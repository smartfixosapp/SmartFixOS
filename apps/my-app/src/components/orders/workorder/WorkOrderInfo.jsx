import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Phone, Mail, MessageSquare, Computer, Tablet, Smartphone, Watch, Key,
  User, Shield, Package, Save, Check
} from 'lucide-react';
import { openWhatsApp, makeCall } from '@/components/utils/helpers';
import { base44 } from '@/api/base44Client';

const getDeviceIcon = (type) => {
  switch (type) {
    case 'computer': return <Computer className="w-4 h-4 mr-1.5" />;
    case 'tablet': return <Tablet className="w-4 h-4 mr-1.5" />;
    case 'phone': return <Smartphone className="w-4 h-4 mr-1.5" />;
    case 'watch': return <Watch className="w-4 h-4 mr-1.5" />;
    default: return <Package className="w-4 h-4 mr-1.5" />;
  }
};

const getSecurityIcon = (security) => {
  if (security?.device_pin) return <Key className="w-4 h-4 mr-1.5 text-blue-400" />;
  if (security?.device_password) return <Key className="w-4 h-4 mr-1.5 text-green-400" />;
  if (security?.pattern_image) return <Key className="w-4 h-4 mr-1.5 text-purple-400" />;
  return <Shield className="w-4 h-4 mr-1.5 text-gray-500" />;
};

export default function WorkOrderInfoHeader({ order, assignedUser, onUpdate }) {
  const initialPin = useMemo(() => order?.device_security?.device_pin || '', [order]);
  const [pin, setPin] = useState(initialPin);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const savePin = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const current = order?.device_security || {};
      const payload = { device_security: { ...current, device_pin: pin || '' } };
      const write = base44.entities.Order.patch || base44.entities.Order.update;
      await write(order.id, payload);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      onUpdate?.();
    } catch (e) {
      console.error('No se pudo guardar el PIN', e);
      alert('No se pudo guardar el PIN');
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') savePin();
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Columna Cliente */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-white flex items-center gap-2">
            <User className="w-5 h-5 text-red-500" /> Cliente
          </h3>
          <p className="font-medium text-white">{order.customer_name}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
            <button onClick={() => makeCall(order.customer_phone)} className="flex items-center gap-1.5 hover:text-red-400">
              <Phone className="w-4 h-4" /> {order.customer_phone}
            </button>
            <button
              onClick={() =>
                openWhatsApp(
                  order.customer_phone,
                  `Hola ${order.customer_name}, te escribimos de 911 SmartFix sobre tu orden ${order.order_number}.`
                )
              }
              className="flex items-center gap-1.5 hover:text-green-400"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </button>
            {order.customer_email && (
              <a href={`mailto:${order.customer_email}`} className="flex items-center gap-1.5 hover:text-blue-400">
                <Mail className="w-4 h-4" /> Email
              </a>
            )}
          </div>
        </div>

        {/* Columna Técnico */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-white flex items-center gap-2">
            <User className="w-5 h-5 text-red-500" /> Técnico
          </h3>
          <p className="font-medium text-white">{assignedUser?.full_name || order?.assigned_to_name || 'Sin asignar'}</p>
          <p className="text-sm text-gray-400">Recibido por: {order.created_by || 'Sistema'}</p>
        </div>

        {/* Equipo */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-white flex items-center gap-2">
            {getDeviceIcon(order.device_type)} Equipo
          </h3>
          <p className="font-medium text-white">
            {order.device_brand} {order.device_model}
          </p>
          <p className="text-sm text-gray-400">Serial/IMEI: {order.device_serial || order.imei || 'No provisto'}</p>
        </div>

        {/* Acceso (PIN editable) */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-white flex items-center gap-2">
            {getSecurityIcon(order.device_security)} Acceso / PIN
          </h3>

          <div className="flex items-center gap-2">
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={12}
              placeholder="PIN del equipo"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={handleKey}
              className="bg-black/40 border-gray-700 text-white w-40"
            />
            <Button onClick={savePin} disabled={saving} className="bg-white/10 hover:bg-white/20 border border-white/20">
              {savedFlash ? <Check className="w-4 h-4 mr-2 text-emerald-400" /> : <Save className="w-4 h-4 mr-2" />}
              {savedFlash ? 'Guardado' : saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>

          <p className="text-xs text-gray-400">
            También puedes presionar <span className="text-white">Enter</span> para guardar.
          </p>
        </div>
      </div>
    </div>
  );
}
