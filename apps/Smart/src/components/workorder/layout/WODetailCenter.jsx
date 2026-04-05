import React from "react";
import { Phone, MessageCircle, Mail, Smartphone, Laptop, Tablet, Watch, Gamepad2, Box } from "lucide-react";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";

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
  children, // stage-specific content
}) {
  const o = order || {};
  const phone = o.customer_phone || o.phone;

  return (
    <div className="space-y-4">
      {/* ── Customer & Device ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Customer */}
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4 space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Cliente</h4>
          <p className="text-sm font-bold text-white">{o.customer_name || "—"}</p>
          {phone && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Phone className="w-3 h-3" />
              <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>
              <a
                href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300"
              >
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

        {/* Device */}
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4 space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Dispositivo</h4>
          <div className="flex items-center gap-2">
            <DeviceIcon type={o.device_type} />
            <p className="text-sm font-bold text-white">
              {[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type || "—"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/50">
            {o.device_color && <Field label="Color" value={o.device_color} />}
            {o.device_imei && <Field label="IMEI/Serial" value={o.device_imei} />}
          </div>
        </div>
      </div>

      {/* ── Problem ── */}
      {o.initial_problem && (
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">Problema reportado</h4>
          <p className="text-sm text-white/80 leading-relaxed">{o.initial_problem}</p>
        </div>
      )}

      {/* ── Stage-specific content ── */}
      {children}

      {/* ── Items & Cost ── */}
      <SharedItemsSection
        order={order}
        onUpdate={onUpdate}
        onOrderItemsUpdate={onOrderItemsUpdate}
        onRemoteSaved={onRemoteSaved}
        onClose={onClose}
        onPaymentClick={onPaymentClick}
      />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <span className="text-white/30">{label}: </span>
      <span className="text-white/70">{value}</span>
    </div>
  );
}
