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
 * CheckoutModalMobile — it's NOT wired in by default. Import where
 * you need a streamlined flow:
 *
 *   import PaymentModalNative from "@/components/PaymentModalNative";
 *   <PaymentModalNative
 *     open={open}
 *     amountDue={total}
 *     onConfirm={(payment) => recordSale(payment)}
 *     onClose={() => setOpen(false)}
 *   />
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { NumericInputHelper, inputModeFor } from "@/plugins/NumericInputHelper";
import { NativeUIPlugin } from "@/plugins/NativeUIPlugin";
import "./PaymentModalNative.css";

export type PaymentMethod = "cash" | "card" | "ath" | "split";

export interface PaymentResult {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface PaymentModalNativeProps {
  open: boolean;
  amountDue: number;
  currency?: string;
  defaultMethod?: PaymentMethod;
  onConfirm: (payment: PaymentResult) => Promise<void> | void;
  onClose: () => void;
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
  open,
  amountDue,
  currency = "USD",
  defaultMethod = "cash",
  onConfirm,
  onClose,
}) => {
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [amountText, setAmountText] = useState<string>(amountDue.toFixed(2));
  const [reference, setReference] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the modal re-opens.
  useEffect(() => {
    if (open) {
      setMethod(defaultMethod);
      setAmountText(amountDue.toFixed(2));
      setReference("");
      setSubmitting(false);
      // Focus the amount field on next paint so iOS shows the keyboard.
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, defaultMethod, amountDue]);

  const amount = useMemo(() => parseMoney(amountText), [amountText]);
  const change = Math.max(0, amount - amountDue);
  const short = Math.max(0, amountDue - amount);
  const canConfirm = amount > 0 && short === 0 && !submitting;

  const handleKey = async (digit: string) => {
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
    // Use a native confirm for sales over $500 to avoid accidental taps.
    if (amount >= 500) {
      const result = await NativeUIPlugin.confirm({
        title: "Confirmar pago",
        message: `¿Cobrar ${formatMoney(amount, currency)} con ${METHOD_LABELS[method].label}?`,
        confirmLabel: "Cobrar",
        cancelLabel: "Cancelar",
      });
      if (!result.confirmed) return;
    }
    setSubmitting(true);
    try {
      await onConfirm({ method, amount, reference: reference.trim() || undefined });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="pmn-backdrop" role="dialog" aria-modal="true" aria-label="Finalizar cobro">
      <div className="pmn-card">
        <header className="pmn-header">
          <h2 className="pmn-title">Finalizar Cobro</h2>
          <button className="pmn-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        <section className="pmn-summary">
          <div className="pmn-row"><span>Total</span><span className="pmn-mono">{formatMoney(amountDue, currency)}</span></div>
          <div className="pmn-row pmn-row--pay"><span>A pagar</span><span className="pmn-mono">{formatMoney(amount, currency)}</span></div>
          {short > 0 && (
            <div className="pmn-row pmn-row--short"><span>Falta</span><span className="pmn-mono">{formatMoney(short, currency)}</span></div>
          )}
          {change > 0 && (
            <div className="pmn-row pmn-row--change"><span>Cambio</span><span className="pmn-mono">{formatMoney(change, currency)}</span></div>
          )}
        </section>

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

        <section className="pmn-input">
          <label className="pmn-input-label">Monto</label>
          <input
            ref={inputRef}
            type="text"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
            className="pmn-input-field pmn-mono"
            {...inputModeFor("price")}
            aria-label="Monto a pagar"
          />
        </section>

        {(method === "card" || method === "ath") && (
          <section className="pmn-input">
            <label className="pmn-input-label">Referencia / últimos 4 dígitos</label>
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

        <button
          type="button"
          className="pmn-confirm"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          {submitting ? "Procesando…" : `Cobrar ${formatMoney(amount, currency)}`}
        </button>
      </div>
    </div>
  );
};

export default PaymentModalNative;
