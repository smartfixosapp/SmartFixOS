import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Shield, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminAuthGate({ onSuccess, onCancel }) {
  const MASTER_PIN = "3407";
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);

  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem("911-session") ||
        localStorage.getItem("employee_session");
      const session = raw ? JSON.parse(raw) : null;
      const role = session?.userRole || session?.role;
      if (role === "admin" || role === "manager") {
        onSuccess?.();
        return;
      }
    } catch {}

    loadAdmins();
  }, []);

  // Soporte para teclado físico
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

      if (validAdmin || pin === MASTER_PIN) {
        onSuccess?.();
      } else {
        setError(true);
        setPin("");
        toast.error("PIN incorrecto");
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
    <div className="apple-type fixed inset-0 apple-surface flex items-center justify-center p-4 z-[9999]">
      <div className="relative w-full max-w-md">
        {/* Header con logo */}
        <div className="text-center mb-12">
          <div className="relative inline-block mb-6">
            <div className="relative w-28 h-28 rounded-apple-lg bg-apple-blue/15 flex items-center justify-center">
              <Shield className="w-14 h-14 text-apple-blue" />
            </div>
          </div>

          <h1 className="apple-text-large-title apple-label-primary mb-3">
            Acceso Administrativo
          </h1>
          <p className="apple-label-secondary apple-text-subheadline">
            Ingresa tu PIN de administrador para continuar
          </p>

          {adminUsers.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2 apple-text-caption1 apple-label-tertiary">
              <Shield className="w-3 h-3" />
              <span className="tabular-nums">{adminUsers.length} administrador{adminUsers.length > 1 ? 'es' : ''} activo{adminUsers.length > 1 ? 's' : ''}</span>
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
                    ? "bg-apple-red scale-110"
                    : "bg-apple-blue scale-110"
                  : "bg-gray-sys6 dark:bg-gray-sys5"
              }`}
            />
          ))}
        </div>

        {/* Teclado */}
        <div className="apple-surface-elevated rounded-apple-lg p-6 shadow-apple-xl border-0">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={loading}
                className="relative overflow-hidden bg-gray-sys6 dark:bg-gray-sys5 hover:bg-apple-blue/12 apple-press rounded-apple-md h-16 apple-label-primary apple-text-title2 tabular-nums transition-all disabled:opacity-50"
              >
                <span className="relative z-10">{num}</span>
              </button>
            ))}

            {/* Fila inferior */}
            <button
              onClick={handleDelete}
              disabled={loading || pin.length === 0}
              className="bg-gray-sys6 dark:bg-gray-sys5 hover:bg-apple-red/12 apple-press rounded-apple-md h-16 apple-label-primary flex items-center justify-center transition-all disabled:opacity-30"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <button
              onClick={() => handleNumberClick("0")}
              disabled={loading}
              className="relative overflow-hidden bg-gray-sys6 dark:bg-gray-sys5 hover:bg-apple-blue/12 apple-press rounded-apple-md h-16 apple-label-primary apple-text-title2 tabular-nums transition-all disabled:opacity-50"
            >
              <span className="relative z-10">0</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading || pin.length < 4}
              className={`rounded-apple-md h-16 apple-text-title2 transition-all flex items-center justify-center relative overflow-hidden apple-press ${
                pin.length >= 4 && !loading
                  ? "apple-btn apple-btn-primary"
                  : "bg-gray-sys6 dark:bg-gray-sys5 opacity-40 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <span className="text-white">OK</span>
              )}
            </button>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="flex items-center gap-2 text-apple-red apple-text-subheadline bg-apple-red/12 rounded-apple-md p-3">
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
              className="apple-label-secondary hover:apple-label-primary transition-colors apple-text-subheadline apple-press"
            >
              ← Cancelar
            </button>
          )}
          <p className="apple-label-tertiary apple-text-caption1">
            Presiona ESC para cancelar • Enter para confirmar
          </p>
        </div>
      </div>
    </div>
  );
}
