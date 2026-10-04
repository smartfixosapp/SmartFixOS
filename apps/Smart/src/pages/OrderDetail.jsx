import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, MessageSquare, Pencil, MoreHorizontal, Trash2, Zap, Info, History, Check, X, AlertTriangle, Loader2, Hand, CalendarClock } from "lucide-react";
import { statusInfo } from "@/lib/orderStatus";
import { hiddenStatusesOf } from "@/lib/tenantSettings";
import {
  fetchOrder, fetchTenant, changeStatusRpc, patchOrder, logActivity, addInternalNote, addCustomerAdvisories,
  normalizeRoles, deleteInternalNote, softDeleteOrder, assignTechnician, fetchTechnicians, findUndiagnosedForTech,
  findOlderUndiagnosed, countPreviousOrders, fetchCustomerOrders, fetchOrderEmails, setQuickService,
  resolveApprovalInPerson, setNotRepairableResolved, confirmPropertyClaim, deferPropertyClaim,
  resolveCurrentEmployee, subscribeToOrder, changedByLabel, uploadOrderPhotos, deleteOrderPhoto,
  deleteAllOrderPhotos, repairEvidence, markPaidNoCharge,
} from "@/lib/orderDetailApi";
import {
  scheduleStatusEmail, cancelScheduledEmail, sendStatusEmail, sendOrderUpdate, isMailableStatus,
  remainingBalance, sendAbandonmentNotice, sendReviewRequest, sendRawEmail, renderOrderEmailHTML,
  tenantEmailFromName, orderTotal, sendPaymentReceipt, sendRefundReceipt,
} from "@/lib/orderEmails";
import { C, tint, Card, Sheet, ConfirmSheet, money, displayDevice, phoneDigits, firstName } from "@/components/orderDetail/ui";
import { buildCancelPlan, applyCancelPlan, doneMessage } from "@/lib/orderCancellation";
import CancelPartsSheet from "@/components/orderDetail/CancelPartsSheet";
import POSheet from "@/components/orderDetail/POSheet";
import HeaderCard from "@/components/orderDetail/HeaderCard";
import StatusModule from "@/components/orderDetail/StatusModule";
import InfoSections, { RatingCard, QuickServiceCard, DeviceCard } from "@/components/orderDetail/InfoSections";
import Timeline from "@/components/orderDetail/Timeline";
import { PhotosCaptureSheet, PhotoGateSheet, PhotoStrip, PhotoViewer } from "@/components/orderDetail/Photos";
import {
  StatusPickerSheet, NoteForChangeSheet, AddNoteSheet, AdvisoriesSheet, NotifySheet, TechPickerSheet,
  CustomerHistorySheet, QueueWarningSheet, TechWarningSheet, EmailViewerSheet,
} from "@/components/orderDetail/Sheets";
import {
  SecuritySheet, PromisedDateSheet, EditOrderSheet, WarrantySheet, ReviewSheet, ConfirmDeliverySheet,
  ReopenSheet, WarrantyReopenSheet,
} from "@/components/orderDetail/Sheets2";
import { CashClosedSheet, CobrarMenuSheet, QuickPaySheet, DepositsSheet, RefundSheet } from "@/components/orderDetail/Money";
import { OpenCashSheet } from "@/components/cash/CashSheets";
import OrderChatSheet from "@/components/orderDetail/OrderChat";
import { PartsModule, JobCostCard } from "@/components/orderDetail/Parts";
import { DocumentsSheet, DocumentShareSheet } from "@/components/orderDetail/Documents";
import ScheduleVisitSheet from "@/components/orderDetail/ScheduleVisit";
import { OrderTasksCard } from "@/components/tareas/Tasks";
import { buildReceiptPDF, buildQuotePDF, printLabel, labelsEnabled } from "@/lib/orderDocs";
import { CloseDraftDialog } from "@/components/compras/PODetail";
import { findOpenRegister, recordOrderPayment, addDeposit, editDeposit, deleteDeposit, recordOrderRefund } from "@/lib/orderMoneyApi";

