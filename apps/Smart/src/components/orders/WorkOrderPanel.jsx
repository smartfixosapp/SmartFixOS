// === WorkOrderPanelV2.jsx — versión limpia (1 solo componente) ===
// 👈 sin duplicados, mismo look negro/rojo, mismo sessionStorage

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  X,
  ChevronLeft,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  Share2,
  Mail,
  Printer,
} from "lucide-react";

import WorkOrderInfoHeader from "./workorder/WorkOrderInfoHeader";
import WorkOrderItems from "./workorder/WorkOrderItems";
import WorkOrderTimeline from "./workorder/WorkOrderTimeline";
import WorkOrderProgress from "./workorder/WorkOrderProgress";
import OrderPhotosGallery from "./OrderPhotosGallery";
import OrderChecklistBadges from "./OrderChecklistBadges";
import QuickPayModal from "@/components/pos/QuickPayModal";

// --- servicio seguro ---
const SafeOrderService = {
  async getById(id, { timeoutMs = 12000 } = {}) {
    if (!id) throw new Error("missing-id");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const cleanId = String(id).trim();
      const data = await base44.entities.Order.get(cleanId, {
        signal: controller.signal,
      });
      if (!data) throw new Error("not-found");
      return data;
    } finally {
      clearTimeout(timer);
    }
  },
  async getByOrderNumber(order_number) {
    if (!order_number) throw new Error("missing-order-number");
    const arr = await base44.entities.Order.filter({ order_number });
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  },
};

