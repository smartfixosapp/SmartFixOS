import React, { useState, useEffect } from "react";
import appClient from "@/api/appClient";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  DollarSign,
  Calendar,
  Smartphone,
  User,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { openWhatsApp, makeCall } from "@/components/utils/helpers";
import { callJENAI } from "@/lib/jenaiEngine";

const statusColors = {
  intake: "bg-apple-blue/12 text-apple-blue",
  diagnosing: "bg-apple-purple/12 text-apple-purple",
  awaiting_approval: "bg-apple-yellow/15 text-apple-yellow",
  waiting_parts: "bg-apple-orange/12 text-apple-orange",
  in_progress: "bg-apple-indigo/12 text-apple-indigo",
  ready_for_pickup: "bg-apple-green/12 text-apple-green",
  picked_up: "bg-apple-green/12 text-apple-green",
  completed: "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
};

const statusLabels = {
  intake: "Recepción",
  diagnosing: "Diagnóstico",
  awaiting_approval: "Esperando Aprobación",
  waiting_parts: "Esperando Piezas",
  in_progress: "En Progreso",
  ready_for_pickup: "Lista para Recoger",
  picked_up: "Recogida",
  completed: "Completada"
};

export default function CustomerPortal() {
  const { orderId, token } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customerMessage, setCustomerMessage] = useState("");
  const [aiPortalResponse, setAiPortalResponse] = useState("");
  const [aiPortalLoading, setAiPortalLoading] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId, token]);

  const fetchPortalAiResponse = async () => {
    if (!customerMessage.trim()) return;
    setAiPortalLoading(true);
    setAiPortalResponse("");
    try {
      const orderStatus = order?.status || "en proceso";
      const deviceInfo = order?.device_model || order?.device_brand || "tu dispositivo";

      const prompt = `Eres el asistente de atención al cliente de SmartFixOS, un taller de reparación.
El cliente pregunta: "${customerMessage}"

Estado actual de su reparación: ${orderStatus}
Dispositivo: ${deviceInfo}

Responde en ESPAÑOL de forma amable, profesional y breve (máximo 40 palabras).
Si preguntan cuándo estará listo, di que el técnico los contactará pronto.
Si preguntan por el estado, explica el estado actual de forma amigable.`;

      const text = await callJENAI(prompt, { maxTokens: 150 });
      setAiPortalResponse(text);
    } catch(err) {
      setAiPortalResponse("Lo sentimos, no pudimos procesar tu consulta en este momento.");
    } finally {
      setAiPortalLoading(false);
    }
  };

  const loadOrder = async () => {
    setLoading(true);
    try {
      // Validate token (simple validation)
      const orders = await appClient.entities.Order.filter({ id: orderId });

      if (orders.length === 0) {
        setError("Orden no encontrada");
        setLoading(false);
        return;
      }

      const order = orders[0];

      // Validate token contains order info
      try {
        const decodedToken = atob(token);
        if (!decodedToken.includes(orderId)) {
          setError("Token inválido");
          setLoading(false);
          return;
        }
      } catch (e) {
        setError("Token inválido");
        setLoading(false);
        return;
      }

      setOrder(order);
      setLoading(false);
    } catch (err) {
      console.error("Error loading order:", err);
      setError("Error al cargar la orden");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-[3px] border-apple-blue/20 border-t-apple-blue rounded-full mx-auto mb-4"></div>
          <p className="apple-text-body apple-label-secondary">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center p-4">
        <div className="max-w-md w-full apple-card p-8 text-center">
          <div className="w-14 h-14 rounded-apple-sm bg-apple-red/12 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-apple-red" />
          </div>
          <h2 className="apple-text-title2 apple-label-primary mb-2">Error</h2>
          <p className="apple-text-body apple-label-secondary">{error || "No se pudo cargar la orden"}</p>
        </div>
      </div>
    );
  }

  const checklist = order.checklist_initial || [];
  const checklistFunctional = checklist.filter(i => i.status === "functional").length;
  const checklistTotal = checklist.length;

  const visiblePhotos = (order.device_photos || []).filter(photo =>
    typeof photo === 'string' || (photo.visible_to_customer !== false)
  );

  const visibleComments = (order.comments || []).filter(comment =>
    !comment.internal
  );

  return (
    <div className="min-h-dvh apple-surface apple-type p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e824240b8444c78a101a65/daf775990_1000035043.jpg"
              alt="911 SmartFix"
              className="w-16 h-16 rounded-full"
            />
            <div className="text-left">
              <h1 className="apple-text-title1 apple-label-primary">911 SmartFix</h1>
              <p className="apple-text-footnote apple-label-secondary">Puerto Rico</p>
            </div>
          </div>
          <p className="apple-text-subheadline apple-label-secondary">Portal de Seguimiento de Orden</p>
        </div>

        {/* Order Header */}
        <div className="apple-card p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="apple-text-title2 apple-label-primary mb-2 tabular-nums">{order.order_number}</h2>
              <div className="flex items-center gap-2 apple-label-secondary">
                <User className="w-4 h-4" />
                <span className="apple-text-body">{order.customer_name}</span>
              </div>
            </div>
            <span className={`${statusColors[order.status]} apple-text-subheadline px-3 py-1.5 rounded-apple-sm`}>
              {statusLabels[order.status] || order.status}
            </span>
          </div>

          {/* Device Info */}
          <div className="flex items-center gap-2 apple-label-tertiary mb-5">
            <Smartphone className="w-4 h-4" />
            <span className="apple-text-callout">{order.device_brand} {order.device_model}</span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="apple-text-footnote apple-label-secondary">Progreso</span>
              <span className="apple-text-footnote apple-label-primary font-semibold tabular-nums">{order.progress_percentage || 0}%</span>
            </div>
            <div className="w-full bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-xs h-2 overflow-hidden">
              <div
                className="bg-apple-blue h-full rounded-apple-xs transition-all"
                style={{ width: `${order.progress_percentage || 0}%` }}
              />
            </div>
          </div>

          {/* Contact Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={() => openWhatsApp("17871234567", `Hola, consulto sobre mi orden ${order.order_number}`)}
              className="apple-btn apple-btn-primary apple-press"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </button>
            <button
              onClick={() => makeCall("17871234567")}
              className="apple-btn apple-btn-secondary apple-press"
            >
              <Phone className="w-4 h-4 mr-2" />
              Llamar
            </button>
          </div>
        </div>

        {/* Payment Summary */}
        {order.cost_estimate && (
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-apple-sm bg-apple-green/12 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-apple-green" />
              </div>
              <h3 className="apple-text-headline apple-label-primary">Resumen de Pago</h3>
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="apple-text-subheadline apple-label-secondary">Total Estimado</span>
                <span className="apple-text-subheadline apple-label-primary font-medium tabular-nums">${order.cost_estimate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="apple-text-subheadline apple-label-secondary">Pagado</span>
                <span className="apple-text-subheadline text-apple-green font-medium tabular-nums">${(order.amount_paid || 0).toFixed(2)}</span>
              </div>
              <div
                className="flex justify-between pt-2.5"
                style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
              >
                <span className="apple-text-body apple-label-primary font-semibold">Balance</span>
                <span className="apple-text-body text-apple-orange font-semibold tabular-nums">
                  ${Math.max(0, order.cost_estimate - (order.amount_paid || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Checklist Status */}
        {checklistTotal > 0 && (
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-apple-sm bg-apple-blue/12 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-apple-blue" />
              </div>
              <h3 className="apple-text-headline apple-label-primary">Checklist de Recepción</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="apple-text-subheadline apple-label-secondary">Estado</span>
                <span className={`apple-text-footnote px-2.5 py-1 rounded-apple-xs tabular-nums ${checklistFunctional === checklistTotal ? "bg-apple-green/12 text-apple-green" : "bg-apple-yellow/15 text-apple-yellow"}`}>
                  {checklistFunctional}/{checklistTotal} verificados
                </span>
              </div>

              <div className="space-y-2">
                {checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 apple-text-subheadline">
                    <span className={`text-base ${item.status === "functional" ? "text-apple-green" : item.status === "not_functional" ? "text-apple-red" : "apple-label-tertiary"}`}>
                      {item.status === "functional" ? "✓" : item.status === "not_functional" ? "✕" : "○"}
                    </span>
                    <span className="apple-label-primary">{item.label}</span>
                  </div>
                ))}
              </div>

              {order.checklist_notes && (
                <div className="mt-4 p-3 bg-apple-yellow/12 rounded-apple-sm">
                  <p className="apple-text-footnote text-apple-yellow font-semibold mb-1">Observaciones</p>
                  <p className="apple-text-subheadline apple-label-primary">{order.checklist_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photos */}
        {visiblePhotos.length > 0 && (
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-apple-sm bg-apple-purple/12 flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-apple-purple" />
              </div>
              <h3 className="apple-text-headline apple-label-primary">Fotos del Equipo</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visiblePhotos.map((photo, idx) => {
                const photoUrl = typeof photo === 'string' ? photo : photo.url;
                return (
                  <a
                    key={idx}
                    href={photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-apple-md overflow-hidden bg-gray-sys6 dark:bg-gray-sys5 apple-press"
                  >
                    <img
                      src={photoUrl}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Comments */}
        {visibleComments.length > 0 && (
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-apple-sm bg-apple-indigo/12 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-apple-indigo" />
              </div>
              <h3 className="apple-text-headline apple-label-primary">Actualizaciones</h3>
            </div>
            <div className="space-y-3">
              {visibleComments.map((comment, idx) => (
                <div key={idx} className="p-3 bg-apple-surface-secondary rounded-apple-sm">
                  <p className="apple-text-body apple-label-primary mb-2">{comment.text}</p>
                  <div className="flex items-center gap-2 apple-text-caption1 apple-label-tertiary">
                    <Calendar className="w-3 h-3" />
                    <span className="tabular-nums">{format(new Date(comment.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                    <span>·</span>
                    <span>{comment.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pregunta al asistente */}
        <div className="apple-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-apple-sm bg-apple-purple/12 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-apple-purple" />
            </div>
            <p className="apple-text-headline apple-label-primary">Asistente IA</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPortalAiResponse()}
              placeholder="¿Tienes alguna pregunta sobre tu reparación?"
              className="apple-input flex-1"
            />
            <button
              onClick={fetchPortalAiResponse}
              disabled={aiPortalLoading || !customerMessage.trim()}
              className="apple-btn apple-btn-tinted apple-press disabled:opacity-40"
            >
              {aiPortalLoading ? "…" : "→"}
            </button>
          </div>
          {aiPortalResponse && (
            <div className="mt-3 p-3 rounded-apple-sm bg-apple-purple/12">
              <p className="apple-text-body apple-label-primary leading-relaxed">{aiPortalResponse}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center apple-label-tertiary apple-text-footnote py-4">
          <p>© 2025 911 SmartFix Puerto Rico</p>
          <p className="mt-1">Gracias por confiar en nosotros</p>
        </div>
      </div>
    </div>
  );
}
