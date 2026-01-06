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
import { Smartphone, Loader2, Code2, Clock, CheckCircle2, AlertCircle, Zap, ArrowRight, DollarSign, CreditCard, MoreVertical, Trash2 } from "lucide-react";
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

export default function UnlocksDialog({ open, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("new");
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

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadPendingUnlocks();
      resetForm();
    }
  }, [open]);

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

    if (!formData.customer_phone.trim() && !formData.customer_email.trim()) {
      toast.error("Debes proporcionar teléfono o email del cliente");
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

      if (formData.customer_email) {
        try {
          await base44.integrations.Core.SendEmail({
            from_name: "SmartFixOS",
            to: formData.customer_email,
            subject: `Confirmación de Desbloqueo - Orden ${orderNumber}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
                <div style="background: white; padding: 30px; border-radius: 10px;">
                  <h2 style="color: #00A8E8; margin-bottom: 20px;">✅ Servicio de Desbloqueo Registrado</h2>
                  
                  <p style="color: #333; margin-bottom: 15px;">Hola <strong>${formData.customer_name}</strong>,</p>
                  
                  <p style="color: #555; margin-bottom: 20px;">
                    Tu solicitud de desbloqueo ha sido recibida. Detalles:
                  </p>
                  
                  <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Orden:</strong> ${orderNumber}</p>
                    <p style="margin: 5px 0;"><strong>Servicio:</strong> ${serviceLabel}</p>
                    <p style="margin: 5px 0;"><strong>Equipo:</strong> ${formData.device_brand} ${formData.device_model}</p>
                    <p style="margin: 5px 0;"><strong>IMEI/Serial:</strong> ${formData.device_serial}</p>
                    ${formData.price ? `<p style="margin: 5px 0;"><strong>Precio:</strong> $${parseFloat(formData.price).toFixed(2)}</p>` : ""}
                  </div>
                  
                  <p style="color: #555; margin-top: 20px;">
                    Te notificaremos cuando tu servicio esté completado.
                  </p>
                  
                  <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                    SmartFixOS - Sistema de Gestión
                  </p>
                </div>
              </div>
            `
          });
        } catch (emailError) {
          console.error("Error enviando email:", emailError);
        }
      }

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
    // Siempre mostrar opciones de pago
    setPaymentModalOrder(order);
  };

  const handlePaymentOption = async (option) => {
    if (!paymentModalOrder) return;

    const total = Number(paymentModalOrder.cost_estimate || paymentModalOrder.total || 0);
    const paid = Number(paymentModalOrder.amount_paid || paymentModalOrder.total_paid || 0);
    const balance = Math.max(0, total - paid);

    if (option === "pay") {
      // Redirigir al POS para cobrar
      onClose();
      navigate(createPageUrl(`POS?workOrderId=${paymentModalOrder.id}&balance=${balance}&mode=full`), {
        state: { fromUnlocks: true, paymentMode: "full" }
      });
    } else if (option === "deposit") {
      // Redirigir al POS para depósito
      onClose();
      navigate(createPageUrl(`POS?workOrderId=${paymentModalOrder.id}&balance=${balance}&mode=deposit`), {
        state: { fromUnlocks: true, paymentMode: "deposit" }
      });
    } else if (option === "skip") {
      // Marcar como completado sin pago
      await completeUnlock(paymentModalOrder.id);
      setPaymentModalOrder(null);
    }
  };

  const completeUnlock = async (orderId) => {
    try {
      const order = await base44.entities.Order.get(orderId);
      const user = await base44.auth.me();

      await base44.entities.Order.update(orderId, {
        status: "ready_for_pickup",
        updated_date: new Date().toISOString()
      });

      await base44.entities.WorkOrderEvent.create({
        order_id: orderId,
        order_number: order.order_number,
        event_type: "status_change",
        description: "Desbloqueo completado → Listo para recoger",
        user_name: user?.full_name || user?.email || "Sistema",
        user_id: user?.id || null,
        metadata: { from: "in_progress", to: "ready_for_pickup" }
      });

      if (order.customer_email) {
        try {
          await base44.integrations.Core.SendEmail({
            from_name: "SmartFixOS",
            to: order.customer_email,
            subject: `✅ Desbloqueo Completado - ${order.order_number}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
                <div style="background: white; padding: 30px; border-radius: 10px;">
                  <h2 style="color: #10B981; margin-bottom: 20px;">✅ ¡Tu Desbloqueo está Listo!</h2>
                  
                  <p style="color: #333; margin-bottom: 15px;">Hola <strong>${order.customer_name}</strong>,</p>
                  
                  <p style="color: #555; margin-bottom: 20px;">
                    Tu servicio de desbloqueo ha sido completado exitosamente.
                  </p>
                  
                  <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #10B981;">
                    <p style="margin: 5px 0;"><strong>Orden:</strong> ${order.order_number}</p>
                    <p style="margin: 5px 0;"><strong>Equipo:</strong> ${order.device_brand} ${order.device_model}</p>
                    <p style="margin: 5px 0;"><strong>IMEI/Serial:</strong> ${order.device_serial}</p>
                  </div>
                  
                  <p style="color: #555; margin-top: 20px; font-weight: bold;">
                    📍 Puedes pasar a recoger tu equipo cuando gustes.
                  </p>
                  
                  <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                    SmartFixOS - Sistema de Gestión
                  </p>
                </div>
              </div>
            `
          });
        } catch (emailError) {
          console.error("Error enviando email:", emailError);
        }
      }

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
        deleted_at: new Date().toISOString(),
        deleted_by: (await base44.auth.me())?.id || "unknown"
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
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] border-cyan-500/30 theme-light:bg-white theme-light:border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3 theme-light:text-gray-900">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            Gestión de Desbloqueos
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-black/40 p-1 rounded-xl border border-white/10 theme-light:bg-gray-100 theme-light:border-gray-200">
            <TabsTrigger 
              value="new" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <Zap className="w-4 h-4 mr-2" />
              Nuevo Desbloqueo
            </TabsTrigger>
            <TabsTrigger 
              value="continue" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white rounded-lg transition-all"
            >
              <Clock className="w-4 h-4 mr-2" />
              Continuar ({pendingUnlocks.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB: NUEVO DESBLOQUEO */}
          <TabsContent value="new" className="space-y-6 mt-6">
            {/* Selección de Cliente */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide flex items-center gap-2 theme-light:text-cyan-700">
                <div className="w-6 h-6 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
                  👤
                </div>
                Cliente
              </h3>
              
              {!selectedCustomer && !showNewCustomer && (
                <>
                  <Input
                    placeholder="Buscar cliente por nombre, teléfono o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-black/40 border-white/15 text-white h-12 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                  />

                  {searchTerm && filteredCustomers.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2 border border-white/10 rounded-lg p-2 bg-black/20 theme-light:bg-gray-50 theme-light:border-gray-200">
                      {filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => handleSelectCustomer(customer)}
                          className="w-full text-left p-3 rounded-lg bg-black/40 hover:bg-cyan-600/20 border border-white/10 transition-all active:scale-98 theme-light:bg-white theme-light:hover:bg-cyan-50 theme-light:border-gray-200"
                        >
                          <p className="text-white font-medium text-sm theme-light:text-gray-900">{customer.name}</p>
                          <p className="text-gray-400 text-xs theme-light:text-gray-600">
                            {customer.phone} {customer.email && `• ${customer.email}`}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={() => setShowNewCustomer(true)}
                    variant="outline"
                    className="w-full border-cyan-500/30 hover:bg-cyan-600/20 h-12 theme-light:border-cyan-300"
                  >
                    + Nuevo Cliente
                  </Button>
                </>
              )}

              {(selectedCustomer || showNewCustomer) && (
                <div className="space-y-3 p-4 bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border border-cyan-500/20 rounded-xl theme-light:bg-cyan-50 theme-light:border-cyan-200">
                  <div className="flex justify-between items-center">
                    <Badge className="bg-cyan-600/30 text-cyan-200 border-cyan-500/50 theme-light:bg-cyan-200 theme-light:text-cyan-800 theme-light:border-cyan-300">
                      {selectedCustomer ? "Cliente Seleccionado" : "Nuevo Cliente"}
                    </Badge>
                    <Button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setShowNewCustomer(false);
                        setSearchTerm("");
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-cyan-400 hover:text-cyan-300 theme-light:text-cyan-700"
                    >
                      Cambiar
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-gray-300 text-xs theme-light:text-gray-700">Nombre *</Label>
                      <Input
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        className="bg-black/40 border-white/15 text-white h-11 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                        disabled={!!selectedCustomer}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-300 text-xs theme-light:text-gray-700">Teléfono</Label>
                        <Input
                          value={formData.customer_phone}
                          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                          className="bg-black/40 border-white/15 text-white h-11 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                          disabled={!!selectedCustomer}
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-xs theme-light:text-gray-700">Email</Label>
                        <Input
                          value={formData.customer_email}
                          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                          type="email"
                          className="bg-black/40 border-white/15 text-white h-11 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                          disabled={!!selectedCustomer}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Información del Equipo */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide flex items-center gap-2 theme-light:text-emerald-700">
                <div className="w-6 h-6 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                  📱
                </div>
                Equipo
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300 text-xs theme-light:text-gray-700">Marca *</Label>
                  <Input
                    value={formData.device_brand}
                    onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                    placeholder="Ej: Apple, Samsung..."
                    className="bg-black/40 border-white/15 text-white h-11 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs theme-light:text-gray-700">Modelo *</Label>
                  <Input
                    value={formData.device_model}
                    onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                    placeholder="Ej: iPhone 13 Pro..."
                    className="bg-black/40 border-white/15 text-white h-11 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-300 text-xs theme-light:text-gray-700">IMEI / Serial Number *</Label>
                <Input
                  value={formData.device_serial}
                  onChange={(e) => setFormData({ ...formData, device_serial: e.target.value })}
                  placeholder="Ej: 123456789012345..."
                  className="bg-black/40 border-white/15 text-white font-mono h-11 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
            </div>

            {/* Servicio */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide flex items-center gap-2 theme-light:text-purple-700">
                <div className="w-6 h-6 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                  ⚙️
                </div>
                Servicio
              </h3>
              <div>
                <Label className="text-gray-300 text-xs theme-light:text-gray-700">Tipo de Servicio *</Label>
                <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                  <SelectTrigger className="bg-black/40 border-white/15 text-white h-12 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">
                    <SelectValue placeholder="Selecciona el servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SOFTWARE_SERVICES.map(service => (
                      <SelectItem key={service.value} value={service.value}>
                        {service.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300 text-xs theme-light:text-gray-700">Descripción / Detalles</Label>
                <Textarea
                  value={formData.service_description}
                  onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
                  placeholder="Detalles adicionales del servicio..."
                  className="bg-black/40 border-white/15 text-white min-h-[100px] theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300 text-xs theme-light:text-gray-700">Precio (Opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="bg-black/40 border-white/15 text-white h-11 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs theme-light:text-gray-700">Notas Internas</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notas privadas..."
                    className="bg-black/40 border-white/15 text-white h-11 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10 theme-light:border-gray-200">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1 border-white/15 h-12 theme-light:border-gray-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 h-12 shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Crear Desbloqueo
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* TAB: CONTINUAR DESBLOQUEOS */}
          <TabsContent value="continue" className="space-y-4 mt-6">
            <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-xl p-4 theme-light:bg-purple-50 theme-light:border-purple-200">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-purple-400 theme-light:text-purple-600" />
                <h3 className="text-white font-semibold theme-light:text-gray-900">Desbloqueos en Progreso</h3>
                <Badge className="bg-purple-600/30 text-purple-200 theme-light:bg-purple-200 theme-light:text-purple-800">
                  {pendingUnlocks.length}
                </Badge>
              </div>
              <p className="text-gray-400 text-xs theme-light:text-gray-600">
                Selecciona un desbloqueo para marcarlo como completado
              </p>
            </div>

            {loadingOrders ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 mx-auto text-cyan-500 animate-spin mb-3" />
                <p className="text-gray-400 text-sm theme-light:text-gray-600">Cargando desbloqueos...</p>
              </div>
            ) : pendingUnlocks.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl theme-light:border-gray-300">
                <CheckCircle2 className="w-16 h-16 mx-auto text-gray-600 mb-4 opacity-50" />
                <p className="text-gray-400 text-sm mb-2 theme-light:text-gray-600">No hay desbloqueos pendientes</p>
                <p className="text-gray-500 text-xs theme-light:text-gray-500">
                  Todos los desbloqueos están completados
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {pendingUnlocks.map((order) => {
                  const serviceType = SOFTWARE_SERVICES.find(s => 
                    order.initial_problem?.toLowerCase().includes(s.label.toLowerCase())
                  );

                  return (
                    <div
                      key={order.id}
                      className="bg-gradient-to-br from-slate-900/60 to-black/60 border border-cyan-500/20 rounded-xl p-4 hover:border-cyan-500/40 transition-all theme-light:bg-white theme-light:border-gray-200 theme-light:hover:border-cyan-300"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-purple-600/30 text-purple-200 text-xs theme-light:bg-purple-200 theme-light:text-purple-800">
                              {order.order_number}
                            </Badge>
                            <Badge className="bg-cyan-600/20 text-cyan-300 text-xs theme-light:bg-cyan-100 theme-light:text-cyan-700">
                              En Progreso
                            </Badge>
                          </div>
                          <h4 className="text-white font-bold text-base mb-1 theme-light:text-gray-900">
                            {order.customer_name}
                          </h4>
                          <p className="text-gray-400 text-sm theme-light:text-gray-600">
                            📱 {order.device_brand} {order.device_model}
                          </p>
                          <p className="text-gray-500 text-xs font-mono mt-1">
                            IMEI: {order.device_serial}
                          </p>
                        </div>
                      </div>

                      <div className="bg-black/30 border border-white/10 rounded-lg p-3 mb-3 theme-light:bg-gray-50 theme-light:border-gray-200">
                        <p className="text-xs text-gray-400 mb-1 theme-light:text-gray-600">Servicio:</p>
                        <p className="text-white text-sm theme-light:text-gray-900">
                          {serviceType?.label || order.initial_problem?.split('\n')[0] || "Servicio de software"}
                        </p>
                        {order.initial_problem?.split('\n')[1] && (
                          <p className="text-gray-400 text-xs mt-2 theme-light:text-gray-600">
                            {order.initial_problem.split('\n')[1]}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 text-xs text-gray-500 mb-3 theme-light:text-gray-600">
                        <span>
                          📅 {format(new Date(order.created_date), "d MMM yyyy", { locale: es })}
                        </span>
                        <div className="flex items-center gap-2">
                          {order.cost_estimate > 0 && (
                            <span className="text-emerald-400 font-bold theme-light:text-emerald-600">
                              ${order.cost_estimate.toFixed(2)}
                            </span>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-900 border-white/10">
                              <DropdownMenuItem
                                onClick={() => {
                                  setOrderToDelete(order);
                                  setShowPinPrompt(true);
                                }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-600/20 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleContinueUnlock(order)}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-12 shadow-lg"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Gestionar Pago y Entrega
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ✅ MODAL DE OPCIONES DE PAGO */}
        {paymentModalOrder && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 rounded-3xl p-8 max-w-lg w-full border border-purple-500/30 shadow-[0_0_100px_rgba(168,85,247,0.4)]">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mx-auto mb-4 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.6)]">
                  <DollarSign className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                  Desbloqueo Completado
                </h2>
                
                <p className="text-gray-400 mb-4">
                  {paymentModalOrder.customer_name}
                </p>

                <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-4 mb-6">
                  <p className="text-amber-300 text-sm mb-2">Balance pendiente</p>
                  <p className="text-4xl font-black text-amber-400">
                    ${(Number(paymentModalOrder.cost_estimate || paymentModalOrder.total || 0) - 
                       Number(paymentModalOrder.amount_paid || paymentModalOrder.total_paid || 0)).toFixed(2)}
                  </p>
                </div>

                <p className="text-gray-400 text-sm mb-6">
                  ¿Qué deseas hacer con el pago?
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handlePaymentOption("pay")}
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 h-14 shadow-lg text-base"
                >
                  <DollarSign className="w-5 h-5 mr-2" />
                  💰 Cobrar Ahora
                  <ArrowRight className="w-5 h-5 ml-auto" />
                </Button>

                <Button
                  onClick={() => handlePaymentOption("deposit")}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 h-14 shadow-lg text-base"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  💳 Recibir Depósito
                  <ArrowRight className="w-5 h-5 ml-auto" />
                </Button>

                <Button
                  onClick={() => handlePaymentOption("skip")}
                  variant="outline"
                  className="w-full border-white/20 bg-slate-900/60 hover:bg-slate-800/80 h-12 text-sm"
                >
                  ✅ Marcar Listo (Sin cobrar ahora)
                </Button>

                <Button
                  onClick={() => setPaymentModalOrder(null)}
                  variant="ghost"
                  className="w-full h-10 text-xs text-gray-500 hover:text-gray-400"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ PIN PROMPT PARA ELIMINAR */}
        {showPinPrompt && (
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
        )}

        {/* ✅ MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
        {deleteConfirmOrder && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-950 via-red-950 to-slate-900 rounded-3xl p-8 max-w-md w-full border border-red-500/30 shadow-[0_0_100px_rgba(239,68,68,0.4)]">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-rose-600 mx-auto mb-4 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.6)]">
                  <AlertCircle className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">
                  ¿Eliminar Desbloqueo?
                </h2>
                
                <p className="text-gray-400 mb-2">
                  {deleteConfirmOrder.order_number}
                </p>

                <p className="text-gray-400 text-sm">
                  {deleteConfirmOrder.customer_name}
                </p>

                <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-3 mt-4">
                  <p className="text-red-300 text-xs">
                    ⚠️ Esta acción no se puede deshacer
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handleDeleteUnlock(deleteConfirmOrder.id)}
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 h-12 shadow-lg text-base"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Sí, Eliminar
                </Button>

                <Button
                  onClick={() => setDeleteConfirmOrder(null)}
                  variant="outline"
                  className="w-full border-white/20 bg-slate-900/60 hover:bg-slate-800/80 h-12"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
