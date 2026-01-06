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
} from "lucide-react";

import WorkOrderInfoHeader from "./workorder/WorkOrderInfoHeader";
import WorkOrderItems from "./workorder/WorkOrderItems";
import WorkOrderTimeline from "./workorder/WorkOrderTimeline";
import WorkOrderProgress from "./workorder/WorkOrderProgress";
import OrderPhotosGallery from "./OrderPhotosGallery";
import OrderChecklistBadges from "./OrderChecklistBadges";

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

export default function WorkOrderPanelV2({ orderId, onClose, onUpdate }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [featureFlags, setFeatureFlags] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const stepContainerRef = useRef(null);

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

  const loadOrder = async () => {
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
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <style>{`body.wo-fullscreen { overflow: hidden !important; }`}</style>

      {/* header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#2B2B2B] to-black border-b border-red-900/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!singleBackCta && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
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

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* body */}
      <div
        ref={stepContainerRef}
        className="flex-1 overflow-y-auto app-scroll p-4 space-y-6"
      >
        <WorkOrderInfoHeader order={order} />
        <WorkOrderProgress order={order} />

        {order.photos_metadata?.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Fotos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderPhotosGallery photos={order.photos_metadata} />
            </CardContent>
          </Card>
        )}

        {order.checklist_items?.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderChecklistBadges items={order.checklist_items} />
              {order.checklist_notes && (
                <p className="text-gray-400 text-sm mt-3">
                  {order.checklist_notes}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <WorkOrderItems order={order} onUpdate={loadOrder} />
        <WorkOrderTimeline orderId={order.id} />
      </div>
    </div>
  );
}
