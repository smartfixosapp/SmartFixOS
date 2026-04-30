/**
 * PaymentModalNative
 *
 * Drop-in payment modal that uses iOS-native facilities for the parts
 * that benefit most from them:
 *   - haptic feedback on keypad presses
 *   - native confirm dialog for irreversible actions
 *   - decimal `inputMode` so iOS shows the right keyboard
 *
 * Designed to live alongside the existing CheckoutModalDesktop /
 * CheckoutModalMobile. Pass cart items + the price breakdown and the
 * modal handles method selection, keypad entry, change calculation, and
 * (for sales ≥ $500) a native confirm dialog before invoking your
 * onConfirmPayment callback.
 *
 * Usage:
 *   import { PaymentModalNative } from "@/components/PaymentModalNative";
 *
 *   <PaymentModalNative
 *     isOpen={showPayment}
 *     onClose={() => setShowPayment(false)}
 *     items={cartItems}
 *     subtotal={subtotal}
 *     tax={tax}
 *     total={total}
 *     onConfirmPayment={async (data) => {
 *       await recordSale(data);
 *     }}
 *   />
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { NumericInputHelper, inputModeFor } from "@/plugins/NumericInputHelper";
import { NativeUIPlugin } from "@/plugins/NativeUIPlugin";
import "./PaymentModalNative.css";

export type PaymentMethod = "cash" | "card" | "ath" | "split";

/** Single line item in the cart. Matches the existing SmartFixOS POS shape. */
export interface CartItem {
  id?: string | number;
  name: string;
  price: number;
  quantity: number;
  /** Optional secondary line, e.g. SKU or model. */
  subtitle?: string;
}

/** Payload returned to the host page when the user confirms payment. */
export interface PaymentData {
  method: PaymentMethod;
  /** Amount the customer handed over (= total for non-cash). */
  amountReceived: number;
  /** Change to give back (cash only; 0 for card/ATH). */
  change: number;
  /** Optional confirmation code / last 4 digits / ATH reference. */
  reference?: string;
  /** Items and totals echoed back so the caller doesn't need to re-pass them. */
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface PaymentModalNativeProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  onConfirmPayment: (data: PaymentData) => Promise<void> | void;
  /** ISO currency code. Defaults to "USD". */
  currency?: string;
  /** Pre-select a payment method. Defaults to "cash". */
  defaultMethod?: PaymentMethod;
}

const METHOD_LABELS: Record<PaymentMethod, { label: string; sub: string; emoji: string }> = {
  cash:  { label: "Efectivo",   sub: "Monto recibido",     emoji: "💵" },
  card:  { label: "Tarjeta",    sub: "Pago exacto",        emoji: "💳" },
  ath:   { label: "ATH Móvil",  sub: "Pago exacto",        emoji: "📱" },
  split: { label: "Dividido",   sub: "Efectivo + ATH",     emoji: "🧮" },
};

function formatMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return `$${(n || 0).toFixed(2)}`;
  }
}

