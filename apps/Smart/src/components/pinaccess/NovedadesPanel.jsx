import React, { useEffect, useState } from "react";
import { Sparkles, Zap, Wrench, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";

// ── Config visual por tipo ────────────────────────────────────────────────
const TYPE_CONFIG = {
  feature:     {
    label: "Nuevo",
    icon: Zap,
    bg: "bg-apple-blue/15",
    text: "text-apple-blue",
    dot: "bg-apple-blue",
  },
  improvement: {
    label: "Mejora",
    icon: TrendingUp,
    bg: "bg-apple-green/15",
    text: "text-apple-green",
    dot: "bg-apple-green",
  },
  fix:         {
    label: "Fix",
    icon: Wrench,
    bg: "bg-apple-yellow/15",
    text: "text-apple-yellow",
    dot: "bg-apple-yellow",
  },
  breaking:    {
    label: "Importante",
    icon: AlertTriangle,
    bg: "bg-apple-red/15",
    text: "text-apple-red",
    dot: "bg-apple-red",
  },
};

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.feature;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full apple-text-caption2 font-semibold ${cfg.bg} ${cfg.text}`}>
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
    <div className="apple-type w-full max-w-sm mx-auto mt-6">
      {/* Título */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Sparkles className="w-4 h-4 text-apple-yellow" />
        <span className="apple-text-caption1 font-semibold apple-label-tertiary">
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
              className={`flex items-start gap-3 p-3 rounded-apple-md transition-all ${cfg.bg}`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cfg.dot}`} />

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={item.type} />
                  {item.version && (
                    <span className="apple-text-caption2 apple-label-tertiary font-mono tabular-nums">v{item.version}</span>
                  )}
                  {item.published_at && (
                    <span className="apple-text-caption2 apple-label-tertiary ml-auto tabular-nums">
                      {formatDate(item.published_at)}
                    </span>
                  )}
                </div>
                <p className={`apple-text-caption1 font-semibold mt-1 ${cfg.text}`}>{item.title}</p>
                {item.description && (
                  <p className="apple-text-caption2 apple-label-tertiary mt-0.5 line-clamp-2">{item.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
