import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Smartphone, Loader2, Code2, Clock, CheckCircle2, AlertCircle, Zap, ArrowRight, DollarSign, CreditCard, MoreVertical, Trash2, User, Search, X, Plus } from "lucide-react";
import AdminAuthGate from "@/components/users/AdminAuthGate";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SOFTWARE_SERVICES = [
  { value: "unlock", label: "🔓 Desbloqueo de Operadora" },
  { value: "blacklist", label: "📵 Remover de Lista Negra" },
  { value: "imei_change", label: "🔢 Cambio de IMEI" },
  { value: "icloud_bypass", label: "☁️ Bypass iCloud" },
  { value: "frp_bypass", label: "🔐 Bypass FRP (Google)" },
  { value: "software_repair", label: "⚙️ Reparación de Software" },
  { value: "data_recovery", label: "💾 Recuperación de Datos" },
  { value: "jailbreak", label: "🔓 Jailbreak / Root" },
  { value: "other", label: "📱 Otro Servicio" }
];

export default function UnlocksDialog({ open, onClose, onSuccess, initialTab = "new" }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [pendingUnlocks, setPendingUnlocks] = useState([]);
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    device_brand: "",
    device_model: "",
    device_serial: "",
    service_type: "",
    service_description: "",
    price: "",
    notes: ""
  });

  const calculateLuhnCheckDigit = (imei14) => {
    if (!/^\d{14}$/.test(imei14)) return null;
    const digits = imei14.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let d = digits[i];
      // For 15-digit IMEI, indices 1, 3, 5, 7, 9, 11, 13 (0-based) are doubled
      // Sequence: 1 2 1 2 1 2 1 2 1 2 1 2 1 2 (Check)
      if (i % 2 !== 0) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
  };

  const handleImeiChange = (val) => {
    // Solo números
    const numeric = val.replace(/[^0-9]/g, '');
    
    // Si tiene 14 dígitos, calcular el 15
    if (numeric.length === 14) {
      const checkDigit = calculateLuhnCheckDigit(numeric);
      if (checkDigit !== null) {
        setFormData(prev => ({ ...prev, device_serial: numeric + checkDigit }));
        return;
      }
    }
    
    // Limitar a 15 dígitos
    if (numeric.length <= 15) {
      setFormData(prev => ({ ...prev, device_serial: numeric }));
    }
  };

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadPendingUnlocks();
      resetForm();
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const loadCustomers = async () => {
    try {
      const data = await base44.entities.Customer.list("-created_date", 100);
      setCustomers(data || []);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  const loadPendingUnlocks = async () => {
    setLoadingOrders(true);
    try {
      const orders = await base44.entities.Order.filter({
        device_type: "Software",
        status: "in_progress",
        deleted: false
      }, "-created_date", 50);
      setPendingUnlocks(orders || []);
    } catch (error) {
      console.error("Error loading pending unlocks:", error);
      setPendingUnlocks([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      device_brand: "",
      device_model: "",
      device_serial: "",
      service_type: "",
      service_description: "",
      price: "",
      notes: ""
    });
    setSelectedCustomer(null);
    setShowNewCustomer(false);
    setSearchTerm("");
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_phone: customer.phone || "",
      customer_email: customer.email || ""
    }));
    setShowNewCustomer(false);
  };

  const handleSubmit = async () => {
    if (!formData.customer_name.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }

    if (!formData.device_brand.trim() || !formData.device_model.trim()) {
      toast.error("Marca y modelo del equipo son obligatorios");
      return;
    }

    if (!formData.device_serial.trim()) {
      toast.error("IMEI o Serial es obligatorio");
      return;
    }

    if (!formData.service_type) {
      toast.error("Selecciona el tipo de servicio");
      return;
    }

    setLoading(true);

    try {
      const user = await base44.auth.me();

      let customerId = selectedCustomer?.id;
      if (!customerId) {
        const newCustomer = await base44.entities.Customer.create({
          name: formData.customer_name,
          phone: formData.customer_phone || undefined,
          email: formData.customer_email || undefined
        });
        customerId = newCustomer.id;
      }

      const timestamp = Date.now();
      const orderNumber = `SW-${String(timestamp).slice(-6)}`;
      const serviceLabel = SOFTWARE_SERVICES.find(s => s.value === formData.service_type)?.label || formData.service_type;

      const order = await base44.entities.Order.create({
        order_number: orderNumber,
        customer_id: customerId,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        device_type: "Software",
        device_brand: formData.device_brand,
        device_model: formData.device_model,
        device_serial: formData.device_serial,
        initial_problem: `${serviceLabel}\n${formData.service_description || ""}`,
        status: "in_progress",
        cost_estimate: parseFloat(formData.price) || 0,
        balance_due: parseFloat(formData.price) || 0,
        created_by: user?.email,
        created_by_name: user?.full_name || user?.email,
        tags: ["software", "unlock"]
      });

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: orderNumber,
        event_type: "create",
        description: `Desbloqueo iniciado: ${serviceLabel}`,
        user_name: user?.full_name || user?.email || "Sistema",
        user_id: user?.id || null,
        metadata: {
          service_type: formData.service_type,
          device: `${formData.device_brand} ${formData.device_model}`,
          serial: formData.device_serial
        }
      });

      toast.success(`✅ Desbloqueo ${orderNumber} creado exitosamente`);
      onSuccess?.();
      loadPendingUnlocks();
      resetForm();
      setActiveTab("continue");

    } catch (error) {
      console.error("Error creando servicio:", error);
      toast.error("Error al crear el servicio");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueUnlock = async (order) => {
    setPaymentModalOrder(order);
  };

  const handlePaymentOption = async (option) => {
    if (!paymentModalOrder) return;

    const total = Number(paymentModalOrder.cost_estimate || paymentModalOrder.total || 0);
    const paid = Number(paymentModalOrder.amount_paid || paymentModalOrder.total_paid || 0);
    const balance = Math.max(0, total - paid);

    // Verificar si ya está pagado
    if (balance <= 0.01 && option !== "skip") {
      toast.info("✅ Este desbloqueo ya está completamente pagado", {
        description: `Total: $${total.toFixed(2)} | Pagado: $${paid.toFixed(2)}`
      });
      setPaymentModalOrder(null);
      return;
    }

    const items = [{
      id: `sw-${paymentModalOrder.id}`,
      name: paymentModalOrder.initial_problem?.split('\n')[0] || "Software Service",
      price: total,
      cost: 0,
      taxable: false,
      type: 'service',
      qty: 1
    }];

    const state = {
      fromDashboard: true,
      workOrder: paymentModalOrder,
      items,
      customer: {
        id: paymentModalOrder.customer_id,
        name: paymentModalOrder.customer_name,
        phone: paymentModalOrder.customer_phone,
        email: paymentModalOrder.customer_email
      },
      balanceDue: balance,
      openPaymentImmediately: true
    };

    if (option === "pay") {
      setPaymentModalOrder(null);
      onClose();
      navigate(createPageUrl(`POS?workOrderId=${paymentModalOrder.id}&balance=${balance}&mode=full`), { state });
    } else if (option === "deposit") {
      setPaymentModalOrder(null);
      onClose();
      navigate(createPageUrl(`POS?workOrderId=${paymentModalOrder.id}&balance=${balance}&mode=deposit`), { 
        state: { ...state, paymentMode: "deposit" } 
      });
    } else if (option === "skip") {
      await completeUnlock(paymentModalOrder.id);
      setPaymentModalOrder(null);
    }
  };

  const completeUnlock = async (orderId) => {
    try {
      await base44.entities.Order.update(orderId, {
        status: "ready_for_pickup",
        updated_date: new Date().toISOString()
      });
      toast.success("✅ Desbloqueo completado");
      loadPendingUnlocks();
      onSuccess?.();
      setPaymentModalOrder(null);
    } catch (error) {
      console.error("Error completando desbloqueo:", error);
      toast.error("Error al completar el desbloqueo");
    }
  };

  const handleDeleteUnlock = async (orderId) => {
    try {
      await base44.entities.Order.update(orderId, {
        deleted: true,
        deleted_at: new Date().toISOString()
      });
      toast.success("Desbloqueo eliminado");
      loadPendingUnlocks();
      setDeleteConfirmOrder(null);
      onSuccess?.();
    } catch (error) {
      console.error("Error eliminando desbloqueo:", error);
      toast.error("Error al eliminar el desbloqueo");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1c1c1e] border border-white/10 max-w-4xl text-white rounded-[32px] p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-[#1c1c1e]">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            Gestión de Desbloqueos
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 bg-[#1c1c1e] min-h-[500px]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-[#2c2c2e] p-1 rounded-2xl border border-white/5 h-auto">
              <TabsTrigger 
                value="new" 
                className="flex-1 rounded-xl h-10 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all text-sm font-semibold"
              >
                <Zap className="w-4 h-4 mr-2" />
                Nuevo Desbloqueo
              </TabsTrigger>
              <TabsTrigger 
                value="continue" 
                className="flex-1 rounded-xl h-10 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all text-sm font-semibold"
              >
                <Clock className="w-4 h-4 mr-2" />
                Continuar ({pendingUnlocks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-6 mt-6">
              {/* CLIENTE */}
              <div className="space-y-4">
                {!selectedCustomer && !showNewCustomer ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>
                    
                    {searchTerm && filteredCustomers.length > 0 && (
                      <div className="bg-[#2c2c2e] rounded-2xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredCustomers.map(customer => (
                          <button
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className="w-full text-left p-3 rounded-xl hover:bg-white/10 transition-all group flex items-center justify-between"
                          >
                            <div>
                              <p className="font-semibold text-white">{customer.name}</p>
                              <p className="text-xs text-white/40">{customer.phone}</p>
                            </div>
                            <User className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={() => setShowNewCustomer(true)}
                      className="w-full h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-white font-medium"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Nuevo Cliente
                    </Button>
                  </div>
                ) : (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">
                          {selectedCustomer ? selectedCustomer.name : "Nuevo Cliente"}
                        </p>
                        <p className="text-xs text-purple-300 font-medium uppercase tracking-wide">Cliente Seleccionado</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setShowNewCustomer(false);
                        setSearchTerm("");
                      }}
                      size="icon"
                      variant="ghost"
                      className="text-white/40 hover:text-white rounded-full hover:bg-white/10"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                )}

                {(showNewCustomer || selectedCustomer) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-white/40 text-xs font-bold uppercase ml-3">Nombre</Label>
                      <Input
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl focus:bg-[#3a3a3c]"
                        disabled={!!selectedCustomer}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/40 text-xs font-bold uppercase ml-3">Teléfono</Label>
                      <Input
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl focus:bg-[#3a3a3c]"
                        disabled={!!selectedCustomer}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* EQUIPO */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/40 text-xs font-bold uppercase ml-3">Marca</Label>
                    <Input
                      value={formData.device_brand}
                      onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                      placeholder="Ej: Apple"
                      className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl focus:bg-[#3a3a3c]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/40 text-xs font-bold uppercase ml-3">Modelo</Label>
                    <Input
                      value={formData.device_model}
                      onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                      placeholder="Ej: iPhone 14 Pro"
                      className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl focus:bg-[#3a3a3c]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/40 text-xs font-bold uppercase ml-3">IMEI / Serial (Números)</Label>
                  <Input
                    value={formData.device_serial}
                    onChange={(e) => handleImeiChange(e.target.value)}
                    placeholder="Ej: 3548..."
                    maxLength={15}
                    className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl focus:bg-[#3a3a3c] font-mono tracking-wide"
                  />
                  {formData.device_serial.length === 15 && (
                    <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 
                      IMEI completo (15 dígitos)
                    </p>
                  )}
                </div>
              </div>

              {/* SERVICIO */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="space-y-1.5">
                  <Label className="text-white/40 text-xs font-bold uppercase ml-3">Servicio</Label>
                  <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                    <SelectTrigger className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl focus:bg-[#3a3a3c]">
                      <SelectValue placeholder="Selecciona el servicio..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2c2c2e] border-white/10 text-white">
                      {SOFTWARE_SERVICES.map(s => (
                        <SelectItem key={s.value} value={s.value} className="focus:bg-white/10">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/40 text-xs font-bold uppercase ml-3">Precio</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                        className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl pl-8 focus:bg-[#3a3a3c] font-bold text-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/40 text-xs font-bold uppercase ml-3">Notas</Label>
                    <Input
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Opcional"
                      className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl focus:bg-[#3a3a3c]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 text-white/40 hover:text-white h-14 rounded-2xl font-medium"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold h-14 rounded-2xl shadow-lg shadow-purple-600/20 text-lg transition-all active:scale-95"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Desbloqueo"
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="continue" className="space-y-4 mt-6">
              {pendingUnlocks.length === 0 ? (
                <div className="text-center py-20 bg-[#2c2c2e]/30 rounded-[32px] border border-white/5 border-dashed">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/40 font-medium">Todo al día</p>
                  <p className="text-white/20 text-sm">No hay desbloqueos en progreso</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {pendingUnlocks.map(order => {
                    const serviceType = SOFTWARE_SERVICES.find(s => 
                      order.initial_problem?.toLowerCase().includes(s.label.toLowerCase())
                    );

                    return (
                      <div
                        key={order.id}
                        className="bg-[#2c2c2e] border border-white/5 rounded-2xl p-5 hover:bg-[#3a3a3c] transition-all group shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px] px-2 py-0.5 rounded-md font-bold">
                                {order.order_number}
                              </Badge>
                              <span className="text-xs text-white/40 font-mono">
                                {format(new Date(order.created_date), "dd MMM")}
                              </span>
                            </div>
                            <h4 className="font-bold text-white text-lg">{order.customer_name}</h4>
                            <p className="text-sm text-white/60">
                              {order.device_brand} {order.device_model}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block mb-1">Precio</span>
                            <span className="text-xl font-bold text-green-400">
                              ${(order.cost_estimate || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="bg-black/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                            <Code2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs text-white/40 font-bold uppercase tracking-wide">Servicio</p>
                            <p className="text-sm text-white font-medium">
                              {serviceType?.label || order.initial_problem?.split('\n')[0] || "Software"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleContinueUnlock(order)}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 h-10 rounded-xl text-sm font-bold shadow-lg shadow-purple-600/10"
                          >
                            Gestionar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setOrderToDelete(order);
                              setShowPinPrompt(true);
                            }}
                            className="h-10 w-10 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ✅ MODAL DE OPCIONES DE PAGO - FIXED Z-INDEX */}
        {paymentModalOrder && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setPaymentModalOrder(null)} />
            
            <div className="relative z-[10000] bg-[#1c1c1e] border border-white/10 rounded-[40px] p-8 max-w-md w-full shadow-2xl">
              <div className="text-center mb-8">
                {(() => {
                  const total = Number(paymentModalOrder.cost_estimate || paymentModalOrder.total || 0);
                  const paid = Number(paymentModalOrder.amount_paid || paymentModalOrder.total_paid || 0);
                  const balance = Math.max(0, total - paid);
                  const isPaid = balance <= 0.01;

                  return (
                    <>
                      <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl animate-in zoom-in duration-300 ${
                        isPaid 
                          ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-emerald-500/30' 
                          : 'bg-gradient-to-br from-green-400 to-emerald-600 shadow-green-500/30'
                      }`}>
                        {isPaid ? (
                          <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={3} />
                        ) : (
                          <DollarSign className="w-12 h-12 text-white" strokeWidth={3} />
                        )}
                      </div>
                      
                      <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                        {isPaid ? 'Desbloqueo Pagado' : 'Desbloqueo Completado'}
                      </h2>
                      <p className="text-white/60 text-lg font-medium">{paymentModalOrder.customer_name}</p>
                      
                      <div className={`mt-8 border border-white/5 rounded-3xl p-6 relative overflow-hidden ${
                        isPaid ? 'bg-emerald-500/10' : 'bg-[#2c2c2e]'
                      }`}>
                        <div className={`absolute top-0 left-0 w-full h-1 ${
                          isPaid ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        }`} />
                        <p className="text-xs text-white/40 uppercase font-bold tracking-widest mb-2">Balance Pendiente</p>
                        <p className={`text-5xl font-black tracking-tighter ${
                          isPaid ? 'text-emerald-400' : 'text-white'
                        }`}>
                          ${balance.toFixed(2)}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handlePaymentOption("pay")}
                  className="w-full bg-green-500 hover:bg-green-400 text-white h-14 rounded-2xl text-lg font-bold shadow-xl shadow-green-500/20 transition-all active:scale-95"
                >
                  <DollarSign className="w-6 h-6 mr-2" strokeWidth={3} />
                  Cobrar Ahora
                </Button>

                <Button
                  onClick={() => handlePaymentOption("deposit")}
                  className="w-full bg-blue-500 hover:bg-blue-400 text-white h-14 rounded-2xl text-lg font-bold shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                >
                  <CreditCard className="w-6 h-6 mr-2" strokeWidth={3} />
                  Recibir Depósito
                </Button>

                <Button
                  onClick={() => handlePaymentOption("skip")}
                  className="w-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white h-14 rounded-2xl text-base font-semibold border border-white/5 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2 text-green-400" />
                  Marcar Listo (Sin cobrar)
                </Button>
                
                <button 
                  onClick={() => setPaymentModalOrder(null)}
                  className="w-full text-center text-white/40 text-sm font-medium hover:text-white mt-4 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ PIN PROMPT */}
        {showPinPrompt && (
          <div className="fixed inset-0 z-[10000]">
            <AdminAuthGate
              onSuccess={() => {
                setShowPinPrompt(false);
                setDeleteConfirmOrder(orderToDelete);
                setOrderToDelete(null);
              }}
              onCancel={() => {
                setShowPinPrompt(false);
                setOrderToDelete(null);
              }}
            />
          </div>
        )}

        {/* ✅ CONFIRM DELETE */}
        {deleteConfirmOrder && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setDeleteConfirmOrder(null)} />
            <div className="relative z-[10001] bg-[#1c1c1e] border border-white/10 rounded-[32px] p-8 max-w-sm w-full text-center shadow-2xl">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">¿Eliminar?</h3>
              <p className="text-white/60 mb-8 text-lg">Esta acción es irreversible.</p>
              <div className="flex gap-3">
                <Button onClick={() => setDeleteConfirmOrder(null)} className="flex-1 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white h-12 rounded-xl font-bold">Cancelar</Button>
                <Button onClick={() => handleDeleteUnlock(deleteConfirmOrder.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl font-bold">Eliminar</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
