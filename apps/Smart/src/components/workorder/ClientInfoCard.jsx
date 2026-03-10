import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, MessageSquare, History } from "lucide-react";
import { openWhatsApp } from "../utils/helpers";
import { logWorkOrderContactEvent } from "@/components/workorder/utils/auditEvents";

export default function ClientInfoCard({ order, compact = false, onViewHistory }) {
  if (!order) return null;

  const onlyDigits = (v) => (v || "").replace(/\D+/g, "");
  const digits = onlyDigits(order.customer_phone);
  const intl = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;

  const handleCallClick = (e) => {
    if (!order.customer_phone) return;
    e.preventDefault();
    void logWorkOrderContactEvent({
      order,
      channel: "call",
      target: order.customer_phone
    });
    window.location.href = `tel:+${intl}`;
  };

  const handleWhatsappClick = () => {
    if (!order.customer_phone) return;
    void logWorkOrderContactEvent({
      order,
      channel: "whatsapp",
      target: order.customer_phone
    });
    openWhatsApp(order.customer_phone, `Hola ${order.customer_name}, te escribimos de 911 SmartFix sobre tu orden ${order.order_number}.`);
  };

  const handleEmailClick = (e) => {
    if (!order.customer_email) return;
    e.preventDefault();
    void logWorkOrderContactEvent({
      order,
      channel: "email",
      target: order.customer_email
    });
    window.location.href = `mailto:${order.customer_email}`;
  };

  return (
    <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/20 theme-light:bg-white theme-light:border-gray-200">
      <CardHeader className="border-b border-blue-500/20 pb-3 theme-light:border-gray-200">
        <CardTitle className="text-white flex items-center gap-2 text-lg theme-light:text-gray-900">
          <User className="w-5 h-5 text-blue-400 theme-light:text-blue-600" />
          Información del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Nombre */}
        <div>
          <label className="text-xs text-gray-400 theme-light:text-gray-600 font-medium block mb-1">
            Nombre Completo
          </label>
          <p className="text-white text-base font-semibold theme-light:text-gray-900">
            {order.customer_name || "—"}
          </p>
        </div>

        {/* Teléfono */}
        <div>
          <label className="text-xs text-gray-400 theme-light:text-gray-600 font-medium block mb-2">
            Teléfono
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`tel:+${intl}`}
              onClick={handleCallClick}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 font-medium text-sm transition-all theme-light:bg-blue-50 theme-light:border-blue-200 theme-light:text-blue-700 theme-light:hover:bg-blue-100"
            >
              <Phone className="w-4 h-4" />
              {order.customer_phone || "—"}
            </a>
            {order.customer_phone && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleWhatsappClick}
                className="border-green-500/30 text-green-400 hover:bg-green-600/20 hover:border-green-500/50 theme-light:border-green-300 theme-light:text-green-700 theme-light:hover:bg-green-50"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                WhatsApp
              </Button>
            )}
          </div>
        </div>

        {/* Email */}
        {order.customer_email && (
          <div>
            <label className="text-xs text-gray-400 theme-light:text-gray-600 font-medium block mb-2">
              Correo Electrónico
            </label>
            <a
              href={`mailto:${order.customer_email}`}
              onClick={handleEmailClick}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-300 font-medium text-sm transition-all inline-flex theme-light:bg-purple-50 theme-light:border-purple-200 theme-light:text-purple-700 theme-light:hover:bg-purple-100"
            >
              <Mail className="w-4 h-4" />
              {order.customer_email}
            </a>
          </div>
        )}

        {/* Botón ver historial */}
        {!compact && onViewHistory && (
          <div className="pt-3 border-t border-blue-500/20 theme-light:border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewHistory}
              className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-600/20 hover:border-blue-500/50 theme-light:border-blue-300 theme-light:text-blue-700 theme-light:hover:bg-blue-50"
            >
              <History className="w-4 h-4 mr-2" />
              Ver historial del cliente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
