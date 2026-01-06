import React, { useState, useEffect, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, User, Phone, Mail, History, Edit, Trash2, ChevronRight, Users } from "lucide-react";
import CreateCustomerDialog from "../components/customers/CreateCustomerDialog";
import CustomerOrdersDialog from "../components/customers/CustomerOrdersDialog";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showOrdersDialog, setShowOrdersDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => dataClient.entities.Customer.list("-created_date"),
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (customerId) => dataClient.entities.Customer.delete(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        (c.email && c.email.toLowerCase().includes(query))
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] theme-light:bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Glass */}
        <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-4 sm:p-6 shadow-[0_8px_32px_rgba(0,168,232,0.3)] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3 theme-light:text-gray-900">
                <Users className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-500" />
                Clientes
              </h1>
              <p className="text-gray-400 mt-1 sm:mt-2 text-sm theme-light:text-gray-600">Gestiona tu base de clientes</p>
            </div>
            <Button
              onClick={() => {
                setEditingCustomer(null);
                setShowCreateDialog(true);
              }}
              className="w-full sm:w-auto bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 shadow-[0_4px_20px_rgba(0,168,232,0.4)] h-10 sm:h-11"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              <span className="text-sm sm:text-base">Nuevo Cliente</span>
            </Button>
          </div>
        </div>

        {/* Search Glass */}
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 theme-light:text-gray-500" />
            <Input
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-black/40 border-cyan-500/20 text-white placeholder:text-gray-500 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-400 theme-light:text-gray-600">Cargando clientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 mb-4 theme-light:text-gray-600">
              {searchQuery ? "No se encontraron clientes" : "No hay clientes registrados"}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800"
              >
                <Plus className="w-5 h-5 mr-2" />
                Crear Primer Cliente
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile/Tablet - Card List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3 sm:gap-4">
              {filteredCustomers.map((customer) => (
                <Card
                  key={customer.id}
                  className="bg-[#121212] border-cyan-500/20 hover:border-cyan-500/50 transition-all cursor-pointer hover:shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200 theme-light:hover:border-cyan-500/50"
                  onClick={() => handleViewOrders(customer)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-white font-semibold text-sm sm:text-base truncate theme-light:text-gray-900">
                            {customer.name}
                          </h3>
                          {customer.total_orders > 0 && (
                            <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 text-xs mt-1 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300">
                              {customer.total_orders} {customer.total_orders === 1 ? "orden" : "órdenes"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-gray-400 theme-light:text-gray-600">
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-gray-400 theme-light:text-gray-600">
                          <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t border-cyan-500/20 theme-light:border-gray-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(customer);
                        }}
                        className="flex-1 border-cyan-500/20 hover:bg-cyan-600/10 text-xs sm:text-sm h-8 theme-light:border-gray-300 theme-light:hover:bg-gray-50"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(customer.id);
                        }}
                        className="flex-1 border-red-600/30 text-red-400 hover:bg-red-600/10 text-xs sm:text-sm h-8 theme-light:border-red-300 theme-light:text-red-600 theme-light:hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-cyan-500/10 hover:bg-cyan-600/5 transition-colors cursor-pointer theme-light:border-gray-100 theme-light:hover:bg-gray-50"
                      onClick={() => handleViewOrders(customer)}
                    >
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
                            className="hover:bg-cyan-600/10 text-cyan-400 theme-light:hover:bg-cyan-50 theme-light:text-cyan-600"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(customer);
                            }}
                            className="hover:bg-white/5 theme-light:hover:bg-gray-100"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(customer.id);
                            }}
                            className="hover:bg-red-600/10 text-red-400 theme-light:text-red-600 theme-light:hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <CreateCustomerDialog
        open={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          setShowCreateDialog(false);
          setEditingCustomer(null);
        }}
      />

      {selectedCustomer && (
        <CustomerOrdersDialog
          open={showOrdersDialog}
          onClose={() => {
            setShowOrdersDialog(false);
            setSelectedCustomer(null);
          }}
          customer={selectedCustomer}
          orders={selectedCustomer.orders || []}
        />
      )}
    </div>
  );
}
