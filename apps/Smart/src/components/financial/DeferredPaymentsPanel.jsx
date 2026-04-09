// ──────────────────────────────────────────────────────────────────────────
// DeferredPaymentsPanel — visualiza y gestiona pagos diferidos (pagos que
// aún no han salido del banco: tarjeta crédito, Klarna, cheque, PayPal crédito).
//
// Modo "widget" → resumen compacto con próximos débitos (5 más cercanos).
// Modo "full"   → lista completa con filtros por bucket de fecha.
//
// Acción principal: "Marcar como pagado" → flip is_settled=true + settles_on=null.
// ──────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from "react";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import { Calendar, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import {
  groupUnsettledByDate,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
} from "@/components/utils/deferredPayments";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function formatDateShort(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function DaysUntil({ iso }) {
  if (!iso) return <span className="text-white/40">Sin fecha</span>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)
    return <span className="text-red-400 font-black">Vencido {Math.abs(diffDays)}d</span>;
  if (diffDays === 0) return <span className="text-amber-400 font-black">Hoy</span>;
  if (diffDays === 1) return <span className="text-amber-300 font-bold">Mañana</span>;
  if (diffDays <= 7) return <span className="text-yellow-400 font-bold">En {diffDays}d</span>;
  return <span className="text-white/50">En {diffDays}d</span>;
}

function PaymentRow({ tx, onSettle, isSettling }) {
  const method = tx.payment_method || "other";
  const icon = PAYMENT_METHOD_ICONS[method] || "💳";
  const label = PAYMENT_METHOD_LABELS[method] || method;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-amber-500/20 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-bold truncate">
          {tx.description || "Gasto sin descripción"}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
          <span className="text-white/50">{label}</span>
          <span className="text-white/20">·</span>
          <span className="text-white/50 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {formatDateShort(tx.settles_on)}
          </span>
          <span className="text-white/20">·</span>
          <DaysUntil iso={tx.settles_on} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-base text-amber-300 font-black tabular-nums">
          {money(tx.amount)}
        </p>
      </div>
      {onSettle && (
        <button
          onClick={() => onSettle(tx)}
          disabled={isSettling}
          className="shrink-0 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[11px] font-black hover:bg-emerald-500/25 disabled:opacity-40 flex items-center gap-1.5"
          title="Marcar como pagado (el dinero ya salió del banco)"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pagado</span>
        </button>
      )}
    </div>
  );
}

