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
  if (!iso) return <span className="apple-label-tertiary">Sin fecha</span>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)
    return <span className="text-apple-red font-semibold tabular-nums">Vencido {Math.abs(diffDays)}d</span>;
  if (diffDays === 0) return <span className="text-apple-yellow font-semibold">Hoy</span>;
  if (diffDays === 1) return <span className="text-apple-yellow font-semibold">Mañana</span>;
  if (diffDays <= 7) return <span className="text-apple-yellow font-semibold tabular-nums">En {diffDays}d</span>;
  return <span className="apple-label-secondary tabular-nums">En {diffDays}d</span>;
}

function PaymentRow({ tx, onSettle, isSettling }) {
  const method = tx.payment_method || "other";
  const icon = PAYMENT_METHOD_ICONS[method] || "💳";
  const label = PAYMENT_METHOD_LABELS[method] || method;
  return (
    <div className="apple-list-row flex items-center gap-3 p-3 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 transition-colors">
      <div className="w-10 h-10 rounded-apple-sm bg-apple-yellow/15 flex items-center justify-center text-lg shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="apple-text-footnote apple-label-primary font-semibold truncate">
          {tx.description || "Gasto sin descripción"}
        </p>
        <div className="flex items-center gap-2 mt-0.5 apple-text-caption1">
          <span className="apple-label-secondary">{label}</span>
          <span className="apple-label-tertiary">·</span>
          <span className="apple-label-secondary tabular-nums flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {formatDateShort(tx.settles_on)}
          </span>
          <span className="apple-label-tertiary">·</span>
          <DaysUntil iso={tx.settles_on} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="apple-text-headline text-apple-yellow font-semibold tabular-nums">
          {money(tx.amount)}
        </p>
      </div>
      {onSettle && (
        <button
          onClick={() => onSettle(tx)}
          disabled={isSettling}
          className="apple-press shrink-0 px-3 py-2 rounded-apple-sm bg-apple-green/15 text-apple-green apple-text-caption1 font-semibold disabled:opacity-40 flex items-center gap-1.5"
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
        <div className="apple-type apple-card rounded-apple-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-apple-yellow" />
            <p className="apple-text-caption2 font-semibold apple-label-tertiary">
              Pagos diferidos
            </p>
          </div>
          <div className="text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-apple-green mx-auto mb-2 opacity-60" />
            <p className="apple-text-footnote apple-label-tertiary">
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
      <div className="apple-type apple-card rounded-apple-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-apple-yellow" />
            <p className="apple-text-caption2 font-semibold text-apple-yellow">
              Pagos diferidos · Por salir del banco
            </p>
          </div>
          <div className="text-right">
            <p className="apple-text-caption2 apple-label-tertiary font-semibold">Total pendiente</p>
            <p className="apple-text-title1 text-apple-yellow tabular-nums">
              {money(totalPending)}
            </p>
          </div>
        </div>

        {/* Buckets de alerta */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {buckets.overdue.count > 0 && (
            <div className="p-2 rounded-apple-sm bg-apple-red/12 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <AlertTriangle className="w-3 h-3 text-apple-red" />
                <p className="apple-text-caption2 text-apple-red font-semibold">Vencidos</p>
              </div>
              <p className="apple-text-subheadline text-apple-red font-semibold tabular-nums">
                {money(buckets.overdue.total)}
              </p>
              <p className="apple-text-caption2 apple-label-tertiary tabular-nums">
                {buckets.overdue.count} pagos
              </p>
            </div>
          )}
          <div className="p-2 rounded-apple-sm bg-apple-yellow/12 text-center">
            <p className="apple-text-caption2 text-apple-yellow font-semibold mb-0.5">
              Esta semana
            </p>
            <p className="apple-text-subheadline text-apple-yellow font-semibold tabular-nums">
              {money(buckets.today.total + buckets.thisWeek.total)}
            </p>
            <p className="apple-text-caption2 apple-label-tertiary tabular-nums">
              {buckets.today.count + buckets.thisWeek.count} pagos
            </p>
          </div>
          <div className="p-2 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 text-center">
            <p className="apple-text-caption2 apple-label-secondary font-semibold mb-0.5">
              30 días
            </p>
            <p className="apple-text-subheadline apple-label-primary font-semibold tabular-nums">
              {money(buckets.thisMonth.total + buckets.later.total)}
            </p>
            <p className="apple-text-caption2 apple-label-tertiary tabular-nums">
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
            <p className="text-center apple-text-caption1 apple-label-tertiary tabular-nums pt-2">
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
    <div className="apple-type space-y-4">
      {/* Resumen */}
      <div className="apple-card rounded-apple-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="apple-text-caption2 font-semibold apple-label-tertiary">
              Pagos diferidos
            </p>
            <p className="apple-text-footnote apple-label-secondary mt-0.5">
              Compras ya realizadas que aún no han salido del banco
            </p>
          </div>
          <div className="text-right">
            <p className="apple-text-caption2 apple-label-tertiary font-semibold">Total pendiente</p>
            <p className="apple-text-large-title text-apple-yellow tabular-nums">
              {money(totalPending)}
            </p>
            <p className="apple-text-caption2 apple-label-tertiary tabular-nums">{unsettled.length} transacciones</p>
          </div>
        </div>
      </div>

      {unsettled.length === 0 ? (
        <div className="apple-card rounded-apple-lg p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-apple-green mx-auto mb-3 opacity-60" />
          <p className="apple-text-body apple-label-secondary font-semibold">
            No tienes pagos pendientes por salir del banco
          </p>
          <p className="apple-text-footnote apple-label-tertiary mt-1">
            Cuando pagues con tarjeta de crédito, Klarna, cheque o PayPal
            crédito, aparecerán aquí hasta que los marques como liquidados.
          </p>
        </div>
      ) : (
        <>
          {/* Bucket: vencidos */}
          {buckets.overdue.count > 0 && (
            <div className="bg-apple-red/12 rounded-apple-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-apple-red" />
                  <p className="apple-text-caption1 font-semibold text-apple-red tabular-nums">
                    Vencidos · {buckets.overdue.count}
                  </p>
                </div>
                <p className="apple-text-headline text-apple-red font-semibold tabular-nums">
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
            <div className="bg-apple-yellow/12 rounded-apple-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="apple-text-caption1 font-semibold text-apple-yellow tabular-nums">
                  Hoy · {buckets.today.count}
                </p>
                <p className="apple-text-headline text-apple-yellow font-semibold tabular-nums">
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
            <div className="bg-apple-yellow/12 rounded-apple-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="apple-text-caption1 font-semibold text-apple-yellow tabular-nums">
                  Esta semana · {buckets.thisWeek.count}
                </p>
                <p className="apple-text-headline text-apple-yellow font-semibold tabular-nums">
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
            <div className="apple-card rounded-apple-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="apple-text-caption1 font-semibold apple-label-secondary tabular-nums">
                  Próximos 30 días · {buckets.thisMonth.count}
                </p>
                <p className="apple-text-headline apple-label-primary font-semibold tabular-nums">
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
            <div className="apple-card rounded-apple-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="apple-text-caption1 font-semibold apple-label-tertiary tabular-nums">
                  Más adelante · {buckets.later.count}
                </p>
                <p className="apple-text-headline apple-label-secondary font-semibold tabular-nums">
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
