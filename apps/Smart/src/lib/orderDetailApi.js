import { supabase } from "../../../../lib/supabase-client.js";

const nowISO = () => new Date().toISOString();

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function changedByLabel(employeeName) {
  const n = String(employeeName || "").trim();
  return n ? `Web · ${n}` : "Web";
}

export async function fetchOrder(orderId, tenantId) {
  let q = supabase.from("order").select("*").eq("id", orderId);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchTenant(tenantId) {
  if (!tenantId) return null;
  const { data } = await supabase.from("tenant").select("*").eq("id", tenantId).maybeSingle();
  return data || null;
}

export async function changeStatusRpc(orderId, newStatus, changedBy, visibleToCustomer = true, { resetNotRepairable = true } = {}) {
  const { error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_changed_by: changedBy,
    p_visible_to_customer: visibleToCustomer,
  });
  if (error) throw error;
  if ((newStatus === "not_repairable" || newStatus === "cancelled") && resetNotRepairable) {
    await patchOrder(orderId, { not_repairable_resolved_at: null }).catch(() => {});
  }
}

export async function patchOrder(orderId, fields, { touchUpdated = true } = {}) {
  const body = touchUpdated ? { ...fields, updated_date: nowISO() } : { ...fields };
  const { error } = await supabase.from("order").update(body).eq("id", orderId);
  if (error) throw error;
}

async function appendHistory(orderId, entry) {
  const { data, error } = await supabase.from("order").select("status_history").eq("id", orderId).maybeSingle();
  if (error) throw error;
  const history = Array.isArray(data?.status_history) ? data.status_history : [];
  const next = [...history, entry];
  const { error: upErr } = await supabase.from("order").update({ status_history: next }).eq("id", orderId);
  if (upErr) throw upErr;
  return next;
}

export const ACTIVITY_LABELS = {
  call: "Llamada al cliente",
  sms: "SMS enviado al cliente",
  whatsapp: "WhatsApp abierto",
  email: "Email enviado al cliente",
  note: "Nota",
  photo: "Foto subida",
  internal_note: "Pendiente interno",
  customer_advisory: "Aviso al cliente",
};

export function logActivity(orderId, kind, by, note) {
  return appendHistory(orderId, {
    status: null,
    timestamp: nowISO(),
    changed_by: by,
    note: note || ACTIVITY_LABELS[kind] || "",
    visible_to_customer: false,
    kind,
  });
}

export function addInternalNote(orderId, text, by, status = null) {
  return appendHistory(orderId, {
    status: status || null,
    timestamp: nowISO(),
    changed_by: by,
    note: text,
    visible_to_customer: false,
    kind: "internal_note",
    note_id: newId(),
  });
}

export function addCustomerAdvisory(orderId, text, by) {
  return addCustomerAdvisories(orderId, [text], by);
}

export async function addCustomerAdvisories(orderId, texts, by) {
  const list = (texts || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!list.length) return null;
  const { data, error } = await supabase.from("order").select("status_history").eq("id", orderId).maybeSingle();
  if (error) throw error;
  const history = Array.isArray(data?.status_history) ? data.status_history : [];
  const ts = nowISO();
  const next = [...history, ...list.map((note) => ({
    status: null,
    timestamp: ts,
    changed_by: by,
    note,
    visible_to_customer: false,
    kind: "customer_advisory",
  }))];
  const { error: upErr } = await supabase.from("order").update({ status_history: next }).eq("id", orderId);
  if (upErr) throw upErr;
  return next;
}

export async function deleteInternalNote(orderId, noteId) {
  const { data, error } = await supabase.from("order").select("status_history").eq("id", orderId).maybeSingle();
  if (error) throw error;
  const history = Array.isArray(data?.status_history) ? data.status_history : [];
  const next = history.filter((e) => e?.note_id !== noteId);
  const { error: upErr } = await supabase.from("order").update({ status_history: next }).eq("id", orderId);
  if (upErr) throw upErr;
}

export function softDeleteOrder(orderId) {
  return patchOrder(orderId, { is_deleted: true });
}

export function assignTechnician(orderId, employee) {
  return patchOrder(
    orderId,
    { assigned_to: employee?.id || null, assigned_to_name: employee?.full_name || null },
    { touchUpdated: false }
  );
}

const KNOWN_ROLES = ["owner", "admin", "manager", "contable", "cashier", "technician"];

export function normalizeRoles(employee) {
  const parse = (r) => {
    const v = String(r || "").trim().toLowerCase();
    return KNOWN_ROLES.includes(v) ? v : null;
  };
  const parsed = [...new Set((Array.isArray(employee?.roles) ? employee.roles : []).map(parse).filter(Boolean))];
  if (parsed.length) return parsed;
  const single = parse(employee?.role);
  return single ? [single] : ["technician"];
}

