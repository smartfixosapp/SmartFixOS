/**
 * Login — sesión real de Supabase Auth (email + contraseña) para dueños y
 * empleados del taller. No existía ninguna página web funcional para esto
 * (PinAccess.jsx fue eliminado en el pivote a nativo; TenantLoginSignup.jsx
 * es huérfana y jamás validó contraseña — no reutilizar). Las cuentas ya
 * existen: registerTenant.js / createFirstAdmin.js las crean en Supabase
 * Auth al registrar el taller.
 */
import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Wrench } from "lucide-react";
import appClient from "@/api/appClient";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);

  const loginWithGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const dest = location.state?.from || "/Dashboard";
      await appClient.auth.login("google", undefined, undefined, dest);
    } catch (err) {
      setError(err?.message || "No se pudo iniciar sesión con Google.");
      setGoogleLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email y contraseña son requeridos.");
      return;
    }
    setLoading(true);
    try {
      await appClient.auth.login("email", email.trim().toLowerCase(), password);
      const dest = location.state?.from || "/Dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      const msg = err?.message || "";
      setError(
        msg.toLowerCase().includes("invalid login")
          ? "Email o contraseña incorrectos."
          : msg || "No se pudo iniciar sesión. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full h-12 rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.07] transition-colors";

  return (
    <div className="h-dvh overflow-y-auto bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-md mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          Archilla OS
        </Link>
        <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
          Volver
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-5 pb-16 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <h1 className="text-3xl font-bold tracking-tight">Inicia sesión</h1>
          <p className="mt-2 text-zinc-400 text-[15px]">Entra con la cuenta de tu taller.</p>

          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={googleLoading || loading}
            className="mt-6 w-full inline-flex items-center justify-center gap-2.5 rounded-full bg-white text-black font-semibold px-6 h-12 text-[14px] hover:bg-gray-100 transition-colors disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z" />
                  <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.7 39.6 16.3 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.6 5.6C41.8 36 44 30.8 44 24c0-1.3-.1-2.7-.4-3.5z" />
                </svg>
                Continuar con Google
              </>
            )}
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[12px] text-zinc-500">o</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  autoComplete="email"
                  className={inputCls}
                  placeholder="tu@taller.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  autoComplete="current-password"
                  className={inputCls}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p className="text-[13px] text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold px-6 h-12 text-[14px] hover:bg-gray-100 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-[13px] text-zinc-500 text-center">
            ¿No tienes taller?{" "}
            <Link to="/registro" className="text-orange-400 hover:text-orange-300">
              Crea uno
            </Link>
          </p>
          <p className="mt-2 text-[13px] text-zinc-500 text-center">
            ¿Eres empleado?{" "}
            <Link to="/EmpleadoLogin" className="text-orange-400 hover:text-orange-300">
              Entra con el código del taller y tu PIN
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
