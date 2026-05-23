/**
 * Auth helpers · SmartFixOS web (smartfixosapp.com)
 *
 * Wraps Supabase Auth for the public marketing flow:
 *   - Magic link  (primary)
 *   - Google OAuth (secondary)
 *
 * Memo's edge functions expect `tenant.email = auth.users.email` for owner
 * matching (auth_user_tenants() does case-insensitive trim, but we
 * normalize here too to stay defensive).
 *
 * See PARA_CHARLIE_PROXIMOS_PASOS.md §4.2 for the canonical signup flow.
 */

import { supabase } from "../../../../lib/supabase-client.js";

const TRIAL_DAYS = 14;

const DASHBOARD_URL = (() => {
  if (typeof window === "undefined") return "/dashboard";
  return `${window.location.origin}/dashboard`;
})();

// ── Normalización ─────────────────────────────────────────────────────────
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// ── Magic link ────────────────────────────────────────────────────────────
/**
 * Manda un magic link al email. Si el user no existe en `auth.users`, Supabase
 * lo crea automáticamente al verificar el link (signup implícito vía OTP).
 *
 * @param {object} args
 * @param {string} args.email
 * @param {object} [args.metadata] — se guarda en `auth.users.user_metadata`,
 *                                    se usa en ensureTenantExists() para crear
 *                                    el tenant con el workshop name correcto.
 */
export async function signInWithMagicLink({ email, metadata = {} } = {}) {
  const clean = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new Error("Email inválido");
  }
  const { data, error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: {
      emailRedirectTo: DASHBOARD_URL,
      data: metadata,
      shouldCreateUser: true, // explicit, default true but we want it
    },
  });
  if (error) throw error;
  return data;
}

// ── Google OAuth ──────────────────────────────────────────────────────────
/**
 * Redirige al flujo OAuth de Google. Después de aprobar, Supabase devuelve al
 * usuario a `${origin}/dashboard`. metadata para signup no se pasa por OAuth
 * (Google trae el nombre desde su perfil — lo recogemos en ensureTenantExists
 * desde `user.user_metadata.full_name` si existe).
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: DASHBOARD_URL,
      queryParams: { prompt: "select_account" }, // permite cambiar de cuenta
    },
  });
  if (error) throw error;
  return data;
}

// ── Logout ────────────────────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Session helpers ───────────────────────────────────────────────────────
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session || null;
}

// ── Tenant: crea (idempotente) y devuelve la fila del tenant del owner ────
/**
 * Llama esto en el mount de /dashboard. Si el user logueado no tiene tenant
 * todavía (porque acaba de hacer signup), lo crea con plan='trial' y trial_end
 * a 14 días. Si ya existe, lo devuelve sin escribir.
 *
 * Idempotente: seguro de llamar múltiples veces.
 */
export async function ensureTenantExists() {
  const user = await getCurrentUser();
  if (!user) return null;

  // 1. ¿Ya existe?
  const { data: existing, error: lookupErr } = await supabase
    .from("tenant")
    .select(
      "id, name, email, plan, subscription_status, trial_end_date, next_billing_date, last_payment_date, stripe_customer_id, country, currency, admin_name, admin_phone",
    )
    .ilike("email", user.email)
    .maybeSingle();

  if (lookupErr) {
    console.error("[ensureTenantExists] lookup error:", lookupErr);
    throw lookupErr;
  }
  if (existing) return existing;

  // 2. No existe — crear con plan='trial'
  const meta = user.user_metadata || {};
  const workshopName = meta.workshop_name || `Taller de ${user.email}`;
  const adminName    = meta.admin_name || meta.full_name || user.email.split("@")[0];
  const adminPhone   = meta.admin_phone || "";
  const country      = meta.country || "PR";
  const trialEnd     = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();

  const row = {
    id: crypto.randomUUID(),
    name: workshopName,
    email: user.email,
    country,
    currency: "USD",
    plan: "trial",
    subscription_status: "trialing",
    trial_end_date: trialEnd,
    admin_name: adminName,
    admin_phone: adminPhone,
    status: "active",
    created_by_id: user.id,
    created_by: "web-signup",
  };

  const { data: created, error: insertErr } = await supabase
    .from("tenant")
    .insert(row)
    .select(
      "id, name, email, plan, subscription_status, trial_end_date, next_billing_date, last_payment_date, stripe_customer_id, country, currency, admin_name, admin_phone",
    )
    .single();

  // 23505 = unique violation — alguien (¿la misma request en paralelo?) ya lo creó.
  // Re-fetch y devolver.
  if (insertErr?.code === "23505") {
    const { data: race } = await supabase
      .from("tenant")
      .select(
        "id, name, email, plan, subscription_status, trial_end_date, next_billing_date, last_payment_date, stripe_customer_id, country, currency, admin_name, admin_phone",
      )
      .ilike("email", user.email)
      .maybeSingle();
    return race;
  }

  if (insertErr) {
    console.error("[ensureTenantExists] insert error:", insertErr);
    throw insertErr;
  }
  return created;
}

// ── Trial status helper ───────────────────────────────────────────────────
/**
 * Estado de la suscripción del tenant para mostrar en UI.
 * @returns {object} { isExpired, isTrial, daysRemaining, plan, status }
 */
export function getTenantSubscriptionStatus(tenant) {
  if (!tenant) {
    return { isExpired: false, isTrial: false, daysRemaining: null, plan: null, status: null };
  }
  const plan = tenant.plan || "trial";
  const status = tenant.subscription_status || "trialing";
  const isTrial = plan === "trial";

  let isExpired = plan === "expired" || status === "expired";
  let daysRemaining = null;

  if (isTrial && tenant.trial_end_date) {
    const end = new Date(tenant.trial_end_date);
    const now = new Date();
    const msLeft = end.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(msLeft / 86_400_000));
    if (msLeft <= 0) isExpired = true;
  }
  return { isExpired, isTrial, daysRemaining, plan, status };
}
