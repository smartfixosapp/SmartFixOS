import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft, Delete, Check, ExternalLink, Shield, Zap, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { triggerRealtimeNotification, NOTIFICATION_TYPES } from "@/components/notifications/RealtimeNotifications";
import RequestAccessModal from "../components/auth/RequestAccessModal";

export default function PinAccess() {
  const navigate = useNavigate();
  const [step, setStep] = useState("welcome");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasCheckedSession = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [checkingUsers, setCheckingUsers] = useState(true);
  const [showRequestAccess, setShowRequestAccess] = useState(false);

  // ✅ Verificar si ya hay sesión activa Y si es primera vez - SOLO UNA VEZ
  useEffect(() => {
    if (hasCheckedSession.current) return;
    hasCheckedSession.current = true;

    (async () => {
      // 🔧 Modo testing: forzar Setup con ?setup=true
      const params = new URLSearchParams(window.location.search);
      if (params.get("setup") === "true") {
        console.log("🔧 Modo testing - forzando Setup");
        navigate("/Setup", { replace: true });
        return;
      }

      // 1. Verificar sesión activa
      const session = localStorage.getItem("employee_session");
      if (session) {
        try {
          const parsed = JSON.parse(session);
          if (parsed && parsed.id) {
            console.log("✅ PinAccess: Sesión detectada, redirigiendo a Dashboard");
            navigate("/Dashboard", { replace: true });
            return;
          }
        } catch (e) {
          console.log("⚠️ PinAccess: Sesión corrupta, limpiando");
          localStorage.removeItem("employee_session");
          sessionStorage.removeItem("911-session");
        }
      }

      // 2. Verificar si hay usuarios en el sistema (primera vez)
      try {
        const users = await base44.entities.User.filter({ active: true });
        if (!users || users.length === 0) {
          console.log("🎉 Primera vez - redirigir a Setup");
          navigate("/Setup", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Error checking users:", error);
      }

      console.log("✅ PinAccess: No hay sesión, mostrando página de acceso");
      setCheckingUsers(false);
      setIsReady(true);
    })();
  }, [navigate]);

  const handleNumberClick = (num) => {
    if (pin.length < 4) {
      setPin(pin + num);
      setError("");
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
    
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError("PIN debe tener 4 dígitos");
      toast.error("PIN debe tener 4 dígitos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const users = await base44.entities.User.filter({ 
        pin: pin,
        active: true 
      });

      if (users && users.length > 0) {
        const user = users[0];
        
        const session = {
          id: user.id,
          userId: user.id,
          userEmail: user.email,
          userName: user.full_name || user.email,
          userRole: user.role || "user",
          employee_code: user.employee_code || "",
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          loginTime: new Date().toISOString()
        };

        localStorage.setItem("employee_session", JSON.stringify(session));
        sessionStorage.setItem("911-session", JSON.stringify(session));

        if (navigator.vibrate) {
          navigator.vibrate([50, 100, 50]);
        }

        // 🔔 Trigger notificación en tiempo real
        await triggerRealtimeNotification(NOTIFICATION_TYPES.EMPLOYEE_LOGIN, {
          userId: user.id,
          userName: user.full_name,
          userRole: user.role,
          ipAddress: 'local'
        });

        toast.success(`¡Bienvenido, ${session.userName}!`, {
          duration: 2000,
        });

        setTimeout(() => {
          navigate("/Dashboard", { replace: true });
        }, 600);

      } else {
        setError("PIN incorrecto o usuario inactivo");
        toast.error("PIN incorrecto o usuario inactivo");
        setPin("");
        
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100, 50, 100]);
        }
      }

    } catch (error) {
      console.error("Error validating PIN:", error);
      setError("Error al validar PIN");
      toast.error("Error al validar PIN. Intenta nuevamente.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== "pin") return;

    const handleKeyPress = (e) => {
      if (e.key === "Enter" && pin.length === 4) {
        handleSubmit();
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key >= "0" && e.key <= "9") {
        handleNumberClick(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [step, pin]);

  if (!isReady || checkingUsers) {
    return (
      <div className="pinaccess-fullscreen-container">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (step === "welcome") {
    return (
      <div className="pinaccess-fullscreen-container">
          {/* Partículas flotantes animadas */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  background: `radial-gradient(circle, ${
                    i % 3 === 0 ? 'rgba(6,182,212,0.6)' : 
                    i % 3 === 1 ? 'rgba(16,185,129,0.6)' : 
                    'rgba(163,230,53,0.6)'
                  }, transparent)`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${3 + Math.random() * 4}s`
                }}
              />
            ))}
          </div>

          {/* Gradient orbs con animación más intensa */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -left-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] animate-spin-slow"></div>
            <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] animate-spin-slow-reverse"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lime-500/10 rounded-full blur-[150px] animate-pulse-slow"></div>
          </div>

          <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-2xl text-center animate-fade-in-up">
              
              {/* Logo con efecto holográfico */}
              <div className="mb-8 sm:mb-12">
                <div className="relative inline-block group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/60 via-emerald-500/60 to-lime-500/60 blur-3xl animate-pulse-fast group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-emerald-500 to-lime-500 blur-xl opacity-50 animate-spin-slow"></div>
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                    alt="SmartFixOS"
                    className="relative w-40 h-40 sm:w-56 sm:h-56 object-contain mx-auto drop-shadow-[0_16px_48px_rgba(0,168,232,1)] group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              </div>

              {/* Título con efecto glitch */}
              <div className="mb-10 sm:mb-14 space-y-4">
                <h1 className="text-5xl sm:text-7xl font-black mb-6 bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-400 bg-clip-text text-transparent animate-gradient-x relative">
                  <span className="relative inline-block animate-glitch">
                    SmartFixOS
                  </span>
                </h1>
                <div className="relative">
                  <p className="text-xl sm:text-3xl text-white font-bold animate-pulse-slow">
                    Sistema de Gestión Ultra-Rápido
                  </p>
                  <div className="absolute -inset-x-4 -inset-y-2 bg-gradient-to-r from-transparent via-white/5 to-transparent blur-xl animate-shimmer"></div>
                </div>
                <div className="flex items-center justify-center gap-3 text-emerald-400 animate-bounce-slow">
                  <Zap className="w-6 h-6 animate-pulse" />
                  <p className="text-lg sm:text-xl font-semibold">
                    Acceso instantáneo • Sin esperas
                  </p>
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              {/* Botón explosivo mejorado */}
              <button
                onClick={() => setStep("pin")}
                className="
                  w-full group relative overflow-hidden
                  bg-gradient-to-r from-cyan-600 via-emerald-600 to-lime-600
                  hover:from-cyan-500 hover:via-emerald-500 hover:to-lime-500
                  rounded-3xl p-8 sm:p-10
                  border-4 border-white/20
                  shadow-[0_0_80px_rgba(6,182,212,0.5),0_0_120px_rgba(16,185,129,0.3)]
                  hover:shadow-[0_0_120px_rgba(6,182,212,0.8),0_0_160px_rgba(16,185,129,0.5)]
                  transition-all duration-500
                  active:scale-95
                  transform hover:scale-105
                  animate-pulse-border
                "
              >
                {/* Efectos de brillo */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Contenido del botón */}
                <div className="relative flex items-center justify-center gap-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center group-hover:rotate-12 transition-transform duration-500 shadow-2xl">
                    <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-lg" />
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-white text-3xl sm:text-4xl font-black mb-2 drop-shadow-lg">
                      🚀 ACCESO RÁPIDO
                    </p>
                    <p className="text-white/90 text-lg sm:text-xl font-semibold">
                      Entra en 2 segundos con tu PIN
                    </p>
                  </div>
                  <Zap className="w-12 h-12 sm:w-14 sm:h-14 text-yellow-300 animate-bounce group-hover:scale-125 transition-transform duration-500 drop-shadow-[0_0_20px_rgba(253,224,71,0.8)]" />
                </div>
              </button>

              {/* Stats dinámicos */}
              <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-sm hover:scale-105 transition-transform duration-300">
                  <p className="text-3xl sm:text-4xl font-black text-cyan-400 mb-1">⚡</p>
                  <p className="text-xs sm:text-sm text-gray-400">Ultra Rápido</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 backdrop-blur-sm hover:scale-105 transition-transform duration-300">
                  <p className="text-3xl sm:text-4xl font-black text-emerald-400 mb-1">🔐</p>
                  <p className="text-xs sm:text-sm text-gray-400">100% Seguro</p>
                </div>
                <div className="bg-gradient-to-br from-lime-500/10 to-lime-500/5 border border-lime-500/20 rounded-2xl p-4 backdrop-blur-sm hover:scale-105 transition-transform duration-300">
                  <p className="text-3xl sm:text-4xl font-black text-lime-400 mb-1">💎</p>
                  <p className="text-xs sm:text-sm text-gray-400">Pro Edition</p>
                </div>
              </div>

              <div className="mt-10 space-y-2">
                <p className="text-gray-500 text-sm sm:text-base font-semibold">
                  💥 Versión 3.0 - La más rápida hasta ahora
                </p>
                <p className="text-gray-600 text-xs">
                  © {new Date().getFullYear()} 911 SmartFix • Powered by Base44
                </p>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0) translateX(0); }
              50% { transform: translateY(-20px) translateX(10px); }
            }

            @keyframes spin-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }

            @keyframes spin-slow-reverse {
              from { transform: rotate(360deg); }
              to { transform: rotate(0deg); }
            }

            @keyframes pulse-slow {
              0%, 100% { opacity: 0.8; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(1.05); }
            }

            @keyframes pulse-fast {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }

            @keyframes gradient-x {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }

            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }

            @keyframes glitch {
              0%, 90%, 100% { transform: translate(0); }
              20% { transform: translate(-2px, 2px); }
              40% { transform: translate(2px, -2px); }
              60% { transform: translate(-2px, -2px); }
              80% { transform: translate(2px, 2px); }
            }

            @keyframes bounce-slow {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }

            @keyframes fade-in-up {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes pulse-border {
              0%, 100% { border-color: rgba(255,255,255,0.2); }
              50% { border-color: rgba(255,255,255,0.5); }
            }

            .animate-float { animation: float 5s ease-in-out infinite; }
            .animate-spin-slow { animation: spin-slow 20s linear infinite; }
            .animate-spin-slow-reverse { animation: spin-slow-reverse 15s linear infinite; }
            .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
            .animate-pulse-fast { animation: pulse-fast 1.5s ease-in-out infinite; }
            .animate-gradient-x { 
              background-size: 200% 200%;
              animation: gradient-x 3s ease infinite;
            }
            .animate-shimmer { animation: shimmer 3s ease-in-out infinite; }
            .animate-glitch { animation: glitch 2s ease-in-out infinite; }
            .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
            .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
            .animate-pulse-border { animation: pulse-border 2s ease-in-out infinite; }

            .delay-500 { animation-delay: 500ms; }
            .delay-1000 { animation-delay: 1000ms; }

            .pinaccess-fullscreen-container {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              width: 100vw;
              height: 100vh;
              height: 100dvh;
              min-height: 100vh;
              min-height: 100dvh;
              margin: 0;
              padding: 0;
              overflow: hidden;
              background: radial-gradient(circle at top, #0f172a 0%, #020617 45%, #000 90%);
              display: flex;
              align-items: center;
              justify-content: center;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background: #000;
            }

            body {
              overscroll-behavior: none;
              -webkit-overflow-scrolling: touch;
            }

            #root {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }

            .active\\:scale-98:active {
              transform: scale(0.98);
            }

            button {
              -webkit-tap-highlight-color: transparent;
              user-select: none;
            }

            * {
              -webkit-tap-highlight-color: transparent;
            }
          `}</style>
        </div>
      );
    }

  const numbers = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [null, 0, "⌫"]
  ];

  return (
    <>
      <div className="pinaccess-fullscreen-container">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/5 rounded-full blur-[150px] animate-pulse delay-500"></div>
        </div>

        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
          <button
            onClick={() => {
              setStep("welcome");
              setPin("");
              setError("");
            }}
            className="
              flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-3
              bg-slate-800/60 hover:bg-slate-800/80
              backdrop-blur-xl
              border-2 border-white/10 hover:border-cyan-500/40
              rounded-xl
              text-white text-sm sm:text-base font-semibold
              transition-all duration-200
              active:scale-95
            "
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Volver
          </button>
        </div>

        <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-md">
            
            <div className="text-center mb-6 sm:mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-emerald-500/30 blur-2xl animate-pulse"></div>
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                  alt="SmartFixOS"
                  className="relative h-16 sm:h-20 w-auto object-contain mx-auto drop-shadow-[0_4px_16px_rgba(0,168,232,0.8)]"
                />
              </div>
            </div>

            <div className="text-center mb-8 animate-fade-in-up">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-emerald-500 to-lime-500 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.6)] animate-pulse-fast">
                  <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-lg" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-400 bg-clip-text text-transparent animate-gradient-x">
                  Acceso Seguro
                </h1>
              </div>
              <p className="text-gray-300 text-base sm:text-lg font-semibold flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
                Tu PIN de 4 dígitos
                <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-2xl border-4 border-cyan-500/40 rounded-3xl p-8 sm:p-10 mb-6 shadow-[0_0_80px_rgba(6,182,212,0.3)] relative overflow-hidden animate-pulse-border">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 animate-pulse-slow"></div>
              
              <div className="relative flex justify-center gap-4 sm:gap-5 mb-2">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`
                      w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-4 transition-all duration-500 relative overflow-hidden
                      ${pin.length > index
                        ? "bg-gradient-to-br from-cyan-500 via-emerald-500 to-lime-500 border-white shadow-[0_0_40px_rgba(6,182,212,0.8),0_0_60px_rgba(16,185,129,0.6)] scale-110 rotate-12"
                        : "bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/30 hover:scale-105"}
                    `}
                  >
                    {pin.length > index && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-shimmer"></div>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white animate-pulse-fast shadow-[0_0_20px_rgba(255,255,255,0.8)]"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {error && (
                <div className="text-center mt-4">
                  <p className="text-red-400 text-sm font-semibold animate-pulse">
                    ⚠️ {error}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3 sm:space-y-4 mb-6">
              {numbers.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-3 gap-3 sm:gap-4">
                  {row.map((num, colIndex) => {
                    const isBackspace = num === "⌫";
                    const isEmpty = num === null;

                    if (isEmpty) {
                      return <div key={`empty-${colIndex}`}></div>;
                    }

                    if (isBackspace) {
                      return (
                        <button
                          key="backspace"
                          onClick={handleBackspace}
                          disabled={pin.length === 0 || loading}
                          className="
                            h-16 sm:h-20 rounded-2xl
                            bg-gradient-to-br from-red-600/30 to-red-800/30
                            border-2 border-red-500/40
                            backdrop-blur-xl
                            hover:from-red-600/50 hover:to-red-800/50 hover:border-red-500/60
                            active:scale-95
                            disabled:opacity-40 disabled:cursor-not-allowed
                            transition-all duration-200
                            shadow-[0_8px_24px_rgba(220,38,38,0.3)]
                            hover:shadow-[0_12px_32px_rgba(220,38,38,0.5)]
                            group
                          "
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 to-red-600/0 group-hover:from-red-500/20 group-hover:to-red-600/20 transition-all duration-300 rounded-2xl"></div>
                          <Delete className="w-6 h-6 sm:w-7 sm:h-7 mx-auto text-red-300 relative z-10" />
                        </button>
                      );
                    }

                    return (
                      <button
                        key={num}
                        onClick={() => handleNumberClick(String(num))}
                        disabled={loading || pin.length >= 4}
                        className="
                          h-16 sm:h-20 rounded-2xl
                          bg-gradient-to-br from-slate-700/60 to-slate-800/60
                          border-2 border-cyan-500/30
                          backdrop-blur-xl
                          text-white text-2xl sm:text-3xl font-black
                          hover:from-slate-700/80 hover:to-slate-800/80 hover:border-cyan-400/50
                          active:scale-95
                          disabled:opacity-40 disabled:cursor-not-allowed
                          transition-all duration-200
                          shadow-[0_8px_24px_rgba(0,168,232,0.2)]
                          hover:shadow-[0_12px_32px_rgba(0,168,232,0.4)]
                          relative overflow-hidden
                          group
                        "
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-emerald-500/0 group-hover:from-cyan-500/20 group-hover:to-emerald-500/20 transition-all duration-300"></div>
                        
                        <span className="relative z-10">{num}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={pin.length !== 4 || loading}
              className="
                w-full h-20 sm:h-24 rounded-3xl
                bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600
                hover:from-emerald-500 hover:via-green-500 hover:to-lime-500
                border-4 border-white/20
                text-white text-2xl sm:text-3xl font-black
                disabled:opacity-40 disabled:cursor-not-allowed
                active:scale-95
                transition-all duration-300
                shadow-[0_0_80px_rgba(16,185,129,0.5),0_0_120px_rgba(163,230,53,0.3)]
                hover:shadow-[0_0_120px_rgba(16,185,129,0.8),0_0_160px_rgba(163,230,53,0.5)]
                hover:scale-105
                relative overflow-hidden
                group
                animate-pulse-border
              "
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10 flex items-center justify-center gap-4">
                {loading ? (
                  <>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-white border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(255,255,255,0.5)]"></div>
                    <span className="drop-shadow-lg">⚡ VALIDANDO...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-lg animate-bounce-slow" />
                    <span className="drop-shadow-lg">🚀 ENTRAR AHORA</span>
                    <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-300 drop-shadow-[0_0_20px_rgba(253,224,71,0.8)] animate-pulse" />
                  </>
                )}
              </div>
            </button>

            <div className="text-center mt-8 space-y-4">
              <p className="text-gray-500 text-xs sm:text-sm">
                🔐 Acceso seguro con PIN de 4 dígitos
              </p>
              
              {/* Botón Solicitar Acceso */}
              <button
                onClick={() => setShowRequestAccess(true)}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border-2 border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl text-emerald-300 hover:text-emerald-200 font-semibold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 group"
              >
                <UserPlus className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                ¿No tienes cuenta? Solicitar Acceso
              </button>
              
              <p className="text-gray-600 text-xs">
                SmartFixOS v2.0
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.05); }
        }

        @keyframes pulse-fast {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes glitch {
          0%, 90%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          60% { transform: translate(-2px, -2px); }
          80% { transform: translate(2px, 2px); }
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-border {
          0%, 100% { border-color: rgba(255,255,255,0.2); }
          50% { border-color: rgba(255,255,255,0.5); }
        }

        .animate-float { animation: float 5s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-spin-slow-reverse { animation: spin-slow-reverse 15s linear infinite; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        .animate-pulse-fast { animation: pulse-fast 1.5s ease-in-out infinite; }
        .animate-gradient-x { 
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        .animate-shimmer { animation: shimmer 3s ease-in-out infinite; }
        .animate-glitch { animation: glitch 2s ease-in-out infinite; }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
        .animate-pulse-border { animation: pulse-border 2s ease-in-out infinite; }

        .delay-500 { animation-delay: 500ms; }
        .delay-1000 { animation-delay: 1000ms; }

        .pinaccess-fullscreen-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          min-height: 100vh;
          min-height: 100dvh;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: radial-gradient(circle at top, #0f172a 0%, #020617 45%, #000 90%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
        }

        body {
          overscroll-behavior: none;
          -webkit-overflow-scrolling: touch;
        }

        #root {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }

        .active\\:scale-98:active,
        .active\\:scale-95:active {
          transform: scale(0.95);
        }

        button {
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        input, select, textarea {
          font-size: 16px !important;
        }

        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>

      <RequestAccessModal
        open={showRequestAccess}
        onClose={() => setShowRequestAccess(false)}
      />
    </>
  );
}
