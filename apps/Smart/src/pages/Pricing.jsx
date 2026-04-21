import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check, X, Zap, Shield, Crown, ArrowRight,
  ClipboardList, Package, Users, BarChart3,
  Smartphone, Mail, Headphones, ChevronLeft
} from "lucide-react";
import { PLANS, PLAN_LIMITS } from "@/lib/plans";

const FEATURES = [
  {
    label: "Ordenes de trabajo",
    starter: "50 / mes",
    pro: "Ilimitadas",
    icon: ClipboardList,
  },
  {
    label: "Productos en inventario",
    starter: "50 SKUs",
    pro: "Ilimitados",
    icon: Package,
  },
  {
    label: "Clientes",
    starter: "Ilimitados",
    pro: "Ilimitados",
    icon: Users,
  },
  {
    label: "POS / Punto de venta",
    starter: true,
    pro: true,
    icon: Smartphone,
  },
  {
    label: "Reportes financieros",
    starter: true,
    pro: true,
    icon: BarChart3,
  },
  {
    label: "Emails automáticos",
    starter: true,
    pro: true,
    icon: Mail,
  },
  {
    label: "Soporte prioritario",
    starter: false,
    pro: true,
    icon: Headphones,
  },
  {
    label: "Multi-usuario",
    starter: false,
    pro: true,
    icon: Shield,
  },
];

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
};

export default function Pricing() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState("monthly"); // monthly | annual

  const getPrice = (plan) => {
    if (billing === "annual") return (plan.priceAnnual / 12).toFixed(2);
    return plan.price.toFixed(2);
  };

  const handleSelectPlan = (planId) => {
    // Navigate to PinAccess with plan pre-selected for registration
    navigate(`/PinAccess?action=register&plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white overflow-y-auto selection:bg-cyan-500/30">
      {/* Nav */}
      <nav className="liquid-glass-strong sticky top-0 z-50 border-b border-white/5">
        <div className="app-container h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Volver</span>
          </button>
          <Button
            onClick={() => navigate("/PinAccess")}
            variant="ghost"
            className="text-white/60 hover:text-white text-sm"
          >
            Ya tengo cuenta
          </Button>
        </div>
      </nav>

      <div className="app-container py-12 sm:py-20">
        {/* Header */}
        <motion.div {...pageVariants} className="text-center mb-12">
          <Badge className="mb-4 bg-cyan-500/10 border-cyan-500/30 text-cyan-300 rounded-full px-4 py-1.5 text-xs font-bold">
            14 dias gratis en cualquier plan
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter bg-gradient-to-br from-white via-gray-200 to-gray-500 bg-clip-text text-transparent mb-4">
            Planes simples.
          </h1>
          <p className="text-lg sm:text-xl text-white/50 max-w-lg mx-auto">
            Sin contratos. Sin sorpresas. Cancela cuando quieras.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                billing === "monthly"
                  ? "bg-white/10 text-white border border-white/20"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all relative ${
                billing === "annual"
                  ? "bg-white/10 text-white border border-white/20"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Anual
              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                -17%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          {/* Starter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="liquid-glass rounded-3xl p-8 flex flex-col relative"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 flex items-center justify-center">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{PLANS.starter.label}</h3>
                <p className="text-sm text-white/50">{PLANS.starter.tagline}</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">${getPrice(PLANS.starter)}</span>
                <span className="text-white/40 text-sm font-medium">/ mes</span>
              </div>
              {billing === "annual" && (
                <p className="text-xs text-emerald-400 mt-1 font-medium">
                  ${PLANS.starter.priceAnnual.toFixed(2)} facturado anualmente
                </p>
              )}
            </div>

            <div className="space-y-3 flex-1 mb-8">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  {f.starter === false ? (
                    <X className="w-4 h-4 text-white/20 shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <span className={`text-sm ${f.starter === false ? "text-white/30" : "text-white/70"}`}>
                    {typeof f.starter === "string" ? f.starter : f.label}
                    {typeof f.starter === "string" && (
                      <span className="text-white/40"> — {f.label}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => handleSelectPlan("starter")}
              className="w-full h-14 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-base transition-all active:scale-[0.98]"
            >
              Empezar gratis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>

          {/* Pro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="liquid-glass-strong rounded-3xl p-8 flex flex-col relative ring-2 ring-cyan-500/30"
          >
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0 rounded-full px-4 py-1 text-xs font-black shadow-lg shadow-cyan-500/30">
                Mas popular
              </Badge>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Crown className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{PLANS.pro.label}</h3>
                <p className="text-sm text-white/50">{PLANS.pro.tagline}</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">${getPrice(PLANS.pro)}</span>
                <span className="text-white/40 text-sm font-medium">/ mes</span>
              </div>
              {billing === "annual" && (
                <p className="text-xs text-emerald-400 mt-1 font-medium">
                  ${PLANS.pro.priceAnnual.toFixed(2)} facturado anualmente
                </p>
              )}
            </div>

            <div className="space-y-3 flex-1 mb-8">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-sm text-white/70">
                    {typeof f.pro === "string" ? f.pro : f.label}
                    {typeof f.pro === "string" && (
                      <span className="text-white/40"> — {f.label}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => handleSelectPlan("pro")}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-base shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98]"
            >
              Empezar gratis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>

        {/* FAQ / Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <div className="liquid-glass-subtle rounded-2xl p-6 max-w-2xl mx-auto">
            <p className="text-white/50 text-sm">
              Ambos planes incluyen <span className="text-white/80 font-semibold">14 dias de prueba gratis</span>.
              No se requiere tarjeta de credito. Puedes cambiar de plan o cancelar en cualquier momento.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
