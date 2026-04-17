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
      toast.success(`Sesión configurada: ${opt?.label ?? "Personalizado"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="apple-type space-y-6 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
          <Clock className="w-5 h-5 text-apple-purple" />
        </div>
        <div>
          <h2 className="apple-text-title3 apple-label-primary">Tiempo de Sesión</h2>
          <p className="apple-label-tertiary apple-text-subheadline">
            El sistema pedirá tu PIN tras este periodo de inactividad
          </p>
        </div>
      </div>

      {/* Opciones */}
      <div className="apple-list overflow-hidden rounded-apple-lg">
        {TIMEOUT_OPTIONS.map((opt, idx) => {
          const isSelected = opt.ms === selected;
          const isFirst = idx === 0;
          const isLast = idx === TIMEOUT_OPTIONS.length - 1;
          return (
            <button
              key={String(opt.ms)}
              onClick={() => setSelected(opt.ms)}
              className={`apple-list-row w-full flex items-center justify-between px-5 py-4 transition-all text-left apple-press
                ${isSelected ? "bg-apple-purple/12" : ""}
              `}
              style={!isFirst ? { borderTop: '0.5px solid rgb(var(--separator) / 0.29)' } : undefined}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                  ${isSelected ? "border-apple-purple bg-apple-purple" : "border-apple-label-tertiary/40"}`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <span className={`apple-text-subheadline ${isSelected ? "text-apple-purple" : "apple-label-primary"}`}>
                    {opt.label}
                  </span>
                  {opt.hint && (
                    <span className="ml-2 apple-text-caption1 px-2 py-0.5 rounded-apple-xs bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary">
                      {opt.hint}
                    </span>
                  )}
                </div>
              </div>
              {isSelected && <CheckCircle2 className="w-4 h-4 text-apple-purple flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Info para "Nunca" */}
      {selected === null && (
        <div className="flex items-start gap-3 p-4 rounded-apple-md bg-apple-orange/12">
          <Shield className="w-5 h-5 text-apple-orange flex-shrink-0 mt-0.5" />
          <p className="text-apple-orange apple-text-subheadline">
            <strong>Sin bloqueo automático.</strong> La sesión solo se cerrará cuando
            cierres la ventana o hagas logout manual. Úsalo solo en dispositivos de confianza.
          </p>
        </div>
      )}

      {/* Guardar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="apple-btn apple-btn-primary apple-btn-lg apple-press w-full flex items-center justify-center gap-2"
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

      <p className="apple-label-tertiary apple-text-caption1 text-center">
        Esta configuración es <strong className="apple-label-secondary">local a este dispositivo</strong> — no afecta otros equipos ni teléfonos.
        Cada dispositivo puede tener su propio tiempo de sesión.
      </p>
    </div>
  );
}
