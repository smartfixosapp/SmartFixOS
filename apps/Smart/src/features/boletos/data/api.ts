import { supabase } from "../../../../../../lib/supabase-client.js";
import { dataClient } from "@/components/api/dataClient";
import { changeStatusRpc, changedByLabel, fetchOrder, fetchTenant, resolveCurrentEmployee, addInternalNote, uploadOrderPhotos } from "@/lib/orderDetailApi";
import { sendStatusEmail, isMailableStatus } from "@/lib/orderEmails";
import { subscribeOrders } from "@/lib/inicioApi";
import { findDuplicateByPhone, insertCustomer, nextOrderNumber, resizeJpeg, thumbPath } from "@/lib/wizard/api";
import { CLOSED_KEYS } from "../domain/statuses";
import { assertStatusKey } from "../domain/transitions";
import { buildOrderPayload, customerFullName, UPSERT_OPTIONS } from "../domain/newTicket";
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
}

export async function loadSession(): Promise<SessionInfo> {
  const tid = activeTenantId();
  if (!tid) return { tenant: null, employeeName: "" };
  const [tenant, employee] = await Promise.all([fetchTenant(tid).catch(() => null), resolveCurrentEmployee(tid).catch(() => null)]);
  return { tenant: tenant as Record<string, unknown> | null, employeeName: String(employee?.full_name ?? "").trim() };
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

async function resolveCustomer(tenantId: string, d: NewTicketDraft): Promise<string | null> {
  if (d.customerId) return d.customerId;
  if (d.phone.trim()) {
    const dup = await findDuplicateByPhone(tenantId, d.phone).catch(() => null);
    if (dup?.id) return dup.id as string;
  }
  if (!d.firstName.trim()) return null;
  const created = await insertCustomer(tenantId, {
    name: d.firstName,
    lastName: d.lastName,
    phone: d.phone.trim(),
    email: d.email.trim(),
    language: "es",
  });
  return (created?.id as string) ?? null;
}

export async function createTicket(
  draft: NewTicketDraft,
  files: File[],
  session: SessionInfo,
  onProgress: (p: CreateProgress) => void,
): Promise<CreateResult> {
  const tenantId = activeTenantId();
  if (!tenantId) throw new Error("No se encontró el taller activo. Vuelve a iniciar sesión.");
  const customerId = await resolveCustomer(tenantId, draft);
  if (customerId && customerId !== draft.customerId) onProgress({ customerId });
  let orderNumber = draft.orderNumber;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!orderNumber) {
      orderNumber = String(await nextOrderNumber(tenantId));
      onProgress({ orderNumber });
    }
    const photoUrls = await uploadPhotos(tenantId, orderNumber, draft.id, files);
    const payload = buildOrderPayload(draft, {
      tenantId,
      orderNumber,
      customerName: customerFullName(draft) || "Cliente",
      customerId,
      createdByName: session.employeeName,
      photoUrls,
    });
    const { data, error } = await supabase.from("order").upsert(payload, UPSERT_OPTIONS).select("*");
    if (!error) {
      const inserted = Array.isArray(data) && data.length > 0;
      const order = (inserted ? data[0] : await getOrder(draft.id)) as OrderRow | null;
      if (!order) throw new Error("El boleto no aparece después de crearlo. Revisa la lista antes de intentar otra vez.");
      if (inserted && session.tenant && order.customer_email && isMailableStatus("intake")) {
        sendEmail({ order, tenant: session.tenant, status: "intake" }).catch(() => {});
      }
      return { order, duplicate: !inserted };
    }
    if (error.code === "23505" && attempt < 2) {
      orderNumber = null;
      continue;
    }
    throw error;
  }
  throw new Error("No se pudo asignar un número de boleto. Intenta de nuevo.");
}
