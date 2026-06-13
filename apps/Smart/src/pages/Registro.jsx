import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Wrench, CheckCircle2, Mail, Loader2, ArrowRight, ShieldCheck } from "lucide-react";

const TESTFLIGHT_URL = "https://testflight.apple.com/join/MjGuBHkP";

export default function Registro() {
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.ownerName.trim() || !form.email.trim() || !form.password) {
      setError("Nombre, email y contraseña son requeridos.");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: form.ownerName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          businessName: form.businessName.trim() || undefined,
          plan: "team",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || "No se pudo crear la cuenta. Intenta de nuevo.");
        setLoading(false);
        return;
      }
      setDone(data);
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
    }
    setLoading(false);
  };

  const inputCls =
    "w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.07] transition-colors";

  return (
    <div className="h-dvh overflow-y-auto bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-2xl mx-auto w-full">
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
        <div className="w-full max-w-md">
          {done ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
                <Mail className="h-7 w-7 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Revisa tu email</h1>
              <p className="mt-2 text-zinc-400 text-[15px]">
                Te enviamos el link de activación a{" "}
                <span className="text-white font-medium">{form.email}</span>. Expira en 24 horas
                — si no lo ves, mira en Spam o Promociones.
              </p>
              <div className="mt-6 text-left space-y-3">
                {[
                  "Abre el email y toca Activar mi cuenta",
                  "Crea tu PIN de dueño",
                  "Descarga la app y entra con tu cuenta",
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 h-6 w-6 rounded-full bg-orange-500/15 text-orange-400 text-[13px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[15px] text-zinc-300">{t}</span>
                  </div>
                ))}
              </div>
              <a
                href={TESTFLIGHT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-6 h-12 text-[14px] hover:bg-gray-100 transition-colors"
              >
                Descargar la app
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="mt-4 text-[13px] text-zinc-500">
                Tu prueba gratis termina el {done.trialEndDate} ({done.trialDays} días).
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Crea tu taller</h1>
              <p className="mt-2 text-zinc-400 text-[15px]">
                {`Prueba gratis de 15 días. Sin tarjeta.`}
              </p>

              <form onSubmit={submit} className="mt-7 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                    Nombre del taller
                  </label>
                  <input
                    className={inputCls}
                    placeholder="Ej: Tech Repair PR"
                    value={form.businessName}
                    onChange={set("businessName")}
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                    Tu nombre *
                  </label>
                  <input
                    className={inputCls}
                    placeholder="Nombre y apellido"
                    value={form.ownerName}
                    onChange={set("ownerName")}
                    autoComplete="name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                    Email *
                  </label>
                  <input
                    className={inputCls}
                    type="email"
                    placeholder="tu@email.com"
                    value={form.email}
                    onChange={set("email")}
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                    Teléfono
                  </label>
                  <input
                    className={inputCls}
                    type="tel"
                    placeholder="(787) 555-0123"
                    value={form.phone}
                    onChange={set("phone")}
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                    Contraseña *
                  </label>
                  <input
                    className={inputCls}
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={set("password")}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[14px] text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 font-semibold text-[15px] text-white transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando tu taller…
                    </>
                  ) : (
                    <>
                      Crear mi taller gratis
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="flex items-center justify-center gap-1.5 text-[13px] text-zinc-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Al crear tu cuenta aceptas los{" "}
                  <Link to="/legal/terms" className="underline hover:text-zinc-300">
                    términos
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
