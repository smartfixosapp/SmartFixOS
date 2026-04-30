import React, { useState, useMemo, useCallback } from "react";
import {
  Smartphone, Laptop, Tablet, Watch, Gamepad2, Box, Pencil,
  Check, X, Phone, MessageCircle, Mail, Plus, Loader2, Shield,
  Eye, EyeOff, Lock
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getStatusConfig } from "@/components/utils/statusRegistry";
import MobilePhotosCarousel from "./MobilePhotosCarousel";
import PatternDisplay from "@/components/security/PatternDisplay";

const DEVICE_ICONS = {
  smartphone: Smartphone, phone: Smartphone, celular: Smartphone,
  laptop: Laptop, notebook: Laptop, macbook: Laptop,
  tablet: Tablet, ipad: Tablet,
  watch: Watch, smartwatch: Watch, reloj: Watch,
  console: Gamepad2, consola: Gamepad2,
};

function DeviceIcon({ type }) {
  const key = (type || "").toLowerCase();
  const Icon = Object.entries(DEVICE_ICONS).find(([k]) => key.includes(k))?.[1] || Box;
  return <Icon className="w-8 h-8 text-white/40" />;
}

const IVU_RATE = 0.115;

export default function MobileInformacionTab({
  order,
  status,
  // editMode = true cuando el usuario tocó "Editar" en el header.
  // Cuando es false, los rows muestran los datos pero NO son interactivos
  // (sin lápices, sin tap-to-edit) — vista limpia de solo lectura.
  editMode = false,
  onUpdate,
  onPaymentClick,
  onSecurityEdit,
}) {
  const o = order || {};
  const phone = o.customer_phone || o.phone;
  const statusConfig = getStatusConfig(status);
  const photos = useMemo(() => o.photos_metadata || o.device_photos || [], [o.photos_metadata, o.device_photos]);

  // Security
  const sec = o.device_security || {};
  const hasPassword = !!sec.device_password;
  const hasPin = !!sec.device_pin;
  const hasPattern = !!sec.pattern_vector || !!sec.pattern_image;
  const hasAnySecurity = hasPassword || hasPin || hasPattern;
  const [showPass, setShowPass] = useState(false);
  const [showPinVal, setShowPinVal] = useState(false);

  // Financial
  const items = useMemo(() => Array.isArray(o.order_items) ? o.order_items : [], [o.order_items]);
  const financial = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    const tax = subtotal * IVU_RATE;
    const total = Number(o.total || o.cost_estimate || 0) || (subtotal + tax);
    const paid = Number(o.amount_paid ?? o.total_paid ?? 0);
    const balance = o.balance_due != null ? Math.max(0, Number(o.balance_due || 0)) : Math.max(0, total - paid);
    return { subtotal, tax, total, paid, balance };
  }, [items, o.total, o.cost_estimate, o.amount_paid, o.total_paid, o.balance_due]);

  // QR URL
  const qrData = encodeURIComponent(o.order_number || o.id || "");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}&bgcolor=0D0D0F&color=ffffff`;

  return (
    <div className="space-y-4 pb-8">
      {/* Device Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center">
            <DeviceIcon type={o.device_type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white truncate">
              {[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type || "Dispositivo"}
            </p>
            <p className="text-xs text-white/40">{o.order_number}</p>
          </div>
          <img src={qrUrl} alt="QR" className="w-14 h-14 rounded-lg opacity-80" loading="lazy" />
        </div>

        {/* Status badge */}
        <div className="mt-3 flex items-center gap-2">
          <div className={cn(
            "flex-1 py-2 rounded-xl text-center text-xs font-bold border",
            statusConfig.colorClasses
          )}>
            <span className="inline-flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusConfig.color }} />
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Last updated */}
        {o.updated_date && (
          <p className="mt-2 text-[10px] text-white/50 text-center">
            Ultima actualizacion: {format(new Date(o.updated_date), "d MMM yyyy, h:mm a", { locale: es })}
          </p>
        )}
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-white/50 px-1">
            Fotos ({photos.length})
          </h4>
          <MobilePhotosCarousel photos={photos} />
        </div>
      )}

      {/* Info Fields */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.06]">
        <InfoRow label="Dispositivo" value={[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type} orderId={o.id} field="device_model" onUpdate={onUpdate} editMode={editMode} />
        <InfoRow label="Parte defectuosa" value={o.initial_problem || o.defective_part} orderId={o.id} field="initial_problem" onUpdate={onUpdate} editMode={editMode} />
        <InfoRow label="IMEI/SERIAL" value={o.device_imei || o.device_serial} orderId={o.id} field="device_imei" onUpdate={onUpdate} placeholder="NOT PROVIDED" editMode={editMode} />
        <InfoRow label="Codigo de bloqueo" value={sec.device_pin || sec.device_password} orderId={o.id} onUpdate={onUpdate} placeholder="NOT PROVIDED" isSecure onSecurityEdit={onSecurityEdit} editMode={editMode} />
        <InfoRow label="Costo de reparacion (est.)" value={`$${financial.total.toFixed(2)}`} orderId={o.id} field="cost_estimate" onUpdate={onUpdate} editMode={editMode} />
        <InfoRow label="Cliente" value={o.customer_name} orderId={o.id} field="customer_name" onUpdate={onUpdate} editMode={editMode} />
        <InfoRow label="Telefono del cliente" value={phone} orderId={o.id} field="customer_phone" onUpdate={onUpdate} isPhone editMode={editMode} />
        {o.customer_email && (
          <InfoRow label="Email" value={o.customer_email} orderId={o.id} field="customer_email" onUpdate={onUpdate} editMode={editMode} />
        )}
        <InfoRow label="Tecnico asignado" value={o.assigned_to_name || o.assigned_to} orderId={o.id} field="assigned_to_name" onUpdate={onUpdate} editMode={editMode} />
        <InfoRow label="Tipo de reparacion" value={o.repair_type || o.service_type} orderId={o.id} field="repair_type" onUpdate={onUpdate} editMode={editMode} />
        <InfoRow label="Tarifa horaria grupo de mano de obra" value={o.labor_rate} orderId={o.id} field="labor_rate" onUpdate={onUpdate} placeholder="Not Provided" editMode={editMode} />
        <InfoRow label="Enviado por" value={o.created_by_name || o.submitted_by} />
      </div>

      {/* Financial Summary */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <h4 className="text-[10px] font-semibold text-white/50 mb-3">Resumen financiero</h4>
        {items.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {items.map((item, i) => (
              <div key={item.id || i} className="flex items-center justify-between text-xs">
                <span className="text-white/60 truncate flex-1">
                  {item.name || item.product_name || item.service_name || "Item"}
                  {Number(item.quantity || 1) > 1 && <span className="text-white/50 ml-1">x{item.quantity}</span>}
                </span>
                <span className="text-white/80 font-semibold ml-3">${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-white/[0.06] pt-2 space-y-1 text-xs">
          <div className="flex justify-between text-white/40"><span>Subtotal</span><span>${financial.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-white/40"><span>IVU (11.5%)</span><span>${financial.tax.toFixed(2)}</span></div>
          <div className="flex justify-between text-white font-bold text-sm pt-1"><span>Total</span><span>${financial.total.toFixed(2)}</span></div>
          {financial.paid > 0 && (
            <div className="flex justify-between text-emerald-400"><span>Pagado</span><span>${financial.paid.toFixed(2)}</span></div>
          )}
          {financial.balance > 0.01 && (
            <div className="flex justify-between text-red-400 font-bold"><span>Balance</span><span>${financial.balance.toFixed(2)}</span></div>
          )}
        </div>
      </div>

      {/* Security Section */}
      {hasAnySecurity && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-semibold text-white/50">Seguridad del dispositivo</h4>
            <button onClick={onSecurityEdit} className="text-xs text-purple-400 font-semibold">Editar</button>
          </div>
          {hasPin && (
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white/50">PIN</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/80 font-mono">{showPinVal ? sec.device_pin : "****"}</span>
                <button onClick={() => setShowPinVal(v => !v)} className="text-white/50">
                  {showPinVal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
          {hasPassword && (
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white/50">Password</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/80 font-mono">{showPass ? sec.device_password : "********"}</span>
                <button onClick={() => setShowPass(v => !v)} className="text-white/50">
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
          {hasPattern && (
            <div className="mt-2">
              <span className="text-xs text-white/50 block mb-2">Patron</span>
              <PatternDisplay vector={sec.pattern_vector} image={sec.pattern_image} size={100} />
            </div>
          )}
        </div>
      )}

      {/* Terms link */}
      <div className="text-center py-2">
        <span className="text-xs text-white/50">Ver </span>
        <button className="text-xs text-cyan-400 font-semibold">Terminos y Condiciones</button>
      </div>
    </div>
  );
}

// ── Info Row with inline edit ──
function InfoRow({ label, value, orderId, field, onUpdate, placeholder, isPhone, isSecure, onSecurityEdit }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (editValue === value || !orderId || !field) { setEditing(false); return; }
    setSaving(true);
    try {
      await base44.entities.Order.update(orderId, { [field]: editValue });
      onUpdate?.();
      toast.success("Actualizado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [editValue, value, orderId, field, onUpdate]);

  const displayValue = value || placeholder || "—";

  if (editing) {
    return (
      <div className="px-4 py-3">
        <label className="text-[10px] text-white/50 block mb-1">{label}</label>
        <div className="flex items-center gap-2">
          <input
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          />
          <button onClick={save} disabled={saving} className="p-2 rounded-lg bg-emerald-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button onClick={() => setEditing(false)} className="p-2 rounded-lg bg-white/10 text-white/40">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-3.5 cursor-pointer active:bg-white/[0.03] transition-colors"
      onClick={() => {
        if (isSecure) { onSecurityEdit?.(); return; }
        if (field && orderId) { setEditValue(value || ""); setEditing(true); }
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-white/50 mb-0.5">{label}</p>
        <p className={cn("text-sm font-semibold truncate", value ? "text-white" : "text-white/50")}>
          {displayValue}
        </p>
      </div>
      {(field || isSecure) && (
        <Pencil className="w-4 h-4 text-red-400/60 flex-shrink-0 ml-3" />
      )}
    </div>
  );
}