export default function DeferredPaymentsPanel({
  transactions = [],
  mode = "full", // "widget" | "full"
  onTransactionsChanged,
}) {
  const [settlingIds, setSettlingIds] = useState(new Set());

  // Filtrar solo las no liquidadas
  const unsettled = useMemo(() => {
    return (transactions || []).filter(
      (t) => t.is_settled === false && !t.is_deleted,
    );
  }, [transactions]);

  const buckets = useMemo(() => groupUnsettledByDate(unsettled), [unsettled]);
  const totalPending = useMemo(
    () => unsettled.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [unsettled],
  );

  const handleSettle = async (tx) => {
    if (!tx?.id) return;
    setSettlingIds((prev) => new Set(prev).add(tx.id));
    try {
      await dataClient.entities.Transaction.update(tx.id, {
        is_settled: true,
        settles_on: null,
      });
      toast.success(`✅ ${money(tx.amount)} marcado como pagado`);
      if (onTransactionsChanged) onTransactionsChanged();
    } catch (err) {
      console.error("Error settling transaction:", err);
      toast.error("No se pudo liquidar: " + (err?.message || "error"));
    } finally {
      setSettlingIds((prev) => {
        const next = new Set(prev);
        next.delete(tx.id);
        return next;
      });
    }
  };

  // ─── Modo Widget: resumen compacto con próximos 5 débitos ─────────────
  if (mode === "widget") {
    if (unsettled.length === 0) {
      return (
        <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">
              Pagos diferidos
            </p>
          </div>
          <div className="text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
            <p className="text-xs text-white/40">
              No tienes pagos pendientes por salir del banco
            </p>
          </div>
        </div>
      );
    }

    // Ordenar por fecha, mostrar los 5 más próximos (vencidos primero)
    const sortedByDate = [...unsettled].sort((a, b) => {
      const ad = a.settles_on || "9999-12-31";
      const bd = b.settles_on || "9999-12-31";
      return ad.localeCompare(bd);
    });
    const upcoming = sortedByDate.slice(0, 5);

    return (
      <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
              Pagos diferidos · Por salir del banco
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 font-bold">Total pendiente</p>
            <p className="text-xl text-amber-300 font-black tabular-nums">
              {money(totalPending)}
            </p>
          </div>
        </div>

        {/* Buckets de alerta */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {buckets.overdue.count > 0 && (
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <p className="text-[9px] text-red-300 font-black uppercase">Vencidos</p>
              </div>
              <p className="text-sm text-red-200 font-black">
                {money(buckets.overdue.total)}
              </p>
              <p className="text-[9px] text-red-300/60">
                {buckets.overdue.count} pagos
              </p>
            </div>
          )}
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-[9px] text-amber-300 font-black uppercase mb-0.5">
              Esta semana
            </p>
            <p className="text-sm text-amber-200 font-black">
              {money(buckets.today.total + buckets.thisWeek.total)}
            </p>
            <p className="text-[9px] text-amber-300/60">
              {buckets.today.count + buckets.thisWeek.count} pagos
            </p>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
            <p className="text-[9px] text-white/50 font-black uppercase mb-0.5">
              30 días
            </p>
            <p className="text-sm text-white/80 font-black">
              {money(buckets.thisMonth.total + buckets.later.total)}
            </p>
            <p className="text-[9px] text-white/40">
              {buckets.thisMonth.count + buckets.later.count} pagos
            </p>
          </div>
        </div>

        {/* Lista de próximos débitos */}
        <div className="space-y-2">
          {upcoming.map((tx) => (
            <PaymentRow
              key={tx.id}
              tx={tx}
              onSettle={handleSettle}
              isSettling={settlingIds.has(tx.id)}
            />
          ))}
          {unsettled.length > upcoming.length && (
            <p className="text-center text-[11px] text-white/30 pt-2">
              +{unsettled.length - upcoming.length} pagos más · ve a tab "Pagos
              diferidos"
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Modo Full: lista completa con buckets ────────────────────────────
  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">
              Pagos diferidos
            </p>
            <p className="text-xs text-white/50 mt-0.5">
              Compras ya realizadas que aún no han salido del banco
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 font-bold">Total pendiente</p>
            <p className="text-3xl text-amber-300 font-black tabular-nums">
              {money(totalPending)}
            </p>
            <p className="text-[10px] text-white/30">{unsettled.length} transacciones</p>
          </div>
        </div>
      </div>

      {unsettled.length === 0 ? (
        <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400/50 mx-auto mb-3" />
          <p className="text-sm text-white/60 font-bold">
            No tienes pagos pendientes por salir del banco
          </p>
          <p className="text-xs text-white/40 mt-1">
            Cuando pagues con tarjeta de crédito, Klarna, cheque o PayPal
            crédito, aparecerán aquí hasta que los marques como liquidados.
          </p>
        </div>
      ) : (
        <>
          {/* Bucket: vencidos */}
          {buckets.overdue.count > 0 && (
            <div className="bg-red-500/[0.05] border border-red-500/20 rounded-[24px] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-[11px] font-black text-red-300 uppercase tracking-widest">
                    Vencidos · {buckets.overdue.count}
                  </p>
                </div>
                <p className="text-lg text-red-300 font-black tabular-nums">
                  {money(buckets.overdue.total)}
                </p>
              </div>
              <div className="space-y-2">
                {buckets.overdue.items.map((tx) => (
                  <PaymentRow
                    key={tx.id}
                    tx={tx}
                    onSettle={handleSettle}
                    isSettling={settlingIds.has(tx.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bucket: hoy */}
          {buckets.today.count > 0 && (
            <div className="bg-amber-500/[0.05] border border-amber-500/20 rounded-[24px] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black text-amber-300 uppercase tracking-widest">
                  Hoy · {buckets.today.count}
                </p>
                <p className="text-lg text-amber-300 font-black tabular-nums">
                  {money(buckets.today.total)}
                </p>
              </div>
              <div className="space-y-2">
                {buckets.today.items.map((tx) => (
                  <PaymentRow
                    key={tx.id}
                    tx={tx}
                    onSettle={handleSettle}
                    isSettling={settlingIds.has(tx.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bucket: esta semana */}
          {buckets.thisWeek.count > 0 && (
            <div className="bg-yellow-500/[0.03] border border-yellow-500/15 rounded-[24px] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black text-yellow-300 uppercase tracking-widest">
                  Esta semana · {buckets.thisWeek.count}
                </p>
                <p className="text-lg text-yellow-300 font-black tabular-nums">
                  {money(buckets.thisWeek.total)}
                </p>
              </div>
              <div className="space-y-2">
                {buckets.thisWeek.items.map((tx) => (
                  <PaymentRow
                    key={tx.id}
                    tx={tx}
                    onSettle={handleSettle}
                    isSettling={settlingIds.has(tx.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bucket: este mes */}
          {buckets.thisMonth.count > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-[24px] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black text-white/60 uppercase tracking-widest">
                  Próximos 30 días · {buckets.thisMonth.count}
                </p>
                <p className="text-lg text-white/80 font-black tabular-nums">
                  {money(buckets.thisMonth.total)}
                </p>
              </div>
              <div className="space-y-2">
                {buckets.thisMonth.items.map((tx) => (
                  <PaymentRow
                    key={tx.id}
                    tx={tx}
                    onSettle={handleSettle}
                    isSettling={settlingIds.has(tx.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bucket: después */}
          {buckets.later.count > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-[24px] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">
                  Más adelante · {buckets.later.count}
                </p>
                <p className="text-lg text-white/60 font-black tabular-nums">
                  {money(buckets.later.total)}
                </p>
              </div>
              <div className="space-y-2">
                {buckets.later.items.map((tx) => (
                  <PaymentRow
                    key={tx.id}
                    tx={tx}
                    onSettle={handleSettle}
                    isSettling={settlingIds.has(tx.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
