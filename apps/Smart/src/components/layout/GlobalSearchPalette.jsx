import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { dataClient } from "@/components/api/dataClient";
import {
  Search, ClipboardList, Users, Package, BarChart3, Settings,
  Smartphone, Laptop, Tablet, Watch, Gamepad2, Camera, Box,
  X, ArrowRight, Zap
} from "lucide-react";

const DEVICE_ICON = (type = "") => {
  const t = String(type).toLowerCase();
  if (t.includes("phone") || t.includes("iphone") || t.includes("galaxy")) return Smartphone;
  if (t.includes("laptop") || t.includes("mac") || t.includes("computer")) return Laptop;
  if (t.includes("tablet") || t.includes("ipad")) return Tablet;
  if (t.includes("watch")) return Watch;
  if (t.includes("console") || t.includes("playstation") || t.includes("xbox")) return Gamepad2;
  if (t.includes("camera") || t.includes("drone")) return Camera;
  return Box;
};

const NAV_ITEMS = [
  { label: "Dashboard",    path: "Dashboard",    icon: Zap },
  { label: "Órdenes",      path: "Orders",       icon: ClipboardList },
  { label: "Clientes",     path: "Customers",    icon: Users },
  { label: "Inventario",   path: "Inventory",    icon: Package },
  { label: "Finanzas",     path: "Financial",    icon: BarChart3 },
  { label: "Configuración",path: "Settings",     icon: Settings },
];

export default function GlobalSearchPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setOrders([]);
      setCustomers([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search
  const runSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setOrders([]);
      setCustomers([]);
      return;
    }
    setLoading(true);
    try {
      const [ords, custs] = await Promise.all([
        dataClient.entities.Order.filter({ search: q }).catch(() => []),
        dataClient.entities.Customer.filter({ search: q }).catch(() => []),
      ]);
      setOrders((ords || []).slice(0, 5));
      setCustomers((custs || []).slice(0, 3));
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  // Flatten items for keyboard nav
  const navResults = query.length < 2
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  const allItems = [
    ...navResults.map(n => ({ type: "nav", data: n })),
    ...orders.map(o => ({ type: "order", data: o })),
    ...customers.map(c => ({ type: "customer", data: c })),
  ];

  const handleSelect = useCallback((item) => {
    if (item.type === "nav") {
      navigate(createPageUrl(item.data.path));
    } else if (item.type === "order") {
      navigate(createPageUrl("Orders") + `?order=${item.data.id}`);
    } else if (item.type === "customer") {
      navigate(createPageUrl("Customers") + `?customer=${item.data.id}`);
    }
    onClose();
  }, [navigate, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, allItems.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && allItems[selectedIdx]) {
        e.preventDefault();
        handleSelect(allItems[selectedIdx]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, allItems, selectedIdx, handleSelect, onClose]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="apple-type fixed inset-0 z-[99999] flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl apple-surface-elevated rounded-apple-xl shadow-apple-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
        >
          <Search className="w-4 h-4 apple-label-tertiary shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar órdenes, clientes, páginas..."
            className="flex-1 bg-transparent apple-label-primary apple-text-body outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-apple-blue/30 border-t-apple-blue rounded-full animate-spin shrink-0" />
          )}
          <button onClick={onClose} className="apple-press apple-label-tertiary shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="apple-list max-h-[60vh] overflow-y-auto py-2">

          {/* Nav shortcuts */}
          {navResults.length > 0 && (
            <div>
              {query.length < 2 && (
                <p className="apple-text-footnote apple-label-tertiary px-4 pt-2 pb-1">Navegación</p>
              )}
              {navResults.map(n => {
                const Icon = n.icon;
                const isSelected = flatIdx === selectedIdx;
                const currentIdx = flatIdx++;
                return (
                  <button
                    key={n.path}
                    onClick={() => handleSelect({ type: "nav", data: n })}
                    onMouseEnter={() => setSelectedIdx(currentIdx)}
                    className={`apple-list-row apple-press w-full flex items-center gap-3 px-4 py-2.5 text-left ${isSelected ? "bg-gray-sys6 dark:bg-gray-sys5" : ""}`}
                  >
                    <div className="apple-list-row-icon w-7 h-7 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-apple-blue" />
                    </div>
                    <span className="apple-list-row-title apple-text-body apple-label-primary">{n.label}</span>
                    <ArrowRight className="apple-list-row-chevron w-3 h-3 apple-label-tertiary ml-auto" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Orders */}
          {orders.length > 0 && (
            <div>
              <p className="apple-text-footnote apple-label-tertiary px-4 pt-3 pb-1">Órdenes</p>
              {orders.map(o => {
                const DevIcon = DEVICE_ICON(o.device_type || o.device_family);
                const isSelected = flatIdx === selectedIdx;
                const currentIdx = flatIdx++;
                const status = o.status || o.current_status || "—";
                return (
                  <button
                    key={o.id}
                    onClick={() => handleSelect({ type: "order", data: o })}
                    onMouseEnter={() => setSelectedIdx(currentIdx)}
                    className={`apple-list-row apple-press w-full flex items-center gap-3 px-4 py-2.5 text-left ${isSelected ? "bg-gray-sys6 dark:bg-gray-sys5" : ""}`}
                  >
                    <div className="apple-list-row-icon w-7 h-7 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center shrink-0">
                      <DevIcon className="w-3.5 h-3.5 text-apple-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="apple-text-body apple-label-primary truncate">
                        <span className="tabular-nums">{o.order_number || o.id?.slice(0, 8)}</span>
                        {o.customer_name ? <span className="apple-label-secondary"> — {o.customer_name}</span> : null}
                      </p>
                      <p className="apple-text-footnote apple-label-tertiary truncate">
                        {[o.device_brand, o.device_family, o.device_model].filter(Boolean).join(" ")}
                        {status ? ` · ${status}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Customers */}
          {customers.length > 0 && (
            <div>
              <p className="apple-text-footnote apple-label-tertiary px-4 pt-3 pb-1">Clientes</p>
              {customers.map(c => {
                const isSelected = flatIdx === selectedIdx;
                const currentIdx = flatIdx++;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect({ type: "customer", data: c })}
                    onMouseEnter={() => setSelectedIdx(currentIdx)}
                    className={`apple-list-row apple-press w-full flex items-center gap-3 px-4 py-2.5 text-left ${isSelected ? "bg-gray-sys6 dark:bg-gray-sys5" : ""}`}
                  >
                    <div className="apple-list-row-icon w-7 h-7 rounded-full bg-apple-purple/15 flex items-center justify-center shrink-0 text-apple-purple apple-text-footnote">
                      {(c.full_name || c.name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="apple-text-body apple-label-primary truncate">{c.full_name || c.name}</p>
                      <p className="apple-text-footnote apple-label-tertiary truncate">{c.phone || c.email || ""}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {query.length >= 2 && !loading && orders.length === 0 && customers.length === 0 && (
            <div className="py-10 text-center">
              <p className="apple-label-tertiary apple-text-subheadline">Sin resultados para "{query}"</p>
            </div>
          )}

          {/* Default empty */}
          {query.length === 0 && (
            <div className="py-6 text-center">
              <p className="apple-label-tertiary apple-text-footnote">Escribe para buscar órdenes, clientes o navegar</p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-3 px-4 py-2 apple-text-caption2 apple-label-tertiary"
          style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
        >
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc cerrar</span>
          <span className="ml-auto">Cmd+K</span>
        </div>
      </div>
    </div>
  );
}
