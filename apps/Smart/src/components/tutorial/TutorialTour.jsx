import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { callJENAI } from "@/lib/jenaiEngine";
import { cn } from "@/lib/utils";
import {
  X, ChevronRight, ChevronLeft, Sparkles,
  LayoutDashboard, ClipboardList, ShoppingCart,
  Users, Package, BarChart3, CheckCircle2, Zap
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// Pasos del tutorial — cada uno describe una función clave
// ─────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "welcome",
    icon: Sparkles,
    color: "bg-apple-purple",
    title: "¡Hola! Soy tu asistente ✨",
    subtitle: "Tour guiado • 7 pasos • ~2 min",
    content: "Te voy a mostrar cómo funciona SmartFixOS. Vamos a recorrer las funciones principales de tu taller digital.",
    page: null,
    selector: null,
    aiTopic: null,
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    color: "bg-apple-blue",
    title: "Dashboard — El centro de mando",
    subtitle: "Vista principal",
    content: "Aquí ves todo de un vistazo: órdenes activas, caja, alertas, y el estado general de tu taller.",
    page: "/Dashboard",
    selector: '[class*="Órdenes Activas"], button:has-text("Órdenes Activas")',
    selectorFallback: "main",
    aiTopic: "dashboard de un taller de reparación: órdenes activas, caja, alertas y KPIs",
  },
  {
    id: "orders",
    icon: ClipboardList,
    color: "bg-apple-green",
    title: "Órdenes de Trabajo",
    subtitle: "El corazón del taller",
    content: "Crea órdenes de trabajo en segundos. El wizard te guía paso a paso: cliente, dispositivo, problema, técnico, seguridad y evidencia.",
    page: "/Dashboard",
    selector: null,
    aiTopic: "crear y gestionar órdenes de trabajo de reparación: wizard de 7 pasos, estatus, técnicos asignados",
  },
  {
    id: "pos",
    icon: ShoppingCart,
    color: "bg-apple-orange",
    title: "POS — Punto de Venta",
    subtitle: "Caja y ventas",
    content: "Abre la caja, busca productos, agrega al carrito y cobra. Acepta efectivo, tarjeta o ambos. El ticket sale automático.",
    page: "/POS",
    selector: null,
    aiTopic: "punto de venta (POS) para taller de reparación: abrir caja, agregar productos al carrito, cobrar, recibos",
  },
  {
    id: "customers",
    icon: Users,
    color: "bg-apple-red",
    title: "Clientes",
    subtitle: "Tu base de datos",
    content: "Todos tus clientes en un lugar. Historial completo de reparaciones, balances pendientes, y portal de seguimiento.",
    page: "/Customers",
    selector: null,
    aiTopic: "gestión de clientes en taller: historial de reparaciones, portal de cliente, balance pendiente",
  },
  {
    id: "inventory",
    icon: Package,
    color: "bg-apple-blue",
    title: "Inventario",
    subtitle: "Control de piezas y productos",
    content: "Controla tu stock de piezas, accesorios y productos. Alertas de stock bajo, órdenes de compra, y movimientos automáticos al completar reparaciones.",
    page: "/Inventory",
    selector: null,
    aiTopic: "inventario de taller de reparación: piezas, accesorios, alertas de stock bajo, órdenes de compra",
  },
  {
    id: "financial",
    icon: BarChart3,
    color: "bg-apple-indigo",
    title: "Finanzas",
    subtitle: "Reportes y flujo de caja",
    content: "Visualiza ingresos, gastos, neto diario y mensual. Reportes por período, compromisos de pago y análisis de rentabilidad.",
    page: "/Financial",
    selector: null,
    aiTopic: "finanzas de taller de reparación: ingresos, gastos, neto, reportes por período, flujo de caja",
  },
  {
    id: "done",
    icon: CheckCircle2,
    color: "bg-apple-green",
    title: "¡Ya eres un experto! 🎉",
    subtitle: "Tour completado",
    content: "Eso es todo lo básico. Recuerda que puedes volver a este tour cuando quieras desde el botón de ayuda. ¡Mucho éxito con tu taller!",
    page: null,
    selector: null,
    aiTopic: null,
  },
];

// ─────────────────────────────────────────────────────────
// Hook: persistencia del estado del tutorial
// ─────────────────────────────────────────────────────────
export function useTutorial() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(() =>
    localStorage.getItem("smartfix_tutorial_done") === "1"
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const complete = useCallback(() => {
    localStorage.setItem("smartfix_tutorial_done", "1");
    setHasCompleted(true);
    setIsOpen(false);
  }, []);
  const reset = useCallback(() => {
    localStorage.removeItem("smartfix_tutorial_done");
    localStorage.removeItem("smartfix_tutorial_step");
    setHasCompleted(false);
  }, []);

  return { isOpen, hasCompleted, open, close, complete, reset };
}

