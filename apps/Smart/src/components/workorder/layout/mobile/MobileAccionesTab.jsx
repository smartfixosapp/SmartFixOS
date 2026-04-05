import React, { useMemo, useState, useRef, useCallback } from "react";
import {
  DollarSign, Wallet, ShoppingCart, MessageSquare, Camera,
  Zap, Send, Printer, Shield, ChevronRight, ChevronDown,
  MessageCircle, Mail, Phone, Smartphone, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";
import { triggerHaptic } from "@/lib/capacitor";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  { id: "checkout", icon: DollarSign, label: "Checkout", color: "text-emerald-400", badgeKey: "balance" },
  { id: "deposit", icon: Wallet, label: "Deposito", color: "text-amber-400" },
  { id: "parts", icon: ShoppingCart, label: "Piezas y accesorios", color: "text-cyan-400" },
  { id: "photos", icon: Camera, label: "Subir fotos", color: "text-cyan-400" },
  { id: "note", icon: MessageSquare, label: "Agregar nota", color: "text-blue-400" },
  { id: "notify", icon: Send, label: "Notificar cliente", color: "text-violet-400", expandable: true },
  { id: "print", icon: Printer, label: "Imprimir", color: "text-white/60" },
  { id: "security", icon: Shield, label: "Seguridad", color: "text-purple-400" },
];

