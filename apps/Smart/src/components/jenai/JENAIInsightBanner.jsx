import React, { useState, useEffect, useCallback } from "react";
import { Brain, Sparkles, ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import { callJENAI } from "@/lib/jenaiEngine";

/**
 * JENAI Insight Banner — reusable component for AI insights
 * @param {string} context - The area (dashboard, financial, inventory, pos, customers)
 * @param {object} data - KPI data to send to JENAI for analysis
 * @param {string} accentColor - purple | emerald | cyan | amber | blue
 * @param {boolean} autoLoad - fetch insight on mount (default: true)
 */
export default function JENAIInsightBanner({ context = "dashboard", data = {}, accentColor = "purple", autoLoad = true }) {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const PROMPTS = {
    dashboard: {
      system: `Eres JENAI, asistente de SmartFixOS. Analiza los KPIs del dia y da un resumen ejecutivo en espanol.
Maximo 3 oraciones. Se directo y actionable. Incluye una recomendacion concreta.
NO uses markdown. Texto plano.`,
      user: (d) => `KPIs de hoy:
- Ingreso hoy: $${d.todayIncome || 0}
- Gastos hoy: $${d.todayExpenses || 0}
- Ingreso del mes: $${d.monthIncome || 0}
- Ordenes activas: ${d.activeOrders || 0}
- Listas para recoger: ${d.readyToPickup || 0}
- Entregadas hoy: ${d.deliveredToday || 0}
- Ordenes atrasadas: ${d.overdue || 0}
Analiza el rendimiento y da una recomendacion.`,
    },
    financial: {
      system: `Eres JENAI, analista financiero de SmartFixOS. Da un analisis breve de la salud financiera.
Maximo 3 oraciones. Incluye: tendencia, riesgo principal, y una accion sugerida.
NO uses markdown. Texto plano.`,
      user: (d) => `Datos financieros:
- Ingreso hoy: $${d.todayIncome || 0}
- Ingreso mes: $${d.monthIncome || 0}
- Gastos mes: $${d.monthExpenses || 0}
- Profit neto: $${d.netProfit || 0}
- Margen: ${d.margin || 0}%
- Transacciones hoy: ${d.txCount || 0}
Analiza la salud financiera.`,
    },
    inventory: {
      system: `Eres JENAI, analista de inventario de SmartFixOS. Analiza el estado del stock y da alertas.
Maximo 3 oraciones. Prioriza: que comprar urgente, riesgo de quedarse sin stock, oportunidad.
NO uses markdown. Texto plano.`,
      user: (d) => `Estado del inventario:
- Total productos: ${d.totalProducts || 0}
- Sin stock: ${d.outOfStock || 0}
- Stock bajo: ${d.lowStock || 0}
- Stock saludable: ${d.healthy || 0}
- Valor total inventario: $${d.totalValue || 0}
${d.criticalItems ? `Productos criticos: ${d.criticalItems}` : ""}
Analiza y recomienda.`,
    },
    pos: {
      system: `Eres JENAI, asistente de ventas de SmartFixOS. Sugiere como maximizar ventas hoy.
Maximo 2 oraciones. Se practico y directo.
NO uses markdown. Texto plano.`,
      user: (d) => `Ventas de hoy:
- Ventas hoy: ${d.salesToday || 0}
- Monto total: $${d.totalToday || 0}
- Producto mas vendido: ${d.topProduct || "N/A"}
- Ordenes listas para cobrar: ${d.readyToPay || 0}
Sugiere como aumentar las ventas.`,
    },
    customers: {
      system: `Eres JENAI, analista de clientes de SmartFixOS. Analiza la base de clientes.
Maximo 3 oraciones. Incluye: retencion, clientes en riesgo, y accion para traer clientes de vuelta.
NO uses markdown. Texto plano.`,
      user: (d) => `Base de clientes:
- Total clientes: ${d.totalCustomers || 0}
- Clientes VIP (3+ ordenes): ${d.vipCount || 0}
- Inactivos (30+ dias): ${d.inactiveCount || 0}
- Nuevos este mes: ${d.newThisMonth || 0}
- Cliente top: ${d.topCustomer || "N/A"}
Analiza retencion y sugiere acciones.`,
    },
  };

  const fetchInsight = useCallback(async () => {
    const config = PROMPTS[context];
    if (!config) return;
    setLoading(true);
    try {
      const result = await callJENAI(config.user(data), {
        maxTokens: 200,
        temperature: 0.4,
        systemPrompt: config.system,
      });
      setInsight(result);
      setHasLoaded(true);
    } catch {
      setInsight("No se pudo generar el analisis. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [context, JSON.stringify(data)]);

  useEffect(() => {
    if (autoLoad && !hasLoaded && Object.values(data).some(v => v)) {
      fetchInsight();
    }
  }, [autoLoad, hasLoaded, fetchInsight]);

  const colors = {
    purple: { border: "border-violet-500/20", bg: "from-violet-500/8 to-purple-500/5", text: "text-violet-300", icon: "text-violet-400", btn: "bg-violet-500/15 hover:bg-violet-500/25 text-violet-300" },
    emerald: { border: "border-emerald-500/20", bg: "from-emerald-500/8 to-teal-500/5", text: "text-emerald-300", icon: "text-emerald-400", btn: "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300" },
    cyan: { border: "border-cyan-500/20", bg: "from-cyan-500/8 to-blue-500/5", text: "text-cyan-300", icon: "text-cyan-400", btn: "bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300" },
    amber: { border: "border-amber-500/20", bg: "from-amber-500/8 to-yellow-500/5", text: "text-amber-300", icon: "text-amber-400", btn: "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300" },
    blue: { border: "border-blue-500/20", bg: "from-blue-500/8 to-indigo-500/5", text: "text-blue-300", icon: "text-blue-400", btn: "bg-blue-500/15 hover:bg-blue-500/25 text-blue-300" },
  };
  const c = colors[accentColor] || colors.purple;

  return (
    <div className={`rounded-2xl border ${c.border} bg-gradient-to-r ${c.bg} overflow-hidden transition-all`}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <Brain className={`w-4 h-4 ${c.icon}`} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>JENAI Insights</span>
          <span className="text-[8px] text-white/20">powered by SmartFixOS</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasLoaded && (
            <button
              onClick={(e) => { e.stopPropagation(); fetchInsight(); }}
              disabled={loading}
              className={`p-1 rounded-lg ${c.btn} transition-all`}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-white/25" /> : <ChevronDown className="w-3.5 h-3.5 text-white/25" />}
        </div>
      </button>

      {/* Content */}
      {open && (
        <div className="px-4 pb-3">
          {loading && !insight ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className={`w-3.5 h-3.5 animate-spin ${c.icon}`} />
              <span className="text-xs text-white/40">JENAI analizando...</span>
            </div>
          ) : insight ? (
            <p className="text-xs text-white/65 leading-relaxed">{insight}</p>
          ) : (
            <button
              onClick={fetchInsight}
              disabled={loading}
              className={`flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg ${c.btn} transition-all`}
            >
              <Sparkles className="w-3 h-3" /> Generar analisis
            </button>
          )}
        </div>
      )}
    </div>
  );
}
