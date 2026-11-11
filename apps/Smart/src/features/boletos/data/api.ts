import { supabase } from "../../../../../../lib/supabase-client.js";
import { dataClient } from "@/components/api/dataClient";
import { changeStatusRpc, changedByLabel, fetchOrder, fetchTenant, resolveCurrentEmployee, addInternalNote, uploadOrderPhotos } from "@/lib/orderDetailApi";
import { sendStatusEmail, isMailableStatus } from "@/lib/orderEmails";
import { subscribeOrders } from "@/lib/inicioApi";
import { analyzeDamagePhoto, findDuplicateByPhone, insertCustomer, loadTechnicians, nextOrderNumber, resizeJpeg, searchCustomers, thumbPath } from "@/lib/wizard/api";
import { findOpenRegister, listDeposits, recordOrderPayment, tenantPaymentMethods } from "@/lib/orderMoneyApi";
import { sendPaymentReceipt } from "@/lib/orderEmails";
import { CLOSED_KEYS } from "../domain/statuses";
import { assertStatusKey } from "../domain/transitions";
import {
  buildOrderPayload, customerFullName, effectiveChecklistNote, effectiveDepositCents, UPSERT_OPTIONS,
} from "../domain/newTicket";
import { alreadyDeposited, depositDecision, depositWarning } from "../domain/quote";
import type { DepositMethod, RegisterState } from "../domain/quote";
import { hintsFromAnalysis } from "../domain/problems";
import { buildTechnicians } from "../domain/technicians";
import type { Technician } from "../domain/technicians";
import type { NewTicketDraft } from "../domain/newTicket";
import type { OrderRow } from "../domain/types";

const LIST_FIELDS = [
  "id", "tenant_id", "order_number", "created_date", "updated_date", "status", "status_note", "customer_id", "customer_name",
  "customer_phone", "customer_email", "device_type", "device_brand", "device_family", "device_model", "device_serial",
  "initial_problem", "is_quick_service", "is_deleted", "promised_date", "appointment_at", "service_type", "cost_estimate",
  "labor_cost", "amount_paid", "balance_due", "priority", "warranty_claim", "liquid_damage", "assigned_to_name", "not_repairable_resolved_at",
];

const sendEmail = sendStatusEmail as (args: { order: OrderRow; tenant: unknown; status: string }) => Promise<unknown>;
const saveNote = addInternalNote as (id: string, text: string, by: string, status?: string | null) => Promise<unknown>;

type Conditions = Record<string, unknown>;

async function fetchRows(conditions: Conditions, limit: number): Promise<OrderRow[]> {
  try {
    return (await dataClient.entities.Order.filter(conditions, "-updated_date", limit, null, LIST_FIELDS)) as OrderRow[];
  } catch {
    return (await dataClient.entities.Order.filter(conditions, "-updated_date", limit)) as OrderRow[];
  }
}

export function activeTenantId(): string {
  try {
    return localStorage.getItem("smartfix_tenant_id") || "";
  } catch {
    return "";
  }
}

function mergeRows(...lists: OrderRow[][]): OrderRow[] {
  const seen = new Map<string, OrderRow>();
  for (const list of lists) for (const o of list ?? []) if (o?.id && !seen.has(o.id)) seen.set(o.id, o);
  return [...seen.values()];
}

export async function listOrders(): Promise<OrderRow[]> {
  const [recent, open] = await Promise.all([
    fetchRows({ is_deleted: false }, 500),
    fetchRows({ is_deleted: false, status: { $nin: CLOSED_KEYS } }, 2000).catch(() => [] as OrderRow[]),
  ]);
  return mergeRows(recent, open);
}

export async function listClosed(limit: number): Promise<OrderRow[]> {
  return fetchRows({ is_deleted: false, status: { $in: CLOSED_KEYS } }, limit);
}

