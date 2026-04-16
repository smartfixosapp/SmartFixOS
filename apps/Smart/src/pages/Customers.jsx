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
import { cn } from "@/lib/utils";
import CreateCustomerDialog from "../components/customers/CreateCustomerDialog";
import CustomerOrdersDialog from "../components/customers/CustomerOrdersDialog";
import BulkOfferModal from "../components/customers/BulkOfferModal";
import JENAIInsightBanner from "@/components/jenai/JENAIInsightBanner";

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
  const [showBulkOffer, setShowBulkOffer] = useState(false);

  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const local = readLocalCustomers();
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      try {
        let query = supabase.from("customer").select("*").order("name", { ascending: true });
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
      className="min-h-screen apple-surface apple-type pb-28"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)" }}
    >
      <div className="max-w-full mx-auto px-4 sm:px-5 lg:px-8 py-4 relative z-10">

        {/* ── JENAI Customer Insights ── */}
        <div className="mb-4">
          <JENAIInsightBanner
            context="customers"
            data={{
              totalCustomers: stats.total,
              vipCount: stats.vip,
              newThisMonth: stats.newThisMonth,
              inactiveCount: customers.filter(c => {
                if (!c.updated_at && !c.created_at) return true;
                const last = new Date(c.updated_at || c.created_at);
                return (Date.now() - last.getTime()) > 30 * 86400000;
              }).length,
              topCustomer: [...customers].sort((a, b) => (b.total_orders || 0) - (a.total_orders || 0))[0]?.full_name || "N/A",
            }}
            accentColor="blue"
            autoLoad={false}
          />
        </div>

        {/* ── HEADER estilo iOS ────────────────────────────── */}
        <div className="flex items-end justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h1 className="apple-text-large-title apple-label-primary">Clientes</h1>
            <p className="apple-text-footnote apple-label-secondary mt-0.5 tabular-nums">{customers.length} registrados</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkOffer(true)}
              className="apple-btn text-[15px] min-h-9 px-3.5 bg-apple-orange/15 text-apple-orange"
            >
              <Megaphone className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">Oferta</span>
            </button>
            <button
              onClick={() => { setEditingCustomer(null); setShowCreateDialog(true); }}
              className="apple-btn apple-btn-primary text-[15px] min-h-9 px-3.5"
            >
              <Plus className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">Nuevo</span>
            </button>
          </div>
        </div>

        {/* ── STATS BAR (apple-cards) ──────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="apple-card p-3 flex items-center gap-2.5">
            <Users className="w-4 h-4 text-apple-blue shrink-0" />
            <div className="min-w-0">
              <p className="apple-text-headline apple-label-primary leading-tight tabular-nums">{stats.total}</p>
              <p className="apple-text-caption2 apple-label-secondary">Total</p>
            </div>
          </div>
          <div className="apple-card p-3 flex items-center gap-2.5">
            <Star className="w-4 h-4 text-apple-yellow shrink-0" />
            <div className="min-w-0">
              <p className="apple-text-headline text-apple-yellow leading-tight tabular-nums">{stats.vip}</p>
              <p className="apple-text-caption2 apple-label-secondary truncate">VIP (3+)</p>
            </div>
          </div>
          <div className="apple-card p-3 flex items-center gap-2.5">
            <Plus className="w-4 h-4 text-apple-green shrink-0" />
            <div className="min-w-0">
              <p className="apple-text-headline text-apple-green leading-tight tabular-nums">{stats.newThisMonth}</p>
              <p className="apple-text-caption2 apple-label-secondary">Este mes</p>
            </div>
          </div>
        </div>

        {/* ── SEARCH ─────────────────────────────────────── */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] apple-label-tertiary pointer-events-none" />
          <input
            placeholder="Buscar por nombre, teléfono"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="apple-input pl-10"
          />
        </div>

        {/* ── CONTENT ────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-7 h-7 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            <p className="apple-text-footnote apple-label-secondary">Cargando…</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center">
              <Users className="w-6 h-6 apple-label-tertiary" />
            </div>
            <p className="apple-text-callout apple-label-secondary">
              {searchQuery ? "Sin resultados" : "Sin clientes registrados"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="apple-btn apple-btn-tinted"
              >
                <Plus className="w-[18px] h-[18px]" />
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
                    className="apple-card overflow-hidden"
                  >
                    {/* Card tap area */}
                    <button
                      onClick={() => handleViewOrders(customer)}
                      className="apple-press w-full p-4 text-left"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {/* Avatar — círculo apple-blue estilo iOS Contacts */}
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: "rgb(var(--apple-blue))" }}
                        >
                          <span className="apple-text-title3 font-semibold">
                            {customer.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="apple-text-headline apple-label-primary leading-tight truncate">{customer.name}</h3>
                            {vip && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-apple-yellow/20 rounded-full">
                                <Star className="w-2.5 h-2.5 text-apple-yellow fill-apple-yellow" />
                                <span className="apple-text-caption2 font-semibold text-apple-yellow">VIP</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {totalOrders > 0 && (
                              <span className="apple-text-caption1 font-medium text-apple-blue bg-apple-blue/12 px-2 py-0.5 rounded-full tabular-nums">
                                {totalOrders} {totalOrders === 1 ? "orden" : "órdenes"}
                              </span>
                            )}
                            {lastVisit && (
                              <span className="apple-text-caption1 apple-label-tertiary">{lastVisit}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 apple-label-tertiary shrink-0 mt-1" />
                      </div>

                      {/* Contact info */}
                      {customer.phone && (
                        <div className="flex items-center gap-2 apple-text-footnote apple-label-secondary mb-1">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate tabular-nums">{customer.phone}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-2 apple-text-footnote apple-label-tertiary">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                    </button>

                    {/* Action bar */}
                    <div className="flex" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                      {customer.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          onClick={e => e.stopPropagation()}
                          className="apple-press flex-1 flex items-center justify-center gap-1.5 py-3 text-apple-blue"
                        >
                          <Phone className="w-[18px] h-[18px]" />
                          <span className="apple-text-footnote font-medium">Llamar</span>
                        </a>
                      )}
                      {customer.phone && (
                        <a
                          href={getWhatsAppUrl(customer.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="apple-press flex-1 flex items-center justify-center gap-1.5 py-3 text-apple-green"
                          style={{ borderLeft: "0.5px solid rgb(var(--separator) / 0.29)" }}
                        >
                          <MessageCircle className="w-[18px] h-[18px]" />
                          <span className="apple-text-footnote font-medium">WhatsApp</span>
                        </a>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleEdit(customer); }}
                        className="apple-press flex-1 flex items-center justify-center gap-1.5 py-3 apple-label-secondary"
                        style={{ borderLeft: "0.5px solid rgb(var(--separator) / 0.29)" }}
                      >
                        <Edit className="w-[18px] h-[18px]" />
                        <span className="apple-text-footnote font-medium">Editar</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Desktop table estilo Apple */}
            <div className="hidden lg:block apple-card overflow-hidden p-0">
              <table className="w-full">
                <thead style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                  <tr>
                    <th className="text-left px-5 py-3 apple-text-caption1 apple-label-secondary font-medium">Cliente</th>
                    <th className="text-left px-5 py-3 apple-text-caption1 apple-label-secondary font-medium">Contacto</th>
                    <th className="text-left px-5 py-3 apple-text-caption1 apple-label-secondary font-medium">Última actividad</th>
                    <th className="text-center px-5 py-3 apple-text-caption1 apple-label-secondary font-medium">Órdenes</th>
                    <th className="text-right px-5 py-3 apple-text-caption1 apple-label-secondary font-medium">Acciones</th>
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
                        className="hover:bg-gray-sys6/50 dark:hover:bg-gray-sys5/50 transition-colors cursor-pointer group"
                        style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.20)" }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                              style={{ backgroundColor: "rgb(var(--apple-blue))" }}
                            >
                              <span className="apple-text-footnote font-semibold">{customer.name?.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="apple-text-body font-semibold apple-label-primary">{customer.name}</span>
                              {vip && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-apple-yellow/20 rounded-full">
                                  <Star className="w-2.5 h-2.5 text-apple-yellow fill-apple-yellow" />
                                  <span className="apple-text-caption2 font-semibold text-apple-yellow">VIP</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="space-y-1">
                            {customer.phone && (
                              <div className="flex items-center gap-2">
                                <span className="apple-text-footnote apple-label-primary tabular-nums">{customer.phone}</span>
                                <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="text-apple-blue/70 hover:text-apple-blue transition-colors">
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                                <a href={getWhatsAppUrl(customer.phone)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-apple-green/70 hover:text-apple-green transition-colors">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                            {customer.email && (
                              <p className="apple-text-caption1 apple-label-secondary">{customer.email}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="apple-text-footnote apple-label-secondary">{lastVisit || "—"}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full apple-text-caption1 font-medium tabular-nums",
                            (customer.total_orders || 0) > 0
                              ? "bg-apple-blue/12 text-apple-blue"
                              : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                          )}>
                            {customer.total_orders || 0}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); handleEdit(customer); }}
                              className="apple-press w-8 h-8 rounded-full bg-apple-blue/10 text-apple-blue flex items-center justify-center"
                              aria-label="Editar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(customer.id); }}
                              className="apple-press w-8 h-8 rounded-full bg-apple-red/10 text-apple-red flex items-center justify-center"
                              aria-label="Eliminar"
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

      <BulkOfferModal
        open={showBulkOffer}
        onClose={() => setShowBulkOffer(false)}
        customers={customers}
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
