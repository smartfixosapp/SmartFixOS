import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, CheckCircle2, Mail } from "lucide-react";
import {
  signInWithMagicLink,
  signInWithGoogle,
  getCurrentSession,
  normalizeEmail,
} from "@/lib/auth";

// Mini wordmark for the corner — keeps the page on-brand without re-mounting
// the full animated wordmark from Landing.
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
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", animation: "sfx-gear-spin-mini 14s linear infinite", transformOrigin: "50% 50%" }}>
          <defs>
            <clipPath id="signup-gear-clip">
              <path d="M 90.57 39.13 L 91.48 43.43 L 99.38 42.18 L 99.38 57.82 L 91.48 56.57 L 90.57 60.87 L 89.21 65.05 L 96.68 67.92 L 88.86 81.47 L 82.64 76.43 L 79.70 79.70 L 76.43 82.64 L 81.47 88.86 L 67.92 96.68 L 65.05 89.21 L 60.87 90.57 L 56.57 91.48 L 57.82 99.38 L 42.18 99.38 L 43.43 91.48 L 39.13 90.57 L 34.95 89.21 L 32.08 96.68 L 18.53 88.86 L 23.57 82.64 L 20.30 79.70 L 17.36 76.43 L 11.14 81.47 L 3.32 67.92 L 10.79 65.05 L 9.43 60.87 L 8.52 56.57 L 0.62 57.82 L 0.62 42.18 L 8.52 43.43 L 9.43 39.13 L 10.79 34.95 L 3.32 32.08 L 11.14 18.53 L 17.36 23.57 L 20.30 20.30 L 23.57 17.36 L 18.53 11.14 L 32.08 3.32 L 34.95 10.79 L 39.13 9.43 L 43.43 8.52 L 42.18 0.62 L 57.82 0.62 L 56.57 8.52 L 60.87 9.43 L 65.05 10.79 L 67.92 3.32 L 81.47 11.14 L 76.43 17.36 L 79.70 20.30 L 82.64 23.57 L 88.86 18.53 L 96.68 32.08 L 89.21 34.95 L 90.57 39.13 Z" />
            </clipPath>
          </defs>
          <g clipPath="url(#signup-gear-clip)">
            <rect x="0" y="0" width="50" height="100" fill="#1FA0DC" />
            <rect x="50" y="0" width="50" height="100" fill="#8FC93F" />
          </g>
          <circle cx="50" cy="50" r="22" fill="#0a0a0a" />
        </svg>
      </span>
      <span>s</span>
      <style>{`@keyframes sfx-gear-spin-mini { to { transform: rotate(360deg); } }`}</style>
    </Link>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg viewBox="0 0 18 18" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("form"); // 'form' | 'sending' | 'sent' | 'google' | 'error'
  const [error, setError] = useState("");

  // Form fields
  const [email, setEmail] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [country, setCountry] = useState("PR");

  // Si el user ya está logueado, lo mandamos directo a /dashboard
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getCurrentSession();
      if (!cancelled && session) navigate("/dashboard", { replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const submitMagicLink = async (e) => {
    e.preventDefault();
    setError("");

    const cleanEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Esa dirección no se ve bien. Revísala.");
      return;
    }
    if (!workshopName.trim()) {
      setError("Necesito el nombre de tu taller.");
      return;
    }

    setStage("sending");
    try {
      await signInWithMagicLink({
        email: cleanEmail,
        metadata: {
          workshop_name: workshopName.trim(),
          admin_name: adminName.trim() || workshopName.trim(),
          admin_phone: adminPhone.trim(),
          country,
        },
      });
      setStage("sent");
    } catch (err) {
      console.error("[signup] magic link error:", err);
      setError(err.message || "Algo salió mal. Intenta de nuevo.");
      setStage("error");
    }
  };

  const startGoogle = async () => {
    setError("");
    setStage("google");
    try {
      await signInWithGoogle();
      // Google redirige fuera de la página — no llegamos a este return en la mayoría de casos
    } catch (err) {
      console.error("[signup] google oauth error:", err);
      setError(err.message || "Google rechazó la conexión. Intenta de nuevo.");
      setStage("error");
    }
  };

  // ── Render del estado "email enviado" ───────────────────────────────────
  if (stage === "sent") {
    return (
      <Shell>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md mx-auto text-center"
        >
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-lime-400/15 border border-lime-400/30 mb-6">
            <CheckCircle2 className="h-7 w-7" style={{ color: "#8FC93F" }} />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-white"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Revisa tu email.
          </h1>
          <p className="mt-4 text-white/55 leading-relaxed">
            Te mandamos un link a <span className="text-white">{normalizeEmail(email)}</span>.
            Click ahí y entras directo a tu dashboard.
          </p>
          <p className="mt-6 text-[13px] text-white/40">
            ¿No te llegó en 1 minuto? Revisa spam o{" "}
            <button
              type="button"
              onClick={() => setStage("form")}
              className="text-white hover:underline underline-offset-4 decoration-white/30"
            >
              vuelve atrás
            </button>
            .
          </p>
        </motion.div>
      </Shell>
    );
  }

  // ── Render principal: form ──────────────────────────────────────────────
  return (
    <Shell>
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-[1.1]"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Empieza tu trial de <span className="text-white/55">14 días</span>.
          </h1>
          <p className="mt-3 text-[15px] text-white/55 leading-relaxed">
            Sin tarjeta. Sin contratos. Cancelas cuando quieras.
          </p>
        </motion.div>

        {/* Google primero — la mayoría va a escoger esto */}
        <motion.button
          type="button"
          onClick={startGoogle}
          disabled={stage === "sending" || stage === "google"}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mt-8 w-full h-12 rounded-full bg-white text-black font-semibold text-sm inline-flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {stage === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="h-5 w-5" />
          )}
          Continuar con Google
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="my-6 flex items-center gap-4 text-[11px] uppercase tracking-[0.22em] text-white/30"
        >
          <span className="flex-1 h-px bg-white/10" />
          <span>o con email</span>
          <span className="flex-1 h-px bg-white/10" />
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          onSubmit={submitMagicLink}
          className="space-y-4"
        >
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="tu@email.com"
            autoComplete="email"
            required
            disabled={stage === "sending"}
          />
          <Field
            label="Nombre del taller"
            value={workshopName}
            onChange={setWorkshopName}
            placeholder="Mi Taller de Reparaciones"
            required
            disabled={stage === "sending"}
          />
          <Field
            label="Tu nombre"
            value={adminName}
            onChange={setAdminName}
            placeholder="Francis Reyes"
            autoComplete="name"
            disabled={stage === "sending"}
          />
          <Field
            label="Teléfono"
            type="tel"
            value={adminPhone}
            onChange={setAdminPhone}
            placeholder="787-XXX-XXXX"
            autoComplete="tel"
            disabled={stage === "sending"}
            hint="Opcional — para que podamos contactarte si pasa algo"
          />

          <div>
            <label className="block text-[11px] uppercase tracking-[0.22em] text-white/45 mb-2">
              País
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={stage === "sending"}
              className="w-full h-12 rounded-2xl bg-white/[0.04] border border-white/15 px-4 text-[15px] text-white outline-none focus:border-white/40 focus:bg-white/[0.06] transition-colors disabled:opacity-50"
            >
              <option value="PR">Puerto Rico</option>
              <option value="DO">República Dominicana</option>
              <option value="MX">México</option>
              <option value="US">Estados Unidos</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={stage === "sending"}
            className="mt-2 w-full h-12 rounded-full bg-lime-400 text-black font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-lime-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_10px_40px_rgba(143,201,63,0.30)]"
          >
            {stage === "sending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando link…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Continuar con email
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-8 text-[13px] text-white/40 text-center"
        >
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-white hover:underline underline-offset-4 decoration-white/30">
            Inicia sesión
          </Link>
        </motion.p>
      </div>
    </Shell>
  );
}

// ── Reusable shell with the back-to-landing wordmark ───────────────────────
function Shell({ children }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans px-6 py-12 sm:py-20">
      <div className="max-w-md mx-auto mb-12">
        <Wordmark />
      </div>
      {children}
    </div>
  );
}

// ── Generic labeled input ─────────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, autoComplete, required, disabled, hint }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.22em] text-white/45 mb-2">
        {label}{required && <span className="ml-1 text-lime-400">·</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className="w-full h-12 rounded-2xl bg-white/[0.04] border border-white/15 px-4 text-[15px] text-white placeholder-white/30 outline-none focus:border-white/40 focus:bg-white/[0.06] transition-colors disabled:opacity-50"
      />
      {hint && (
        <p className="mt-1.5 text-[12px] text-white/35">{hint}</p>
      )}
    </div>
  );
}