export async function searchOrders(query: string): Promise<OrderRow[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const like = { $ilike: `%${q}%` };
  return fetchRows(
    { is_deleted: false, $or: [{ order_number: like }, { customer_name: like }, { customer_phone: like }, { customer_email: like }, { device_model: like }, { device_serial: like }] },
    80,
  );
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  return (await fetchOrder(id, activeTenantId() || undefined)) as OrderRow | null;
}

export function watchOrders(onChange: () => void): () => void {
  const tid = activeTenantId();
  if (!tid) return () => {};
  return subscribeOrders(tid, onChange) as () => void;
}

export interface SessionInfo {
  tenant: Record<string, unknown> | null;
  employeeName: string;
  employeeId?: string;
}

export async function loadSession(): Promise<SessionInfo> {
  const tid = activeTenantId();
  if (!tid) return { tenant: null, employeeName: "" };
  const [tenant, employee] = await Promise.all([fetchTenant(tid).catch(() => null), resolveCurrentEmployee(tid).catch(() => null)]);
  return {
    tenant: tenant as Record<string, unknown> | null,
    employeeName: String(employee?.full_name ?? "").trim(),
    employeeId: employee?.id ? String(employee.id) : undefined,
  };
}

export async function changeStatus(order: OrderRow, next: string, session: SessionInfo): Promise<OrderRow> {
  const target = assertStatusKey(next);
  if (order.status === target) return order;
  await changeStatusRpc(order.id, target, changedByLabel(session.employeeName), true);
  const fresh = (await getOrder(order.id).catch(() => null)) ?? { ...order, status: target };
  if (session.tenant && isMailableStatus(target) && String(fresh.customer_email ?? "").trim()) {
    sendEmail({ order: { ...fresh, status: target }, tenant: session.tenant, status: target }).catch(() => {});
  }
  return fresh;
}

export async function addNote(order: OrderRow, text: string, session: SessionInfo): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  await saveNote(order.id, clean, changedByLabel(session.employeeName), order.status ?? null);
}

export async function uploadDetailPhotos(order: OrderRow, files: FileList, session: SessionInfo): Promise<{ uploaded: number; failed: number }> {
  const res = await uploadOrderPhotos(order, files, { status: order.status, by: changedByLabel(session.employeeName) });
  return { uploaded: Number(res?.uploaded ?? 0), failed: Array.isArray(res?.failed) ? res.failed.length : 0 };
}

export interface CreateProgress {
  customerId?: string;
  orderNumber?: string;
}

export interface CreateResult {
  order: OrderRow;
  duplicate: boolean;
  warnings: string[];
}

export interface CustomerHit {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  isB2b: boolean;
}

const toHit = (c: Record<string, unknown>): CustomerHit => ({
  id: String(c.id),
  name: String(c.name ?? ""),
  phone: String(c.phone ?? ""),
  email: String(c.email ?? ""),
  company: String(c.company_name ?? ""),
  isB2b: c.is_b2b === true,
});

export async function searchExistingCustomers(query: string): Promise<CustomerHit[]> {
  const tenant = activeTenantId();
  if (!tenant || query.trim().length < 3) return [];
  const rows = (await searchCustomers(tenant, query)) as Record<string, unknown>[];
  return rows.slice(0, 8).map(toHit);
}

export async function loadTechnicianList(): Promise<Technician[]> {
  const tenant = activeTenantId();
  if (!tenant) return [];
  const res = (await loadTechnicians(tenant)) as { employees: { id?: string; full_name?: string | null; email?: string | null }[]; counts: Record<string, number> };
  return buildTechnicians(res.employees, res.counts);
}

export async function loadPaymentMethods(tenant: Record<string, unknown> | null): Promise<DepositMethod[]> {
  const built = (tenantPaymentMethods(tenant) as { builtIns: string[] }).builtIns;
  const list = built.filter((m): m is DepositMethod => m === "cash" || m === "card" || m === "ath_movil");
  return list.length ? list : ["cash"];
}

