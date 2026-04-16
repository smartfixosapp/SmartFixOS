import React, { useState, useEffect } from "react";
// 👈 MIGRACIÓN: Usar dataClient unificado
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Plus, Search, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CustomerSelector({ open, onClose, selectedCustomer, onSelect }) {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [customerHistory, setCustomerHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: ""
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
    }
  }, [open]);

  const loadCustomers = async () => {
    // 👈 MIGRACIÓN: Usar dataClient
    const data = await dataClient.entities.Customer.list("-created_date", 100);
    setCustomers(data);
  };

  const loadCustomerHistory = async (customerId) => {
    setLoading(true);
    try {
      // 👈 MIGRACIÓN: Usar dataClient
      const orders = await dataClient.entities.Order.filter({ customer_id: customerId }, "-created_date", 50);
      const totalSpent = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const totalPaid = orders.reduce((sum, o) => sum + Number(o.total_paid || o.amount_paid || 0), 0);
      const outstandingBalance = orders.reduce((sum, o) => {
        const balance = Number(o.balance_due || 0);
        return sum + balance;
      }, 0);
      
      setCustomerHistory({
        orders,
        totalSpent,
        totalPaid,
        outstandingBalance,
        orderCount: orders.length
      });
      setShowHistoryDialog(true);
    } catch (error) {
      console.error("Error loading customer history:", error);
      alert("Error al cargar historial del cliente");
    } finally {
      setLoading(false);
    }
  };

  // 👈 BÚSQUEDA MEJORADA: Busca solo en nombre (o teléfono si hay números)
  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const name = (c.name || "").toLowerCase();
    const phone = (c.phone || "").replace(/\D/g, ""); // Solo dígitos
    const searchDigits = query.replace(/\D/g, ""); // Solo dígitos del query
    
    // Si el query tiene dígitos, buscar en teléfono
    if (searchDigits.length > 0) {
      return phone.includes(searchDigits);
    }
    
    // Si no tiene dígitos, buscar solo en nombre
    return name.includes(query);
  });

  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      alert("Nombre y teléfono son requeridos");
      return;
    }

    const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    if (!phoneRegex.test(newCustomer.phone.replace(/\D/g, ''))) {
      alert("Formato de teléfono inválido");
      return;
    }

    if (newCustomer.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newCustomer.email)) {
        alert("Formato de email inválido");
        return;
      }
    }

    setLoading(true);
    try {
      // 👈 MIGRACIÓN: Usar dataClient
      const customer = await dataClient.entities.Customer.create({
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email,
        total_orders: 0
      });

      await loadCustomers();
      onSelect(customer);
      setShowCreateDialog(false);
      setNewCustomer({ name: "", phone: "", email: "" });
      onClose();
    } catch (error) {
      console.error("Error creating customer:", error);
      alert("Error al crear cliente");
    }
    setLoading(false);
  };

  return (
    <>
      {/* Main Customer Selector Dialog (Apple style) */}
      <Dialog open={open && !showCreateDialog && !showHistoryDialog} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl apple-surface-elevated border-0 shadow-apple-2xl rounded-apple-xl apple-type p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-[rgb(var(--separator)/0.29)]">
            <DialogTitle className="apple-text-title2 apple-label-primary flex items-center justify-between gap-3">
              <span>Seleccionar cliente</span>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="apple-btn apple-btn-primary text-[15px] min-h-9 px-3.5"
              >
                <Plus className="w-[18px] h-[18px]" />
                <span>Nuevo</span>
              </button>
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 apple-label-tertiary w-[18px] h-[18px] pointer-events-none" />
              <Input
                placeholder="Buscar por nombre o teléfono"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="apple-input pl-10 border-0"
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto apple-scroll -mx-1 px-1">
              {filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 gap-3">
                  <div className="w-14 h-14 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center">
                    <User className="w-7 h-7 apple-label-tertiary" />
                  </div>
                  <p className="apple-text-callout apple-label-secondary">No se encontraron clientes</p>
                  <button
                    onClick={() => setShowCreateDialog(true)}
                    className="apple-btn apple-btn-tinted"
                  >
                    <Plus className="w-[18px] h-[18px]" />
                    Crear nuevo cliente
                  </button>
                </div>
              ) : (
                <div className="apple-list">
                  {filteredCustomers.map((customer, idx) => (
                    <div key={customer.id} className="flex items-center">
                      <button
                        className="apple-list-row flex-1 apple-focusable"
                        onClick={() => {
                          onSelect(customer);
                          onClose();
                        }}
                      >
                        <div className="apple-list-row-icon" style={{ backgroundColor: 'rgb(var(--apple-blue))' }}>
                          <User className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="apple-text-headline apple-label-primary truncate">{customer.name}</p>
                          <p className="apple-text-footnote apple-label-secondary truncate tabular-nums">{customer.phone}</p>
                          {customer.email && (
                            <p className="apple-text-caption1 apple-label-tertiary truncate">{customer.email}</p>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => loadCustomerHistory(customer.id)}
                        title="Ver historial"
                        aria-label={`Ver historial de ${customer.name}`}
                        className="apple-press mr-3 w-10 h-10 rounded-full flex items-center justify-center text-apple-blue bg-apple-blue/10 flex-shrink-0"
                      >
                        <History className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog (Apple style) */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md apple-surface-elevated border-0 shadow-apple-2xl rounded-apple-xl apple-type p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-2">
            <DialogTitle className="apple-text-title2 apple-label-primary">
              Crear cliente
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 pt-3 space-y-4">
            <div className="space-y-1.5">
              <Label className="apple-text-subheadline apple-label-secondary px-1">Nombre</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="apple-input border-0"
                placeholder="Juan Pérez"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="apple-text-subheadline apple-label-secondary px-1">Teléfono</Label>
              <Input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="apple-input border-0"
                placeholder="(787) 123-4567"
                inputMode="tel"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="apple-text-subheadline apple-label-secondary px-1">Email <span className="apple-label-tertiary">(opcional)</span></Label>
              <Input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="apple-input border-0"
                placeholder="juan@example.com"
                inputMode="email"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="apple-btn apple-btn-secondary apple-btn-lg flex-1"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCustomer}
                className="apple-btn apple-btn-primary apple-btn-lg flex-1"
                disabled={loading || !newCustomer.name || !newCustomer.phone}
              >
                {loading ? "Creando…" : "Crear cliente"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer History Dialog (Apple style) */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl apple-surface-elevated border-0 shadow-apple-2xl rounded-apple-xl apple-type p-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-[rgb(var(--separator)/0.29)] sticky top-0 apple-surface-elevated z-10">
            <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2.5">
              <History className="w-5 h-5 apple-label-secondary" />
              Historial de servicio
            </DialogTitle>
          </DialogHeader>

          {customerHistory && (
            <div className="p-5 space-y-5">
              {/* Stats cards estilo Apple dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="apple-card p-3.5">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Total órdenes</p>
                  <p className="apple-text-title2 apple-label-primary tabular-nums">{customerHistory.orderCount}</p>
                </div>
                <div className="apple-card p-3.5">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Total gastado</p>
                  <p className="apple-text-title2 text-apple-green tabular-nums">${customerHistory.totalSpent.toFixed(2)}</p>
                </div>
                <div className="apple-card p-3.5">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Total pagado</p>
                  <p className="apple-text-title2 text-apple-blue tabular-nums">${customerHistory.totalPaid.toFixed(2)}</p>
                </div>
                <div className="apple-card p-3.5">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Balance pendiente</p>
                  <p className="apple-text-title2 text-apple-orange tabular-nums">${customerHistory.outstandingBalance.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="apple-text-footnote apple-label-secondary px-1">Órdenes recientes</h3>
                {customerHistory.orders.length === 0 ? (
                  <div className="text-center py-8 apple-label-tertiary">
                    <p className="apple-text-callout">No hay órdenes registradas</p>
                  </div>
                ) : (
                  <div className="apple-list max-h-96 overflow-y-auto apple-scroll">
                    {customerHistory.orders.map((order) => {
                      const balance = Number(order.balance_due || 0);
                      const hasPending = balance > 0;

                      return (
                        <div key={order.id} className="apple-list-row cursor-default">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="apple-text-headline apple-label-primary">{order.order_number}</p>
                              <Badge className="text-[10px] bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary border-0">
                                {order.status || "—"}
                              </Badge>
                              {hasPending && (
                                <Badge className="text-[10px] bg-apple-orange/20 text-apple-orange border-0">
                                  Balance: ${balance.toFixed(2)}
                                </Badge>
                              )}
                            </div>
                            <p className="apple-text-footnote apple-label-secondary mt-0.5">
                              {order.device_brand} {order.device_model}
                            </p>
                            <p className="apple-text-caption1 apple-label-tertiary">
                              {order.created_date ? new Date(order.created_date).toLocaleDateString() : "—"}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="apple-text-headline apple-label-primary tabular-nums">${Number(order.total || 0).toFixed(2)}</p>
                            <p className="apple-text-caption1 text-apple-green tabular-nums">
                              Pagado: ${Number(order.total_paid || order.amount_paid || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
