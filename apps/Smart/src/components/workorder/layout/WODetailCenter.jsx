import React, { useState, useMemo, useCallback } from "react";
import { Phone, MessageCircle, Mail, Smartphone, Laptop, Tablet, Watch, Gamepad2, Box, Pencil, Check, X } from "lucide-react";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

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
  return <Icon className="w-4 h-4 text-white/40" />;
}

export default function WODetailCenter({
  order,
  onUpdate,
  onOrderItemsUpdate,
  onRemoteSaved,
  onPaymentClick,
  onClose,
  children,
}) {
  const o = order || {};
  const phone = o.customer_phone || o.phone;

  const items = useMemo(() => {
    return Array.isArray(o.order_items) ? o.order_items : [];
  }, [o.order_items]);

  const hasItems = items.length > 0;

  // Financial summary
  const financial = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    const taxRate = 0.115;
    const tax = subtotal * taxRate;
    const total = Number(o.total || o.cost_estimate || subtotal + tax || 0);
    const paid = Number(o.amount_paid ?? o.total_paid ?? 0);
    const balance = o.balance_due != null ? Math.max(0, Number(o.balance_due || 0)) : Math.max(0, total - paid);
    return { subtotal, tax, total, paid, balance };
  }, [items, o.total, o.cost_estimate, o.amount_paid, o.total_paid, o.balance_due]);

  return (
    <div className="space-y-3">
      {/* ── Customer & Device ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4 space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Cliente</h4>
          <EditableField
            orderId={o.id}
            field="customer_name"
            value={o.customer_name}
            onUpdate={onUpdate}
            className="text-sm font-bold text-white"
          />
          {phone && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Phone className="w-3 h-3" />
              <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>
              <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                <MessageCircle className="w-3 h-3" />
              </a>
            </div>
          )}
          {o.customer_email && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Mail className="w-3 h-3" />
              <a href={`mailto:${o.customer_email}`} className="hover:text-white transition-colors truncate">{o.customer_email}</a>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4 space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Dispositivo</h4>
          <div className="flex items-center gap-2">
            <DeviceIcon type={o.device_type} />
            <p className="text-sm font-bold text-white">
              {[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type || "—"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/50">
            {o.device_color && <InfoField label="Color" value={o.device_color} />}
            {o.device_imei && <InfoField label="IMEI" value={o.device_imei} />}
          </div>
        </div>
      </div>

      {/* ── Problem ── */}
      {o.initial_problem && (
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">Problema reportado</h4>
          <EditableField
            orderId={o.id}
            field="initial_problem"
            value={o.initial_problem}
            onUpdate={onUpdate}
            className="text-sm text-white/80 leading-relaxed"
            multiline
          />
        </div>
      )}

      {/* ── Stage-specific content ── */}
      {children}

      {/* ── Items & Cost — only show full section if has items ── */}
      <SharedItemsSection
        order={order}
        onUpdate={onUpdate}
        onOrderItemsUpdate={onOrderItemsUpdate}
        onRemoteSaved={onRemoteSaved}
        onClose={onClose}
        onPaymentClick={onPaymentClick}
      />

      {/* ── Sticky Financial Summary ── */}
      {financial.total > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-[#0D0D0F]/95 backdrop-blur border-t border-white/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-white/40">Total: <span className="text-white font-bold">${financial.total.toFixed(2)}</span></span>
              <span className="text-white/40">Pagado: <span className="text-emerald-400 font-bold">${financial.paid.toFixed(2)}</span></span>
              {financial.balance > 0.01 && (
                <span className="text-red-400 font-bold">Balance: ${financial.balance.toFixed(2)}</span>
              )}
            </div>
            {financial.balance > 0.01 && (
              <button
                onClick={() => onPaymentClick?.("full")}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95"
              >
                Cobrar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline Editable Field ──
function EditableField({ orderId, field, value, onUpdate, className, multiline }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (editValue === value || !orderId) { setEditing(false); return; }
    setSaving(true);
    try {
      await base44.entities.Order.update(orderId, { [field]: editValue });
      onUpdate?.();
      toast.success("Actualizado");
    } catch (e) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [editValue, value, orderId, field, onUpdate]);

  if (editing) {
    const inputCls = "w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-cyan-500";
    return (
      <div className="flex items-start gap-1.5">
        {multiline ? (
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className={inputCls + " min-h-[60px] resize-none"} autoFocus onKeyDown={e => { if (e.key === "Escape") setEditing(false); }} />
        ) : (
          <input value={editValue} onChange={e => setEditValue(e.target.value)} className={inputCls} autoFocus onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
        )}
        <button onClick={save} disabled={saving} className="p-1 rounded-md hover:bg-white/10 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => setEditing(false)} className="p-1 rounded-md hover:bg-white/10 text-white/40"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-1.5 cursor-pointer" onClick={() => { setEditValue(value || ""); setEditing(true); }}>
      <span className={className}>{value || "—"}</span>
      <Pencil className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <span className="text-white/30">{label}: </span>
      <span className="text-white/70">{value}</span>
    </div>
  );
}