export async function registerState(): Promise<RegisterState> {
  const tenant = activeTenantId();
  if (!tenant) return "unknown";
  try {
    const res = (await findOpenRegister(tenant)) as { failOpen?: boolean; register?: unknown };
    if (res.failOpen) return "unknown";
    return res.register ? "open" : "closed";
  } catch {
    return "unknown";
  }
}

export async function analyzeReference(file: File, hint: string): Promise<{ hints: string[]; diagnosis: string }> {
  const res = (await analyzeDamagePhoto(file, hint)) as { diagnosis: string; category: string };
  return { hints: hintsFromAnalysis(res.category, res.diagnosis), diagnosis: res.diagnosis };
}

async function uploadPhotos(tenantId: string, orderNumber: string, draftId: string, files: File[]): Promise<string[]> {
  if (!files.length) return [];
  const bucket = supabase.storage.from("uploads");
  const urls = await Promise.all(
    files.map(async (file, i) => {
      const path = `tenants/${tenantId}/orders/${orderNumber}/photo_${draftId}_${i}.jpg`;
      const main = await resizeJpeg(file, 1800, 0.82);
      const { error } = await bucket.upload(path, main, { contentType: "image/jpeg", upsert: true });
      if (error) return null;
      resizeJpeg(file, 480, 0.6)
        .then((small: Blob) => bucket.upload(thumbPath(path), small, { contentType: "image/jpeg", upsert: true }))
        .catch(() => {});
      return bucket.getPublicUrl(path).data.publicUrl as string;
    }),
  );
  const ok = urls.filter((u): u is string => !!u);
  if (ok.length !== files.length) throw new Error("No se pudieron guardar las fotos del equipo. El boleto no se creó para no perder la evidencia; revisa la conexión e intenta de nuevo.");
  return ok;
}

async function uploadSignature(tenantId: string, orderNumber: string, draftId: string, blob: Blob): Promise<string> {
  const path = `tenants/${tenantId}/orders/${orderNumber}/signature_${draftId}.png`;
  const bucket = supabase.storage.from("uploads");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { error } = await bucket.upload(path, blob, { contentType: "image/png", upsert: true });
    if (!error) return bucket.getPublicUrl(path).data.publicUrl as string;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("No se pudo guardar la firma del cliente. El boleto no se creó para no perder la autorización; revisa la conexión e intenta de nuevo.");
}

async function resolveCustomer(tenantId: string, d: NewTicketDraft): Promise<{ id: string | null; created: boolean }> {
  if (d.customerId) return { id: d.customerId, created: false };
  if (d.phone.trim()) {
    const dup = await findDuplicateByPhone(tenantId, d.phone).catch(() => null);
    if (dup?.id) return { id: dup.id as string, created: false };
  }
  if (!d.firstName.trim()) return { id: null, created: false };
  const created = await insertCustomer(tenantId, {
    name: d.firstName,
    lastName: d.lastName,
    phone: d.phone.trim(),
    email: d.email.trim(),
    language: "es",
    ...(d.business.enabled
      ? { isB2b: true, companyName: d.business.companyName.trim(), taxId: d.business.taxId.trim(), billingEmail: d.business.billingEmail.trim().toLowerCase() }
      : {}),
  });
  return { id: (created?.id as string) ?? null, created: true };
}

async function patchBusiness(tenantId: string, customerId: string, d: NewTicketDraft): Promise<void> {
  const body: Record<string, unknown> = { is_b2b: true, company_name: d.business.companyName.trim() };
  if (d.business.taxId.trim()) body.tax_id = d.business.taxId.trim();
  if (d.business.billingEmail.trim()) body.billing_email = d.business.billingEmail.trim().toLowerCase();
  const { error } = await supabase.from("customer").update(body).eq("id", customerId).eq("tenant_id", tenantId);
  if (error) throw error;
}

