/**
 * Stripe configuration · SmartFixOS web (app.archillaos.com)
 *
 * SOURCE OF TRUTH for Price IDs and the publishable key reference.
 * Mantén este archivo sincronizado con BILLING_CONTRACT.md §1.
 *
 * ─────────────────────────────────────────────────────────────
 *  Seguridad
 * ─────────────────────────────────────────────────────────────
 *
 *  ✅ EXPUESTO INTENCIONALMENTE (todo en este archivo es público):
 *     - VITE_STRIPE_PUBLISHABLE_KEY  — Stripe la diseñó para frontend
 *     - Price IDs                    — visibles en URLs de Checkout
 *     - Amounts                      — visibles en la página de pricing
 *
 *  ❌ NUNCA EN ESTE ARCHIVO NI EN EL FRONTEND:
 *     - STRIPE_SECRET_KEY    (sk_test_* / sk_live_*) → Supabase Edge Function secret
 *     - STRIPE_WEBHOOK_SECRET (whsec_*)             → Supabase Edge Function secret
 *
 * ─────────────────────────────────────────────────────────────
 *  Cómo se usa
 * ─────────────────────────────────────────────────────────────
 *
 *  1. Frontend lee el Price ID por plan:
 *
 *       import { STRIPE_PRICES, STRIPE_PUBLISHABLE_KEY } from "@/lib/stripe";
 *       const priceId = STRIPE_PRICES.completo;  // o .boletos_1 ... .boletos_5
 *
 *  2. Frontend llama al edge function `create-checkout-session`
 *     pasando `{ price_id, tenant_id, success_url, cancel_url }`.
 *
 *  3. La edge function (server-side, con STRIPE_SECRET_KEY) crea la
 *     Stripe Checkout Session y devuelve `{ url }`. Frontend redirige.
 *
 *  4. Stripe envía webhook a la edge function `stripe-webhook` que
 *     actualiza `public.tenant`. (Lo construye Memo según
 *     BILLING_CONTRACT §4.)
 */

// ── Modo ───────────────────────────────────────────────────────
// "test" mientras Francis verifica cuenta + banco. Después → "live".
// El switch real se hace cambiando VITE_STRIPE_PUBLISHABLE_KEY y los
// Price IDs por sus equivalentes de live mode en Stripe Dashboard.
export const STRIPE_MODE =
  (typeof import.meta !== "undefined" &&
   import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_"))
    ? "live"
    : "test";

// ── Publishable key (frontend-safe) ────────────────────────────
export const STRIPE_PUBLISHABLE_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY) || "";

// ── Price IDs · TEST MODE ──────────────────────────────────────
// Un solo plan a $9.99/mes. El price id de abajo (price_1TaEWc...)
// todavia corresponde al Price object viejo de $19 en Stripe test —
// HAY QUE CREAR un Price nuevo de $9.99 en el Stripe Dashboard y
// pegar su id aqui antes de activar billing (VITE_BILLING_ENABLED).
const STRIPE_PRICES_TEST = Object.freeze({
  solo: "price_1TaEWc0ynKjNBHk65T30N5Ck",
  boletos_1: "",
  boletos_2: "",
  boletos_3: "",
  boletos_4: "",
  boletos_5: "",
  completo: "",
});

// Placeholder hasta que tengamos productos live (esperando verificación
// de cuenta + banco en Stripe).
const STRIPE_PRICES_LIVE = Object.freeze({
  solo: "",
  boletos_1: "",
  boletos_2: "",
  boletos_3: "",
  boletos_4: "",
  boletos_5: "",
  completo: "",
});

export const STRIPE_PRICES =
  STRIPE_MODE === "live" ? STRIPE_PRICES_LIVE : STRIPE_PRICES_TEST;

// ── Monto display (USD/mes) ─────────────────────────────────────
export const PLAN_AMOUNTS_USD = Object.freeze({
  solo: 9.99,
  boletos: 20,
  boletos_tecnico_extra: 5,
  completo: 49,
});

export const BOLETOS_MAX_TECHNICIANS = 5;

export function boletosPrice(technicians = 1) {
  const n = Math.min(BOLETOS_MAX_TECHNICIANS, Math.max(1, Math.round(Number(technicians) || 1)));
  return PLAN_AMOUNTS_USD.boletos + PLAN_AMOUNTS_USD.boletos_tecnico_extra * (n - 1);
}

// ── Trial ────────────────────────────────────────────────────────
export const TRIAL_DAYS = 14;

// ── Plan metadata para uso en UI — un solo plan, todo incluido ──
const BOLETOS_PLANS = Object.fromEntries(
  [1, 2, 3, 4, 5].map((n) => [
    `boletos_${n}`,
    {
      slug: `boletos_${n}`,
      name: "Solo boletos",
      technicians: n,
      tagline: "Boletos, clientes, piezas, chat y ponche. Multitienda incluida.",
      price: boletosPrice(n),
      priceId: STRIPE_PRICES[`boletos_${n}`],
    },
  ])
);

export const PLANS = Object.freeze({
  ...BOLETOS_PLANS,
  completo: {
    slug: "completo",
    name: "Completo",
    tagline: "Todo tu taller: boletos, caja, finanzas, inventario y hasta 5 usuarios.",
    price: PLAN_AMOUNTS_USD.completo,
    priceId: STRIPE_PRICES.completo,
  },
  solo: {
    slug: "solo",
    name: "Archilla OS (anterior)",
    tagline: "Plan anterior, ya no se ofrece a clientes nuevos.",
    price: PLAN_AMOUNTS_USD.solo,
    priceId: STRIPE_PRICES.solo,
  },
});

// ── Helpers ────────────────────────────────────────────────────

/**
 * ¿Stripe está configurado para correr Checkout? Útil para mostrar
 * un fallback ("Próximamente") cuando todavía no hay claves.
 */
export function isStripeConfigured(planSlug = "completo") {
  return Boolean(STRIPE_PUBLISHABLE_KEY) && Boolean(STRIPE_PRICES[planSlug]);
}

/**
 * Devuelve el Price ID dado un slug del plan, o null si el plan
 * no existe o no tiene Price ID configurado para el modo actual.
 */
export function getPriceId(planSlug) {
  const slug = String(planSlug || "").toLowerCase();
  return STRIPE_PRICES[slug] || null;
}
