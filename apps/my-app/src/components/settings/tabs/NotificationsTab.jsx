import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Mail, MessageSquare, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function NotificationsTab({ config, onChange }) {
  const notifications = config?.notifications || {
    enabled: true,
    email: {
      enabled: true,
      from_name: "911 SmartFix",
      reply_to: "",
      events: {
        order_created: {
          enabled: true,
          subject: "Nueva orden recibida - {{order_number}}",
          template: "Tu orden {{order_number}} ha sido recibida y está siendo procesada."
        },
        order_status_changed: {
          enabled: true,
          subject: "Actualización de tu orden - {{order_number}}",
          template: "El estado de tu orden {{order_number}} cambió a: {{new_status}}"
        },
        ready_for_pickup: {
          enabled: true,
          subject: "¡Tu equipo está listo! - {{order_number}}",
          template: "Tu {{device_brand}} {{device_model}} está listo para recoger. Orden: {{order_number}}"
        },
        completed: {
          enabled: true,
          subject: "Orden completada - {{order_number}}",
          template: "Tu orden {{order_number}} ha sido completada exitosamente."
        },
        payment_received: {
          enabled: true,
          subject: "Pago recibido - {{order_number}}",
          template: "Hemos recibido tu pago de ${{amount}}. Balance restante: ${{balance}}"
        }
      }
    },
    sms: {
      enabled: false,
      events: {
        order_created: {
          enabled: false,
          template: "911 SmartFix: Tu orden {{order_number}} fue recibida."
        },
        ready_for_pickup: {
          enabled: false,
          template: "911 SmartFix: Tu equipo {{device_model}} está listo para recoger. Orden: {{order_number}}"
        },
        completed: {
          enabled: false,
          template: "911 SmartFix: Orden {{order_number}} completada. Gracias por tu preferencia."
        }
      }
    }
  };

  const handleChange = (path, value) => {
    const newNotifications = JSON.parse(JSON.stringify(notifications));
    const keys = path.split('.');
    let current = newNotifications;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    onChange({ ...config, notifications: newNotifications });
  };

  const emailEvents = notifications.email?.events || {};
  const smsEvents = notifications.sms?.events || {};

  return (
    <div className="space-y-6">
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-300 font-semibold mb-1">Sistema de Notificaciones Automáticas</p>
            <p className="text-sm text-blue-200/80">
              Las notificaciones se envían automáticamente cuando cambia el estado de una orden. 
              Puedes personalizar los mensajes usando variables como {'{{order_number}}'}, {'{{customer_name}}'}, {'{{device_model}}'}, etc.
            </p>
          </div>
        </div>
      </div>

      {/* Email Notifications */}
      <Card className="bg-[#111114] border-white/10">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" />
            Notificaciones por Email
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white">Habilitar emails automáticos</Label>
              <p className="text-xs text-gray-400 mt-1">Enviar emails cuando cambien estados</p>
            </div>
            <Checkbox
              checked={notifications.email?.enabled || false}
              onCheckedChange={(checked) => handleChange('email.enabled', checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nombre del remitente</Label>
              <Input
                value={notifications.email?.from_name || ""}
                onChange={(e) => handleChange('email.from_name', e.target.value)}
                className="bg-black/40 border-white/15 text-white"
                placeholder="911 SmartFix"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Email de respuesta (opcional)</Label>
              <Input
                type="email"
                value={notifications.email?.reply_to || ""}
                onChange={(e) => handleChange('email.reply_to', e.target.value)}
                className="bg-black/40 border-white/15 text-white"
                placeholder="info@911smartfix.com"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Eventos de Email
            </h3>

            {/* Order Created */}
            <div className="space-y-3 p-4 bg-black/40 border border-white/10 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Orden Recibida</Label>
                  <p className="text-xs text-gray-400">Cuando se crea una nueva orden</p>
                </div>
                <Checkbox
                  checked={emailEvents.order_created?.enabled || false}
                  onCheckedChange={(checked) => handleChange('email.events.order_created.enabled', checked)}
                />
              </div>
              {emailEvents.order_created?.enabled && (
                <>
                  <Input
                    value={emailEvents.order_created?.subject || ""}
                    onChange={(e) => handleChange('email.events.order_created.subject', e.target.value)}
                    className="bg-black/40 border-white/15 text-white text-sm"
                    placeholder="Asunto del email"
                  />
                  <Textarea
                    value={emailEvents.order_created?.template || ""}
                    onChange={(e) => handleChange('email.events.order_created.template', e.target.value)}
                    className="bg-black/40 border-white/15 text-white text-sm"
                    placeholder="Mensaje del email"
                    rows={3}
                  />
                </>
              )}
            </div>

            {/* Status Changed */}
            <div className="space-y-3 p-4 bg-black/40 border border-white/10 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Cambio de Estado</Label>
                  <p className="text-xs text-gray-400">Cuando cambia el estado de la orden</p>
                </div>
                <Checkbox
                  checked={emailEvents.order_status_changed?.enabled || false}
                  onCheckedChange={(checked) => handleChange('email.events.order_status_changed.enabled', checked)}
                />
              </div>
              {emailEvents.order_status_changed?.enabled && (
                <>
                  <Input
                    value={emailEvents.order_status_changed?.subject || ""}
                    onChange={(e) => handleChange('email.events.order_status_changed.subject', e.target.value)}
                    className="bg-black/40 border-white/15 text-white text-sm"
                    placeholder="Asunto del email"
                  />
                  <Textarea
                    value={emailEvents.order_status_changed?.template || ""}
                    onChange={(e) => handleChange('email.events.order_status_changed.template', e.target.value)}
                    className="bg-black/40 border-white/15 text-white text-sm"
                    placeholder="Mensaje del email"
                    rows={3}
                  />
                </>
              )}
            </div>

            {/* Ready for Pickup */}
            <div className="space-y-3 p-4 bg-black/40 border border-white/10 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Listo para Recoger</Label>
                  <p className="text-xs text-gray-400">Cuando el equipo está listo</p>
                </div>
                <Checkbox
                  checked={emailEvents.ready_for_pickup?.enabled || false}
                  onCheckedChange={(checked) => handleChange('email.events.ready_for_pickup.enabled', checked)}
                />
              </div>
              {emailEvents.ready_for_pickup?.enabled && (
                <>
                  <Input
                    value={emailEvents.ready_for_pickup?.subject || ""}
                    onChange={(e) => handleChange('email.events.ready_for_pickup.subject', e.target.value)}
                    className="bg-black/40 border-white/15 text-white text-sm"
                    placeholder="Asunto del email"
                  />
                  <Textarea
                    value={emailEvents.ready_for_pickup?.template || ""}
                    onChange={(e) => handleChange('email.events.ready_for_pickup.template', e.target.value)}
                    className="bg-black/40 border-white/15 text-white text-sm"
                    placeholder="Mensaje del email"
                    rows={3}
                  />
                </>
              )}
            </div>

            {/* Payment Received */}
            <div className="space-y-3 p-4 bg-black/40 border border-white/10 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Pago Recibido</Label>
                  <p className="text-xs text-gray-400">Cuando se registra un pago</p>
                </div>
                <Checkbox
                  checked={emailEvents.payment_received?.enabled || false}
                  onCheckedChange={(checked) => handleChange('email.events.payment_received.enabled', checked)}
                />
              </div>
              {emailEvents.payment_received?.enabled && (
                <>
                  <Input
                    value={emailEvents.payment_received?.subject || ""}
                    onChange={(e) => handleChange('email.events.payment_received.subject', e.target.value)}
                    className="bg-black/40 border-white/15 text-white text-sm"
                    placeholder="Asunto del email"
                  />
                  <Textarea
                    value={emailEvents.payment_received?.template || ""}
                    onChange={(e) => handleChange('email.events.payment_received.template', e.target.value)}
                    className="bg-black/40 border-white/15 text-white text-sm"
                    placeholder="Mensaje del email"
                    rows={3}
                  />
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card className="bg-[#111114] border-white/10">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-500" />
            Notificaciones por SMS
            <Badge className="bg-amber-600/20 text-amber-300 border-amber-600/30 text-xs">
              Próximamente
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-400">
            Las notificaciones por SMS estarán disponibles próximamente. 
            Podrás enviar mensajes de texto automáticos a tus clientes.
          </p>
        </CardContent>
      </Card>

      <div className="bg-gray-800/50 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Variables Disponibles</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-400">
          <code className="bg-black/40 px-2 py-1 rounded">{'{{order_number}}'}</code>
          <code className="bg-black/40 px-2 py-1 rounded">{'{{customer_name}}'}</code>
          <code className="bg-black/40 px-2 py-1 rounded">{'{{device_brand}}'}</code>
          <code className="bg-black/40 px-2 py-1 rounded">{'{{device_model}}'}</code>
          <code className="bg-black/40 px-2 py-1 rounded">{'{{new_status}}'}</code>
          <code className="bg-black/40 px-2 py-1 rounded">{'{{amount}}'}</code>
          <code className="bg-black/40 px-2 py-1 rounded">{'{{balance}}'}</code>
          <code className="bg-black/40 px-2 py-1 rounded">{'{{total}}'}</code>
        </div>
      </div>
    </div>
  );
}
