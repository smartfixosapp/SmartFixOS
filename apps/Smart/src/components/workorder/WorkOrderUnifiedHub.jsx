import React, { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Activity, Camera, ChevronDown, LockKeyhole, Sparkles } from "lucide-react";
import OrderSecurity from "@/components/workorder/sections/OrderSecurity";
import OrderMultimedia from "@/components/workorder/sections/OrderMultimedia";
import WorkOrderTimeline from "@/components/orders/workorder/WorkOrderTimeline";

export default function WorkOrderUnifiedHub({
  order,
  onUpdate,
  title = "Centro de Historial",
  subtitle = "Historial, fotos y seguridad reunidos en un solo lugar",
  accent = "cyan",
  openTab = null
}) {
  const o = order || {};
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    if (openTab) setActiveTab(openTab);
  }, [openTab]);

  const photoCount = useMemo(() => {
    const groups = [
      Array.isArray(o.photos_metadata) ? o.photos_metadata.length : 0,
      Array.isArray(o.device_photos) ? o.device_photos.length : 0,
      Array.isArray(o.photos) ? o.photos.length : 0,
    ];
    return Math.max(...groups, 0);
  }, [o]);

  const securityCount = useMemo(
    () =>
      [
        o?.device_security?.device_pin,
        o?.device_security?.device_password,
        o?.device_security?.pattern_vector,
        o?.device_security?.pattern_image,
      ].filter(Boolean).length,
    [o]
  );

  const accentMap = {
    cyan: {
      border: "border-cyan-500/15",
      bg: "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
      header: "bg-gradient-to-r from-cyan-500/10 to-transparent",
      icon: "border-cyan-400/20 bg-cyan-500/15 text-cyan-300",
      active: "bg-cyan-500/20 text-cyan-100 border-cyan-400/30",
    },
    purple: {
      border: "border-purple-500/15",
      bg: "bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
      header: "bg-gradient-to-r from-purple-500/10 to-transparent",
      icon: "border-purple-400/20 bg-purple-500/15 text-purple-300",
      active: "bg-purple-500/20 text-purple-100 border-purple-400/30",
    },
    emerald: {
      border: "border-emerald-500/15",
      bg: "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
      header: "bg-gradient-to-r from-emerald-500/10 to-transparent",
      icon: "border-emerald-400/20 bg-emerald-500/15 text-emerald-300",
      active: "bg-emerald-500/20 text-emerald-100 border-emerald-400/30",
    },
    amber: {
      border: "border-amber-500/15",
      bg: "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
      header: "bg-gradient-to-r from-amber-500/10 to-transparent",
      icon: "border-amber-400/20 bg-amber-500/15 text-amber-300",
      active: "bg-amber-500/20 text-amber-100 border-amber-400/30",
    },
    fuchsia: {
      border: "border-fuchsia-500/15",
      bg: "bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
      header: "bg-gradient-to-r from-fuchsia-500/10 to-transparent",
      icon: "border-fuchsia-400/20 bg-fuchsia-500/15 text-fuchsia-300",
      active: "bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-400/30",
    },
  };

  const tone = accentMap[accent] || accentMap.cyan;

  return (
    <section className={`overflow-hidden rounded-[28px] border ${tone.border} ${tone.bg} shadow-[0_18px_50px_rgba(0,0,0,0.28)]`}>
      <div className={`border-b border-white/10 p-5 ${tone.header}`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${tone.icon}`}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Módulo unificado</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-black tracking-tight text-white">{title}</h3>
              <Badge className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-white/70">{photoCount} fotos</Badge>
              <Badge className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-white/70">{securityCount} claves</Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "timeline" ? null : "timeline")}
            className={`flex items-center justify-between rounded-[20px] border px-4 py-4 text-left transition-all ${
              activeTab === "timeline"
                ? tone.active
                : "border-white/10 bg-black/20 text-white/75 hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-cyan-300" />
              <div>
                <p className="text-sm font-black text-white">Historial</p>
                <p className="text-xs text-white/45">Notas, checklist y actividad</p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${activeTab === "timeline" ? "rotate-180" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "photos" ? null : "photos")}
            className={`flex items-center justify-between rounded-[20px] border px-4 py-4 text-left transition-all ${
              activeTab === "photos"
                ? "border-blue-400/30 bg-blue-500/20 text-blue-100"
                : "border-white/10 bg-black/20 text-white/75 hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Camera className="h-4 w-4 text-blue-300" />
              <div>
                <p className="text-sm font-black text-white">Fotos</p>
                <p className="text-xs text-white/45">{photoCount} cargada{photoCount === 1 ? "" : "s"}</p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${activeTab === "photos" ? "rotate-180" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "security" ? null : "security")}
            className={`flex items-center justify-between rounded-[20px] border px-4 py-4 text-left transition-all ${
              activeTab === "security"
                ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-100"
                : "border-white/10 bg-black/20 text-white/75 hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-3">
              <LockKeyhole className="h-4 w-4 text-emerald-300" />
              <div>
                <p className="text-sm font-black text-white">Seguridad</p>
                <p className="text-xs text-white/45">{securityCount} clave{securityCount === 1 ? "" : "s"} registrada{securityCount === 1 ? "" : "s"}</p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${activeTab === "security" ? "rotate-180" : ""}`} />
          </button>
        </div>

        {activeTab && (
          <div className="mt-5">
            {activeTab === "timeline" && <WorkOrderTimeline order={order} onUpdate={onUpdate} />}
            {activeTab === "photos" && <OrderMultimedia order={order} onUpdate={onUpdate} />}
            {activeTab === "security" && <OrderSecurity order={order} onUpdate={onUpdate} />}
          </div>
        )}
      </div>
    </section>
  );
}
