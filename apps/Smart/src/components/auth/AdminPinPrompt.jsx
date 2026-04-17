import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Shield, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Lockout config ─────────────────────────────────────────────────────────
const MAX_ATTEMPTS   = 5;          // intentos antes de bloquear
const LOCKOUT_MS     = 10 * 60 * 1000; // 10 minutos
const LOCKOUT_KEY    = "admin_lockout";
const ATTEMPTS_KEY   = "admin_attempts";

// ── SHA-256 via Web Crypto (nativo, sin librerías) ─────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Lockout helpers ────────────────────────────────────────────────────────
function getLockoutInfo() {
  try {
    const until    = parseInt(localStorage.getItem(LOCKOUT_KEY) || "0", 10);
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0", 10);
    const locked   = until > Date.now();
    const remaining = locked ? Math.ceil((until - Date.now()) / 60000) : 0;
    return { locked, until, attempts, remaining };
  } catch {
    return { locked: false, until: 0, attempts: 0, remaining: 0 };
  }
}

function recordFailedAttempt() {
  try {
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0", 10) + 1;
    localStorage.setItem(ATTEMPTS_KEY, String(attempts));
    if (attempts >= MAX_ATTEMPTS) {
      localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
      localStorage.setItem(ATTEMPTS_KEY, "0");
      return { lockedNow: true };
    }
    return { lockedNow: false, remaining: MAX_ATTEMPTS - attempts };
  } catch {
    return { lockedNow: false, remaining: MAX_ATTEMPTS - 1 };
  }
}

function clearLockout() {
  try {
    localStorage.removeItem(LOCKOUT_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {}
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminPinPrompt({ onSuccess, onCancel }) {
  const [password, setPassword]   = useState("");
  const [showPwd,  setShowPwd]    = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [err,      setErr]        = useState("");
  const [shake,    setShake]      = useState(false);
  const [mounted,  setMounted]    = useState(false);
  const [masterHash, setMasterHash] = useState(null);
  const [lockout,  setLockout]    = useState({ locked: false, remaining: 0 });
  const inputRef = useRef(null);

  // Lockout countdown timer
  useEffect(() => {
    const tick = () => {
      const info = getLockoutInfo();
      setLockout(info);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
      inputRef.current?.focus();
    }, 80);
    loadMasterHash();
  }, []);

  const loadMasterHash = async () => {
    try {
      const configs = await base44.entities.SystemConfig.filter({ key: "master_pin" });
      if (configs?.length) {
        setMasterHash(configs[0].value);
      } else {
        // Si no hay nada en BD, crear con hash de contraseña por defecto
        const defaultHash = await sha256("SmFix@2026!");
        await base44.entities.SystemConfig.create({
          key: "master_pin",
          value: defaultHash,
          category: "security",
          description: "Contraseña maestra admin — SHA-256",
        });
        setMasterHash(defaultHash);
      }
    } catch (e) {
      console.error("Error loading master hash:", e);
      // Fallback: hash de la contraseña por defecto
      setMasterHash(await sha256("SmFix@2026!"));
    }
  };

  const showFail = (message) => {
    setErr(message);
    setShake(true);
    setTimeout(() => setShake(false), 450);
    setTimeout(() => setErr(""), 3000);
    setPassword("");
    inputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (loading || !password.trim()) return;

    // Verificar lockout
    const info = getLockoutInfo();
    if (info.locked) {
      showFail(`Bloqueado. Intenta en ${info.remaining} min.`);
      return;
    }

    setLoading(true);
    try {
      const inputHash = await sha256(password);

      if (inputHash === masterHash) {
        clearLockout();
        onSuccess?.();
      } else {
        const result = recordFailedAttempt();
        setLockout(getLockoutInfo());
        if (result.lockedNow) {
          showFail(`Demasiados intentos. Bloqueado 10 min.`);
        } else {
          showFail(`Contraseña incorrecta (${result.remaining} intentos restantes)`);
        }
      }
    } catch (e) {
      console.error("Auth error:", e);
      showFail("Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="apple-type fixed inset-0 z-[1000] apple-surface backdrop-blur-sm grid place-items-center px-4">
      <div
        className={`w-full max-w-sm transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        } ${shake ? "animate-[shake_0.45s_ease]" : ""}`}
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-apple-lg bg-apple-red/15 flex items-center justify-center">
            <Shield className="w-10 h-10 text-apple-red" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="apple-text-title2 apple-label-primary">Acceso Administrativo</h1>
          <p className="apple-text-subheadline apple-label-secondary mt-1">Panel de administración de usuarios</p>
        </div>

        {/* Lockout banner */}
        {lockout.locked && (
          <div className="mb-4 px-4 py-3 rounded-apple-md bg-apple-red/12 text-center">
            <p className="text-apple-red apple-text-subheadline font-medium">
              🔒 Bloqueado por intentos fallidos
            </p>
            <p className="text-apple-red apple-text-caption1 mt-1 opacity-80 tabular-nums">
              Intenta de nuevo en {lockout.remaining} minuto{lockout.remaining !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 apple-label-tertiary">
              <Lock className="w-4 h-4" />
            </div>
            <input
              ref={inputRef}
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErr(""); }}
              placeholder="Contraseña maestra"
              disabled={loading || lockout.locked}
              autoComplete="current-password"
              className="apple-input w-full pl-11 pr-12 py-4 disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 apple-label-tertiary hover:apple-label-secondary transition"
              tabIndex={-1}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Error */}
          {err && (
            <p className="text-apple-red apple-text-subheadline text-center font-medium animate-[fadeIn_0.3s_ease]">
              {err}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!password.trim() || loading || lockout.locked}
            className="apple-btn apple-btn-destructive apple-btn-lg w-full disabled:opacity-30"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Verificando…</>
            ) : (
              "Verificar acceso"
            )}
          </button>
        </form>

        {/* Cancel */}
        {onCancel && (
          <div className="mt-4 text-center">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="apple-btn apple-btn-plain apple-label-tertiary"
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(3px); }
          30%, 50%, 70% { transform: translateX(-5px); }
          40%, 60% { transform: translateX(5px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
