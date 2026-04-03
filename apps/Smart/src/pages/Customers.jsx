import React, { useState, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Phone, Mail, MessageCircle,
  Star, Users, ChevronRight, Edit, Trash2, Megaphone
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import CreateCustomerDialog from "../components/customers/CreateCustomerDialog";
import CustomerOrdersDialog from "../components/customers/CustomerOrdersDialog";

const LOCAL_CUSTOMERS_KEY = "smartfix_local_customers";

function readLocalCustomers() {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeLocalCustomers(customers) {
  try { localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(customers || [])); } catch {}
}

function dedupeById(list = []) {
  const seen = new Set();
  return list.filter(item => { if (!item?.id || seen.has(item.id)) return false; seen.add(item.id); return true; });
}

function getWhatsAppUrl(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

function getLastVisit(customer) {
  const d = customer.updated_at || customer.created_at;
  if (!d) return null;
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: es }); } catch { return null; }
}

function isVip(customer) {
  return (customer.total_orders || 0) >= 3;
}

// Avatar color based on first letter
const AVATAR_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-purple-500 to-violet-600",
  "from-orange-500 to-red-500",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-sky-600",
];
function avatarColor(name = "") {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showOrdersDialog, setShowOrdersDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const local = readLocalCustomers();
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      try {
        let query = supabase.from("customer").select("*").order("created_at", { ascending: false });
        if (tenantId) query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
        const { data: remote } = await query;
        const remoteList = remote || [];
        if (tenantId) {
          const orphaned = remoteList.filter(c => !c.tenant_id);
          if (orphaned.length > 0) supabase.from("customer").update({ tenant_id: tenantId }).is("tenant_id", null).then(() => {});
        }
        const localOnlyCustomers = local.filter(c => !remoteList.some(r => r.id === c.id));
        if (localOnlyCustomers.length > 0 && tenantId) {
          Promise.allSettled(localOnlyCustomers.map(c => supabase.from("customer").upsert({ ...c, tenant_id: tenantId }).then(() => {}))).then(() => writeLocalCustomers([]));
        } else if (localOnlyCustomers.length === 0) {
          writeLocalCustomers([]);
        }
        return remoteList;
      } catch {
        return dedupeById([...local]);
      }
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (customerId) => dataClient.entities.Customer.delete(customerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] })
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const stats = useMemo(() => ({
    total: customers.length,
    vip: customers.filter(isVip).length,
    newThisMonth: customers.filter(c => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  }), [customers]);

  const handleDelete = async (customerId) => {
    if (window.confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) {
      try { await deleteCustomerMutation.mutateAsync(customerId); } catch (e) { alert("Error: " + e.message); }
    }
  };

  const handleEdit = (customer) => { setEditingCustomer(customer); setShowCreateDialog(true); };

  const handleViewOrders = async (customer) => {
    try {
      const orders = await dataClient.entities.Order.filter({ customer_id: customer.id });
      setSelectedCustomer({ ...customer, orders: orders || [] });
    } catch {
      setSelectedCustomer({ ...customer, orders: [] });
    }
    setShowOrdersDialog(true);
  };

  return (
    <div
      className="min-h-screen bg-black pb-28"
      style={{ paddingTop: "6px" }}
    >
      {/* Ambient glow */}
      <div className="fixed -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-80 h-80 bg-cyan-500/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-3 sm:px-5 py-4 relative z-10">

        {/* ── HEADER ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[32px] font-black text-white tracking-tight leading-none">Clientes</h1>
            <p className="text-white/30 mt-1 text-[11px] font-bold uppercase tracking-widest">{customers.length} registrados</p>
          </div>
          <button
            onClick={() => { setEditingCustomer(null); setShowCreateDialog(true); }}
            className="h-11 px-5 bg-blue-500 hover:bg-blue-400 text-white font-black text-sm rounded-full flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(59,130,246,0.35)]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>

        {/* ── STATS BAR ──────────────────────────────────── */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-3">
            <Users className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <p className="text-lg font-black text-white leading-none">{stats.total}</p>
              <p className="text-[10px] text-white/30 font-bold">Total</p>
            </div>
          </div>
          <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-3">
            <Star className="w-4 h-4 text-yellow-400 shrink-0" />
            <div>
              <p className="text-lg font-black text-yellow-400 leading-none">{stats.vip}</p>
              <p className="text-[10px] text-white/30 font-bold">VIP (3+ órdenes)</p>
            </div>
          </div>
          <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-3">
            <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-lg font-black text-emerald-400 leading-none">{stats.newThisMonth}</p>
              <p className="text-[10px] text-white/30 font-bold">Este mes</p>
            </div>
          </div>
        </div>

        {/* ── SEARCH ─────────────────────────────────────── */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" strokeWidth={2.5} />
          <input
            placeholder="Buscar por nombre, teléfono..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/[0.07] transition-all font-medium"
          />
        </div>

        {/* ── CONTENT ────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/30 text-xs font-bold uppercase tracking-widest">Cargando...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/30 text-sm font-bold mb-4">
              {searchQuery ? "Sin resultados" : "Sin clientes registrados"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="px-5 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm font-bold transition-all active:scale-95"
              >
                Crear primer cliente
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile/Tablet cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
              {filteredCustomers.map((customer, i) => {
                const vip = isVip(customer);
                const lastVisit = getLastVisit(customer);
                const totalOrders = customer.total_orders || 0;
                return (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/[0.07] rounded-[24px] overflow-hidden"
                  >
                    {/* Card tap area */}
                    <button
                      onClick={() => handleViewOrders(customer)}
                      className="w-full p-4 text-left active:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {/* Avatar */}
                        <div className={`w-12 h-12 rounded-[14px] bg-gradient-to-br ${avatarColor(customer.name)} flex items-center justify-center text-white font-black text-lg shrink-0 shadow-lg`}>
                          {customer.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-white font-black text-[15px] leading-tight truncate">{customer.name}</h3>
                            {vip && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/30 rounded-md">
                                <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                                <span className="text-[9px] font-black text-yellow-400 uppercase tracking-tight">VIP</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {totalOrders > 0 && (
                              <span className="text-[10px] font-bold text-blue-400/80 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                {totalOrders} {totalOrders === 1 ? "orden" : "órdenes"}
                              </span>
                            )}
                            {lastVisit && (
                              <span className="text-[10px] text-white/25 font-bold">{lastVisit}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/15 shrink-0 mt-1" />
                      </div>

                      {/* Contact info */}
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-white/50 text-xs mb-1.5">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate font-medium">{customer.phone}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-2 text-white/30 text-xs">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                    </button>

                    {/* Action bar */}
                    <div className="flex border-t border-white/[0.05]">
                      {customer.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-white/50 hover:text-white/80 transition-colors active:bg-white/[0.04]"
                        >
                          <Phone className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-tight">Llamar</span>
                        </a>
                      )}
                      {customer.phone && (
                        <a
                          href={getWhatsAppUrl(customer.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-green-400/70 hover:text-green-400 transition-colors active:bg-white/[0.04] border-l border-white/[0.05]"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-tight">WhatsApp</span>
                        </a>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleEdit(customer); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-white/40 hover:text-white/70 transition-colors active:bg-white/[0.04] border-l border-white/[0.05]"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-tight">Editar</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/[0.07] rounded-[28px] overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-white/[0.06]">
                  <tr>
                    <th className="text-left px-5 py-3.5 text-white/30 font-black text-[10px] uppercase tracking-widest">Cliente</th>
                    <th className="text-left px-5 py-3.5 text-white/30 font-black text-[10px] uppercase tracking-widest">Contacto</th>
                    <th className="text-left px-5 py-3.5 text-white/30 font-black text-[10px] uppercase tracking-widest">Última actividad</th>
                    <th className="text-center px-5 py-3.5 text-white/30 font-black text-[10px] uppercase tracking-widest">Órdenes</th>
                    <th className="text-right px-5 py-3.5 text-white/30 font-black text-[10px] uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => {
                    const vip = isVip(customer);
                    const lastVisit = getLastVisit(customer);
                    return (
                      <tr
                        key={customer.id}
                        onClick={() => handleViewOrders(customer)}
                        className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor(customer.name)} flex items-center justify-center text-white font-black text-sm shrink-0`}>
                              {customer.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-black text-sm">{customer.name}</span>
                                {vip && (
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/30 rounded-md">
                                    <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                                    <span className="text-[9px] font-black text-yellow-400 uppercase">VIP</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="space-y-1">
                            {customer.phone && (
                              <div className="flex items-center gap-2">
                                <span className="text-white/60 text-xs font-medium">{customer.phone}</span>
                                <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="text-white/20 hover:text-white/60 transition-colors">
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                                <a href={getWhatsAppUrl(customer.phone)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-green-400/30 hover:text-green-400/80 transition-colors">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                            {customer.email && (
                              <p className="text-white/30 text-xs">{customer.email}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-white/30 text-xs font-medium">{lastVisit || "—"}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black border ${
                            (customer.total_orders || 0) > 0
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-white/5 text-white/20 border-white/10"
                          }`}>
                            {customer.total_orders || 0}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); handleEdit(customer); }}
                              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all active:scale-90"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(customer.id); }}
                              className="w-8 h-8 rounded-xl bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 flex items-center justify-center text-red-400/40 hover:text-red-400 transition-all active:scale-90"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <CreateCustomerDialog
        open={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); setEditingCustomer(null); }}
        customer={editingCustomer}
        onSuccess={(createdCustomer) => {
          if (createdCustomer?.id) {
            queryClient.setQueryData(["customers"], (prev = []) => {
              const exists = prev.some(c => c.id === createdCustomer.id);
              if (exists) return prev.map(c => c.id === createdCustomer.id ? createdCustomer : c);
              return [createdCustomer, ...prev];
            });
            if (createdCustomer?.is_local) {
              const local = readLocalCustomers();
              writeLocalCustomers([createdCustomer, ...local.filter(c => c.id !== createdCustomer.id)]);
            }
          }
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          setShowCreateDialog(false);
          setEditingCustomer(null);
        }}
      />

      {selectedCustomer && (
        <CustomerOrdersDialog
          open={showOrdersDialog}
          onClose={() => { setShowOrdersDialog(false); setSelectedCustomer(null); }}
          customer={selectedCustomer}
          orders={selectedCustomer.orders || []}
          onDelete={async (customerId) => {
            if (window.confirm("¿Eliminar este cliente permanentemente? Esta acción no se puede deshacer.")) {
              try {
                await deleteCustomerMutation.mutateAsync(customerId);
                setShowOrdersDialog(false);
                setSelectedCustomer(null);
              } catch (e) { alert("Error: " + e.message); }
            }
          }}
        />
      )}
    </div>
  );
}