function useIsDesktop() {
  const q = "(min-width: 768px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setV(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}

function storedTenantId() {
  try {
    return localStorage.getItem("smartfix_tenant_id") || "";
  } catch {
    return "";
  }
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const tenantId = storedTenantId();

  const [order, setOrder] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [costTick, setCostTick] = useState(0);
  const [docBusy, setDocBusy] = useState(null);
  const [docShare, setDocShare] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [emails, setEmails] = useState([]);
  const [prevCount, setPrevCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [banner, setBanner] = useState(null);
  const [tab, setTab] = useState("actions");
  const [sheet, setSheet] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [queueBanner, setQueueBanner] = useState(location.state?.queueMessage || null);
  useEffect(() => {
    if (warrantyParamDone.current || !order) return;
    if (new URLSearchParams(location.search).get("warranty") === "1") {
      warrantyParamDone.current = true;
      setSheet({ name: "warrantyReopen" });
      navigate(location.pathname, { replace: true });
    }
  }, [order, location.search]);
  const [history, setHistory] = useState({ loading: false, orders: [] });
  const [deliveryWarranty, setDeliveryWarranty] = useState(null);
  const [payFlow, setPayFlow] = useState(null);
  const [depositKey, setDepositKey] = useState(0);
  const [openDrawer, setOpenDrawer] = useState(false);
  const pendingGateRef = useRef(null);
  const afterPayDeliverRef = useRef(false);

  const orderRef = useRef(null);
  const busyRef = useRef(false);
  const warrantyAttemptRef = useRef(null);
  const warrantyParamDone = useRef(false);
  const noticeRef = useRef(null);
  const countdownRef = useRef(null);
  const clearTimerRef = useRef(null);
  const skipNoteRef = useRef(null);
  const claimShownRef = useRef(false);
  const expectedStatusRef = useRef(null);

  useEffect(() => { orderRef.current = order; }, [order]);
  useEffect(() => { noticeRef.current = notice; }, [notice]);

  const by = employee?.full_name || "";
  const changedBy = changedByLabel(by);

  const toast = useCallback((text, type = "success") => {
    setBanner({ text, type });
    if (type === "success") setTimeout(() => setBanner((b) => (b?.text === text ? null : b)), 4000);
  }, []);

  const commitOrder = useCallback((o) => {
    orderRef.current = o;
    setOrder(o);
  }, []);

  const attempt = useCallback(async (label, fn) => {
    try {
      await fn();
      return true;
    } catch (e) {
      toast(`${label}: ${e?.message || e}`, "error");
      return false;
    }
  }, [toast]);

  const autoClearNotice = useCallback((ms) => {
    clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setNotice(null), ms);
  }, []);

  const refreshEmails = useCallback(async (o) => {
    const cur = o || orderRef.current;
    if (!cur) return;
    setEmails(await fetchOrderEmails(cur.tenant_id, cur.order_number).catch(() => []));
  }, []);

  const reload = useCallback(async () => {
    try {
      const o = await fetchOrder(orderId, tenantId);
      if (!o || o.is_deleted) {
        navigate("/Orders", { replace: true });
        return null;
      }
      commitOrder(o);
      return o;
    } catch {
      toast("Se guardó el cambio, pero no pudimos refrescar la orden. Recarga para actualizar.", "error");
      return null;
    }
  }, [orderId, tenantId, navigate, toast, commitOrder]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [o, t, emp, techs] = await Promise.all([
        fetchOrder(orderId, tenantId).catch(() => null),
        fetchTenant(tenantId).catch(() => null),
        resolveCurrentEmployee(tenantId).catch(() => null),
        fetchTechnicians(tenantId).catch(() => []),
      ]);
      if (!alive) return;
      if (!o || o.is_deleted) {
        navigate("/Orders", { replace: true });
        return;
      }
      commitOrder(o);
      setTenant(t);
      setEmployee(emp);
      setTechnicians(techs);
      setLoading(false);
      countPreviousOrders(o).then((n) => alive && setPrevCount(n)).catch(() => {});
      refreshEmails(o);
    })();
    return () => { alive = false; };
  }, [orderId, tenantId, navigate, refreshEmails, commitOrder]);

  useEffect(() => {
    if (!tenantId || !orderId) return undefined;
    return subscribeToOrder(tenantId, orderId, (payload) => {
      const incoming = payload.new;
      if (incoming?.status && expectedStatusRef.current && incoming.status !== expectedStatusRef.current && noticeRef.current?.kind === "countdown") {
        clearInterval(countdownRef.current);
        setNotice(null);
      }
      reload();
    });
  }, [tenantId, orderId, reload]);

  useEffect(() => {
    if (!queueBanner) return undefined;
    const t = setTimeout(() => setQueueBanner(null), 8000);
    return () => clearTimeout(t);
  }, [queueBanner]);

  useEffect(() => {
    if (!order || !employee || claimShownRef.current) return;
    if (!order.assigned_to && employee.id && normalizeRoles(employee).includes("technician")) {
      claimShownRef.current = true;
      setSheet({ name: "claim" });
    }
  }, [order, employee]);

  useEffect(() => () => { clearInterval(countdownRef.current); clearTimeout(clearTimerRef.current); }, []);

  const startEmailFlow = useCallback(async (o, newStatus, prevStatus, opts = {}) => {
    if (!isMailableStatus(newStatus) || !tenant) return;
    clearTimeout(clearTimerRef.current);
    const sameOrder = () => orderRef.current?.id === o.id;
    const email = String(o.customer_email || "").trim();
    if (!email) {
      if (String(o.customer_phone || "").trim()) setNotice({ kind: "noEmail", status: newStatus });
      else { setNotice({ kind: "none" }); autoClearNotice(4000); }
      return;
    }
    const undoable = !!prevStatus && prevStatus !== newStatus;
    clearInterval(countdownRef.current);
    let tick = null;
    if (undoable) {
      setNotice({ kind: "countdown", seconds: 5, prev: prevStatus, newStatus, orderId: o.id, prevResolvedAt: opts.prevResolvedAt || null });
      tick = setInterval(() => {
        setNotice((n) => (n?.kind === "countdown" && n.seconds > 1 ? { ...n, seconds: n.seconds - 1 } : n));
      }, 1000);
      countdownRef.current = tick;
    }
    const res = await scheduleStatusEmail(o.id, async () => {
      const fresh = await fetchOrder(o.id).catch(() => null);
      return sendStatusEmail({ order: { ...(fresh || o), status: newStatus }, tenant, status: newStatus, photoScope: opts.photoScope, includeIntakePhotos: opts.includeIntakePhotos });
    });
    if (tick) clearInterval(tick);
    if (res.cancelled || !sameOrder()) return;
    if (res.sent) { setNotice({ kind: "sent", email }); autoClearNotice(3000); }
    else if (res.error) setNotice({ kind: "failed" });
    else if (noticeRef.current?.kind === "countdown" && noticeRef.current?.orderId === o.id) setNotice(null);
    refreshEmails();
  }, [tenant, autoClearNotice, refreshEmails]);

  const changeStatus = useCallback(async (newStatus, opts = {}) => {
    const o = orderRef.current;
    if (!o || busyRef.current) return false;
    busyRef.current = true;
    setSaving(true);
    try {
      if (!opts.bypassQueue && (o.status === "intake" || o.status === "diagnosing") && !o.is_quick_service) {
        const older = await findOlderUndiagnosed(o).catch(() => null);
        if (older) {
          setSheet({ name: "queueWarn", older, retry: () => { setSheet(null); changeStatus(newStatus, { ...opts, bypassQueue: true }); } });
          return false;
        }
      }
      clearInterval(countdownRef.current);
      clearTimeout(clearTimerRef.current);
      if (noticeRef.current) setNotice(null);
      const prev = o.status;
      const prevResolvedAt = o.not_repairable_resolved_at || null;
      if (newStatus !== "delivered") commitOrder({ ...o, status: newStatus });
      expectedStatusRef.current = newStatus;
      try {
        await changeStatusRpc(o.id, newStatus, changedBy, true);
      } catch (e) {
        commitOrder(o);
        toast(`No se pudo cambiar el estado: ${e?.message || e}`, "error");
        return false;
      }
      const fresh = await reload();
      startEmailFlow(fresh || { ...o, status: newStatus }, newStatus, opts.noUndo ? null : prev, { ...opts, prevResolvedAt });
      if (opts.afterSuccess) await opts.afterSuccess(fresh);
      return true;
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }, [changedBy, reload, startEmailFlow, toast, commitOrder]);

  const undo = useCallback(async () => {
    const n = noticeRef.current;
    const o = orderRef.current;
    if (!o || n?.kind !== "countdown" || !n.orderId || n.orderId !== o.id || busyRef.current) return;
    busyRef.current = true;
    clearInterval(countdownRef.current);
    const cancelled = cancelScheduledEmail(n.orderId);
    setNotice(null);
    setSaving(true);
    try {
      expectedStatusRef.current = n.prev;
      await changeStatusRpc(n.orderId, n.prev, by ? `Web · ${by} (deshacer)` : "Web · deshacer", false, { resetNotRepairable: false });
      if (n.prevResolvedAt) await patchOrder(n.orderId, { not_repairable_resolved_at: n.prevResolvedAt }).catch(() => {});
      setNotice({ kind: cancelled ? "undone" : "undoneLate" });
      autoClearNotice(3000);
    } catch (e) {
      toast(`No se pudo deshacer: ${e?.message || e}`, "error");
    }
    await reload();
    busyRef.current = false;
    setSaving(false);
  }, [by, reload, toast, autoClearNotice]);

  const afterRemoteDelivery = useCallback(() => {
    setTimeout(() => setSheet({ name: "warranty", chainReview: true }), 5000);
  }, []);

  const openReviewIfPossible = useCallback(() => {
    const o = orderRef.current;
    const social = tenant?.settings?.social || {};
    if ((o?.customer_phone || o?.customer_email) && (social.google_reviews || social.yelp)) setSheet({ name: "review" });
  }, [tenant]);

  const advance = useCallback(async (next) => {
    const o = orderRef.current;
    if (next === "ready_for_pickup") {
      const ev = repairEvidence(o);
      if (ev.length) {
        await changeStatus("ready_for_pickup", {
          afterSuccess: () => toast(ev.length === 1 ? "Listo para Recoger · 1 foto de prueba" : `Listo para Recoger · ${ev.length} fotos de prueba`),
        });
      } else {
        setSheet({ name: "photoGate", mode: "repairEvidence" });
      }
      return;
    }
    if (o.status === "scheduled" && next === "delivered") {
      await changeStatus("delivered", { afterSuccess: afterRemoteDelivery });
      return;
    }
    await changeStatus(next);
  }, [changeStatus, toast, afterRemoteDelivery]);

  const requireRegister = useCallback(async (action) => {
    const { register, failOpen } = await findOpenRegister(tenantId).catch(() => ({ failOpen: true }));
    if (register || failOpen) {
      Promise.resolve().then(action).catch((e) => toast(`No se pudo completar: ${e?.message || e}`, "error"));
      return;
    }
    pendingGateRef.current = action;
    setSheet({ name: "cashClosed" });
  }, [tenantId, toast]);

  const openQuickPay = useCallback(() => setPayFlow({ name: "quickPay" }), []);

  const deliver = useCallback(() => {
    const o = orderRef.current;
    skipNoteRef.current = null;
    const bal = remainingBalance(o);
    if (bal > 0) {
      afterPayDeliverRef.current = true;
      setPayFlow({ name: "quickPay" });
      return;
    }
    setDeliveryWarranty(o.warranty_days ?? null);
    if (repairEvidence(o).length) setSheet({ name: "confirmDelivery", flowId: Date.now() });
    else setSheet({ name: "photoGate", mode: "deliveryProof" });
  }, []);

  const confirmDelivery = useCallback(async ({ attachPhotos, askReview }) => {
    const o = orderRef.current;
    const w = deliveryWarranty === null || deliveryWarranty === undefined ? null : parseInt(deliveryWarranty, 10);
    const skipNote = skipNoteRef.current;
    await changeStatus("delivered", {
      photoScope: attachPhotos ? { kind: "beforeAfter", includeRepair: false } : { kind: "none" },
      afterSuccess: async () => {
        if (w !== (o.warranty_days ?? null)) await patchOrder(o.id, { warranty_days: w }).catch(() => {});
        if (skipNote) await addInternalNote(o.id, skipNote, by).catch(() => {});
        skipNoteRef.current = null;
        setSheet(null);
        toast("Orden entregada");
        if (askReview) setTimeout(() => setSheet({ name: "review" }), 400);
        reload();
      },
    });
  }, [changeStatus, deliveryWarranty, by, toast, reload]);

  const pickStatus = useCallback(async (raw) => {
    const o = orderRef.current;
    setSheet(null);
    if (raw === "ready_for_pickup" && o.status === "in_progress") { advance("ready_for_pickup"); return; }
    if (raw === "delivered") { deliver(); return; }
    if (raw === "cancelled") {
      if (busyRef.current) return;
      busyRef.current = true;
      setSaving(true);
      let plan;
      try {
        plan = await buildCancelPlan({ orderId: o.id, orderNumber: o.order_number, tenantId: o.tenant_id });
      } catch {
        toast("No se pudieron revisar las piezas de la orden. Intenta de nuevo.", "error");
        return;
      } finally {
        busyRef.current = false;
        setSaving(false);
      }
      if (plan.alreadyCancelled) {
        if (plan.hasPendingWork) { setSheet({ name: "cancelParts", plan }); return; }
        if (orderRef.current?.not_repairable_resolved_at) {
          if (await attempt("No se pudo reabrir la orden", () => patchOrder(orderRef.current.id, { not_repairable_resolved_at: null }))) toast("Orden reabierta");
          await reload();
          return;
        }
        toast("La orden ya está cancelada y no quedan piezas pendientes.");
        return;
      }
      if (plan.isEmpty) { await changeStatus("cancelled"); return; }
      setSheet({ name: "cancelParts", plan });
      return;
    }
    await changeStatus(raw, { afterSuccess: () => setSheet({ name: "noteForChange", status: raw }) });
  }, [advance, deliver, changeStatus, toast, attempt, reload]);

  const confirmCancelParts = useCallback(async (plan) => {
    if (busyRef.current) return;
    setSheet((sh) => (sh?.name === "cancelParts" ? { ...sh, busy: true } : sh));
    let cancelled = plan.alreadyCancelled;
    if (!cancelled) cancelled = await changeStatus("cancelled", { noUndo: true, bypassQueue: true });
    const fresh = await fetchOrder(plan.orderId).catch(() => null);
    if (!cancelled) cancelled = fresh?.status === "cancelled";
    if (!cancelled || (fresh && fresh.status !== "cancelled")) { setSheet(null); if (fresh) await reload(); return; }
    busyRef.current = true;
    setSaving(true);
    let failures;
    try {
      failures = await applyCancelPlan(plan, { tenantId: plan.tenantId || orderRef.current?.tenant_id, employeeName: by });
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
    setSheet(null);
    await reload();
    if (failures.length) toast(`La orden se canceló, pero falta arreglar esto a mano:\n${failures.join("\n")}`, "error");
    else toast(doneMessage(plan));
  }, [changeStatus, reload, by, toast]);

  const stagePill = useCallback(async (key) => {
    const o = orderRef.current;
    if (key === "to_waiting_parts") return changeStatus("waiting_parts");
    if (key === "to_not_repairable") return changeStatus("not_repairable");
    if (key === "to_in_progress") return changeStatus("in_progress");
    if (key === "to_part_arrived") return changeStatus("part_arrived_waiting_device");
    if (key === "review") return setSheet({ name: "review" });
    if (key === "notify") return setSheet({ name: "notify", variant: "general" });
    if (key === "notify_abandoned") return setSheet({ name: "notify", variant: "abandoned" });
    if (key === "charge") return requireRegister(openQuickPay);
    if (key === "resolve_nr") {
      if (await attempt("No se pudo marcar como resuelta", () => setNotRepairableResolved(o.id))) toast("Orden marcada como resuelta");
      return reload();
    }
    if (key === "claimed") {
      await changeStatus("delivered", { afterSuccess: afterRemoteDelivery });
      return undefined;
    }
    if (key === "confirm_property") {
      if (await attempt("No se pudo confirmar", () => confirmPropertyClaim(o.id))) toast("Equipo confirmado como inventario del taller");
      return reload();
    }
    if (key === "defer_property") {
      await attempt("No se pudo posponer", () => deferPropertyClaim(o.id));
      return reload();
    }
    return undefined;
  }, [changeStatus, toast, reload, afterRemoteDelivery, attempt, requireRegister, openQuickPay]);

  const contact = useCallback(async (channel, text, kind) => {
    const o = orderRef.current;
    const phone = phoneDigits(o.customer_phone);
    const msg = text ?? `Hola ${o.customer_name || ""}, te escribimos del taller sobre tu orden ${o.order_number}.`;
    if (channel === "call") window.location.href = `tel:${phone}`;
    if (channel === "sms") window.location.href = `sms:${phone}?&body=${encodeURIComponent(msg)}`;
    if (channel === "whatsapp") window.open(`https://wa.me/${phone.replace(/\+/g, "")}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    await logActivity(o.id, kind || channel, by).catch(() => {});
    reload();
  }, [by, reload]);

  const notifyChannel = useCallback(async (channel) => {
    const o = orderRef.current;
    const variant = sheet?.variant || "general";
    const label = statusInfo(o.status).label;
    const device = displayDevice(o) || "equipo";
    const first = firstName(o.customer_name);
    let text = `Hola ${o.customer_name || ""}, tu orden ${o.order_number} está en estado: ${label}.`;
    if (variant === "ready") {
      const bal = remainingBalance(o);
      text = `Hola ${first}, tu ${device} ya está listo para recoger.${bal > 0.009 ? ` Balance a pagar al recoger: $${bal.toFixed(2)}.` : " Ya está pago en su totalidad."} ¡Gracias por tu confianza!`;
    }
    if (variant === "abandoned") {
      const fee = Number(o.storage_fee_total || 0);
      const daily = Number(tenant?.settings?.abandonment_policy?.daily_fee ?? 3);
      text = `Hola ${first}, tu ${device} sigue sin reclamar en el taller.${fee > 0.009 ? ` Llevas $${fee.toFixed(2)} acumulados en almacenaje ($${daily.toFixed(2)}/día).` : ""} Pasa a recogerlo lo antes posible.`;
    }
    if (channel === "call" || channel === "sms" || channel === "whatsapp") {
      setSheet(null);
      return contact(channel, text);
    }
    if (channel === "mailto") {
      setSheet(null);
      window.location.href = `mailto:${o.customer_email}?subject=${encodeURIComponent(`Tu orden ${o.order_number}`)}&body=${encodeURIComponent(`Hola ${o.customer_name || ""},\n\nActualización de tu orden ${o.order_number}: ${label}.`)}`;
      await logActivity(o.id, "email", by).catch(() => {});
      return reload();
    }
    if (channel === "email") {
      setSheet((s) => ({ ...s, busy: true }));
      try {
        let sent;
        if (variant === "ready") sent = await sendStatusEmail({ order: o, tenant, status: "ready_for_pickup" });
        else if (variant === "abandoned") sent = await sendStatusEmail({ order: o, tenant, status: "abandoned" });
        else sent = await sendOrderUpdate({ order: o, tenant });
        setSheet(null);
        if (sent === false) toast("Plantilla de email desactivada para este estado.", "error");
        else {
          toast(`Email enviado a ${o.customer_email}`);
          await logActivity(o.id, "email", by).catch(() => {});
        }
      } catch (e) {
        setSheet(null);
        toast(`No se pudo enviar email: ${e?.message || e}`, "error");
      }
      refreshEmails();
      return reload();
    }
    return undefined;
  }, [sheet, tenant, by, contact, reload, refreshEmails, toast]);

  const quick = useCallback(async (key) => {
    const o = orderRef.current;
    if (key === "charge") {
      return requireRegister(async () => {
        const cur = orderRef.current;
        if (!cur.paid && orderTotal(cur) === 0) {
          if (await attempt("No se pudo cerrar la orden", () => markPaidNoCharge(cur))) {
            toast("Orden marcada como pagada");
            setBanner({ text: "Orden cerrada sin cobro", type: "success" });
          }
          reload();
          return;
        }
        setPayFlow({ name: "menu" });
      });
    }
    if (key === "photo") return setSheet({ name: "photos" });
    if (key === "note") return setSheet({ name: "addNote" });
    if (key === "notify_ready") return setSheet({ name: "notify", variant: "ready" });
    if (key === "advisories") return setSheet({ name: "advisories" });
    if (key === "abandon_notice") {
      if (!String(o.customer_email || "").trim()) return toast("El cliente no tiene email.", "error");
      try {
        await sendAbandonmentNotice({ order: o, tenant });
        toast(`Aviso de abandono enviado a ${o.customer_email}`);
      } catch (e) {
        toast(`No se pudo enviar: ${e?.message || e}`, "error");
      }
      return refreshEmails();
    }
    if (key === "documents") return setSheet({ name: "documents" });
    if (key === "security") return setSheet({ name: "security" });
    if (key === "tech") return setSheet({ name: "tech" });
    return undefined;
  }, [tenant, toast, reload, refreshEmails, requireRegister, attempt]);

  const payParamDone = useRef(false);
  useEffect(() => {
    if (payParamDone.current || !order || !tenant) return;
    if (new URLSearchParams(location.search).get("pay") === "1") {
      payParamDone.current = true;
      navigate(location.pathname, { replace: true });
      quick("charge");
    }
  }, [order, tenant, location.search, quick]);

  const labelDone = useRef(false);
  useEffect(() => {
    if (labelDone.current || !order || !tenant || !labelsEnabled()) return;
    const created = order.created_date ? new Date(order.created_date).getTime() : 0;
    if (!created || Date.now() - created > 180000) return;
    let printed = false;
    try { printed = sessionStorage.getItem(`label.printed.${order.id}`) === "1"; } catch { printed = false; }
    labelDone.current = true;
    if (printed) return;
    try { sessionStorage.setItem(`label.printed.${order.id}`, "1"); } catch { return; }
    setTimeout(() => printLabel(order, tenant).catch(() => {}), 600);
  }, [order, tenant]);

  const submitPayment = useCallback(async ({ amount, method, customLabel, label }) => {
    const o = orderRef.current;
    const res = await recordOrderPayment({ order: o, amount, method, customLabel, by });
    const fresh = await reload();
    const settled = fresh && orderTotal(fresh) > 0 && remainingBalance(fresh) <= 0.004;
    if (settled) setBanner({ text: `Orden cobrada por ${label}`, type: "success" });
    else { setBanner({ text: `Pago registrado por ${label}`, type: "success" }); toast(`Cobro de ${money(amount)} registrado`); }
    if (fresh && String(fresh.customer_email || "").trim() && tenant) {
      sendPaymentReceipt({ order: fresh, tenant, amount: res.applied, method, isFull: res.isPaidNow, transactionId: res.transactionId })
        .then(() => refreshEmails(), () => refreshEmails());
    }
  }, [by, reload, toast, tenant, refreshEmails]);

  const closeQuickPay = useCallback(() => {
    setPayFlow(null);
    if (afterPayDeliverRef.current) {
      afterPayDeliverRef.current = false;
      const o = orderRef.current;
      const bal = remainingBalance(o);
      if (bal > 0) { toast(`Falta cobrar ${money(bal)} para poder entregar.`, "error"); return; }
      setDeliveryWarranty(o.warranty_days ?? null);
      if (repairEvidence(o).length) setSheet({ name: "confirmDelivery", flowId: Date.now() });
      else setSheet({ name: "photoGate", mode: "deliveryProof" });
    }
  }, [toast]);

  const pickTech = useCallback(async (tech, { bypass = false } = {}) => {
    const o = orderRef.current;
    if (tech && !bypass) {
      const other = await findUndiagnosedForTech(o.tenant_id, tech.id, o.id).catch(() => null);
      if (other) {
        setSheet({ name: "techWarn", orderNumber: other.order_number, retry: () => pickTech(tech, { bypass: true }) });
        return;
      }
    }
    try {
      await assignTechnician(o.id, tech);
      setSheet(null);
    } catch (e) {
      toast(`No se pudo asignar el técnico: ${e?.message || e}`, "error");
    }
    reload();
  }, [reload, toast]);

  const savePhotos = useCallback(async (files, purpose) => {
    const o = orderRef.current;
    setUploading(true);
    try {
      const { uploaded, failed } = await uploadOrderPhotos(o, files, { status: o.status, by });
      if (uploaded) toast(`Fotos subidas (${uploaded})`);
      if (failed.length) {
        toast(failed.length === 1 ? "1 foto no subió. Toca Guardar para reintentar." : `${failed.length} fotos no subieron. Toca Guardar para reintentar.`, "error");
        setSheet({ name: "photos", purpose, retryFiles: failed });
        if (uploaded) await reload();
        return;
      }
      setSheet(null);
      const fresh = await reload();
      if (uploaded && purpose === "repairEvidence") await changeStatus("ready_for_pickup");
      if (uploaded && purpose === "deliveryProof" && fresh) { setDeliveryWarranty(fresh.warranty_days ?? null); setSheet({ name: "confirmDelivery", flowId: Date.now() }); }
    } catch (e) {
      toast(`No se pudieron subir las fotos: ${e?.message || e}`, "error");
    } finally {
      setUploading(false);
    }
  }, [by, toast, reload, changeStatus]);

  const skipPhoto = useCallback(async (mode) => {
    const o = orderRef.current;
    const who = by || "Usuario sin nombre";
    const text = `${who} marco la orden como ${mode === "repairEvidence" ? "Listo para Recoger" : "Entregado"} sin tomar la foto que pide el sistema.`;
    setSheet(null);
    if (mode === "repairEvidence") {
      await addInternalNote(o.id, text, who).catch(() => {});
      await changeStatus("ready_for_pickup", { afterSuccess: () => toast("Listo para Recoger · sin foto, quedó anotado") });
      return;
    }
    skipNoteRef.current = text;
    setDeliveryWarranty(o.warranty_days ?? null);
    setSheet({ name: "confirmDelivery", flowId: Date.now() });
  }, [by, changeStatus, toast]);

  const sendReview = useCallback(async (channel, platform) => {
    const o = orderRef.current;
    const shop = tenant?.name || "nosotros";
    const text = `¡Hola ${o.customer_name || ""}! Gracias por confiar en ${shop}. Si tienes un momento, nos ayudaría mucho que dejaras una reseña: ${platform.url}`;
    setSheet(null);
    if (channel === "email") {
      try {
        await sendReviewRequest({ order: o, tenant, reviewUrl: platform.url, platformLabel: platform.label });
        await logActivity(o.id, "email", by).catch(() => {});
        toast(`Email enviado a ${o.customer_email}`);
      } catch (e) {
        toast(`No se pudo enviar el email: ${e?.message || e}`, "error");
      }
      refreshEmails();
      return reload();
    }
    return contact(channel, text);
  }, [tenant, by, contact, toast, refreshEmails, reload]);

  const openHistory = useCallback(async () => {
    setSheet({ name: "history" });
    setHistory({ loading: true, orders: [] });
    const list = await fetchCustomerOrders(orderRef.current).catch(() => []);
    setHistory({ loading: false, orders: list });
  }, []);

  if (loading || !order) {
    return (
      <div className="apple-type min-h-dvh flex items-center justify-center" style={{ background: C.bg, color: C.sub }}>
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const header = (
    <HeaderCard
      order={order}
      previousCount={prevCount}
      isDesktop={isDesktop}
      onOpenHistory={openHistory}
      onCharge={() => requireRegister(openQuickPay)}
      onPromisedDate={() => setSheet({ name: "promised" })}
      onContact={(k) => contact(k)}
      onEmail={() => setSheet({ name: "notify", variant: "general" })}
      onApproval={async (ok) => {
        if (await attempt("No se pudo guardar la respuesta", () => resolveApprovalInPerson(order.id, ok, by))) toast(ok ? "Cotización aprobada" : "Cotización rechazada");
        reload();
      }}
      onWarranty={() => setSheet({ name: "warranty" })}
    />
  );

  const visitCard = order.service_type === "visit" && order.appointment_location ? (
    <Card>
      <p style={{ fontSize: 16, fontWeight: 700 }}>Dirección de la visita</p>
      <p style={{ fontSize: 13, color: C.sub }}>Ubicación guardada para esta visita técnica</p>
      <p style={{ fontSize: 15, marginTop: 8 }}>{order.appointment_location}</p>
      <button
        onClick={() => window.open(/^https?:\/\//.test(order.appointment_location) ? order.appointment_location : `https://maps.google.com/?q=${encodeURIComponent(order.appointment_location)}`, "_blank", "noopener")}
        className="apple-press" style={{ marginTop: 10, padding: "8px 14px", borderRadius: 999, background: tint(C.blue, 0.16), color: C.blue, fontWeight: 700, fontSize: 14 }}
      >
        Abrir en Mapas
      </button>
    </Card>
  ) : null;

  const module = (
    <StatusModule
      order={order}
      tenant={tenant}
      saving={saving}
      notice={notice}
      isDesktop={isDesktop}
      uploadingPhotos={uploading}
      techName={order.assigned_to_name}
      onAdvance={advance}
      onDeliver={deliver}
      onOpenPicker={() => setSheet({ name: "picker" })}
      onReopen={() => (order.status === "delivered" ? setSheet({ name: "reopen" }) : setSheet({ name: "picker" }))}
      onUndo={undo}
      onSmsFallback={() => {
        const phone = phoneDigits(order.customer_phone);
        window.location.href = `sms:${phone}?&body=${encodeURIComponent(`Hola ${order.customer_name || "Cliente"}, tu orden ${order.order_number} cambió a: ${statusInfo(order.status).label}.`)}`;
        setNotice(null);
      }}
      onDismissNotice={() => setNotice(null)}
      onTakePhoto={() => setSheet({ name: "photos" })}
      onStagePill={stagePill}
      onQuick={quick}
    />
  );

  const makeDoc = async (kind) => {
    const o = orderRef.current;
    setDocBusy(kind);
    try {
      const blob = await (kind === "quote" ? buildQuotePDF : buildReceiptPDF)({ order: o, tenant });
      logActivity(o.id, "note", by || "Web", kind === "quote" ? "Cotización compartida (PDF)" : "Recibo compartido (PDF)").then(() => reload(), () => {});
      setSheet(null);
      setDocShare({ kind, blob });
    } catch (e) {
      toast(`No se pudo generar el documento: ${e?.message || e}`, "error");
    } finally { setDocBusy(null); }
  };
  const doLabel = async () => {
    setDocBusy("label");
    try { await printLabel(orderRef.current, tenant); setSheet(null); } catch (e) { toast(`No se pudo imprimir la etiqueta: ${e?.message || e}`, "error"); } finally { setDocBusy(null); }
  };

  const partsModule = (
    <PartsModule order={order} tenant={tenant} tenantId={tenantId} employeeName={by} onReload={reload} onExtrasChanged={() => setCostTick((n) => n + 1)} onOpenPO={(id) => setSheet({ name: "po", poId: id })} onCloseDraft={(po) => setSheet({ name: "closeDraft", po })} />
  );
  const costTasks = (
    <>
      <JobCostCard order={order} tenantId={tenantId} tick={costTick} onOpenPO={(id) => setSheet({ name: "po", poId: id })} />
      <OrderTasksCard order={order} tenantId={tenantId} employeeName={by} />
    </>
  );
  const partsBoard = (<>{partsModule}{costTasks}</>);

  const liquidBanner = order.liquid_damage ? (
    <div className="flex items-start gap-3" style={{ padding: 14, borderRadius: 14, background: tint(C.blue, 0.12), color: C.blue }}>
      <AlertTriangle className="w-4 h-4 shrink-0" style={{ marginTop: 2 }} />
      <span style={{ fontSize: 14 }}>
        Daño por líquido{Array.isArray(order.liquid_damage_indicators) && order.liquid_damage_indicators.length ? `: ${order.liquid_damage_indicators.join(", ")}` : ""}
      </span>
    </div>
  ) : null;

  const info = (
    <InfoSections
      order={order}
      onOpenHistory={openHistory}
      onTech={() => setSheet({ name: "tech" })}
      onQuickService={async (v) => { await attempt("No se pudo guardar", () => setQuickService(order.id, v)); reload(); }}
      onPromisedDate={() => setSheet({ name: "promised" })}
    />
  );

  const photos = (
    <PhotoStrip
      order={order}
      onOpen={(items, index) => setViewer({ items, index })}
      onDeleteAll={() => setSheet({ name: "deleteAllPhotos" })}
      onDeleteOne={async (url) => {
        try {
          await deleteOrderPhoto(order.id, url);
          toast("Foto eliminada");
          reload();
        } catch (e) {
          toast(`No se pudo eliminar: ${e?.message || e}`, "error");
        }
      }}
    />
  );

  const timeline = (
    <Timeline
      order={order}
      emails={emails}
      compact={isDesktop}
      onOpenEmail={(email) => setSheet({ name: "email", email })}
      onAddNote={() => setSheet({ name: "addNote" })}
      onDoneInternal={async (noteId) => { await attempt("No se pudo marcar como hecho", () => deleteInternalNote(order.id, noteId)); reload(); }}
    />
  );

  const bannerEl = banner && (
    <div className="flex items-center gap-3" style={{ position: "sticky", top: 12, zIndex: 50, backdropFilter: "blur(14px)", padding: "12px 14px", borderRadius: 14, background: tint(banner.type === "error" ? C.red : C.green, 0.22), color: banner.type === "error" ? C.red : C.green }}>
      {banner.type === "error" ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
      <span className="flex-1" style={{ fontSize: 14, whiteSpace: "pre-line" }}>{banner.text}</span>
      <button onClick={() => setBanner(null)} aria-label="Cerrar" className="apple-press"><X className="w-4 h-4" /></button>
    </div>
  );

  const queueEl = queueBanner && (
    <div className="flex items-center gap-3" style={{ padding: "12px 14px", borderRadius: 14, background: tint(C.amber, 0.14), color: C.amber }}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1" style={{ fontSize: 14 }}>{queueBanner}</span>
      <button onClick={() => setQueueBanner(null)} aria-label="Cerrar" className="apple-press"><X className="w-4 h-4" /></button>
    </div>
  );

  const toolbar = (
    <div className="flex items-center justify-between gap-3" style={{ padding: "14px 0 6px" }}>
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={() => navigate("/Orders")} aria-label="Volver" className="apple-press" style={{ width: 40, height: 40, borderRadius: 999, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="truncate" style={{ fontSize: 20, fontWeight: 800 }}>Orden {order.order_number}</p>
      </div>
      <div className="flex items-center gap-1" style={{ padding: 4, borderRadius: 999, background: C.card }}>
        <button onClick={() => setSheet({ name: "chat" })} aria-label="Chat de la orden" className="apple-press" style={{ width: 38, height: 38, borderRadius: 999, color: C.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageSquare className="w-5 h-5" />
        </button>
        <button onClick={() => setSheet({ name: "edit" })} disabled={saving} aria-label="Editar orden" className="apple-press disabled:opacity-50" style={{ width: 38, height: 38, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => setSheet({ name: "menu" })} aria-label="Más opciones" className="apple-press" style={{ width: 38, height: 38, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="apple-type min-h-dvh" style={{ background: C.bg, color: C.text, paddingBottom: isDesktop ? 48 : 110 }}>
      <div className="app-container" style={{ maxWidth: 1500 }}>
        {toolbar}
        <div className="flex flex-col gap-4">
          {queueEl}
          {isDesktop ? (
            <>
              {header}
              {visitCard}
              {module}
              {liquidBanner}
              <QuickServiceCard order={order} onQuickService={async (v) => { await attempt("No se pudo guardar", () => setQuickService(order.id, v)); reload(); }} />
              {partsModule}
              <DeviceCard order={order} compact onPromisedDate={() => setSheet({ name: "promised" })} />
              {costTasks}
              <RatingCard order={order} />
              {photos}
              {timeline}
            </>
          ) : (
            <>
              {liquidBanner}
              {tab === "actions" && (<>{header}{visitCard}{module}{partsBoard}</>)}
              {tab === "info" && info}
              {tab === "history" && (<>{photos}{timeline}</>)}
            </>
          )}
          {bannerEl}
        </div>
      </div>

      {!isDesktop && (
        <div className="fixed left-0 right-0 z-[90]" style={{ bottom: 0, padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)" }}>
          <div className="grid grid-cols-3 gap-1" style={{ padding: 4, borderRadius: 14, background: C.card }}>
            {[["actions", "Acciones", Zap], ["info", "Info", Info], ["history", "Historial", History]].map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className="apple-press flex items-center justify-center gap-1.5"
                style={{ padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: tab === k ? tint(C.brand, 0.14) : "transparent", color: tab === k ? C.brand : C.sub }}>
                <Icon className="w-4 h-4" /> {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <DocumentsSheet open={sheet?.name === "documents"} onClose={() => setSheet(null)} order={order} busy={docBusy} onReceipt={() => makeDoc("receipt")} onQuote={() => makeDoc("quote")} onLabel={doLabel} />
      <DocumentShareSheet open={!!docShare} kind={docShare?.kind} order={order} blob={docShare?.blob} onClose={() => setDocShare(null)} />
      <ScheduleVisitSheet open={sheet?.name === "schedule"} order={order} tenant={tenant} by={by} onClose={() => setSheet(null)} onSaved={() => { toast(order.appointment_at ? "Cita actualizada" : "Cita agendada"); reload(); }} />
      <CloseDraftDialog open={sheet?.name === "closeDraft"} po={sheet?.po} tenantId={tenantId} employeeName={by} onClose={() => setSheet(null)} onDone={(p, msg) => { toast(msg); reload(); }} />
      <POSheet open={sheet?.name === "po"} poId={sheet?.poId} tenant={tenant} tenantId={tenantId} employeeName={by} onClose={() => { setSheet(null); reload(); setCostTick((n) => n + 1); }} onChanged={() => { reload(); setCostTick((n) => n + 1); }} />
      <CancelPartsSheet open={sheet?.name === "cancelParts"} plan={sheet?.plan} busy={!!sheet?.busy} onClose={() => setSheet(null)} onConfirm={confirmCancelParts} />
      <StatusPickerSheet open={sheet?.name === "picker"} onClose={() => setSheet(null)} current={order.status} onPick={pickStatus} hidden={hiddenStatusesOf(tenant)} />
      <NoteForChangeSheet
        open={sheet?.name === "noteForChange"}
        status={sheet?.status}
        onClose={() => setSheet(null)}
        onSave={async (text) => { if (await attempt("No se pudo guardar la nota", () => addInternalNote(order.id, text, by, sheet?.status))) setSheet(null); reload(); }}
      />
      <AddNoteSheet open={sheet?.name === "addNote"} onClose={() => setSheet(null)} onSave={async (text) => { if (await attempt("No se pudo guardar la nota", () => addInternalNote(order.id, text, by))) setSheet(null); reload(); }} />
      <AdvisoriesSheet
        open={sheet?.name === "advisories"}
        onClose={() => setSheet(null)}
        onSave={async (texts) => {
          const ok = await attempt("No se pudieron guardar los avisos", () => addCustomerAdvisories(order.id, texts, by || "Web"));
          if (ok) {
            setSheet(null);
            toast(texts.length === 1 ? "Aviso documentado" : `${texts.length} avisos documentados`);
          }
          reload();
        }}
      />
      <NotifySheet open={sheet?.name === "notify"} variant={sheet?.variant} order={order} busy={!!sheet?.busy} onClose={() => setSheet(null)} onChannel={notifyChannel} />
      <TechPickerSheet open={sheet?.name === "tech"} onClose={() => setSheet(null)} technicians={technicians} currentId={order.assigned_to} onPick={(t) => pickTech(t)} />
      <TechWarningSheet open={sheet?.name === "techWarn"} orderNumber={sheet?.orderNumber} onClose={() => setSheet(null)} onContinue={() => sheet?.retry?.()} />
      <QueueWarningSheet open={sheet?.name === "queueWarn"} olderNumber={sheet?.older?.order_number} onClose={() => setSheet(null)} onContinue={() => sheet?.retry?.()} />
      <CustomerHistorySheet
        open={sheet?.name === "history"}
        onClose={() => setSheet(null)}
        loading={history.loading}
        orders={history.orders}
        onOpenOrder={(id) => { setSheet(null); navigate(`/Orders/${id}`); }}
      />
      <EmailViewerSheet open={sheet?.name === "email"} email={sheet?.email} onClose={() => setSheet(null)} />
      <PhotosCaptureSheet
        open={sheet?.name === "photos"}
        initialFiles={sheet?.retryFiles}
        busy={uploading}
        onClose={() => setSheet(null)}
        onSave={(files) => savePhotos(files, sheet?.purpose)}
      />
      <PhotoGateSheet
        open={sheet?.name === "photoGate"}
        mode={sheet?.mode}
        onClose={() => setSheet(null)}
        onTakePhoto={() => setSheet({ name: "photos", purpose: sheet?.mode })}
        onSkip={() => skipPhoto(sheet?.mode)}
      />
      <ConfirmSheet
        open={sheet?.name === "deleteAllPhotos"}
        onClose={() => setSheet(null)}
        icon={Trash2}
        iconColor={C.red}
        title="¿Eliminar todas las fotos de esta orden?"
        message="No se puede deshacer."
        confirmLabel="Eliminar todas"
        confirmColor={C.red}
        onConfirm={async () => {
          if (await attempt("No se pudieron eliminar las fotos", () => deleteAllOrderPhotos(order.id))) { setSheet(null); toast("Fotos eliminadas"); }
          reload();
        }}
      />
      <SecuritySheet
        open={sheet?.name === "security"}
        order={order}
        onClose={() => setSheet(null)}
        onSave={async (sec, serial) => {
          if (await attempt("No se pudo guardar la seguridad", () => patchOrder(order.id, { device_security: sec, device_serial: serial }))) {
            setSheet(null);
            toast("Orden actualizada");
          }
          reload();
        }}
      />
      <PromisedDateSheet
        open={sheet?.name === "promised"}
        current={order.promised_date}
        onClose={() => setSheet(null)}
        onSave={async (v) => {
          try {
            await patchOrder(order.id, { promised_date: v ? new Date(`${v}T12:00:00`).toISOString() : null });
            setSheet(null);
            reload();
          } catch (e) {
            toast(`No se pudo guardar la fecha: ${e?.message || e}`, "error");
          }
        }}
      />
      <EditOrderSheet
        open={sheet?.name === "edit"}
        order={order}
        technicians={technicians}
        onClose={() => setSheet(null)}
        onSave={async (f) => {
          const tech = f.assigned_to ? technicians.find((t) => t.id === f.assigned_to) || null : null;
          const numOrUndef = (v) => {
            if (v === "" || v === null || v === undefined) return undefined;
            const n = Number(v);
            return Number.isFinite(n) && n >= 0 ? n : undefined;
          };
          const fields = {
            customer_name: f.customer_name.trim(),
            customer_phone: f.customer_phone.trim(),
            customer_email: f.customer_email.trim(),
            initial_problem: f.initial_problem,
            device_type: String(f.device_type || "").trim() || order.device_type || null,
            device_brand: f.device_brand.trim(),
            device_family: f.device_family.trim(),
            device_model: f.device_model.trim(),
            device_color: f.device_color,
            device_serial: f.device_serial,
            status_note: f.status_note,
            priority: f.priority,
          };
          if (!f.assigned_to) {
            fields.assigned_to = null;
            fields.assigned_to_name = null;
          } else if (tech) {
            fields.assigned_to = tech.id;
            fields.assigned_to_name = tech.full_name || null;
          }
          const ce = numOrUndef(f.cost_estimate);
          const lc = numOrUndef(f.labor_cost);
          if (ce !== undefined) fields.cost_estimate = ce;
          if (lc !== undefined) fields.labor_cost = lc;
          const before = displayDevice(order);
          const after = displayDevice(fields);
          try {
            await patchOrder(order.id, fields);
            if (before !== after) await logActivity(order.id, "note", by, before ? `Dispositivo corregido: ${before} → ${after}` : `Dispositivo actualizado: ${after}`);
            setSheet(null);
            toast("Orden actualizada");
            reload();
          } catch (e) {
            toast(`No se pudo guardar: ${e?.message || e}`, "error");
          }
        }}
      />
      <WarrantySheet
        open={sheet?.name === "warranty" || sheet?.name === "deliveryWarranty"}
        number={order.order_number}
        current={sheet?.name === "deliveryWarranty" ? deliveryWarranty : order.warranty_days}
        onClose={() => {
          if (sheet?.name === "deliveryWarranty") setSheet({ name: "confirmDelivery", flowId: sheet?.flowId });
          else { const chain = sheet?.chainReview; setSheet(null); if (chain) openReviewIfPossible(); }
        }}
        onSave={async (days) => {
          if (sheet?.name === "deliveryWarranty") {
            setDeliveryWarranty(days);
            setSheet({ name: "confirmDelivery", flowId: sheet?.flowId });
            return;
          }
          try {
            await patchOrder(order.id, { warranty_days: parseInt(days, 10) });
            const chain = sheet?.chainReview;
            setSheet(null);
            reload();
            if (chain) openReviewIfPossible();
          } catch (e) {
            toast(`No se pudo guardar la garantía: ${e?.message || e}`, "error");
          }
        }}
      />
      <ConfirmDeliverySheet
        open={sheet?.name === "confirmDelivery"}
        order={order}
        tenant={tenant}
        warrantyDays={deliveryWarranty}
        flowId={sheet?.flowId}
        onOpenWarranty={() => setSheet({ name: "deliveryWarranty", flowId: sheet?.flowId })}
        onClose={() => { skipNoteRef.current = null; setSheet(null); }}
        onConfirm={confirmDelivery}
      />
      <ReviewSheet open={sheet?.name === "review"} order={order} tenant={tenant} onClose={() => setSheet(null)} onSend={sendReview} />
      <ReopenSheet
        open={sheet?.name === "reopen"}
        onClose={() => setSheet(null)}
        onWarranty={() => setSheet({ name: "warrantyReopen" })}
        onContinue={async (reason) => {
          const ok = await attempt("No se pudo reabrir la orden", async () => {
            const cur = (await fetchOrder(order.id, tenantId)) || order;
            await patchOrder(order.id, { reopen_count: (parseInt(cur.reopen_count, 10) || 0) + 1, last_reopen_reason: reason, last_reopen_at: new Date().toISOString() }, { touchUpdated: false });
          });
          await reload();
          if (ok) setSheet({ name: "picker" });
        }}
      />
      <WarrantyReopenSheet
        open={sheet?.name === "warrantyReopen"}
        onClose={() => { warrantyAttemptRef.current = null; setSheet(null); }}
        onContinue={async (reason, files) => {
          const prior = warrantyAttemptRef.current;
          const step = prior && prior.orderId === order.id ? prior : { orderId: order.id, reason, patched: false, pending: null };
          warrantyAttemptRef.current = step;
          try {
            if (!step.patched) {
              const cur = (await fetchOrder(order.id, tenantId)) || order;
              await patchOrder(order.id, { reopen_count: (parseInt(cur.reopen_count, 10) || 0) + 1, last_reopen_reason: reason, last_reopen_at: new Date().toISOString(), warranty_claim: true }, { touchUpdated: false });
              step.patched = true;
              step.reason = reason;
            } else if (step.reason !== reason) {
              await patchOrder(order.id, { last_reopen_reason: reason }, { touchUpdated: false });
              step.reason = reason;
            }
            const toUpload = step.pending ?? Array.from(files || []);
            if (toUpload.length) {
              const { failed } = await uploadOrderPhotos(order, toUpload, { status: "warranty", by });
              step.pending = failed;
              if (failed.length) toast(failed.length === 1 ? "1 foto no subió" : `${failed.length} fotos no subieron`, "error");
            } else {
              step.pending = [];
            }
          } catch (e) {
            toast(`No se pudo registrar la garantía: ${e?.message || e}`, "error");
            return;
          }
          await reload();
          const moved = await changeStatus("in_progress", { bypassQueue: true });
          if (!moved) return;
          warrantyAttemptRef.current = null;
          try {
            const fresh = orderRef.current;
            setSheet(null);
            if (fresh && String(fresh.customer_email || "").trim() && tenant) {
              const lang = "es";
              const html = renderOrderEmailHTML({
                order: fresh, tenant, lang,
                heroTitle: "Recibimos tu equipo de vuelta",
                heroLine: reason,
                sections: [{ type: "deviceDetails" }, { type: "photos", scope: { kind: "stages", statuses: ["intake"], heading: "Fotos al recibir el equipo de vuelta" } }],
              });
              await sendRawEmail({
                tenantId: fresh.tenant_id,
                to: fresh.customer_email,
                subject: `Garantía · Orden ${fresh.order_number} · ${tenantEmailFromName(tenant)}`,
                html,
                replyTo: tenant.email,
                fromName: tenantEmailFromName(tenant),
              }).catch(() => {});
              refreshEmails();
            }
            toast("Garantía registrada");
          } catch (e) {
            toast(`No se pudo registrar la garantía: ${e?.message || e}`, "error");
          }
        }}
      />
      <Sheet open={sheet?.name === "menu"} onClose={() => setSheet(null)} title="Más opciones" width={400}>
        <button onClick={() => setSheet({ name: "schedule" })} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "13px 14px", borderRadius: 12, background: C.card2, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
          <CalendarClock className="w-5 h-5" style={{ color: C.brand }} /> {order.service_type === "visit" && order.appointment_at ? "Editar cita" : "Agendar cita"}
        </button>
        <button onClick={() => setSheet({ name: "delete" })} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "13px 14px", borderRadius: 12, background: C.card2, color: C.red, fontSize: 15, fontWeight: 600 }}>
          <Trash2 className="w-5 h-5" /> Borrar orden
        </button>
      </Sheet>
      <ConfirmSheet
        open={sheet?.name === "delete"}
        onClose={() => setSheet(null)}
        icon={Trash2}
        iconColor={C.red}
        title="¿Borrar orden?"
        message="Esta acción marca la orden como eliminada. La web también dejará de mostrarla. Solo el admin master puede recuperarla."
        confirmLabel="Borrar permanentemente"
        confirmColor={C.red}
        onConfirm={async () => {
          try {
            await softDeleteOrder(order.id);
            navigate("/Orders", { replace: true });
          } catch (e) {
            toast(`No se pudo borrar: ${e?.message || e}`, "error");
          }
        }}
      />
      <ConfirmSheet
        open={sheet?.name === "claim"}
        onClose={() => setSheet(null)}
        icon={Hand}
        iconColor={C.blue}
        title={`¿Vas a atender este boleto, ${firstName(employee?.full_name)}?`}
        message={`${order.order_number} · ${order.customer_name || ""} — ${displayDevice(order) || "Equipo"}`}
        confirmLabel="Sí, asignármelo"
        confirmColor={C.blue}
        cancelLabel="No, solo estoy viendo"
        onConfirm={() => pickTech(employee)}
      />
      <OrderChatSheet open={sheet?.name === "chat"} onClose={() => setSheet(null)} order={order} employee={employee} tenantId={tenantId} />
      <CashClosedSheet
        open={sheet?.name === "cashClosed"}
        onClose={() => { pendingGateRef.current = null; setSheet(null); }}
        onGoHome={() => navigate("/Dashboard")}
        onOpenRegister={() => { setSheet(null); setOpenDrawer(true); }}
      />
      <OpenCashSheet
        open={openDrawer}
        tenantId={tenantId}
        tenant={tenant}
        employee={employee}
        onClose={() => { pendingGateRef.current = null; setOpenDrawer(false); }}
        onOpened={() => { const a = pendingGateRef.current; pendingGateRef.current = null; if (a) setTimeout(a, 300); }}
      />
      <CobrarMenuSheet
        open={payFlow?.name === "menu"}
        order={order}
        onClose={() => setPayFlow(null)}
        onFull={() => { setPayFlow(null); setTimeout(() => setPayFlow({ name: "quickPay" }), 350); }}
        onDeposit={() => setPayFlow({ name: "deposits" })}
        onRefund={() => setPayFlow({ name: "refund" })}
      />
      <QuickPaySheet open={payFlow?.name === "quickPay"} order={order} tenant={tenant} onClose={closeQuickPay} onSubmit={submitPayment} />
      <DepositsSheet
        open={payFlow?.name === "deposits"}
        order={order}
        tenant={tenant}
        refreshKey={depositKey}
        onClose={() => setPayFlow({ name: "menu" })}
        onAdd={async ({ amount, method }) => {
          await addDeposit({ order: orderRef.current, amount, method, by });
          const fresh = await reload();
          setDepositKey((k) => k + 1);
          const rem = fresh ? remainingBalance(fresh) : 0;
          toast(fresh && orderTotal(fresh) > 0 && rem <= 0.004 ? "Orden saldada" : "Depósito recibido");
        }}
        onEdit={async ({ txId, amount }) => { await editDeposit({ order: orderRef.current, txId, amount }); await reload(); setDepositKey((k) => k + 1); }}
        onDelete={async ({ txId }) => { await deleteDeposit({ order: orderRef.current, txId }); await reload(); setDepositKey((k) => k + 1); }}
      />
      <RefundSheet
        open={payFlow?.name === "refund"}
        order={order}
        onClose={() => setPayFlow({ name: "menu" })}
        onRefund={async ({ amount, method, reason }) => {
          const { refunded } = await recordOrderRefund({ order: orderRef.current, amount, method, reason, by });
          const fresh = await reload();
          setPayFlow({ name: "menu" });
          toast(`Devolución de ${money(refunded)} registrada`);
          if (fresh && String(fresh.customer_email || "").trim() && tenant) {
            sendRefundReceipt({ order: fresh, tenant, amount: refunded, method, reason }).then(() => refreshEmails(), () => refreshEmails());
          }
        }}
      />
      {viewer && (
        <PhotoViewer
          items={viewer.items}
          index={viewer.index}
          order={order}
          onSaveAnnotated={async (file, source) => {
            const { uploaded } = await uploadOrderPhotos(order, [file], { status: source?.status || "intake", by });
            if (!uploaded) throw new Error("upload");
            toast("Foto anotada guardada");
            await reload();
          }}
          onClose={() => setViewer(null)}
          onDelete={async (url) => {
            try {
              await deleteOrderPhoto(order.id, url);
              toast("Foto eliminada");
              setViewer(null);
              reload();
            } catch (e) {
              toast(`No se pudo eliminar: ${e?.message || e}`, "error");
            }
          }}
        />
      )}
    </div>
  );
}
