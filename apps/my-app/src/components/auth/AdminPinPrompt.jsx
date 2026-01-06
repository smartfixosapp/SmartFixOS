import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const brand = {
  bg: "bg-[#0B0B0F]",
  panel: "bg-[#121218]",
  key: "bg-[#1A1A22]",
  red: "bg-red-600 hover:bg-red-700",
  text: "text-slate-200",
  sub: "text-slate-400",
};

const Dot = ({ filled }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full ${filled ? "bg-slate-200" : "bg-slate-700"}`} />
);

const hashPin = (pin) => {
  // Simple hash - en producción usar bcrypt o similar
  return btoa(pin);
};

export default function AdminPinPrompt({ onSuccess, onCancel }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [masterPin, setMasterPin] = useState(null);

  useEffect(() => {
    setPin("");
    setErr("");
    setTimeout(() => setMounted(true), 50);
    loadMasterPin();
  }, []);

  const loadMasterPin = async () => {
    try {
      const configs = await base44.entities.SystemConfig.filter({ key: "master_pin" });
      if (configs?.length) {
        // El valor ya está hasheado en la BD
        setMasterPin(configs[0].value);
      } else {
        // Crear config por defecto con PIN 9110 hasheado
        const defaultHashed = hashPin("9110");
        await base44.entities.SystemConfig.create({
          key: "master_pin",
          value: defaultHashed,
          category: "security",
          description: "PIN maestro para acceso a administración de usuarios"
        });
        setMasterPin(defaultHashed);
      }
    } catch (error) {
      console.error("Error loading master PIN:", error);
      // Fallback al PIN por defecto hasheado
      setMasterPin(hashPin("9110"));
    }
  };

  const showFail = (message = "PIN maestro incorrecto") => {
    setErr(message);
    setShake(true);
    setTimeout(() => setShake(false), 450);
    setTimeout(() => setErr(""), 2000);
    setPin("");
  };

  const press = (val) => {
    if (loading) return;

    if (val === "back") {
      setPin((p) => p.slice(0, -1));
      setErr("");
      return;
    }
    if (val === "ok") {
      if (pin.length >= 4) void login(pin);
      return;
    }
    
    setPin((prev) => {
      const next = (prev + String(val)).slice(0, 8);
      setErr("");
      if (next.length >= 4) {
        setTimeout(() => login(next), 30);
      }
      return next;
    });
  };

  const login = async (p) => {
    if (loading) return;
    setLoading(true);

    try {
      const hashedInput = hashPin(p);
      
      // Comparar el hash del input con el hash almacenado
      if (hashedInput === masterPin) {
        onSuccess?.();
      } else {
        showFail();
      }
    } catch (e) {
      console.error("Master PIN login error:", e);
      showFail("Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const Key = ({ label, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-20 h-16 rounded-2xl ${brand.key} text-slate-100 text-xl font-semibold shadow-[0_8px_30px_rgb(0,0,0,0.35)] active:scale-95 transition disabled:opacity-40`}
    >
      {label}
    </button>
  );

  return (
    <div 
      className="fixed inset-0 z-[1000] overflow-hidden bg-black/95 backdrop-blur-sm"
    >
      <div className="relative max-w-3xl mx-auto min-h-screen grid place-items-center px-4">
        <div 
          className={`w-full text-center transition-all duration-700 ${
            shake ? "animate-[shake_0.45s_ease]" : ""
          } ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Header */}
          <div className={`transition-all duration-1000 mb-6 ${
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"
          }`}>
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(220,38,38,0.6)]">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className={`transition-all duration-1000 delay-100 ${
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}>
            <h1 className="text-3xl font-bold text-white drop-shadow-2xl">PIN Maestro</h1>
            <p className="text-gray-300 mt-2 drop-shadow-lg">Acceso a administración de usuarios</p>
          </div>

          {/* PIN Dots */}
          <div className="flex items-center justify-center gap-3 mt-6">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div 
                key={i}
                className={`transition-all duration-500 ${
                  mounted ? "opacity-100 scale-100" : "opacity-0 scale-0"
                }`}
                style={{ transitionDelay: `${200 + (i * 50)}ms` }}
              >
                <Dot filled={pin.length > i} />
              </div>
            ))}
          </div>

          {err && (
            <p className="mt-3 text-red-400 text-sm font-medium animate-[fadeIn_0.3s_ease]">
              {err}
            </p>
          )}

          {/* Keypad */}
          <div className="mt-8 grid grid-cols-3 gap-6 place-items-center">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n, idx) => (
              <div
                key={n}
                className={`transition-all duration-500 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${400 + (idx * 40)}ms` }}
              >
                <Key label={n} onClick={() => press(n)} disabled={loading} />
              </div>
            ))}
            
            <div
              className={`transition-all duration-500 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: '760ms' }}
            >
              <Key label="←" onClick={() => press("back")} disabled={loading} />
            </div>
            
            <div
              className={`transition-all duration-500 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: '800ms' }}
            >
              <Key label={0} onClick={() => press(0)} disabled={loading} />
            </div>
            
            <div
              className={`transition-all duration-500 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: '840ms' }}
            >
              <button
                onClick={() => press("ok")}
                disabled={pin.length < 4 || loading}
                className={`w-20 h-16 rounded-2xl text-white text-base font-semibold shadow-[0_8px_30px_rgba(220,38,38,0.45)] active:scale-95 transition ${brand.red} disabled:opacity-40`}
              >
                {loading ? <Loader2 className="mx-auto animate-spin" /> : "✓"}
              </button>
            </div>
          </div>

          {/* Cancel */}
          {onCancel && (
            <div className="mt-8">
              <Button
                onClick={onCancel}
                variant="outline"
                className="border-white/15 text-gray-300 hover:bg-white/5"
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          )}

          {/* Info */}
          <p className="mt-8 text-xs text-gray-500">
            PIN por defecto: 9110 (cambiar después de primer acceso)
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
