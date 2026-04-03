/**
 * GACC — Global Admin Control Center
 * Shell layout: sidebar navigation + content area
 * Dark control-center aesthetic (bg-[#09090b])
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, LayoutDashboard, Building2, DollarSign, Activity,
  HeadphonesIcon, Lock, Wrench, LogOut, ChevronLeft, ChevronRight,
  Timer, Search, Command, Bell, Menu, X
} from "lucide-react";

// ── Auth ─────────────────────────────────────────────────────────────────────
const SUPER_SESSION_KEY = "smartfix_saas_session";
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2h

function checkSession(navigate) {
  const raw = localStorage.getItem(SUPER_SESSION_KEY);
  if (!raw) { navigate("/PinAccess", { replace: true }); return false; }
  try {
    const sess = JSON.parse(raw);
    if (sess?.role !== "saas_owner") { navigate("/PinAccess", { replace: true }); return false; }
    if (sess.loginTime && (Date.now() - sess.loginTime) > SESSION_TIMEOUT_MS) {
      localStorage.removeItem(SUPER_SESSION_KEY);
      toast.error("Sesion expirada. Inicia sesion de nuevo.");
      navigate("/PinAccess", { replace: true });
      return false;
    }
    if (!sess.loginTime) {
      localStorage.setItem(SUPER_SESSION_KEY, JSON.stringify({ ...sess, loginTime: Date.now() }));
    }
    return true;
  } catch {
    navigate("/PinAccess", { replace: true });
    return false;
  }
}

// ── Navigation config ────────────────────────────────────────────────────────
export const NAV_SECTIONS = [
  {
    id: "command-center",
    label: "Command Center",
    icon: LayoutDashboard,
    shortLabel: "HQ",
  },
  {
    id: "stores",
    label: "Stores",
    icon: Building2,
    shortLabel: "Stores",
  },
  {
    id: "revenue",
    label: "Revenue",
    icon: DollarSign,
    shortLabel: "Revenue",
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    shortLabel: "Ops",
  },
  {
    id: "support",
    label: "Support",
    icon: HeadphonesIcon,
    shortLabel: "Support",
  },
  {
    id: "security",
    label: "Security",
    icon: Lock,
    shortLabel: "Security",
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    shortLabel: "Tools",
  },
];

// ── Session timer display ────────────────────────────────────────────────────
function SessionTimer() {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      try {
        const sess = JSON.parse(localStorage.getItem(SUPER_SESSION_KEY) || "{}");
        if (!sess.loginTime) { setRemaining("--:--"); return; }
        const elapsed = Date.now() - sess.loginTime;
        const left = Math.max(0, SESSION_TIMEOUT_MS - elapsed);
        const mins = Math.floor(left / 60000);
        const secs = Math.floor((left % 60000) / 1000);
        setRemaining(`${mins}:${String(secs).padStart(2, "0")}`);
      } catch { setRemaining("--:--"); }
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 tabular-nums">
      <Timer className="w-3 h-3" />
      <span>{remaining}</span>
    </div>
  );
}

// ── Main Layout ──────────────────────────────────────────────────────────────
export default function GACCLayout({ activeSection, onSectionChange, onOpenPalette, children }) {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!checkSession(navigate)) return;
    setAuthorized(true);
    const iv = setInterval(() => checkSession(navigate), 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(SUPER_SESSION_KEY);
    toast.success("Sesion cerrada");
    navigate("/PinAccess", { replace: true });
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex">

      {/* ── Sidebar (desktop) ── */}
      <aside
        className={`hidden lg:flex flex-col border-r border-white/[0.06] bg-[#09090b] transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-[220px]"
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)] flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="leading-none overflow-hidden">
              <p className="text-sm font-black text-white tracking-tight">SmartFixOS</p>
              <p className="text-[9px] font-bold text-purple-400 uppercase tracking-[0.2em]">Control Center</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                title={collapsed ? section.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                  isActive
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-purple-400" : ""}`} />
                {!collapsed && <span>{section.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle + logout */}
        <div className="border-t border-white/[0.06] p-2 space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] text-gray-600 hover:text-gray-400 transition-all"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>Colapsar</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] text-gray-600 hover:text-red-400 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Salir</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Top bar ── */}
        <header className="sticky top-0 z-30 h-14 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-2xl flex items-center justify-between px-4 sm:px-6 gap-4 flex-shrink-0">
          {/* Left: mobile menu + section title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="leading-none">
              <p className="text-sm font-bold text-white">
                {NAV_SECTIONS.find(s => s.id === activeSection)?.label || "Control Center"}
              </p>
              <p className="text-[10px] text-gray-600 hidden sm:block">Global Admin Control Center</p>
            </div>
          </div>

          {/* Right: search hint + session + notifications */}
          <div className="flex items-center gap-3">
            <button
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[12px] text-gray-600 hover:text-gray-400 hover:border-white/[0.12] transition-all"
              title="Buscar tienda"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono text-gray-600">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
            </button>

            <button className="p-2 rounded-xl text-gray-600 hover:text-white hover:bg-white/[0.05] transition-all relative">
              <Bell className="w-4 h-4" />
            </button>

            <SessionTimer />
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[260px] bg-[#09090b] border-r border-white/[0.06] z-50 flex flex-col lg:hidden"
            >
              {/* Header */}
              <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div className="leading-none">
                    <p className="text-sm font-black text-white">SmartFixOS</p>
                    <p className="text-[9px] font-bold text-purple-400 uppercase tracking-[0.2em]">Control Center</p>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav */}
              <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
                {NAV_SECTIONS.map((section) => {
                  const isActive = activeSection === section.id;
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => { onSectionChange(section.id); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                        isActive
                          ? "bg-white/[0.08] text-white"
                          : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-purple-400" : ""}`} />
                      <span>{section.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Logout */}
              <div className="border-t border-white/[0.06] p-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] text-gray-600 hover:text-red-400 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Salir</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
