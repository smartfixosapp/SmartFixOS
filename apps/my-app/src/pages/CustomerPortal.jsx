import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
  User
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { openWhatsApp, makeCall } from "@/components/utils/helpers";

const statusColors = {
  intake: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  diagnosing: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  awaiting_approval: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  waiting_parts: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  in_progress: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  ready_for_pickup: "bg-green-500/20 text-green-400 border-green-500/30",
  picked_up: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-gray-500/20 text-gray-400 border-gray-500/30"
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

  useEffect(() => {
    loadOrder();
  }, [orderId, token]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      // Validate token (simple validation)
      const orders = await base44.entities.Order.filter({ id: orderId });
      
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
      <div className="min-h-screen bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin w-16 h-16 border-4 border-[#FF0000] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gray-900 border-red-900/30">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Error</h2>
            <p className="text-gray-400">{error || "No se pudo cargar la orden"}</p>
          </CardContent>
        </Card>
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
    <div className="min-h-screen bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] p-4 md:p-8">
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
              <h1 className="text-2xl font-bold text-white">911 SmartFix</h1>
              <p className="text-gray-400 text-sm">Puerto Rico</p>
            </div>
          </div>
          <p className="text-gray-400">Portal de Seguimiento de Orden</p>
        </div>

        {/* Order Header */}
        <Card className="bg-gradient-to-br from-gray-900 to-black border-red-900/30">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{order.order_number}</h2>
                <div className="flex items-center gap-2 text-gray-300">
                  <User className="w-4 h-4" />
                  <span>{order.customer_name}</span>
                </div>
              </div>
              <Badge className={`${statusColors[order.status]} text-base px-4 py-2`}>
                {statusLabels[order.status] || order.status}
              </Badge>
            </div>

            {/* Device Info */}
            <div className="flex items-center gap-2 text-gray-400 mb-4">
              <Smartphone className="w-4 h-4" />
              <span>{order.device_brand} {order.device_model}</span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Progreso</span>
                <span className="text-white font-medium">{order.progress_percentage || 0}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-[#FF0000] to-red-700 h-full rounded-full transition-all"
                  style={{ width: `${order.progress_percentage || 0}%` }}
                />
              </div>
            </div>

            {/* Contact Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <Button
                onClick={() => openWhatsApp("17871234567", `Hola, consulto sobre mi orden ${order.order_number}`)}
                className="bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                onClick={() => makeCall("17871234567")}
                variant="outline"
                className="border-gray-700 text-gray-300"
              >
                <Phone className="w-4 h-4 mr-2" />
                Llamar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        {order.cost_estimate && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#FF0000]" />
                Resumen de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Estimado:</span>
                <span className="text-white font-medium">${order.cost_estimate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Pagado:</span>
                <span className="text-green-400 font-medium">${(order.amount_paid || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-800">
                <span className="font-medium text-white">Balance:</span>
                <span className="font-bold text-orange-400">
                  ${Math.max(0, order.cost_estimate - (order.amount_paid || 0)).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checklist Status */}
        {checklistTotal > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#FF0000]" />
                Checklist de Recepción
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Estado:</span>
                  <Badge className={checklistFunctional === checklistTotal ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}>
                    {checklistFunctional}/{checklistTotal} verificados
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <span className={`text-lg ${item.status === "functional" ? "text-green-400" : item.status === "not_functional" ? "text-red-400" : "text-gray-500"}`}>
                        {item.status === "functional" ? "✅" : item.status === "not_functional" ? "❌" : "⚪"}
                      </span>
                      <span className="text-gray-300">{item.label}</span>
                    </div>
                  ))}
                </div>

                {order.checklist_notes && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-400 font-medium mb-1">Observaciones:</p>
                    <p className="text-sm text-gray-300">{order.checklist_notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {visiblePhotos.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#FF0000]" />
                Fotos del Equipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {visiblePhotos.map((photo, idx) => {
                  const photoUrl = typeof photo === 'string' ? photo : photo.url;
                  return (
                    <a
                      key={idx}
                      href={photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-gray-800 hover:opacity-80 transition-opacity"
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
            </CardContent>
          </Card>
        )}

        {/* Comments */}
        {visibleComments.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#FF0000]" />
                Actualizaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleComments.map((comment, idx) => (
                <div key={idx} className="p-3 bg-black/50 rounded-lg">
                  <p className="text-white mb-2">{comment.text}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>{format(new Date(comment.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                    <span>·</span>
                    <span>{comment.author}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm py-4">
          <p>© 2025 911 SmartFix Puerto Rico</p>
          <p className="mt-1">Gracias por confiar en nosotros</p>
        </div>
      </div>
    </div>
  );
}