// ─────────────────────────────────────────────────────────
// Componente: Anillo pulsante sobre un elemento del DOM
// ─────────────────────────────────────────────────────────
function SpotlightRing({ selector, fallback }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!selector && !fallback) return;

    const findEl = () => {
      // Try multiple selector strategies
      const strategies = [
        () => selector ? document.querySelector(selector) : null,
        () => fallback ? document.querySelector(fallback) : null,
        () => document.querySelector("main"),
      ];
      for (const s of strategies) {
        try { const el = s(); if (el) return el; } catch {}
      }
      return null;
    };

    const measure = () => {
      const el = findEl();
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    measure();
    const timer = setTimeout(measure, 300);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [selector, fallback]);

  if (!rect) return null;

  const padding = 8;
  return (
    <motion.div
      className="pointer-events-none fixed z-[9988]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      style={{
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: 12,
        border: "2px solid rgba(139,92,246,0.8)",
        boxShadow: "0 0 0 4px rgba(139,92,246,0.2), 0 0 20px rgba(139,92,246,0.3)",
      }}
    >
      {/* Pulsing ring animation */}
      <motion.div
        className="absolute inset-0 rounded-[10px] border-2 border-violet-400/50"
        animate={{ scale: [1, 1.04, 1], opacity: [0.8, 0.2, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Componente principal: TutorialTour
// ─────────────────────────────────────────────────────────
export default function TutorialTour({ isOpen, onClose, onComplete }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [aiTips, setAiTips] = useState({});
  const [loadingTip, setLoadingTip] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const loadedTips = useRef(new Set());

  const currentStep = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progress = step / (STEPS.length - 1);

  // ── Navegar a la página del paso ──────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const targetPage = currentStep.page;
    if (targetPage && location.pathname !== targetPage) {
      setNavigating(true);
      navigate(targetPage);
      setTimeout(() => setNavigating(false), 600);
    }
  }, [step, isOpen]);

  // ── Cargar tip IA para el paso actual ─────────────────
  useEffect(() => {
    if (!isOpen || !currentStep.aiTopic) return;
    if (loadedTips.current.has(step)) return;

    const loadTip = async () => {
      setLoadingTip(true);
      try {
        const prompt = `Eres el asistente de SmartFixOS, un sistema para talleres de reparación.
Da UN tip práctico y corto (máximo 2 oraciones) sobre: ${currentStep.aiTopic}.
Empieza directamente con el tip, sin saludos. En español. Máximo 30 palabras.`;
        const tip = await callJENAI(prompt, { maxTokens: 80, temperature: 0.6 });
        setAiTips(prev => ({ ...prev, [step]: tip }));
        loadedTips.current.add(step);
      } catch {
        // Si falla la IA, simplemente no muestra el tip extra
      } finally {
        setLoadingTip(false);
      }
    };

    loadTip();
  }, [step, isOpen]);

  // ── Reset al abrir ────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setAiTips({});
      loadedTips.current.clear();
    }
  }, [isOpen]);

  const handleNext = () => {
    if (isLast) { onComplete?.(); return; }
    setStep(s => s + 1);
  };

  const handlePrev = () => {
    if (!isFirst) setStep(s => s - 1);
  };

  if (!isOpen) return null;

  const StepIcon = currentStep.icon;
  const aiTip = aiTips[step];
  const showSpotlight = !isFirst && !isLast && currentStep.selector;

  return (
    <>
      {/* Spotlight ring sobre el elemento objetivo */}
      <AnimatePresence>
        {showSpotlight && !navigating && (
          <SpotlightRing
            selector={currentStep.selector}
            fallback={currentStep.selectorFallback}
          />
        )}
      </AnimatePresence>

      {/* Panel del tutorial */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed z-[9989] bottom-24 right-3 left-3 sm:left-auto sm:right-4 sm:w-[340px]"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 overflow-hidden">

              {/* Header tinted */}
              <div className={cn("p-4", currentStep.color)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-apple-sm bg-white/20 flex items-center justify-center">
                      <StepIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white apple-text-subheadline font-semibold leading-tight">
                        {currentStep.title}
                      </p>
                      <p className="text-white/70 apple-text-caption2 font-medium">
                        {currentStep.subtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="apple-press w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-4 space-y-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="apple-label-secondary apple-text-footnote leading-relaxed">
                      {currentStep.content}
                    </p>

                    {/* Tip de IA */}
                    <AnimatePresence>
                      {(aiTip || loadingTip) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 rounded-apple-md bg-apple-purple/12 p-3"
                        >
                          <div className="flex items-start gap-2">
                            <Zap className="w-3.5 h-3.5 text-apple-purple mt-0.5 shrink-0" />
                            {loadingTip ? (
                              <div className="flex gap-1 items-center">
                                {[0, 1, 2].map(i => (
                                  <motion.div
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-apple-purple"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="text-apple-purple apple-text-caption1 leading-relaxed">
                                {aiTip}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </AnimatePresence>

                {/* Barra de progreso */}
                <div className="h-1 rounded-full bg-gray-sys6 dark:bg-gray-sys5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-apple-purple"
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  />
                </div>

                {/* Puntos de progreso + contador */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {STEPS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setStep(i)}
                        className={cn(
                          "rounded-full transition-all",
                          i === step
                            ? "w-4 h-1.5 bg-apple-purple"
                            : i < step
                            ? "w-1.5 h-1.5 bg-gray-sys4"
                            : "w-1.5 h-1.5 bg-gray-sys5"
                        )}
                      />
                    ))}
                  </div>
                  <span className="apple-label-tertiary apple-text-caption2 tabular-nums">
                    {step + 1} / {STEPS.length}
                  </span>
                </div>

                {/* Botones de navegación */}
                <div className="flex gap-2 pt-1">
                  {!isFirst && (
                    <button
                      onClick={handlePrev}
                      className="apple-press flex items-center gap-1.5 px-3 py-2 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary apple-text-caption1 font-medium transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Atrás
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className={cn(
                      "apple-press flex-1 flex items-center justify-center gap-2 py-2 rounded-apple-sm apple-text-subheadline font-semibold transition-all",
                      isLast
                        ? "bg-apple-green text-white"
                        : "bg-apple-purple text-white"
                    )}
                  >
                    {isLast ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        ¡Listo!
                      </>
                    ) : isFirst ? (
                      <>
                        Empezar tour
                        <ChevronRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
