import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Shield, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminAuthGate({ onSuccess, onCancel }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);

  useEffect(() => {
    loadAdmins();
  }, []);

  // ✅ Soporte para teclado físico
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Solo procesar si no es un input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Enter' && pin.length >= 4) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [pin, onCancel]);

  const loadAdmins = async () => {
    try {
      const admins = await dataClient.entities.User.filter({ 
        role: "admin",
        active: true 
      });
      setAdminUsers(admins || []);
    } catch (error) {
      console.error("Error loading admins:", error);
      toast.error("Error al cargar administradores");
    }
  };

  const handleNumberClick = (num) => {
    if (pin.length < 6) {
      setPin(pin + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const handleSubmit = async () => {
    if (pin.length < 4) return;

    setLoading(true);
    try {
      // Buscar admin con ese PIN
      const validAdmin = adminUsers.find(admin => admin.pin === pin);
      
      if (validAdmin) {
        // ✅ No mostrar toast de bienvenida, ir directo a la acción
        onSuccess?.();
      } else {
        setError(true);
        setPin("");
        toast.error("❌ PIN incorrecto");
      }
    } catch (error) {
      console.error("Error validating PIN:", error);
      toast.error("Error al validar PIN");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4 || pin.length === 6) {
      handleSubmit();
    }
  }, [pin]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-4 z-[9999]">
      {/* Efectos de fondo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header con logo */}
        <div className="text-center mb-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-emerald-500 to-cyan-500 blur-2xl opacity-60 rounded-full animate-pulse" />
            <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-cyan-600 via-emerald-600 to-cyan-600 flex items-center justify-center shadow-2xl">
              <Shield className="w-14 h-14 text-white" />
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 mb-3">
            Acceso Administrativo
          </h1>
          <p className="text-cyan-300/70 text-sm">
            Ingresa tu PIN de administrador para continuar
          </p>

          {adminUsers.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-cyan-400/60">
              <Shield className="w-3 h-3" />
              <span>{adminUsers.length} administrador{adminUsers.length > 1 ? 'es' : ''} activo{adminUsers.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* PIN Display */}
        <div className="flex justify-center gap-3 mb-12">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full transition-all duration-300 ${
                i < pin.length
                  ? error
                    ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] scale-110"
                    : "bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_20px_rgba(6,182,212,0.8)] scale-110"
                  : "bg-slate-800/40 border border-cyan-500/20"
              }`}
            />
          ))}
        </div>

        {/* Teclado */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-6 shadow-[0_0_60px_rgba(6,182,212,0.2)]">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={loading}
                className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 hover:from-cyan-900/40 hover:to-blue-900/40 active:scale-95 rounded-2xl h-16 text-white text-2xl font-bold transition-all border border-cyan-500/10 hover:border-cyan-500/30 shadow-lg group disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10">{num}</span>
              </button>
            ))}

            {/* Fila inferior */}
            <button
              onClick={handleDelete}
              disabled={loading || pin.length === 0}
              className="bg-gradient-to-br from-slate-800 to-slate-900 hover:from-red-900/40 hover:to-red-900/40 active:scale-95 rounded-2xl h-16 text-white flex items-center justify-center transition-all border border-cyan-500/10 hover:border-red-500/30 disabled:opacity-30"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <button
              onClick={() => handleNumberClick("0")}
              disabled={loading}
              className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 hover:from-cyan-900/40 hover:to-blue-900/40 active:scale-95 rounded-2xl h-16 text-white text-2xl font-bold transition-all border border-cyan-500/10 hover:border-cyan-500/30 shadow-lg group disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10">0</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading || pin.length < 4}
              className={`rounded-2xl h-16 text-white text-2xl font-bold transition-all flex items-center justify-center relative overflow-hidden ${
                pin.length >= 4 && !loading
                  ? "bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-[0_0_40px_rgba(6,182,212,0.6)] hover:shadow-[0_0_60px_rgba(6,182,212,0.8)] active:scale-95"
                  : "bg-slate-800/40 opacity-40 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <span className="text-3xl">✓</span>
              )}
            </button>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-3 animate-pulse">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>PIN incorrecto. Intenta nuevamente.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-cyan-400/60 hover:text-cyan-400 transition-colors text-sm font-medium"
            >
              ← Cancelar
            </button>
          )}
          <p className="text-slate-600 text-xs">
            Presiona ESC para cancelar • Enter para confirmar
          </p>
        </div>
      </div>
    </div>
  );
}
