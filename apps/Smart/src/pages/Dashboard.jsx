import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Loader2, CheckCircle2, AlertTriangle, Clock,
  ExternalLink, LogOut, Smartphone, CreditCard,
} from "lucide-react";
import {
  ensureTenantExists,
  signOut,
  getCurrentUser,
  getCurrentSession,
  getTenantSubscriptionStatus,
} from "@/lib/auth";
import { supabase } from "../../../../lib/supabase-client.js";
import {
  PLANS,
  PLAN_AMOUNTS_USD,
  STRIPE_PRICES,
  isStripeConfigured,
} from "@/lib/stripe";

// ── Mini wordmark — link de vuelta a marketing ────────────────────────────
function Wordmark() {
  return (
    <Link
      to="/"
      className="inline-flex items-center font-[700] tracking-[-0.04em] text-white text-2xl leading-none select-none hover:opacity-80 transition-opacity"
      style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
      aria-label="Volver a smartfixos.com"
    >
      <span>smartfix</span>
      <span
        className="inline-grid place-items-center mx-[-0.02em]"
        style={{ width: "0.92em", height: "0.92em" }}
        aria-hidden
      >
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", animation: "sfx-gear-spin-dash 14s linear infinite", transformOrigin: "50% 50%" }}>
          <defs>
            <clipPath id="dash-gear-clip">
              <path d="M 90.57 39.13 L 91.48 43.43 L 99.38 42.18 L 99.38 57.82 L 91.48 56.57 L 90.57 60.87 L 89.21 65.05 L 96.68 67.92 L 88.86 81.47 L 82.64 76.43 L 79.70 79.70 L 76.43 82.64 L 81.47 88.86 L 67.92 96.68 L 65.05 89.21 L 60.87 90.57 L 56.57 91.48 L 57.82 99.38 L 42.18 99.38 L 43.43 91.48 L 39.13 90.57 L 34.95 89.21 L 32.08 96.68 L 18.53 88.86 L 23.57 82.64 L 20.30 79.70 L 17.36 76.43 L 11.14 81.47 L 3.32 67.92 L 10.79 65.05 L 9.43 60.87 L 8.52 56.57 L 0.62 57.82 L 0.62 42.18 L 8.52 43.43 L 9.43 39.13 L 10.79 34.95 L 3.32 32.08 L 11.14 18.53 L 17.36 23.57 L 20.30 20.30 L 23.57 17.36 L 18.53 11.14 L 32.08 3.32 L 34.95 10.79 L 39.13 9.43 L 43.43 8.52 L 42.18 0.62 L 57.82 0.62 L 56.57 8.52 L 60.87 9.43 L 65.05 10.79 L 67.92 3.32 L 81.47 11.14 L 76.43 17.36 L 79.70 20.30 L 82.64 23.57 L 88.86 18.53 L 96.68 32.08 L 89.21 34.95 L 90.57 39.13 Z" />
            </clipPath>
          </defs>
          <g clipPath="url(#dash-gear-clip)">
            <rect x="0" y="0" width="50" height="100" fill="#1FA0DC" />
            <rect x="50" y="0" width="50" height="100" fill="#8FC93F" />
          </g>
          <circle cx="50" cy="50" r="22" fill="#0a0a0a" />
        </svg>
      </span>
      <span>s</span>
      <style>{`@keyframes sfx-gear-spin-dash { to { transform: rotate(360deg); } }`}</style>
    </Link>
  );
}

// ── Plan name pill ────────────────────────────────────────────────────────
function PlanBadge({ tenant }) {
  if (!tenant) return null;
  const plan = tenant.plan || "trial";
  const labels = {
    trial:   { label: "Trial",   bg: "bg-lime-400/15",  border: "border-lime-400/30",  text: "text-lime-300"   },
    solo:    { label: "Solo",    bg: "bg-white/10",     border: "border-white/20",     text: "text-white"      },
    team:    { label: "Equipo",  bg: "bg-white",        border: "border-white",        text: "text-black"      },
    expired: { label: "Expirado",bg: "bg-red-500/15",   border: "border-red-500/30",   text: "text-red-300"    },
  };
  const s = labels[plan] || labels.trial;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border ${s.bg} ${s.border} ${s.text}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Plan {s.label}
    </span>
  );
}

