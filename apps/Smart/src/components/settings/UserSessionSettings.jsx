import React, { useState } from "react";
import { Clock, CheckCircle2, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth, saveLocalTimeout, readLocalTimeout } from "@/components/Auth";

// ── Opciones pre-establecidas de timeout ─────────────────────────────────────
const TIMEOUT_OPTIONS = [
  { label: "30 segundos",  ms: 30_000,           hint: "Máxima seguridad" },
  { label: "1 minuto",     ms: 60_000,            hint: "" },
  { label: "2 minutos",    ms: 2 * 60_000,        hint: "" },
  { label: "5 minutos",    ms: 5 * 60_000,        hint: "Recomendado" },
  { label: "10 minutos",   ms: 10 * 60_000,       hint: "" },
  { label: "15 minutos",   ms: 15 * 60_000,       hint: "" },
  { label: "30 minutos",   ms: 30 * 60_000,       hint: "" },
  { label: "1 hora",       ms: 60 * 60_000,       hint: "" },
  { label: "Nunca",        ms: null,              hint: "Sin bloqueo automático" },
];

function readCurrentSession() {
  try {
    const raw = sessionStorage.getItem("911-session") || localStorage.getItem("employee_session");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function patchSession(raw, patch) {
  try {
    const s = JSON.parse(raw);
    return JSON.stringify({ ...s, ...patch });
  } catch { return raw; }
}

export default function UserSessionSettings() {
  const { user, updateSessionTimeout } = useAuth();
  const session = readCurrentSession();
  const employeeId = session?.id || user?.id;

  const [selected, setSelected] = useState(() => {
    // Prioridad: valor guardado localmente en este dispositivo
    const local = readLocalTimeout(employeeId);
    if (local !== undefined) return local;
    // Fallback: valor en la sesión activa
    return session?.session_timeout_ms ?? 5 * 60_000;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!employeeId) { toast.error("No hay sesión activa"); return; }
    setSaving(true);
    try {
      // 1. Guardar localmente en este dispositivo (no se sincroniza entre equipos)
      saveLocalTimeout(employeeId, selected);

      // 2. Parchear las sesiones en storage para que persista tras refresco
      const patch = { session_timeout_ms: selected };
      const lsRaw = localStorage.getItem("employee_session");
      const ssRaw = sessionStorage.getItem("911-session");
      if (lsRaw) localStorage.setItem("employee_session", patchSession(lsRaw, patch));
      if (ssRaw) sessionStorage.setItem("911-session", patchSession(ssRaw, patch));

      // 3. Actualizar el timer en vivo sin necesidad de re-login
      updateSessionTimeout?.(selected);

      const opt = TIMEOUT_OPTIONS.find((o) => o.ms === selected);
      toast.success(`✅ Sesión configurada: ${opt?.label ?? "Personalizado"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Tiempo de Sesión</h2>
          <p className="text-white/50 text-sm">
            El sistema pedirá tu PIN tras este periodo de inactividad
          </p>
        </div>
      </div>

      {/* Opciones */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        {TIMEOUT_OPTIONS.map((opt, idx) => {
          const isSelected = opt.ms === selected;
          const isFirst = idx === 0;
          const isLast = idx === TIMEOUT_OPTIONS.length - 1;
          return (
            <button
              key={String(opt.ms)}
              onClick={() => setSelected(opt.ms)}
              className={`w-full flex items-center justify-between px-5 py-4 transition-all text-left
                ${isSelected
                  ? "bg-violet-500/20 border-l-2 border-violet-400"
                  : "hover:bg-white/5 border-l-2 border-transparent"}
                ${!isFirst ? "border-t border-white/8" : ""}
                ${isFirst ? "rounded-t-3xl" : ""}
                ${isLast ? "rounded-b-3xl" : ""}
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                  ${isSelected ? "border-violet-400 bg-violet-400" : "border-white/30"}`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <span className={`font-semibold text-sm ${isSelected ? "text-violet-300" : "text-white"}`}>
                    {opt.label}
                  </span>
                  {opt.hint && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                      {opt.hint}
                    </span>
                  )}
                </div>
              </div>
              {isSelected && <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Info para "Nunca" */}
      {selected === null && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">
            <strong>Sin bloqueo automático.</strong> La sesión solo se cerrará cuando
            cierres la ventana o hagas logout manual. Úsalo solo en dispositivos de confianza.
          </p>
        </div>
      )}

      {/* Guardar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm
          hover:from-violet-500 hover:to-purple-500 transition-all active:scale-95 disabled:opacity-60
          flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
      >
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Guardar configuración
          </>
        )}
      </button>

      <p className="text-white/30 text-xs text-center">
        Esta configuración es <strong className="text-white/40">local a este dispositivo</strong> — no afecta otros equipos ni teléfonos.
        Cada dispositivo puede tener su propio tiempo de sesión.
      </p>
    </div>
  );
}