function parseMoney(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^0-9.,]/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export const PaymentModalNative: React.FC<PaymentModalNativeProps> = ({
  isOpen,
  onClose,
  items,
  subtotal,
  tax,
  total,
  onConfirmPayment,
  currency = "USD",
  defaultMethod = "cash",
}) => {
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [amountText, setAmountText] = useState<string>(total.toFixed(2));
  const [reference, setReference] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the modal re-opens or the total changes.
  useEffect(() => {
    if (isOpen) {
      setMethod(defaultMethod);
      // Card / ATH pre-fill exactly to total (no manual entry needed).
      // Cash starts at total but the user can type a higher "amount received".
      setAmountText(total.toFixed(2));
      setReference("");
      setSubmitting(false);
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOpen, defaultMethod, total]);

  // When the user switches to card/ATH, snap to total exactly.
  useEffect(() => {
    if (method === "card" || method === "ath") {
      setAmountText(total.toFixed(2));
    }
  }, [method, total]);

  const amountReceived = useMemo(() => parseMoney(amountText), [amountText]);
  const change = method === "cash" ? Math.max(0, amountReceived - total) : 0;
  const short = Math.max(0, total - amountReceived);
  const canConfirm = amountReceived > 0 && short === 0 && !submitting && items.length > 0;

  const handleKey = (digit: string) => {
    NumericInputHelper.tapHaptic({ style: "light" }).catch(() => {});
    if (digit === "back") {
      setAmountText((s) => (s.length > 1 ? s.slice(0, -1) : "0"));
      return;
    }
    if (digit === "clear") {
      setAmountText("0");
      return;
    }
    setAmountText((s) => {
      if (s === "0" && digit !== ".") return digit;
      if (digit === "." && s.includes(".")) return s;
      return s + digit;
    });
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    // Native confirm for sales over $500 to avoid accidental taps.
    if (total >= 500) {
      const result = await NativeUIPlugin.confirm({
        title: "Confirmar pago",
        message: `¿Cobrar ${formatMoney(total, currency)} con ${METHOD_LABELS[method].label}?`,
        confirmLabel: "Cobrar",
        cancelLabel: "Cancelar",
      });
      if (!result.confirmed) return;
    }
    setSubmitting(true);
    try {
      await onConfirmPayment({
        method,
        amountReceived,
        change,
        reference: reference.trim() || undefined,
        items,
        subtotal,
        tax,
        total,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pmn-backdrop" role="dialog" aria-modal="true" aria-label="Finalizar cobro">
      <div className="pmn-card">
        <header className="pmn-header">
          <h2 className="pmn-title">Finalizar Cobro</h2>
          <button className="pmn-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        {/* ── Items list ──────────────────────────────────────────── */}
        {items.length > 0 && (
          <section className="pmn-items" aria-label="Artículos">
            <ul className="pmn-items-list">
              {items.map((it, i) => (
                <li key={it.id ?? i} className="pmn-item">
                  <span className="pmn-item-qty">{it.quantity}×</span>
                  <span className="pmn-item-name">
                    {it.name}
                    {it.subtitle && <span className="pmn-item-sub"> · {it.subtitle}</span>}
                  </span>
                  <span className="pmn-mono pmn-item-price">
                    {formatMoney(it.price * it.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Price breakdown ─────────────────────────────────────── */}
        <section className="pmn-summary">
          <div className="pmn-row">
            <span>Subtotal</span><span className="pmn-mono">{formatMoney(subtotal, currency)}</span>
          </div>
          {tax > 0 && (
            <div className="pmn-row">
              <span>Impuesto</span><span className="pmn-mono">{formatMoney(tax, currency)}</span>
            </div>
          )}
          <div className="pmn-row pmn-row--total">
            <span>Total</span><span className="pmn-mono">{formatMoney(total, currency)}</span>
          </div>
          {method === "cash" && amountReceived > 0 && (
            <>
              <div className="pmn-row pmn-row--pay">
                <span>Recibido</span><span className="pmn-mono">{formatMoney(amountReceived, currency)}</span>
              </div>
              {short > 0 && (
                <div className="pmn-row pmn-row--short"><span>Falta</span><span className="pmn-mono">{formatMoney(short, currency)}</span></div>
              )}
              {change > 0 && (
                <div className="pmn-row pmn-row--change"><span>Cambio</span><span className="pmn-mono">{formatMoney(change, currency)}</span></div>
              )}
            </>
          )}
        </section>

        {/* ── Method selector ─────────────────────────────────────── */}
        <section className="pmn-methods">
          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <button
              key={m}
              className={`pmn-method ${method === m ? "is-active" : ""}`}
              onClick={() => {
                NumericInputHelper.tapHaptic({ style: "light" }).catch(() => {});
                setMethod(m);
              }}
              aria-pressed={method === m}
              type="button"
            >
              <span className="pmn-method-emoji" aria-hidden="true">{METHOD_LABELS[m].emoji}</span>
              <span className="pmn-method-label">{METHOD_LABELS[m].label}</span>
              <span className="pmn-method-sub">{METHOD_LABELS[m].sub}</span>
            </button>
          ))}
        </section>

        {/* ── Amount input (cash only) ──────────────────────────── */}
        {method === "cash" && (
          <section className="pmn-input">
            <label className="pmn-input-label">Monto recibido</label>
            <input
              ref={inputRef}
              type="text"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
              className="pmn-input-field pmn-mono"
              {...inputModeFor("price")}
              aria-label="Monto recibido"
            />
          </section>
        )}

        {/* ── Reference (card / ATH) ─────────────────────────────── */}
        {(method === "card" || method === "ath") && (
          <section className="pmn-input">
            <label className="pmn-input-label">
              {method === "card" ? "Últimos 4 dígitos / referencia" : "Confirmación ATH"}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="pmn-input-field"
              maxLength={32}
              {...inputModeFor("code")}
            />
          </section>
        )}

        {/* ── Numeric keypad (cash only) ─────────────────────────── */}
        {method === "cash" && (
          <section className="pmn-keypad" role="group" aria-label="Teclado numérico">
            {["1","2","3","4","5","6","7","8","9",".","0","back"].map((k) => (
              <button
                key={k}
                type="button"
                className={`pmn-key ${k === "back" ? "pmn-key--back" : ""}`}
                onClick={() => handleKey(k)}
                aria-label={k === "back" ? "Borrar" : k}
              >
                {k === "back" ? "⌫" : k}
              </button>
            ))}
          </section>
        )}

        <button
          type="button"
          className="pmn-confirm"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          {submitting
            ? "Procesando…"
            : method === "cash"
              ? `Cobrar ${formatMoney(amountReceived, currency)}`
              : `Cobrar ${formatMoney(total, currency)}`}
        </button>
      </div>
    </div>
  );
};

export default PaymentModalNative;