// ── Stripe Checkout — usa edge function de Memo ───────────────────────────
async function startCheckout({ plan, tenant }) {
  if (!tenant?.id) throw new Error("Sin tenant");
  if (!isStripeConfigured()) throw new Error("Stripe no configurado todavía");

  const priceId = STRIPE_PRICES[plan];
  if (!priceId) throw new Error(`Plan inválido: ${plan}`);

  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: {
      price_id:    priceId,
      tenant_id:   tenant.id,
      success_url: `${window.location.origin}/dashboard?upgrade=success`,
      cancel_url:  `${window.location.origin}/dashboard?upgrade=canceled`,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Edge function no devolvió URL");
  window.location.href = data.url;
}

// ──────────────────────────────────────────────────────────────────────────
//  Página principal
// ──────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(null); // "solo" | "team" | null

  const upgradeStatus = searchParams.get("upgrade"); // "success" | "canceled" | null

  // Bootstrap: confirma sesión, asegura tenant
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await getCurrentSession();
        if (!session) {
          navigate("/login", { replace: true });
          return;
        }
        const u = await getCurrentUser();
        if (!cancelled) setUser(u);

        const t = await ensureTenantExists();
        if (!cancelled) setTenant(t);
      } catch (err) {
        console.error("[dashboard] bootstrap error:", err);
        if (!cancelled) setError(err.message || "Algo salió mal cargando tu cuenta.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Si volvemos de Stripe con upgrade=success, hacer refetch del tenant
  // (el webhook ya debería haber actualizado plan/subscription_status)
  useEffect(() => {
    if (upgradeStatus !== "success" || !user) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 6;
    const poll = async () => {
      attempts++;
      try {
        const fresh = await ensureTenantExists();
        if (cancelled) return;
        if (fresh && (fresh.plan === "solo" || fresh.plan === "team")) {
          setTenant(fresh);
          // Limpiar el query param después de actualizar
          setSearchParams({}, { replace: true });
          return;
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 1500);
        }
      } catch (err) {
        console.warn("[dashboard] poll error:", err);
        if (attempts < maxAttempts) setTimeout(poll, 1500);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [upgradeStatus, user, setSearchParams]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[dashboard] signout error:", err);
    }
  };

  const handleUpgrade = async (plan) => {
    setCheckoutLoading(plan);
    try {
      await startCheckout({ plan, tenant });
      // Redirige fuera — si llegamos aquí algo falló
    } catch (err) {
      console.error("[dashboard] checkout error:", err);
      setError(err.message || "Error iniciando el checkout.");
      setCheckoutLoading(null);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell user={null} onSignOut={() => {}}>
        <div className="max-w-md mx-auto text-center py-20 text-white/45">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
          Cargando tu cuenta…
        </div>
      </Shell>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error && !tenant) {
    return (
      <Shell user={user} onSignOut={handleSignOut}>
        <div className="max-w-md mx-auto rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-[14px] text-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold mb-1">Algo salió mal</div>
              <p className="text-red-200/90">{error}</p>
              <p className="mt-3 text-[12px] text-red-200/70">
                Si esto sigue, escríbenos a{" "}
                <a href="mailto:archillastudios@gmail.com" className="underline">
                  archillastudios@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const subStatus = getTenantSubscriptionStatus(tenant);
  const { isExpired, isTrial, daysRemaining, plan } = subStatus;

  return (
    <Shell user={user} onSignOut={handleSignOut}>
      {/* Success banner — vuelve de Stripe Checkout */}
      <AnimatePresence>
        {upgradeStatus === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 rounded-2xl border border-lime-400/30 bg-lime-400/10 px-5 py-4 flex items-start gap-3"
          >
            <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#8FC93F" }} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Pago confirmado</div>
              <p className="text-[13px] text-white/65 mt-0.5">
                {tenant?.plan === "solo" || tenant?.plan === "team"
                  ? `Plan ${tenant.plan.toUpperCase()} activo. Bienvenido al equipo.`
                  : "Stripe nos notificó. Estamos actualizando tu cuenta…"}
              </p>
            </div>
          </motion.div>
        )}
        {upgradeStatus === "canceled" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-white/60" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Pago cancelado</div>
              <p className="text-[13px] text-white/55 mt-0.5">
                Tranquilo, sigues en tu trial. Puedes intentarlo de nuevo cuando quieras.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero del dashboard */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-12"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/40 mb-3">
              Tu taller
            </p>
            <h1
              className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-[1.1]"
              style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
            >
              {tenant?.name || "Cargando…"}
            </h1>
            <p className="mt-2 text-[14px] text-white/45">
              {user?.email}
            </p>
          </div>
          <PlanBadge tenant={tenant} />
        </div>
      </motion.section>

      {/* Estado trial / expirado */}
      {isExpired && (
        <ExpiredBlock />
      )}
      {!isExpired && isTrial && (
        <TrialCountdown daysRemaining={daysRemaining} />
      )}
      {!isExpired && !isTrial && (plan === "solo" || plan === "team") && (
        <ActivePlanCard tenant={tenant} />
      )}

      {/* Upgrade buttons — sólo si trial o expirado */}
      {(isTrial || isExpired) && (
        <UpgradeCards
          loading={checkoutLoading}
          onUpgrade={handleUpgrade}
          currentPlan={plan}
        />
      )}

      {/* App download nudge */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-12 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8"
      >
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-2xl bg-lime-400/10 border border-lime-400/25 flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-6 w-6 text-lime-400" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-base font-semibold text-white">Descarga la app</div>
            <p className="text-[13px] text-white/55 mt-1 leading-relaxed">
              La app iOS está en TestFlight (próximamente App Store). Android viene después.
            </p>
          </div>
          <Link
            to="/#waitlist"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 h-10 text-[13px] font-semibold hover:bg-gray-100 transition-colors"
          >
            Reservar acceso <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.div>

      {/* Soporte */}
      <p className="mt-12 text-[13px] text-white/40 text-center">
        ¿Necesitas ayuda?{" "}
        <a href="mailto:archillastudios@gmail.com" className="text-white hover:underline underline-offset-4 decoration-white/30">
          archillastudios@gmail.com
        </a>
      </p>
    </Shell>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────

function TrialCountdown({ daysRemaining }) {
  if (daysRemaining == null) return null;
  const urgent = daysRemaining <= 3;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.6 }}
      className={`mb-10 rounded-2xl px-5 py-4 flex items-center gap-4 border ${
        urgent
          ? "border-amber-400/30 bg-amber-400/10"
          : "border-lime-400/25 bg-lime-400/[0.07]"
      }`}
    >
      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        urgent ? "bg-amber-400/20 text-amber-300" : "bg-lime-400/20 text-lime-300"
      }`}>
        <Clock className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-white">
          {daysRemaining === 0
            ? "Hoy termina tu trial"
            : `${daysRemaining} día${daysRemaining === 1 ? "" : "s"} de trial restante${daysRemaining === 1 ? "" : "s"}`}
        </div>
        <p className="text-[12px] text-white/55 mt-0.5">
          Activa tu plan abajo para que no pierdas acceso.
        </p>
      </div>
    </motion.div>
  );
}

function ExpiredBlock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.6 }}
      className="mb-10 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-5"
    >
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-red-500/20 text-red-300 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Tu trial terminó</div>
          <p className="text-[13px] text-white/70 mt-1 leading-relaxed">
            Tu data está intacta y la guardamos por 90 días. Activa un plan abajo para volver
            a tener acceso completo en la app.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ActivePlanCard({ tenant }) {
  const planMeta = PLANS[tenant.plan] || PLANS.solo;
  const nextBilling = tenant.next_billing_date
    ? new Date(tenant.next_billing_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.6 }}
      className="mb-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45 mb-3">
            Suscripción
          </p>
          <h2 className="text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
            Plan {planMeta.name} · ${planMeta.price}/mes
          </h2>
          {nextBilling && (
            <p className="mt-2 text-[13px] text-white/50">
              Próximo cobro: {nextBilling}
            </p>
          )}
        </div>
        <Link
          to="/dashboard/billing"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 h-10 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          Manejar suscripción
        </Link>
      </div>
    </motion.div>
  );
}

function UpgradeCards({ loading, onUpgrade, currentPlan }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="mb-10"
    >
      <h3
        className="text-xl font-semibold text-white tracking-tight mb-6"
        style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
      >
        Activa tu plan
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UpgradeCard
          plan="solo"
          name="Solo"
          price={PLAN_AMOUNTS_USD.solo}
          tagline="Para el técnico independiente."
          loading={loading === "solo"}
          disabled={loading !== null}
          onUpgrade={() => onUpgrade("solo")}
        />
        <UpgradeCard
          plan="team"
          name="Equipo"
          price={PLAN_AMOUNTS_USD.team}
          tagline="Cuando ya no eres solo tú."
          highlighted
          loading={loading === "team"}
          disabled={loading !== null}
          onUpgrade={() => onUpgrade("team")}
        />
      </div>
    </motion.section>
  );
}

function UpgradeCard({ plan, name, price, tagline, highlighted, loading, disabled, onUpgrade }) {
  return (
    <div
      className={[
        "rounded-2xl p-6 sm:p-8 border flex flex-col",
        highlighted
          ? "bg-white text-black border-white"
          : "bg-transparent text-white border-white/10",
      ].join(" ")}
    >
      <div className={highlighted ? "text-[11px] uppercase tracking-[0.22em] font-semibold text-black/55" : "text-[11px] uppercase tracking-[0.22em] font-semibold text-white/45"}>
        Plan {name}
      </div>
      <p className={highlighted ? "mt-1.5 text-[15px] font-medium text-black/75" : "mt-1.5 text-[15px] font-medium text-white/65"}>
        {tagline}
      </p>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span
          className="text-4xl sm:text-[42px] font-bold tracking-tight leading-none"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
        >
          ${price}
        </span>
        <span className={highlighted ? "text-sm font-medium text-black/45" : "text-sm font-medium text-white/40"}>
          / mes
        </span>
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        disabled={disabled}
        className={[
          "mt-6 h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all",
          highlighted
            ? "bg-black text-white hover:bg-gray-900"
            : "bg-white/[0.06] text-white border border-white/15 hover:bg-white/[0.10]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Abriendo checkout…
          </>
        ) : (
          <>
            Suscribirme
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

// ── Shell con nav simple + sign-out ────────────────────────────────────────
function Shell({ children, user, onSignOut }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans">
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Wordmark />
          {user && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 text-[13px] text-white/55 hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              <span className="hidden sm:inline">Cerrar sesión</span>
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        {children}
      </main>
    </div>
  );
}
