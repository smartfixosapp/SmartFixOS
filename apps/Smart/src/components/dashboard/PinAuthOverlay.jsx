
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, X } from "lucide-react"; // Added X for backspace icon

// LOCAL_USERS and brand are removed as they are not used in the new component's logic or styling.
// Dot component is removed as the PIN display logic is changed.

export default function PinAuthOverlayPro({ onAuthSuccess }) { // Renamed component
  const [pin, setPin] = useState("");
  const [error, setError] = useState(""); // Renamed 'err' to 'error'
  const [loading, setLoading] = useState(false);

  // Removed state variables not used in the new design:
  // const [shake, setShake] = useState(false);
  // const [mounted, setMounted] = useState(false);
  // const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  // const [currentUser, setCurrentUser] = useState(null);
  // const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    setPin("");
    setError(""); // Use new error state
    // Removed biometric checks and mounted state setup as per new design
  }, []);

  // Removed all biometric-related functions (checkBiometricSupport, attemptBiometricLogin, handleBiometricLogin)
  // as they are not part of this new PinAuthOverlayPro component's scope.

  const showError = (message = "PIN inválido o usuario no encontrado.") => { // Renamed from showFail
    setError(message);
    // Removed shake animation logic
    setTimeout(() => setError(""), 2000); // Clear error message after 2 seconds
    setPin(""); // Clear pin on error
  };

  const handleNumberClick = (num) => { // New function, replaces part of old 'press'
    if (loading) return;

    setPin((prev) => {
      const next = (prev + String(num)).slice(0, 4);
      setError(""); // Clear error on any new input
      if (next.length === 4) {
        setTimeout(() => login(next), 30); // Auto-submit after 4 digits
      }
      return next;
    });
  };

  const handleBackspace = () => { // New function, replaces part of old 'press'
    if (loading) return;
    setPin((p) => p.slice(0, -1));
    setError(""); // Clear error on backspace
  };

  const handleSubmit = () => { // New function, replaces part of old 'press' ('ok' logic)
    if (loading || pin.length === 0) return;
    void login(pin);
  };

  const login = async (p) => {
    if (loading) return;
    setLoading(true);
    try {
      let user = null;
      // Define LOCAL_USERS directly within the function or fetch from an external source if needed
      // For now, I'll put it here to keep the login logic working with local fallbacks
      const LOCAL_USERS = [
        { id: "1", full_name: "Yuka",    role: "admin",      pin: "1111", active: true },
        { id: "2", full_name: "Tiffany", role: "service",    pin: "1234", active: true },
        { id: "3", full_name: "Francis", role: "technician", pin: "3407", active: true },
      ];

      try {
        const r1 = await base44.entities.User.filter({ pin: p, active: true });
        if (Array.isArray(r1) && r1.length) user = r1[0];
        // The original code tried to parse p as Number if initial filter failed, keeping that logic
        if (!user && /^\d+$/.test(p)) {
          const r2 = await base44.entities.User.filter({ pin: Number(p), active: true });
          if (Array.isArray(r2) && r2.length) user = r2[0];
        }
      } catch (e) {
        console.warn("Base44 user lookup failed:", e); // Log warning but continue to local
      }

      if (!user) {
        // Fallback to local users if not found in base44 or base44 call failed
        user = LOCAL_USERS.find((u) => String(u.pin) === String(p) && u.active);
      }

      if (!user) {
        showError(); // Use new showError function
        return;
      }

      try {
        const open = await base44.entities.TimeEntry.filter({
          employee_id: user.id,
          clock_out: null,
        });
        if (open?.length) {
          sessionStorage.setItem("timeEntryId", open[0].id);
        }
      } catch (e) {
        console.error("Error checking open time entries:", e);
      }

      const sessionData = {
        userId: user.id,
        userName: user.full_name,
        userRole: user.role,
        authMode: "pin",
        sessionStart: new Date().toISOString(),
      };
      sessionStorage.setItem("911-session", JSON.stringify(sessionData));
      
      // Removed setCurrentUser and setShowBiometricSetup as biometric setup is not part of this component
      
      onAuthSuccess?.(sessionData);
    } catch (e) {
      console.error("PIN login error:", e);
      showError("Error de conexión."); // Use new showError function
    } finally {
      setLoading(false);
    }
  };

  // Key component is removed as the new UI uses direct buttons.

  return (
    <div className="fixed inset-0 z-[100] bg-[radial-gradient(circle_at_top,_rgba(0,168,232,0.15)_0%,_rgba(0,0,0,0.95)_45%,_rgba(0,0,0,1)_100%)]">
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-md">
          {/* Logo y título */}
          <div className="text-center mb-8">
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-emerald-500/30 blur-3xl"></div>
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                alt="SmartFixOS"
                className="relative h-24 w-auto mx-auto drop-shadow-[0_8px_32px_rgba(0,168,232,0.6)]"
              />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">SmartFixOS</h1>
            <p className="text-gray-400">Ingresa tu PIN para continuar</p>
          </div>

          {/* PIN Display */}
          <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-8 shadow-[0_24px_80px_rgba(0,168,232,0.5)]">
            <div className="h-16 grid place-items-center mb-6">
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      i < pin.length
                        ? "bg-gradient-to-br from-cyan-500 to-emerald-600 border-cyan-400 shadow-[0_4px_16px_rgba(0,168,232,0.4)]"
                        : "border-gray-600"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Numeric Pad */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  disabled={loading}
                  className="h-16 rounded-2xl bg-black/40 backdrop-blur-sm border border-cyan-500/20 text-white text-2xl font-bold hover:bg-cyan-600/20 hover:border-cyan-500/40 active:scale-95 transition-all disabled:opacity-50"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleBackspace}
                disabled={loading}
                className="h-16 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                <X className="w-6 h-6" /> {/* Uses Lucide-React X icon */}
              </button>
              <button
                onClick={() => handleNumberClick(0)}
                disabled={loading}
                className="h-16 rounded-2xl bg-black/40 backdrop-blur-sm border border-cyan-500/20 text-white text-2xl font-bold hover:bg-cyan-600/20 hover:border-cyan-500/40 active:scale-95 transition-all disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || pin.length === 0}
                className="h-16 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 text-white font-bold active:scale-95 transition-all disabled:opacity-50 shadow-[0_8px_32px_rgba(0,168,232,0.4)] flex items-center justify-center"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "OK"}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-600/20 border border-red-500/40 rounded-xl p-3 text-center">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Información adicional */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-xs">
              © {new Date().getFullYear()} SmartFixOS v2.0
            </p>
          </div>
        </div>
      </div>

      {/* Removed BiometricSetup component rendering */}
      {/* Removed old keyframe styles as they are not used */}
    </div>
  );
}
