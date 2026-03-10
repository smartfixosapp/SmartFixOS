import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, History } from "lucide-react";
import { openWhatsApp, makeCall } from "../../utils/helpers";

export default function ClientSection({ order, customer }) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <User className="w-5 h-5" />
          Información del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-gray-400">Nombre</label>
          <p className="text-white text-lg">{order.customer_name || "—"}</p>
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Teléfono</label>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => makeCall(order.customer_phone)}
              className="text-blue-400 hover:underline"
            >
              {order.customer_phone || "—"}
            </button>
            {order.customer_phone && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openWhatsApp(order.customer_phone, `Hola ${order.customer_name}, referente a tu orden ${order.order_number}`)}
                className="ml-auto border-gray-700"
              >
                WhatsApp
              </Button>
            )}
          </div>
        </div>

        {order.customer_email && (
          <div>
            <label className="text-sm text-gray-400">Email</label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <a 
                href={`mailto:${order.customer_email}`}
                className="text-blue-400 hover:underline"
              >
                {order.customer_email}
              </a>
            </div>
          </div>
        )}

        {customer && (
          <div className="pt-4 border-t border-gray-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="border-gray-700"
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