export async function fetchTechnicians(tenantId) {
  const { data, error } = await supabase
    .from("app_employee")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data || []).filter((e) => normalizeRoles(e).includes("technician"));
}

export async function hasLinkedPurchaseLines(tenantId, orderId) {
  const pageSize = 500;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("purchase_order")
      .select("id,status,line_items")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    const hit = rows.some((po) => String(po.status || "").toLowerCase() !== "cancelled"
      && (Array.isArray(po.line_items) ? po.line_items : []).some((l) => l && l.linked_work_order_id === orderId && l.is_tool !== true));
    if (hit) return true;
    if (rows.length < pageSize) return false;
    from += pageSize;
  }
}

export async function findUndiagnosedForTech(tenantId, techId, exceptOrderId) {
  const { data } = await supabase
    .from("order")
    .select("id,order_number")
    .eq("tenant_id", tenantId)
    .eq("assigned_to", techId)
    .in("status", ["intake", "diagnosing"])
    .eq("is_deleted", false)
    .limit(5);
  return (data || []).find((o) => o.id !== exceptOrderId) || null;
}

export async function findOlderUndiagnosed(order) {
  if (!order?.created_date) return null;
  const { data } = await supabase
    .from("order")
    .select("id,order_number")
    .eq("tenant_id", order.tenant_id)
    .in("status", ["intake", "diagnosing"])
    .eq("is_deleted", false)
    .eq("is_quick_service", false)
    .lt("created_date", order.created_date)
    .order("created_date", { ascending: true })
    .limit(1);
  return data?.[0] || null;
}

export async function countPreviousOrders(order) {
  let q = supabase.from("order").select("id").eq("tenant_id", order.tenant_id).eq("is_deleted", false).limit(100);
  if (order.customer_id) q = q.eq("customer_id", order.customer_id);
  else if (order.customer_name) q = q.eq("customer_name", order.customer_name);
  else return 0;
  const { data } = await q;
  return (data || []).filter((o) => o.id !== order.id).length;
}

export async function fetchCustomerOrders(order) {
  let q = supabase.from("order").select("*").eq("tenant_id", order.tenant_id).eq("is_deleted", false).order("created_date", { ascending: false }).limit(100);
  if (order.customer_id) q = q.eq("customer_id", order.customer_id);
  else if (order.customer_name) q = q.eq("customer_name", order.customer_name);
  else return [];
  const { data } = await q;
  return (data || []).filter((o) => o.id !== order.id);
}

export async function fetchOrderEmails(tenantId, orderNumber) {
  if (!orderNumber) return [];
  const { data } = await supabase
    .from("email_log")
    .select("id,to_email,subject,body_html,status,sent_at,created_at,error_message")
    .eq("tenant_id", tenantId)
    .ilike("subject", `%${orderNumber}%`)
    .order("created_at", { ascending: false })
    .limit(50);
  const re = new RegExp(`${orderNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`);
  return (data || []).filter((e) => re.test(e.subject || ""));
}

export async function openCashRegister(tenantId) {
  const { data } = await supabase.from("cash_register").select("id,status,opened_by").eq("tenant_id", tenantId).eq("status", "open").limit(1);
  return data?.[0] || null;
}

export function setQuickService(orderId, value) {
  return patchOrder(orderId, { is_quick_service: !!value }, { touchUpdated: false });
}

export async function resolveApprovalInPerson(orderId, approved, by) {
  await patchOrder(orderId, { customer_approval_status: approved ? "approved" : "rejected" }, { touchUpdated: false });
  await addInternalNote(orderId, approved ? "Cliente aprobó la cotización en persona" : "Cliente rechazó la cotización en persona", by);
}

export function setNotRepairableResolved(orderId) {
  return patchOrder(orderId, { not_repairable_resolved_at: nowISO() });
}

export function confirmPropertyClaim(orderId) {
  return patchOrder(orderId, { property_claimed_at: nowISO() }, { touchUpdated: false });
}

export function deferPropertyClaim(orderId) {
  const until = new Date(Date.now() + 15 * 86400000).toISOString();
  return patchOrder(orderId, { property_claim_ready_at: null, property_claim_deferred_until: until }, { touchUpdated: false });
}

export function markPaidNoCharge(order) {
  return patchOrder(order.id, { amount_paid: Number(order.amount_paid || 0), balance_due: 0, paid: true });
}

