/**
 * GACC — Command Palette (Cmd+K)
 * Global search for stores + quick actions
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Building2, DollarSign, Activity, HeadphonesIcon,
  Lock, Wrench, LayoutDashboard, ArrowRight, Command, X,
  Mail, PauseCircle, PlayCircle, Clock, CreditCard, Eye
} from "lucide-react";
import { useGACC, getStatusBadge, getPlanConfig } from "./gaccContext";

export default function CommandPalette({ open, onClose, onNavigate, onSelectTenant }) {
  const { tenants } = useGACC();
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        else onClose("toggle");
      }
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const quickActions = [
    { id: "nav-command-center", label: "Command Center", icon: LayoutDashboard, section: "command-center" },
    { id: "nav-stores", label: "Stores Directory", icon: Building2, section: "stores" },
    { id: "nav-revenue", label: "Revenue & Billing", icon: DollarSign, section: "revenue" },
    { id: "nav-operations", label: "Operations", icon: Activity, section: "operations" },
    { id: "nav-support", label: "Support Center", icon: HeadphonesIcon, section: "support" },
    { id: "nav-security", label: "Security & Audit", icon: Lock, section: "security" },
    { id: "nav-tools", label: "Internal Tools", icon: Wrench, section: "tools" },
  ];

  const results = useMemo(() => {
    const items = [];

    if (!query.trim()) {
      // Show all nav items + recent tenants
      items.push(...quickActions.map(a => ({ ...a, type: "action" })));
      items.push(...tenants.slice(0, 5).map(t => ({ ...t, type: "tenant" })));
      return items;
    }

    const q = query.toLowerCase();

    // Match nav items
    quickActions.forEach(a => {
      if (a.label.toLowerCase().includes(q)) items.push({ ...a, type: "action" });
    });

    // Match tenants
    tenants.forEach(t => {
      if (
        (t.name || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q) ||
        (t.slug || "").toLowerCase().includes(q)
      ) {
        items.push({ ...t, type: "tenant" });
      }
    });

    return items.slice(0, 15);
  }, [query, tenants]);

  const handleSelect = useCallback((item) => {
    if (item.type === "action") {
      onNavigate(item.section);
    } else if (item.type === "tenant") {
      onSelectTenant(item);
    }
    onClose();
  }, [onNavigate, onSelectTenant, onClose]);

  // Keyboard navigation
  const [selected, setSelected] = useState(0);
  useEffect(() => { setSelected(0); }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) { handleSelect(results[selected]); }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
          className="w-full max-w-lg bg-[#141416] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
            <Search className="w-5 h-5 text-gray-600 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar tienda, navegar..."
              className="flex-1 bg-transparent text-[14px] text-white placeholder:text-gray-600 outline-none"
            />
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-gray-600 font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto py-2">
            {results.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">Sin resultados para "{query}"</p>
            ) : (
              results.map((item, i) => {
                const isSelected = i === selected;

                if (item.type === "action") {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelected(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-[13px] text-white font-medium flex-1">{item.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-700" />
                    </button>
                  );
                }

                // Tenant result
                const badge = getStatusBadge(item);
                const plan = getPlanConfig(item.effective_plan || item.plan);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-600 truncate">{item.email}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] text-[10px] text-gray-700">
            <div className="flex items-center gap-3">
              <span>↑↓ navegar</span>
              <span>↵ seleccionar</span>
              <span>esc cerrar</span>
            </div>
            <div className="flex items-center gap-1">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
