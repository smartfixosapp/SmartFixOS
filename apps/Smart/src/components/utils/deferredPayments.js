// ──────────────────────────────────────────────────────────────────────────
// Deferred payments — central definitions used by ExpenseDialog, PO flows,
// and Finanzas dashboard (KPIs / widget / tab).
//
// Concept: some payment methods don't debit from the bank immediately.
//   - Credit card: debited on statement date (15 or 30 days later)
//   - Klarna: debited on scheduled installment dates
//   - Check: debited when the payee cashes it
//   - PayPal credit (Pay in 4): debited on installment dates
//
// We store them as transactions with { is_settled: false, settles_on: <date> }.
// When the user confirms the charge hit their bank, they mark it as settled.
// ──────────────────────────────────────────────────────────────────────────

/** Methods that always hit the bank immediately */
export const IMMEDIATE_PAYMENT_METHODS = ["cash", "transfer", "ath_movil"];

/** Methods that are deferred by default (user can override to settled) */
export const DEFERRED_PAYMENT_METHODS = [
  "credit_card",
  "klarna",
  "check",
  "paypal_credit",
];

/** All valid payment_method values (matches DB check constraint) */
export const ALL_PAYMENT_METHODS = [
  "cash",
  "card",
  "transfer",
  "ath_movil",
  "credit_card",
  "klarna",
  "check",
  "paypal_credit",
];

/** Display labels (Spanish, matches existing UI language) */
export const PAYMENT_METHOD_LABELS = {
  cash: "Efectivo",
  card: "Débito",
  transfer: "Transferencia",
  ath_movil: "ATH Móvil",
  credit_card: "Tarjeta de crédito",
  klarna: "Klarna",
  check: "Cheque",
  paypal_credit: "PayPal crédito",
};

/** Emoji/icon per method for quick visual ID */
export const PAYMENT_METHOD_ICONS = {
  cash: "💵",
  card: "💳",
  transfer: "🏦",
  ath_movil: "📱",
  credit_card: "💳",
  klarna: "🛍️",
  check: "📄",
  paypal_credit: "🅿️",
};

/**
 * Returns true if the given payment method is considered deferred
 * (money doesn't leave the bank immediately).
 */
export function isDeferredMethod(method) {
  return DEFERRED_PAYMENT_METHODS.includes(String(method || ""));
}

/**
 * Compute the default settlement date for a given method.
 * Current policy (per user): always ask — we just suggest a reasonable default.
 *   - credit_card: 30 days from now (common statement cycle)
 *   - klarna: 14 days from now (common Pay-in-4 first installment)
 *   - check: 7 days from now (common clearance)
 *   - paypal_credit: 14 days from now
 *   - others (immediate): today
 */
export function defaultSettlementDate(method) {
  const now = new Date();
  const daysOffset = {
    credit_card: 30,
    klarna: 14,
    check: 7,
    paypal_credit: 14,
  }[method] ?? 0;
  const d = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Build the settlement portion of a transaction payload from user input.
 * Returns { is_settled, settles_on } ready to spread into the payload.
 *
 * @param {object} opts
 * @param {string} opts.method - payment_method value
 * @param {boolean} [opts.userMarkedDeferred] - explicit override (true=force deferred)
 * @param {string} [opts.settlesOn] - ISO date string YYYY-MM-DD
 */
export function buildSettlementFields({ method, userMarkedDeferred, settlesOn }) {
  const isDeferred =
    typeof userMarkedDeferred === "boolean"
      ? userMarkedDeferred
      : isDeferredMethod(method);
  if (!isDeferred) {
    return { is_settled: true, settles_on: null };
  }
  return {
    is_settled: false,
    settles_on: settlesOn || defaultSettlementDate(method),
  };
}

/**
 * Group unsettled transactions by date bucket relative to today.
 * Returns { overdue, today, thisWeek, thisMonth, later } each with { count, total, items }.
 */
export function groupUnsettledByDate(transactions, today = new Date()) {
  const todayKey = today.toISOString().slice(0, 10);
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const buckets = {
    overdue: { count: 0, total: 0, items: [] },
    today: { count: 0, total: 0, items: [] },
    thisWeek: { count: 0, total: 0, items: [] },
    thisMonth: { count: 0, total: 0, items: [] },
    later: { count: 0, total: 0, items: [] },
  };

  for (const tx of transactions || []) {
    if (tx.is_settled !== false) continue;
    const settlesOn = String(tx.settles_on || "").slice(0, 10);
    const amount = Number(tx.amount || 0);
    let bucket;
    if (!settlesOn) bucket = "later";
    else if (settlesOn < todayKey) bucket = "overdue";
    else if (settlesOn === todayKey) bucket = "today";
    else if (settlesOn <= in7Days) bucket = "thisWeek";
    else if (settlesOn <= in30Days) bucket = "thisMonth";
    else bucket = "later";
    buckets[bucket].count++;
    buckets[bucket].total += amount;
    buckets[bucket].items.push(tx);
  }
  return buckets;
}
