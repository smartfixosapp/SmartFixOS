import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import {
  Smartphone, Code2, Clock, CheckCircle2, Zap, Plus,
  DollarSign, CreditCard, Trash2, User, Search, X, Loader2
} from "lucide-react";
import AdminAuthGate from "@/components/users/AdminAuthGate";
import UnlockManageDialog from "./UnlockManageDialog";
import { generateUnlockNumber } from "@/components/utils/sequenceHelpers";
import { generateCustomerNumber } from "@/components/utils/sequenceHelpers";

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

export default function UnlocksPanel() {
  const navigate = useNavigate();
  const [unlocks, setUnlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [selectedUnlock, setSelectedUnlock] = useState(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    loadUnlocks();
    loadCustomers();
  }, []);

  const loadUnlocks = async () => {
    setLoading(true);
    try {
      const data = await dataClient.entities.Order.filter({
        device_type: "Software",
        status: "in_progress",
        deleted: false
      }, "-created_date", 100);
      setUnlocks(data || []);
    } catch (error) {
      console.error("Error loading unlocks:", error);
      toast.error("Error al cargar desbloqueos");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await dataClient.entities.Customer.list("-created_date", 100);
      setCustomers(data || []);
    } catch (error) {
      console.error("Error loading customers:", error);
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

    setSubmitting(true);

    try {
      const user = await dataClient.auth.me();

      let customerId = selectedCustomer?.id;
      if (!customerId) {
        const newCustomer = await dataClient.entities.Customer.create({
          name: formData.customer_name,
          phone: formData.customer_phone || undefined,
          email: formData.customer_email || undefined
        });
        customerId = newCustomer.id;
      }

      const orderNumber = await generateUnlockNumber();
      const serviceLabel = SOFTWARE_SERVICES.find(s => s.value === formData.service_type)?.label || formData.service_type;

      const order = await dataClient.entities.Order.create({
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

      await dataClient.entities.WorkOrderEvent.create({
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
      loadUnlocks();
      resetForm();
      setShowNewForm(false);

    } catch (error) {
      console.error("Error creando servicio:", error);
      toast.error("Error al crear el servicio");
    } finally {
      setSubmitting(false);
    }
  };

  const handleManageUnlock = (unlock) => {
    setSelectedUnlock(unlock);
  };

  const handlePaymentOption = async (option, customAmount = null) => {
    if (!selectedUnlock) return;

    const total = Number(selectedUnlock.cost_estimate || selectedUnlock.total || 0);
    const paid = Number(selectedUnlock.amount_paid || selectedUnlock.total_paid || 0);
    const balance = Math.max(0, total - paid);

    // Verificar si ya está pagado
    if (balance <= 0.01) {
      toast.info("Este desbloqueo ya está completamente pagado", {
        description: `Total: $${total.toFixed(2)} | Pagado: $${paid.toFixed(2)}`
      });
      setSelectedUnlock(null);
      return;
    }

    if (option === "pay") {
      setSelectedUnlock(null);
      navigate(createPageUrl(`POS?workOrderId=${selectedUnlock.id}&balance=${balance}&mode=full`));
    } else if (option === "deposit") {
      const depositAmt = customAmount || balance;
      setSelectedUnlock(null);
      navigate(createPageUrl(`POS?workOrderId=${selectedUnlock.id}&balance=${balance}&depositAmount=${depositAmt}&mode=deposit`));
    } else if (option === "skip") {
      await completeUnlock(selectedUnlock.id);
    }
  };

  const handleUpdateUnlock = async (unlockId, updateData) => {
    try {
      await dataClient.entities.Order.update(unlockId, updateData);
      await loadUnlocks();
      toast.success("✅ Desbloqueo actualizado");
    } catch (error) {
      console.error("Error actualizando desbloqueo:", error);
      toast.error("Error al actualizar");
      throw error;
    }
  };

  const completeUnlock = async (orderId) => {
    try {
      await dataClient.entities.Order.update(orderId, {
        status: "ready_for_pickup",
        updated_date: new Date().toISOString()
      });
      toast.success("✅ Desbloqueo completado");
      loadUnlocks();
      setSelectedUnlock(null);
    } catch (error) {
      console.error("Error completando desbloqueo:", error);
      toast.error("Error al completar el desbloqueo");
    }
  };

  const handleDeleteUnlock = async (orderId) => {
    try {
      await dataClient.entities.Order.update(orderId, {
        deleted: true,
        deleted_at: new Date().toISOString()
      });
      toast.success("Desbloqueo eliminado");
      loadUnlocks();
      setDeleteConfirmOrder(null);
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
    <div className="space-y-6">
      {/* Botón para añadir desbloqueo */}
      <Button
        onClick={() => setShowNewForm(!showNewForm)}
        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-[20px] h-14 text-lg font-black shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all duration-300 active:scale-95"
      >
        <Plus className="w-5 h-5 mr-2" />
        {showNewForm ? "Cancelar" : "Nuevo Desbloqueo"}
      </Button>

      {/* Formulario de nuevo desbloqueo */}
      {showNewForm && (
        <div className="bg-[#1c1c1e] border border-white/10 rounded-[24px] p-6 space-y-6 shadow-xl">
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
                  <div className="bg-[#2c2c2e] rounded-2xl p-2 max-h-48 overflow-y-auto">
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
                    className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl"
                    disabled={!!selectedCustomer}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/40 text-xs font-bold uppercase ml-3">Teléfono</Label>
                  <Input
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl"
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
                  className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/40 text-xs font-bold uppercase ml-3">Modelo</Label>
                <Input
                  value={formData.device_model}
                  onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                  placeholder="Ej: iPhone 14 Pro"
                  className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/40 text-xs font-bold uppercase ml-3">IMEI / Serial</Label>
              <Input
                value={formData.device_serial}
                onChange={(e) => handleImeiChange(e.target.value)}
                placeholder="Ej: 3548..."
                maxLength={15}
                className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl font-mono"
              />
            </div>
          </div>

          {/* SERVICIO */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="space-y-1.5">
              <Label className="text-white/40 text-xs font-bold uppercase ml-3">Servicio</Label>
              <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                <SelectTrigger className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl">
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
                    className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl pl-8 font-bold text-lg"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/40 text-xs font-bold uppercase ml-3">Notas</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Opcional"
                  className="bg-[#2c2c2e] border-transparent text-white h-12 rounded-2xl"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold h-14 rounded-2xl shadow-lg"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Desbloqueo"
            )}
          </Button>
        </div>
      )}

      {/* Lista de desbloqueos */}
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : unlocks.length === 0 ? (
        <div className="bg-[#1c1c1e] border border-white/10 rounded-[32px] p-20 text-center">
          <Code2 className="w-20 h-20 text-white/10 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">No hay desbloqueos pendientes</h3>
          <p className="text-gray-500">Los desbloqueos activos aparecerán aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unlocks.map(unlock => {
            const serviceType = SOFTWARE_SERVICES.find(s => 
              unlock.initial_problem?.toLowerCase().includes(s.label.toLowerCase())
            );

            return (
              <div
                key={unlock.id}
                className="bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/5 rounded-2xl p-5 transition-all group shadow-md"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px] px-2 py-0.5 rounded-md font-bold">
                        {unlock.order_number}
                      </Badge>
                      <span className="text-xs text-white/40 font-mono">
                        {format(new Date(unlock.created_date), "dd MMM", { locale: es })}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-lg">{unlock.customer_name}</h4>
                    <p className="text-sm text-white/60">
                      {unlock.device_brand} {unlock.device_model}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block mb-1">Precio</span>
                    <span className="text-xl font-bold text-green-400">
                      ${(unlock.cost_estimate || 0).toFixed(2)}
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
                      {serviceType?.label || unlock.initial_problem?.split('\n')[0] || "Software"}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleManageUnlock(unlock)}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 h-10 rounded-xl text-sm font-bold"
                  >
                    Gestionar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setOrderToDelete(unlock);
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

      {/* Modal de gestión mejorado */}
      {selectedUnlock && (
        <UnlockManageDialog
          unlock={selectedUnlock}
          onClose={() => setSelectedUnlock(null)}
          onPaymentOption={handlePaymentOption}
          onUpdateUnlock={handleUpdateUnlock}
        />
      )}

      {/* PIN PROMPT */}
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

      {/* CONFIRM DELETE */}
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
    </div>
  );
}
