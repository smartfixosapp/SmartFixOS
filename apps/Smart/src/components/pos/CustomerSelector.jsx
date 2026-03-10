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
      {/* Main Customer Selector Dialog */}
      <Dialog open={open && !showCreateDialog && !showHistoryDialog} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center justify-between">
              <span>Seleccionar Cliente</span>
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nuevo Cliente
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por nombre o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-black border-gray-700 text-white"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No se encontraron clientes</p>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="mt-4 bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Nuevo Cliente
                  </Button>
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg p-3 hover:border-red-600/50 transition-all">
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start text-left hover:bg-white/5 h-auto py-2"
                      onClick={() => {
                        onSelect(customer);
                        onClose();
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{customer.name}</p>
                          <p className="text-sm text-gray-400 truncate">{customer.phone}</p>
                          {customer.email && (
                            <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                          )}
                        </div>
                      </div>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-10 w-10 border-white/15 flex-shrink-0"
                      onClick={() => loadCustomerHistory(customer.id)}
                      title="Ver historial"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Crear Cliente Rápido
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nombre *</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="bg-black border-gray-700 text-white"
                placeholder="Juan Pérez"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Teléfono *</Label>
              <Input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="bg-black border-gray-700 text-white"
                placeholder="(787) 123-4567"
                inputMode="tel"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Email (opcional)</Label>
              <Input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="bg-black border-gray-700 text-white"
                placeholder="juan@example.com"
                inputMode="email"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 border-gray-700 text-gray-300"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCustomer}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-800"
                disabled={loading || !newCustomer.name || !newCustomer.phone}
              >
                {loading ? "Creando..." : "Crear Cliente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              Historial de Servicio
            </DialogTitle>
          </DialogHeader>

          {customerHistory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Total órdenes</p>
                  <p className="text-2xl font-bold text-white">{customerHistory.orderCount}</p>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Total gastado</p>
                  <p className="text-2xl font-bold text-emerald-400">${customerHistory.totalSpent.toFixed(2)}</p>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Total pagado</p>
                  <p className="text-2xl font-bold text-blue-400">${customerHistory.totalPaid.toFixed(2)}</p>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Balance pendiente</p>
                  <p className="text-2xl font-bold text-amber-400">${customerHistory.outstandingBalance.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Órdenes Recientes</h3>
                {customerHistory.orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay órdenes registradas</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {customerHistory.orders.map((order) => {
                      const balance = Number(order.balance_due || 0);
                      const hasPending = balance > 0;
                      
                      return (
                        <div key={order.id} className="bg-black/40 border border-white/10 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-white">{order.order_number}</p>
                                <Badge className="text-[10px]">
                                  {order.status || "—"}
                                </Badge>
                                {hasPending && (
                                  <Badge className="text-[10px] bg-amber-600/20 text-amber-300 border-amber-600/30">
                                    Balance: ${balance.toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">
                                {order.device_brand} {order.device_model}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {order.created_date ? new Date(order.created_date).toLocaleDateString() : "—"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-semibold">${Number(order.total || 0).toFixed(2)}</p>
                              <p className="text-xs text-emerald-400">
                                Pagado: ${Number(order.total_paid || order.amount_paid || 0).toFixed(2)}
                              </p>
                            </div>
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
