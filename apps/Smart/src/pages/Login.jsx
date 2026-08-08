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
  const [error, setError] = useState(null);

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
      const dest = location.state?.from || "/Financial";
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

          <form onSubmit={submit} className="mt-7 space-y-4">
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
        </motion.div>
      </main>
    </div>
  );
}
