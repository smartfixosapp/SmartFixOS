import React, { useState, useEffect, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, User, Phone, Mail, History, Edit, Trash2, ChevronRight, Users, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { motion } from "framer-motion";
import CreateCustomerDialog from "../components/customers/CreateCustomerDialog";
import CustomerOrdersDialog from "../components/customers/CustomerOrdersDialog";

const LOCAL_CUSTOMERS_KEY = "smartfix_local_customers";

function readLocalCustomers() {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCustomers(customers) {
  try {
    localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(customers || []));
  } catch {
    // no-op
  }
}

function dedupeById(list = []) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const id = item?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export default function Customers() {
  const navigate = useNavigate();
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
      try {
        const remote = await dataClient.entities.Customer.list("-created_date");
        const merged = dedupeById([...(remote || []), ...local]);
        if (local.length > 0) {
          // Limpia locales ya presentes en remoto.
          const remainingLocal = local.filter((c) => !remote?.some((r) => r.id === c.id));
          writeLocalCustomers(remainingLocal);
        }
        return merged;
      } catch {
        return dedupeById(local);
      }
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (customerId) => dataClient.entities.Customer.delete(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
      c.name.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      c.email && c.email.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const handleDelete = async (customerId) => {
    if (window.confirm("¿Estás seguro de eliminar este cliente?")) {
      try {
        await deleteCustomerMutation.mutateAsync(customerId);
      } catch (error) {
        alert("Error al eliminar el cliente: " + error.message);
      }
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setShowCreateDialog(true);
  };

  const handleViewOrders = async (customer) => {
    try {
      // Cargar las órdenes del cliente
      const orders = await dataClient.entities.Order.filter({ customer_id: customer.id });
      setSelectedCustomer({ ...customer, orders: orders || [] });
      setShowOrdersDialog(true);
    } catch (error) {
      console.error("Error loading customer orders:", error);
      // Ensure orders is an empty array even if fetching fails, to prevent undefined errors
      setSelectedCustomer({ ...customer, orders: [] });
      setShowOrdersDialog(true);
    }
  };

  return (
    <div
      className="min-h-screen bg-black theme-light:bg-gray-50 pb-24"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)" }}
    >
      {/* Fondos animados */}
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse delay-1000 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 relative z-10">
        {/* Header iOS Style */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-[32px] sm:text-4xl font-black text-white tracking-tight leading-none theme-light:text-gray-900">
                Clientes
              </h1>
              <p className="text-gray-400 mt-1 text-sm theme-light:text-gray-600">{customers.length} clientes registrados</p>
            </div>
            <Button
              onClick={() => {
                setEditingCustomer(null);
                setShowCreateDialog(true);
              }}
              className="h-11 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold shadow-[0_0_25px_rgba(59,130,246,0.4)] rounded-full flex items-center gap-2 transition-all active:scale-95">

              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nuevo</span>
            </Button>
          </div>
        </div>

        {/* Search iOS Style */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" strokeWidth={2.5} />
          <input
            placeholder="Buscar"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="bg-white/8 text-slate-900 pr-4 pl-12 rounded-xl w-full h-11 border-none placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all theme-light:bg-gray-100 theme-light:text-gray-900" />


        </div>

        {isLoading ?
        <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-400 theme-light:text-gray-600">Cargando clientes...</p>
          </div> :
        filteredCustomers.length === 0 ?
        <div className="text-center py-12">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 mb-4 theme-light:text-gray-600">
              {searchQuery ? "No se encontraron clientes" : "No hay clientes registrados"}
            </p>
            {!searchQuery &&
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800">

                <Plus className="w-5 h-5 mr-2" />
                Crear Primer Cliente
              </Button>
          }
          </div> :

        <>
            {/* Mobile/Tablet - iOS Card List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
              {filteredCustomers.map((customer) =>
            <motion.button
              key={customer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleViewOrders(customer)}
              className="relative bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 backdrop-blur-xl border border-white/10 rounded-[24px] p-5 transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-2xl hover:border-blue-500/30 text-left theme-light:bg-white theme-light:border-gray-200 theme-light:hover:shadow-xl">

                  {/* Glossy Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity rounded-[24px] pointer-events-none" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-[17px] truncate theme-light:text-gray-900">
                          {customer.name}
                        </h3>
                        {(customer.total_orders > 0 || customer.orders?.length > 0) &&
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold theme-light:bg-blue-100 theme-light:text-blue-700">
                            {customer.orders?.length || customer.total_orders || 0} {(customer.orders?.length || customer.total_orders) === 1 ? "orden" : "órdenes"}
                          </span>
                    }
                      </div>
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex items-center gap-2 text-white/70 theme-light:text-gray-600">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                      {customer.email &&
                  <div className="flex items-center gap-2 text-white/70 theme-light:text-gray-600">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                  }
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-white/10 theme-light:border-gray-200">
                      <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(customer);
                    }}
                    className="flex-1 h-9 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 hover:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:text-gray-700">

                        <Edit className="w-4 h-4" />
                        <span>Editar</span>
                      </button>
                      <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(customer.id);
                    }}
                    className="flex-1 h-9 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 hover:text-red-300 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 theme-light:bg-red-50 theme-light:border-red-200 theme-light:text-red-600">

                        <Trash2 className="w-4 h-4" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                </motion.button>
            )}
            </div>

            {/* Desktop - Table */}
            <div className="hidden lg:block bg-[#121212] border border-cyan-500/20 rounded-xl overflow-hidden theme-light:bg-white theme-light:border-gray-200">
              <table className="w-full">
                <thead className="bg-black/40 border-b border-cyan-500/20 theme-light:bg-gray-50 theme-light:border-gray-200">
                  <tr>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm theme-light:text-gray-700">Cliente</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm theme-light:text-gray-700">Teléfono</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm theme-light:text-gray-700">Email</th>
                    <th className="text-center p-4 text-gray-400 font-medium text-sm theme-light:text-gray-700">Órdenes</th>
                    <th className="text-right p-4 text-gray-400 font-medium text-sm theme-light:text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) =>
                <tr
                  key={customer.id}
                  className="border-b border-cyan-500/10 hover:bg-cyan-600/5 transition-colors cursor-pointer theme-light:border-gray-100 theme-light:hover:bg-gray-50"
                  onClick={() => handleViewOrders(customer)}>

                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center text-white font-bold">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-white font-medium theme-light:text-gray-900">{customer.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300 theme-light:text-gray-700">{customer.phone}</td>
                      <td className="p-4 text-gray-300 theme-light:text-gray-700">{customer.email || "—"}</td>
                      <td className="p-4 text-center">
                        <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300">
                          {customer.total_orders || 0}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewOrders(customer);
                        }}
                        className="hover:bg-cyan-600/10 text-cyan-400 theme-light:hover:bg-cyan-50 theme-light:text-cyan-600">

                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(customer);
                        }}
                        className="hover:bg-white/5 theme-light:hover:bg-gray-100">

                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(customer.id);
                        }}
                        className="hover:bg-red-600/10 text-red-400 theme-light:text-red-600 theme-light:hover:bg-red-50">

                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </>
        }
      </div>

      {/* Dialogs */}
      <CreateCustomerDialog
        open={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSuccess={(createdCustomer) => {
          if (createdCustomer?.id) {
            queryClient.setQueryData(["customers"], (prev = []) => {
              const exists = prev.some((c) => c.id === createdCustomer.id);
              if (exists) return prev.map((c) => (c.id === createdCustomer.id ? createdCustomer : c));
              return [createdCustomer, ...prev];
            });
            if (createdCustomer?.is_local) {
              const local = readLocalCustomers();
              writeLocalCustomers([createdCustomer, ...local.filter((c) => c.id !== createdCustomer.id)]);
            }
          }
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          setShowCreateDialog(false);
          setEditingCustomer(null);
        }} />


      {selectedCustomer &&
      <CustomerOrdersDialog
        open={showOrdersDialog}
        onClose={() => {
          setShowOrdersDialog(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
        orders={selectedCustomer.orders || []} />

      }
    </div>);

}
