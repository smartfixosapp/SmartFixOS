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
    const numeric = val.replace(/[^0-9]/g, '');
    if (numeric.length === 14) {
      const checkDigit = calculateLuhnCheckDigit(numeric);
      if (checkDigit !== null) {
        setFormData(prev => ({ ...prev, device_serial: numeric + checkDigit }));
        return;
      }
    }
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
      <DialogContent className="apple-type apple-surface-elevated max-w-4xl apple-label-primary rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 apple-surface-elevated" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-3">
            <div className="w-12 h-12 rounded-apple-sm bg-apple-purple flex items-center justify-center shadow-apple-md">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            Gestión de Desbloqueos
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 apple-surface-elevated min-h-[500px]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-gray-sys6 dark:bg-gray-sys5 p-1 rounded-apple-md h-auto">
              <TabsTrigger
                value="new"
                className="apple-press flex-1 rounded-apple-sm h-10 data-[state=active]:bg-apple-purple data-[state=active]:text-white transition-all apple-text-footnote font-semibold"
              >
                <Zap className="w-4 h-4 mr-2" />
                Nuevo Desbloqueo
              </TabsTrigger>
              <TabsTrigger
                value="continue"
                className="apple-press flex-1 rounded-apple-sm h-10 data-[state=active]:bg-apple-purple data-[state=active]:text-white transition-all apple-text-footnote font-semibold"
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
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 apple-label-tertiary" />
                      <input
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="apple-input w-full pl-12 h-12"
                      />
                    </div>

                    {searchTerm && filteredCustomers.length > 0 && (
                      <div className="apple-card border-0 rounded-apple-md p-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredCustomers.map(customer => (
                          <button
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className="apple-press w-full text-left p-3 rounded-apple-sm hover:bg-gray-sys6 dark:hover:bg-gray-sys5 transition-all group flex items-center justify-between"
                          >
                            <div>
                              <p className="apple-text-subheadline font-semibold apple-label-primary">{customer.name}</p>
                              <p className="apple-text-caption1 apple-label-tertiary tabular-nums">{customer.phone}</p>
                            </div>
                            <User className="w-4 h-4 apple-label-tertiary" />
                          </button>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={() => setShowNewCustomer(true)}
                      className="apple-btn apple-btn-secondary w-full h-12 rounded-apple-md font-medium"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Nuevo Cliente
                    </Button>
                  </div>
                ) : (
                  <div className="bg-apple-purple/12 rounded-apple-md p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-apple-purple/15 flex items-center justify-center text-apple-purple">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="apple-text-headline font-semibold apple-label-primary">
                          {selectedCustomer ? selectedCustomer.name : "Nuevo Cliente"}
                        </p>
                        <p className="apple-text-caption2 text-apple-purple font-medium">Cliente Seleccionado</p>
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
                      aria-label="Cerrar selección de cliente"
                      className="apple-label-tertiary hover:apple-label-primary rounded-full hover:bg-gray-sys6 dark:hover:bg-gray-sys5"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                )}

                {(showNewCustomer || selectedCustomer) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="apple-label-tertiary apple-text-caption1 font-semibold ml-3">Nombre</Label>
                      <Input
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        className="apple-input h-12"
                        disabled={!!selectedCustomer}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="apple-label-tertiary apple-text-caption1 font-semibold ml-3">Teléfono</Label>
                      <Input
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        className="apple-input h-12"
                        disabled={!!selectedCustomer}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* EQUIPO */}
              <div className="space-y-4 pt-4" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="apple-label-tertiary apple-text-caption1 font-semibold ml-3">Marca</Label>
                    <Input
                      value={formData.device_brand}
                      onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                      placeholder="Ej: Apple"
                      className="apple-input h-12"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="apple-label-tertiary apple-text-caption1 font-semibold ml-3">Modelo</Label>
                    <Input
                      value={formData.device_model}
                      onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                      placeholder="Ej: iPhone 14 Pro"
                      className="apple-input h-12"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="apple-label-tertiary apple-text-caption1 font-semibold ml-3">IMEI / Serial (Números)</Label>
                  <Input
                    value={formData.device_serial}
                    onChange={(e) => handleImeiChange(e.target.value)}
                    placeholder="Ej: 3548..."
                    maxLength={15}
                    className="apple-input h-12 font-mono tabular-nums"
                  />
                  {formData.device_serial.length === 15 && (
                    <p className="apple-text-caption2 text-apple-green mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      IMEI completo (15 dígitos)
                    </p>
                  )}
                </div>
              </div>

              {/* SERVICIO */}
              <div className="space-y-4 pt-4" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                <div className="space-y-1.5">
                  <Label className="apple-label-tertiary apple-text-caption1 font-semibold ml-3">Servicio</Label>
                  <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                    <SelectTrigger className="apple-input h-12">
                      <SelectValue placeholder="Selecciona el servicio..." />
                    </SelectTrigger>
                    <SelectContent className="apple-surface-elevated border-0 apple-label-primary">
                      {SOFTWARE_SERVICES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="apple-label-tertiary apple-text-caption1 font-semibold ml-3">Precio</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 apple-label-tertiary font-semibold">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                        className="apple-input h-12 pl-8 font-semibold apple-text-headline tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="apple-label-tertiary apple-text-caption1 font-semibold ml-3">Notas</Label>
                    <Input
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Opcional"
                      className="apple-input h-12"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={loading}
                  className="apple-btn apple-btn-plain flex-1 h-14 rounded-apple-md font-medium"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="apple-btn apple-btn-lg flex-1 bg-apple-purple hover:bg-apple-purple text-white font-semibold h-14 rounded-apple-md shadow-apple-md apple-text-headline transition-all active:scale-95"
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
                <div className="text-center py-20 apple-card border-0 rounded-apple-lg">
                  <div className="w-16 h-16 bg-gray-sys6 dark:bg-gray-sys5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 apple-label-tertiary" />
                  </div>
                  <p className="apple-label-secondary font-medium apple-text-body">Todo al día</p>
                  <p className="apple-label-tertiary apple-text-footnote">No hay desbloqueos en progreso</p>
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
                        className="apple-card border-0 rounded-apple-md p-5 hover:bg-gray-sys6 dark:hover:bg-gray-sys5 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-apple-purple/15 text-apple-purple border-0 apple-text-caption2 px-2 py-0.5 rounded-apple-xs font-semibold">
                                {order.order_number}
                              </Badge>
                              <span className="apple-text-caption1 apple-label-tertiary font-mono tabular-nums">
                                {format(new Date(order.created_date), "dd MMM")}
                              </span>
                            </div>
                            <h4 className="apple-text-headline apple-label-primary font-semibold">{order.customer_name}</h4>
                            <p className="apple-text-footnote apple-label-secondary">
                              {order.device_brand} {order.device_model}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="apple-text-caption2 apple-label-tertiary font-semibold block mb-1">Precio</span>
                            <span className="apple-text-title2 font-semibold text-apple-green tabular-nums">
                              ${(order.cost_estimate || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm p-3 mb-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-apple-xs bg-apple-purple/15 flex items-center justify-center text-apple-purple">
                            <Code2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="apple-text-caption2 apple-label-tertiary font-semibold">Servicio</p>
                            <p className="apple-text-footnote apple-label-primary font-medium">
                              {serviceType?.label || order.initial_problem?.split('\n')[0] || "Software"}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleContinueUnlock(order)}
                            className="apple-btn flex-1 bg-apple-purple hover:bg-apple-purple text-white h-10 rounded-apple-sm apple-text-footnote font-semibold shadow-apple-sm"
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
                            aria-label="Eliminar desbloqueo"
                            className="h-10 w-10 apple-label-tertiary hover:text-apple-red hover:bg-apple-red/12 rounded-apple-sm"
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

        {paymentModalOrder && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" onClick={() => setPaymentModalOrder(null)} />

            <div className="relative z-[10000] apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-8 max-w-md w-full">
              <div className="text-center mb-8">
                {(() => {
                  const total = Number(paymentModalOrder.cost_estimate || paymentModalOrder.total || 0);
                  const paid = Number(paymentModalOrder.amount_paid || paymentModalOrder.total_paid || 0);
                  const balance = Math.max(0, total - paid);
                  const isPaid = balance <= 0.01;

                  return (
                    <>
                      <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center shadow-apple-lg animate-in zoom-in duration-300 ${
                        isPaid
                          ? 'bg-apple-green'
                          : 'bg-apple-green'
                      }`}>
                        {isPaid ? (
                          <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={3} />
                        ) : (
                          <DollarSign className="w-12 h-12 text-white" strokeWidth={3} />
                        )}
                      </div>

                      <h2 className="apple-text-title1 apple-label-primary mb-2">
                        {isPaid ? 'Desbloqueo Pagado' : 'Desbloqueo Completado'}
                      </h2>
                      <p className="apple-label-secondary apple-text-headline font-medium">{paymentModalOrder.customer_name}</p>

                      <div className={`mt-8 rounded-apple-lg p-6 relative overflow-hidden ${
                        isPaid ? 'bg-apple-green/12' : 'apple-card border-0'
                      }`}>
                        <div className={`absolute top-0 left-0 w-full h-1 ${
                          isPaid ? 'bg-apple-green' : 'bg-apple-orange'
                        }`} />
                        <p className="apple-text-caption1 apple-label-tertiary font-semibold mb-2">Balance Pendiente</p>
                        <p className={`apple-text-large-title font-bold tabular-nums ${
                          isPaid ? 'text-apple-green' : 'apple-label-primary'
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
                  className="apple-btn apple-btn-lg w-full bg-apple-green hover:bg-apple-green text-white h-14 rounded-apple-md apple-text-headline font-semibold shadow-apple-md transition-all active:scale-95"
                >
                  <DollarSign className="w-6 h-6 mr-2" strokeWidth={3} />
                  Cobrar Ahora
                </Button>

                <Button
                  onClick={() => handlePaymentOption("deposit")}
                  className="apple-btn apple-btn-lg w-full bg-apple-blue hover:bg-apple-blue text-white h-14 rounded-apple-md apple-text-headline font-semibold shadow-apple-md transition-all active:scale-95"
                >
                  <CreditCard className="w-6 h-6 mr-2" strokeWidth={3} />
                  Recibir Depósito
                </Button>

                <Button
                  onClick={() => handlePaymentOption("skip")}
                  className="apple-btn apple-btn-secondary w-full h-14 rounded-apple-md apple-text-body font-semibold transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2 text-apple-green" />
                  Marcar Listo (Sin cobrar)
                </Button>

                <button
                  onClick={() => setPaymentModalOrder(null)}
                  className="w-full text-center apple-label-tertiary apple-text-footnote font-medium hover:apple-label-primary mt-4 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

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

        {deleteConfirmOrder && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" onClick={() => setDeleteConfirmOrder(null)} />
            <div className="relative z-[10001] apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-8 max-w-sm w-full text-center">
              <div className="w-20 h-20 rounded-full bg-apple-red/15 flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-apple-red" />
              </div>
              <h3 className="apple-text-title2 apple-label-primary mb-2">¿Eliminar?</h3>
              <p className="apple-label-secondary mb-8 apple-text-body">Esta acción es irreversible.</p>
              <div className="flex gap-3">
                <Button onClick={() => setDeleteConfirmOrder(null)} className="apple-btn apple-btn-secondary flex-1 h-12 rounded-apple-sm font-semibold">Cancelar</Button>
                <Button onClick={() => handleDeleteUnlock(deleteConfirmOrder.id)} className="apple-btn apple-btn-destructive flex-1 h-12 rounded-apple-sm font-semibold">Eliminar</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
