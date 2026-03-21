import React, { useEffect, useState } from "react";
import { Sparkles, Zap, Wrench, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";

// ── Config visual por tipo ────────────────────────────────────────────────
const TYPE_CONFIG = {
  feature:     {
    label: "Nuevo",
    icon: Zap,
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/30",
    text: "text-cyan-300",
    dot: "bg-cyan-400",
  },
  improvement: {
    label: "Mejora",
    icon: TrendingUp,
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  fix:         {
    label: "Fix",
    icon: Wrench,
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  breaking:    {
    label: "Importante",
    icon: AlertTriangle,
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    text: "text-red-300",
    dot: "bg-red-400",
  },
};

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.feature;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric", month: "short",
    });
  } catch { return ""; }
}

export default function NovedadesPanel() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await supabase
          .from("app_update")
          .select("id, title, description, type, version, published_at, order")
          .eq("published", true)
          .order("order", { ascending: true })
          .order("published_at", { ascending: false })
          .limit(5);
        if (!cancelled) setUpdates(data || []);
      } catch {
        // Si no hay conexión o la tabla no existe, simplemente no mostrar nada
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // No mostrar nada si no hay actualizaciones publicadas
  if (loading || updates.length === 0) return null;

  return (
    <div className="w-full max-w-sm mx-auto mt-6">
      {/* Título */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
          Novedades
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {updates.map((item, idx) => {
          const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.feature;
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-2xl border backdrop-blur-sm transition-all
                ${cfg.bg} ${cfg.border}`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cfg.dot}`} />

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={item.type} />
                  {item.version && (
                    <span className="text-[10px] text-white/30 font-mono">v{item.version}</span>
                  )}
                  {item.published_at && (
                    <span className="text-[10px] text-white/25 ml-auto">
                      {formatDate(item.published_at)}
                    </span>
                  )}
                </div>
                <p className={`text-xs font-semibold mt-1 ${cfg.text}`}>{item.title}</p>
                {item.description && (
                  <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{item.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