export default function MobileAccionesTab({
  order,
  status,
  activeStatuses,
  closedStatuses,
  changingStatus,
  onChangeStatus,
  onPaymentClick,
  onPrint,
  onSecurityEdit,
  onSwitchTab,
  onUpdate,
  stageContent,
}) {
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [showNotifyOptions, setShowNotifyOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef(null);
  const o = order || {};
  const phone = o.customer_phone || o.phone;

  // Photo upload
  const handlePhotoUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type?.startsWith("image/"));
    if (!files.length || !o.id) return;
    setUploading(true);
    triggerHaptic("light");
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      const existing = o.photos_metadata || o.device_photos || [];
      const newItems = [];
      for (const file of files) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          const versionedUrl = `${file_url}${file_url.includes("?") ? "&" : "?"}v=${Date.now()}`;
          newItems.push({
            id: `${Date.now()}-${file.name}`,
            type: "image",
            mime: file.type || "image/jpeg",
            filename: file.name,
            publicUrl: versionedUrl,
            thumbUrl: versionedUrl,
            stage_id: "general",
            stage_label: "General",
            captured_at: new Date().toISOString(),
            captured_by: me?.full_name || me?.email || "Sistema",
          });
        } catch (err) {
          console.error("Upload error:", err);
        }
      }
      if (!newItems.length) throw new Error("No se pudo subir");
      await base44.entities.Order.update(o.id, { photos_metadata: [...existing, ...newItems] });
      onUpdate?.();
      triggerHaptic("success");
      toast.success(`${newItems.length} foto(s) subida(s)`);
    } catch {
      toast.error("Error al subir fotos");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [o, onUpdate]);

  // Badges
  const badges = useMemo(() => {
    const b = {};
    const total = Number(o.total || o.cost_estimate || 0);
    const paid = Number(o.amount_paid ?? o.total_paid ?? 0);
    const balance = o.balance_due != null ? Number(o.balance_due || 0) : Math.max(0, total - paid);
    if (balance > 0.01) b.balance = true;
    const photos = o.photos_metadata || o.device_photos || [];
    if (photos.length === 0 && normalizeStatusId(status) === "intake") b.photos = true;
    if (o.warranty_countdown?.days_remaining <= 3) b.warranty = true;
    return b;
  }, [o, status]);

  // Next status
  const nextStatus = useMemo(() => {
    const currentOrder = getStatusConfig(status).order || 0;
    return activeStatuses
      .filter(s => (s.order || 0) > currentOrder && !s.isTerminal)
      .sort((a, b) => (a.order || 0) - (b.order || 0))[0] || null;
  }, [status, activeStatuses]);

  const allStatuses = useMemo(() => {
    return [...activeStatuses, ...(closedStatuses || [])]
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [activeStatuses, closedStatuses]);

  const handleAction = (id) => {
    triggerHaptic("light");
    switch (id) {
      case "checkout": onPaymentClick?.("full"); break;
      case "deposit": onPaymentClick?.("deposit"); break;
      case "parts": document.dispatchEvent(new CustomEvent("wo:open-catalog")); break;
      case "photos": photoInputRef.current?.click(); break;
      case "print": onPrint?.(); break;
      case "security": onSecurityEdit?.(); break;
      case "notify": setShowNotifyOptions(v => !v); break;
      case "note": onSwitchTab?.(2); break; // Switch to Historial tab
      default: break;
    }
  };

  const handleNotify = (channel) => {
    triggerHaptic("light");
    const cleanPhone = (phone || "").replace(/\D/g, "");
    const name = o.customer_name || "";
    const orderNum = o.order_number || "";
    const msg = `Hola ${name}, le contactamos de SmartFixOS sobre su orden #${orderNum}.`;

    switch (channel) {
      case "whatsapp":
        if (cleanPhone) window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
        break;
      case "email":
        if (o.customer_email) {
          const subj = encodeURIComponent(`Actualizacion de orden #${orderNum}`);
          const body = encodeURIComponent(msg);
          window.open(`mailto:${o.customer_email}?subject=${subj}&body=${body}`);
        }
        break;
      case "sms":
        if (cleanPhone) window.open(`sms:${cleanPhone}&body=${encodeURIComponent(msg)}`);
        break;
    }
    setShowNotifyOptions(false);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Next Status CTA */}
      {nextStatus && (
        <button
          onClick={() => { triggerHaptic("medium"); onChangeStatus?.(nextStatus.id); }}
          disabled={changingStatus}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.97]",
            changingStatus ? "opacity-50 cursor-not-allowed" : "hover:brightness-110",
            nextStatus.colorClasses || "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
            "border"
          )}
        >
          <Zap className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-left">Pasar a {nextStatus.label}</span>
          <ChevronRight className="w-4 h-4 opacity-50" />
        </button>
      )}

      {/* Quick Actions heading */}
      <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Acciones rapidas</h3>

      {/* Quick Actions List */}
      <div className="space-y-1">
        {QUICK_ACTIONS.map(action => (
          <React.Fragment key={action.id}>
            <button
              onClick={() => handleAction(action.id)}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] active:scale-[0.98] transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <action.icon className={cn("w-4.5 h-4.5", action.color)} />
              </div>
              <span className="flex-1 text-left text-sm font-semibold text-white/80">{action.label}</span>
              {badges[action.badgeKey] && (
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              )}
              {action.expandable ? (
                <ChevronDown className={cn("w-4 h-4 text-white/20 transition-transform", showNotifyOptions && "rotate-180")} />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/20" />
              )}
            </button>

            {/* Notify sub-options */}
            {action.id === "notify" && showNotifyOptions && (
              <div className="ml-6 space-y-1 py-1">
                {phone && (
                  <button
                    onClick={() => handleNotify("whatsapp")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 active:scale-[0.98] transition-all"
                  >
                    <MessageCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-green-300">WhatsApp</span>
                  </button>
                )}
                {o.customer_email && (
                  <button
                    onClick={() => handleNotify("email")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 active:scale-[0.98] transition-all"
                  >
                    <Mail className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-300">Email</span>
                  </button>
                )}
                {phone && (
                  <button
                    onClick={() => handleNotify("sms")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 active:scale-[0.98] transition-all"
                  >
                    <Smartphone className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-300">Mensaje de texto</span>
                  </button>
                )}
                {!phone && !o.customer_email && (
                  <p className="text-xs text-white/30 px-4 py-2">Sin datos de contacto disponibles</p>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Stage content */}
      {stageContent && (
        <div className="mt-4">
          {stageContent}
        </div>
      )}

      {/* Status dropdown */}
      <div className="mt-4">
        <button
          onClick={() => setShowAllStatuses(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/50 transition-all"
        >
          <span>Cambiar estado...</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showAllStatuses && "rotate-180")} />
        </button>

        {showAllStatuses && (
          <div className="mt-2 space-y-1 p-2 rounded-xl border border-white/10 bg-[#0D0D0F]">
            {allStatuses.map(s => {
              const isCurrent = normalizeStatusId(status) === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (!isCurrent) {
                      triggerHaptic("medium");
                      onChangeStatus?.(s.id);
                      setShowAllStatuses(false);
                    }
                  }}
                  disabled={changingStatus || isCurrent}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all text-left",
                    isCurrent ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color || "#6B7280" }} />
                  <span className="truncate flex-1">{s.label}</span>
                  {isCurrent && <span className="text-[10px] text-white/30">actual</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