export async function resolveCurrentEmployee(tenantId) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user || !tenantId) return null;
  const base = () => supabase.from("app_employee").select("*").eq("tenant_id", tenantId);
  let { data } = await base().eq("id", user.id).limit(1);
  if (data?.[0]) return data[0];
  ({ data } = await base().eq("auth_user_id", user.id).limit(1));
  if (data?.[0]) return data[0];
  if (user.email) {
    ({ data } = await base().ilike("email", user.email).order("created_at", { ascending: true }).limit(1));
    if (data?.[0]) return data[0];
  }
  let role = "";
  try {
    role = localStorage.getItem("smartfix_tenant_role") || "";
  } catch {
    role = "";
  }
  if (role === "owner") {
    ({ data } = await base().contains("roles", ["owner"]).limit(1));
    if (data?.[0]) return data[0];
    ({ data } = await base().eq("role", "owner").limit(1));
    if (data?.[0]) return data[0];
  }
  return { id: null, full_name: user.user_metadata?.full_name || user.email || "", email: user.email, roles: role ? [role] : [] };
}

export function subscribeToOrder(tenantId, orderId, onChange) {
  const channel = supabase
    .channel(`order-detail-${orderId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "order", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
      const rec = payload.new || payload.old;
      if (rec?.id === orderId) onChange(payload);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

async function resizeToJpeg(file, maxDim, quality) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la foto"))), "image/jpeg", quality);
  });
}

function thumbPath(path) {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? `${path}_thumb` : `${path.slice(0, dot)}_thumb${path.slice(dot)}`;
}

export function photoThumbCandidate(url) {
  if (!url) return url;
  return thumbPath(url);
}

let photoWriteQueue = Promise.resolve();

function enqueuePhotoWrite(task) {
  const run = photoWriteQueue.then(task, task);
  photoWriteQueue = run.catch(() => undefined);
  return run;
}

async function uploadOne(order, file, idx) {
  const main = await resizeToJpeg(file, 1800, 0.82);
  const path = `tenants/${order.tenant_id}/orders/${order.order_number || order.id}/photo_${idx}_${newId()}.jpg`;
  const bucket = supabase.storage.from("uploads");
  const { error } = await bucket.upload(path, main, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  await resizeToJpeg(file, 480, 0.6)
    .then((small) => bucket.upload(thumbPath(path), small, { contentType: "image/jpeg", upsert: true }))
    .catch(() => null);
  return bucket.getPublicUrl(path).data.publicUrl;
}

export async function uploadOrderPhotos(order, files, { status, by }) {
  const list = Array.from(files || []);
  const results = await Promise.allSettled(list.map((f, i) => uploadOne(order, f, i)));
  const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = list.filter((_, i) => results[i].status === "rejected");
  if (urls.length) {
    await enqueuePhotoWrite(async () => {
      const { data, error } = await supabase.from("order").select("device_photos,photos_metadata").eq("id", order.id).maybeSingle();
      if (error) throw error;
      const photos = Array.isArray(data?.device_photos) ? data.device_photos : [];
      const meta = Array.isArray(data?.photos_metadata) ? data.photos_metadata : [];
      const taken = nowISO();
      const fresh = urls.filter((u) => !photos.includes(u));
      await patchOrder(order.id, {
        device_photos: [...photos, ...fresh],
        photos_metadata: [...meta, ...fresh.map((u) => ({ url: u, status: status || order.status, taken_at: taken, by: by || "Web" }))],
      });
      await logActivity(order.id, "photo", by, fresh.length === 1 ? "Foto subida" : `${fresh.length} fotos subidas`);
    });
  }
  return { uploaded: urls.length, failed };
}

export async function deleteOrderPhoto(orderId, url) {
  return enqueuePhotoWrite(async () => {
    const { data, error } = await supabase.from("order").select("device_photos,photos_metadata").eq("id", orderId).maybeSingle();
    if (error) throw error;
    await patchOrder(orderId, {
      device_photos: (data?.device_photos || []).filter((u) => u !== url),
      photos_metadata: (data?.photos_metadata || []).filter((m) => m?.url !== url),
    });
  });
}

export function deleteAllOrderPhotos(orderId) {
  return enqueuePhotoWrite(() => patchOrder(orderId, { device_photos: [], photos_metadata: [] }));
}

export function repairEvidence(order) {
  const meta = Array.isArray(order?.photos_metadata) ? order.photos_metadata : [];
  const since = order?.last_reopen_at ? new Date(order.last_reopen_at).getTime() : null;
  return meta.filter((m) => m?.url && (m.status === "in_progress" || m.status === "ready_for_pickup"))
    .filter((m) => !since || (m.taken_at && new Date(m.taken_at).getTime() >= since));
}