export default function WorkOrderPanelV2({ orderId, onClose, onUpdate, user }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [featureFlags, setFeatureFlags] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const stepContainerRef = useRef(null);
  const [quickPayMode, setQuickPayMode] = useState(null);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const handlePaymentClick = useCallback((mode) => {
    setQuickPayMode(mode || "full");
  }, []);

  // cargar flags
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const rows = await base44.entities.SystemConfig.filter({
          key: "feature_flags",
        });
        const raw = rows?.[0]?.value || rows?.[0]?.value_json;
        let flags = {};
        if (typeof raw === "string") {
          try {
            flags = JSON.parse(raw);
          } catch {}
        } else if (typeof raw === "object" && raw !== null) {
          flags = raw;
        }
        setFeatureFlags(flags);
      } catch {}
    };
    loadConfig();
  }, []);

  const singleBackCta = featureFlags.workorder_single_back_cta !== false;
  const backFix = featureFlags.workorder_back_fix !== false;

  // cargar orden
  useEffect(() => {
    if (orderId) {
      loadOrder();
      document.body.classList.add("wo-fullscreen");
    }
    return () => {
      document.body.classList.remove("wo-fullscreen");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // restore step
  useEffect(() => {
    if (!backFix || !orderId) return;
    try {
      const saved = sessionStorage.getItem(
        `workorder.last_step.${orderId}`
      );
      if (saved) {
        const step = parseInt(saved, 10);
        if (!isNaN(step) && step >= 0) {
          setCurrentStep(step);
        }
      }
    } catch {}
  }, [orderId, backFix]);

  // save step
  useEffect(() => {
    if (!backFix || !orderId) return;
    try {
      sessionStorage.setItem(
        `workorder.last_step.${orderId}`,
        String(currentStep)
      );
    } catch {}
  }, [currentStep, orderId, backFix]);

  const loadOrder = async (updatedData = null) => {
    if (updatedData) {
      setOrder(prev => ({ ...prev, ...updatedData }));
      return;
    }

    const possibleId =
      orderId?.id ??
      orderId?.order_id ??
      orderId?.Order?.id ??
      orderId?._id ??
      orderId?.OrderId ??
      orderId;
    const order_number =
      orderId?.order_number ?? orderId?.OrderNumber;

    if (!possibleId && !order_number) {
      setError("ID de orden no válido");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data = null;
      if (possibleId) {
        try {
          data = await SafeOrderService.getById(possibleId);
        } catch {
          // fall back
        }
      }
      if (!data && order_number) {
        data = await SafeOrderService.getByOrderNumber(order_number);
      }
      if (!data) {
        throw new Error("No se encontró la orden (ID o número inválido).");
      }

      // relaciones
      try {
        const [eventsRes, customerRes] = await Promise.allSettled([
          base44.entities.WorkOrderEvent.filter({ order_id: data.id }),
          data.customer_id
            ? base44.entities.Customer.get(String(data.customer_id))
            : Promise.resolve(null),
        ]);
        data._events =
          eventsRes.status === "fulfilled" ? eventsRes.value || [] : [];
        data._customer =
          customerRes.status === "fulfilled" ? customerRes.value : null;
      } catch {}

      setOrder(data);
    } catch (e) {
      setError(e?.message || "Error desconocido al cargar la orden.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = loadOrder;

  const sendStatusChangeEmail = async (newStatusId, previousStatusId, currentOrder) => {
    // Siempre usar la orden original como fallback para datos del cliente,
    // ya que Order.update() puede devolver una respuesta parcial sin customer_email
    const o = {
      ...(currentOrder || order),
      customer_email: currentOrder?.customer_email || order?.customer_email,
      customer_name:  currentOrder?.customer_name  || order?.customer_name,
      customer_phone: currentOrder?.customer_phone || order?.customer_phone,
      order_number:   currentOrder?.order_number   || order?.order_number,
    };
    if (!o?.customer_email) {
      console.warn("[Email] Sin customer_email, omitiendo email para estado:", newStatusId);
      return;
    }

    // Estados que NO envían email (basado en el panel principal)
    const skipEmailStates = ["reparacion_externa", "waiting_order", "pending_order", "intake"];
    if (skipEmailStates.includes(newStatusId)) return;

    try {
      const deviceLine = `${o.device_brand || ""} ${o.device_model || ""}`.trim();
      await base44.functions.invoke('sendTemplatedEmail', {
        event_type: newStatusId,
        order_data: {
          order_number: o.order_number,
          customer_name: o.customer_name || "Cliente",
          customer_email: o.customer_email,
          device_info: deviceLine || o.device_type || "tu equipo",
          initial_problem: o.initial_problem || ""
        }
      });

      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "email_sent",
        description: `Email enviado a ${o.customer_email} para estado: ${newStatusId}`,
        user_name: user?.full_name || user?.email || "Sistema",
        user_id: user?.id || null,
        metadata: { template: newStatusId, auto: true }
      });
    } catch (err) {
      console.error("[Email Error]", err);
    }
  };

  const changeStatus = async (newStatus, note = "", metadata = {}, skipRefresh = false) => {
    if (!order?.id) return;
    const oldStatus = order.status;

    try {
      const updateData = {
        status: newStatus,
        status_note: note || undefined,
        updated_date: new Date().toISOString()
      };
      
      if (metadata && Object.keys(metadata).length > 0) {
        updateData.status_metadata = {
          ...(order.status_metadata || {}),
          ...metadata
        };
      }

      const updated = await base44.entities.Order.update(order.id, updateData);
      setOrder(updated);

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "status_change",
        description: `Estado: ${oldStatus} → ${newStatus}${note ? ` — ${note}` : ""}`,
        user_name: user?.full_name || user?.email || "Sistema",
        user_id: user?.id || null,
        metadata: { from: oldStatus, to: newStatus, ...metadata }
      });

      // Triggers de Automatización y Email
      await sendStatusChangeEmail(newStatus, oldStatus, updated);
      
      try {
        await base44.functions.invoke('handleStatusChange', {
          orderId: order.id,
          newStatus,
          previousStatus: oldStatus
        });
      } catch (e) {
        console.warn("handleStatusChange error:", e);
      }

      if (!skipRefresh) onUpdate?.();
    } catch (err) {
      console.error("changeStatus error:", err);
      throw err;
    }
  };

  const handleClose = useCallback(() => {
    if (backFix) {
      if (window.history.length > 1) {
        try {
          const referrer = document.referrer;
          if (
            referrer &&
            referrer.includes(window.location.origin)
          ) {
            window.history.back();
            return;
          }
        } catch {}
      }
      try {
        if (orderId) {
          sessionStorage.removeItem(
            `workorder.last_step.${orderId}`
          );
        }
      } catch {}
    }
    onClose?.();
  }, [backFix, orderId, onClose]);

  // scroll top
  useEffect(() => {
    if (stepContainerRef.current) {
      stepContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [currentStep]);

  // loading
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-3">
          <Loader2 className="w-12 h-12 animate-spin text-red-600" />
          <div className="text-lg">Cargando orden…</div>
        </div>
      </div>
    );
  }

  // error
  if (error || !order) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-[#2B2B2B] to-black border border-red-900/30 rounded-xl p-8 max-w-md w-full">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                Error al cargar
              </h3>
              <p className="text-gray-300">
                {error || "Orden no encontrada"}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleClose}
                variant="outline"
                className="border-gray-700"
              >
                Cerrar
              </Button>
              <Button
                onClick={loadOrder}
                className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700"
              >
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // render
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-3xl flex flex-col">
      <style>{`body.wo-fullscreen { overflow: hidden !important; }`}</style>

      {/* header glass */}
      <div className="flex-shrink-0 bg-white/5 border-b border-white/10 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!singleBackCta && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                aria-label="Volver"
                className="text-gray-400 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {order?.order_number || "—"}
              </h2>
              <p className="text-sm text-gray-400">
                {order.customer_name} • {order.device_model || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Botón compartir */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowShareMenu(v => !v)}
                aria-label="Compartir recibo"
                className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                title="Compartir recibo"
              >
                <Share2 className="w-5 h-5" />
              </Button>
              {showShareMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 min-w-[190px] rounded-2xl bg-[#0e0e0e] border border-white/10 shadow-2xl overflow-hidden">
                    <p className="text-[9px] font-semibold text-white/50 px-3 pt-2.5 pb-1">Compartir recibo</p>
                    {/* WhatsApp */}
                    {order?.customer_phone && (() => {
                      const url  = `${window.location.origin}/Receipt?order_id=${order.id}`;
                      const PAID = ["completed", "delivered", "picked_up"];
                      const tipo = PAID.includes(order.status) ? "recibo de pago" : "recibo de recepción";
                      const msg  = `¡Hola ${order.customer_name}! 🧾 Aquí está tu ${tipo}:\n\n${url}`;
                      const wa   = `https://wa.me/${order.customer_phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
                      return (
                        <a href={wa} target="_blank" rel="noopener noreferrer"
                          onClick={() => setShowShareMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                          <span className="text-base">💬</span> WhatsApp
                        </a>
                      );
                    })()}
                    {/* Email */}
                    {order?.customer_email && (() => {
                      const url  = `${window.location.origin}/Receipt?order_id=${order.id}`;
                      const subj = encodeURIComponent(`Tu recibo — ${order.order_number}`);
                      const body = encodeURIComponent(`Hola ${order.customer_name},\n\nAquí está tu recibo:\n${url}\n\nGracias.`);
                      return (
                        <a href={`mailto:${order.customer_email}?subject=${subj}&body=${body}`}
                          onClick={() => setShowShareMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                          <Mail className="w-4 h-4 text-blue-400" /> Email
                        </a>
                      );
                    })()}
                    {/* Imprimir */}
                    <button
                      onClick={() => { setShowShareMenu(false); window.open(`${window.location.origin}/Receipt?order_id=${order.id}&print=1`, "_blank"); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                      <Printer className="w-4 h-4 text-white/40" /> Imprimir
                    </button>
                    {/* Copiar link */}
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/Receipt?order_id=${order.id}`); setShowShareMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 pb-3 pt-1 hover:bg-white/[0.06] transition-colors text-sm text-white/40 border-t border-white/[0.06] mt-1">
                      <span className="text-base">🔗</span> Copiar link
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Botón cerrar */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Cerrar orden de trabajo"
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* body */}
      <div
        ref={stepContainerRef}
        className="flex-1 overflow-y-auto app-scroll p-4 space-y-6"
      >
        <WorkOrderInfoHeader order={order} onUpdate={handleRefresh} user={user} changeStatus={changeStatus} onPaymentClick={handlePaymentClick} />
        <WorkOrderProgress order={order} onUpdate={onUpdate} user={user} changeStatus={changeStatus} onPaymentClick={handlePaymentClick} />

        {order.photos_metadata?.length > 0 && (
          <Card className="bg-white/5 border border-white/5 rounded-[24px]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                Fotos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderPhotosGallery photos={order.photos_metadata} />
            </CardContent>
          </Card>
        )}

        {order.checklist_items?.length > 0 && (
          <Card className="bg-white/5 border border-white/5 rounded-[24px]">
            <CardHeader>
              <CardTitle className="text-white text-lg">Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderChecklistBadges items={order.checklist_items} />
              {order.checklist_notes && (
                <p className="text-white/60 text-sm mt-3 bg-black/20 p-3 rounded-xl border border-white/5">
                  {order.checklist_notes}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <WorkOrderItems order={order} onUpdate={loadOrder} />
        <WorkOrderTimeline orderId={order.id} />
      </div>

      {quickPayMode && order && (
        <QuickPayModal
          order={order}
          paymentMode={quickPayMode}
          onClose={() => setQuickPayMode(null)}
          onSuccess={async ({ updatedOrder }) => {
            setQuickPayMode(null);
            if (updatedOrder?.id) setOrder((prev) => ({ ...(prev || {}), ...updatedOrder }));
            await loadOrder();
            onUpdate?.();
          }}
        />
      )}
    </div>
  );
}