async function collectDeposit(order: OrderRow, d: NewTicketDraft, session: SessionInfo): Promise<string | null> {
  const cents = effectiveDepositCents(d);
  if (cents <= 0) return null;
  const state = await registerState();
  const action = depositDecision(cents, state);
  if (action !== "collect") return depositWarning(action, cents);
  const existing = (await listDeposits(order.id).catch(() => [])) as { amount?: number | string }[];
  if (alreadyDeposited(existing.map((t) => Number(t.amount) || 0), cents)) return null;
  const by = changedByLabel(session.employeeName);
  const res = (await recordOrderPayment({ order, amount: cents / 100, method: d.depositMethod, customLabel: null, by })) as { applied: number; isPaidNow: boolean; transactionId: string | null };
  if (session.tenant && order.customer_email && res.applied > 0) {
    sendPaymentReceipt({ order, tenant: session.tenant, amount: res.applied, method: d.depositMethod, isFull: res.isPaidNow, transactionId: res.transactionId }).catch(() => {});
  }
  return null;
}

export async function createTicket(
  draft: NewTicketDraft,
  files: File[],
  session: SessionInfo,
  onProgress: (p: CreateProgress) => void,
  signature: Blob | null = null,
): Promise<CreateResult> {
  const tenantId = activeTenantId();
  if (!tenantId) throw new Error("No se encontró el taller activo. Vuelve a iniciar sesión.");
  const { id: customerId, created: customerCreated } = await resolveCustomer(tenantId, draft);
  if (customerId && customerId !== draft.customerId) onProgress({ customerId });
  let orderNumber = draft.orderNumber;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!orderNumber) {
      orderNumber = String(await nextOrderNumber(tenantId));
      onProgress({ orderNumber });
    }
    const photoUrls = await uploadPhotos(tenantId, orderNumber, draft.id, files);
    const wantsSignature = draft.signatureOn && draft.signed && draft.mode === "repair";
    const signatureUrl = wantsSignature && signature ? await uploadSignature(tenantId, orderNumber, draft.id, signature) : null;
    if (wantsSignature && !signatureUrl) throw new Error("Falta la firma del cliente. Pídele que firme de nuevo.");
    const payload = buildOrderPayload(draft, {
      tenantId,
      orderNumber,
      customerName: customerFullName(draft) || "Cliente",
      customerId,
      createdByName: session.employeeName,
      photoUrls,
      signatureUrl,
    });
    const { data, error } = await supabase.from("order").upsert(payload, UPSERT_OPTIONS).select("*");
    if (!error) {
      const inserted = Array.isArray(data) && data.length > 0;
      let order = (inserted ? data[0] : await getOrder(draft.id)) as OrderRow | null;
      if (!order) throw new Error("El boleto no aparece después de crearlo. Revisa la lista antes de intentar otra vez.");
      const warnings: string[] = [];
      if (inserted && session.tenant && order.customer_email && isMailableStatus("intake")) {
        sendEmail({ order, tenant: session.tenant, status: "intake" }).catch(() => {});
      }
      if (customerId && draft.business.enabled && !customerCreated) {
        await patchBusiness(tenantId, customerId, draft).catch(() => warnings.push("No se pudieron guardar los datos de la empresa en el cliente."));
      }
      const note = effectiveChecklistNote(draft);
      if (inserted && note) await addNote(order, note, session).catch(() => warnings.push("No se pudo guardar la revisión del equipo en el historial."));
      try {
        const warn = await collectDeposit(order, draft, session);
        if (warn) warnings.push(warn);
        else if (effectiveDepositCents(draft) > 0) order = ((await getOrder(order.id).catch(() => null)) ?? order) as OrderRow;
      } catch (e) {
        warnings.push(`No se pudo cobrar el depósito: ${e instanceof Error ? e.message : "error desconocido"}. Cóbralo desde el boleto.`);
      }
      return { order, duplicate: !inserted, warnings };
    }
    if (error.code === "23505" && attempt < 2) {
      orderNumber = null;
      continue;
    }
    throw error;
  }
  throw new Error("No se pudo asignar un número de boleto. Intenta de nuevo.");
}
