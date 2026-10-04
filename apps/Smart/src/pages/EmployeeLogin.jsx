/**
 * EmployeeLogin — login de empleado por código del taller + PIN, calcando
 * el flujo real que ya usa la app nativa (Features/Auth/EmployeeLoginView.swift
 * + AuthService.signInWithPINv2): llama al mismo edge function
 * `employee-login` (valida workshop_code+pin, crea/actualiza un auth user
 * sintético) y luego signInWithPassword contra ese mismo Supabase — misma
 * sesión real con JWT + refresh token que usa nativo, mismas RLS policies.
 * No existía ningún login de empleado en la web (solo email+password de
 * dueño en Login.jsx) — este es el primer paso de identidad para poder
 * construir gestión de empleados encima.
 */
import { flagPinChange } from "@/components/auth/ChangePinGate";
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, ArrowRight, Loader2, Wrench } from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [workshopCode, setWorkshopCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = workshopCode.trim().length > 0 && pin.trim().length >= 4;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/employee-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          workshop_code: workshopCode.trim(),
          pin: pin.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Código o PIN incorrecto.");
      }

      const { auth, employee } = body;
      if (employee?.active === false) {
        throw new Error("Tu acceso está desactivado. Habla con el dueño del taller.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: auth.email,
        password: auth.pin,
      });
      if (signInError) throw signInError;

      if (employee?.pin_is_temp === true && employee?.id) flagPinChange(employee.id);
      navigate("/Orders", { replace: true, state: { employee, tenant: body.tenant } });
    } catch (err) {
      setError(err?.message || "Código o PIN incorrecto. Pídele el código del taller al dueño.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full h-12 rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.07] transition-colors font-mono tracking-wide";

  return (
    <div className="h-dvh overflow-y-auto bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-md mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          Archilla OS
        </Link>
        <Link to="/Login" className="text-sm text-zinc-400 hover:text-white transition-colors">
          Soy dueño
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-5 pb-16 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="h-16 w-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-5">
            <KeyRound className="h-7 w-7 text-orange-400" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Acceso de empleado</h1>
          <p className="mt-2 text-zinc-400 text-[15px]">
            Ingresa el código del taller (te lo da el dueño) y tu PIN.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                Código del taller
              </label>
              <input
                type="text"
                className={inputCls + " pl-4 uppercase"}
                placeholder="XXXX-XXXX"
                value={workshopCode}
                onChange={(e) => setWorkshopCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">Tu PIN</label>
              <input
                type="password"
                inputMode="numeric"
                className={inputCls + " pl-4"}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
                required
              />
            </div>

            {error && <p className="text-[13px] text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={!canSubmit || loading}
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
        </motion.div>
      </main>
    </div>
  );
}
