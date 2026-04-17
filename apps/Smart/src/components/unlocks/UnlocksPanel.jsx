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
  DollarSign, CreditCard, Trash2, User, Search, X, Loader2,
  Lock, Unlock, ChevronRight, ShieldAlert, Hash, Cloud,
  Shield, Wrench, Database, Cpu, MoreHorizontal, Star
} from "lucide-react";
import AdminAuthGate from "@/components/users/AdminAuthGate";
import UnlockManageDialog from "./UnlockManageDialog";
import { generateUnlockNumber } from "@/components/utils/sequenceHelpers";
import { generateCustomerNumber } from "@/components/utils/sequenceHelpers";

const SOFTWARE_SERVICES = [
  { value: "unlock",          label: "Desbloqueo de Operadora",  emoji: "🔓", color: "bg-apple-purple",   badge: "bg-apple-purple/15 text-apple-purple" },
  { value: "blacklist",       label: "Remover Lista Negra",       emoji: "📵", color: "bg-apple-red",      badge: "bg-apple-red/15 text-apple-red" },
  { value: "imei_change",     label: "Cambio de IMEI",            emoji: "🔢", color: "bg-apple-blue",     badge: "bg-apple-blue/15 text-apple-blue" },
  { value: "icloud_bypass",   label: "Bypass iCloud",             emoji: "☁️", color: "bg-apple-blue",     badge: "bg-apple-blue/15 text-apple-blue" },
  { value: "frp_bypass",      label: "Bypass FRP (Google)",       emoji: "🔐", color: "bg-apple-orange",   badge: "bg-apple-orange/15 text-apple-orange" },
  { value: "software_repair", label: "Reparación de Software",    emoji: "⚙️", color: "bg-apple-green",    badge: "bg-apple-green/15 text-apple-green" },
  { value: "data_recovery",   label: "Recuperación de Datos",     emoji: "💾", color: "bg-apple-indigo",   badge: "bg-apple-indigo/15 text-apple-indigo" },
  { value: "jailbreak",       label: "Jailbreak / Root",          emoji: "🔓", color: "bg-apple-red",      badge: "bg-apple-red/15 text-apple-red" },
  { value: "other",           label: "Otro Servicio",             emoji: "📱", color: "bg-gray-sys3",      badge: "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary" },
];

function getServiceMeta(unlock) {
  for (const svc of SOFTWARE_SERVICES) {
    if (unlock.initial_problem?.toLowerCase().includes(svc.label.toLowerCase())) return svc;
  }
  return SOFTWARE_SERVICES[0];
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {/* SVG ilustración inline */}
      <div className="relative mb-8">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Glow detrás */}
          <circle cx="60" cy="60" r="55" fill="url(#glow)" fillOpacity="0.12" />
          {/* Candado cuerpo */}
          <rect x="28" y="52" width="64" height="46" rx="12" fill="url(#lockGrad)" fillOpacity="0.9" />
          {/* Arco del candado — abierto */}
          <path d="M40 52V38C40 24 80 18 80 38" stroke="url(#arcGrad)" strokeWidth="8" strokeLinecap="round" fill="none" />
          {/* Ojo interior */}
          <circle cx="60" cy="72" r="8" fill="white" fillOpacity="0.15" />
          <circle cx="60" cy="72" r="4" fill="white" fillOpacity="0.6" />
          {/* Estrellas decorativas */}
          <circle cx="22" cy="30" r="3" fill="#a78bfa" fillOpacity="0.8" />
          <circle cx="98" cy="22" r="2" fill="#818cf8" fillOpacity="0.7" />
          <circle cx="105" cy="55" r="4" fill="#c4b5fd" fillOpacity="0.5" />
          <circle cx="15" cy="70" r="2.5" fill="#7c3aed" fillOpacity="0.6" />
          <circle cx="90" cy="108" r="3" fill="#a78bfa" fillOpacity="0.5" />
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="lockGrad" x1="28" y1="52" x2="92" y2="98" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6d28d9" />
              <stop offset="1" stopColor="#4c1d95" />
            </linearGradient>
            <linearGradient id="arcGrad" x1="40" y1="25" x2="80" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a78bfa" />
              <stop offset="1" stopColor="#818cf8" />
            </linearGradient>
          </defs>
        </svg>
        {/* Pequeñas chispas animadas */}
        <div className="absolute top-1 right-4 w-2 h-2 rounded-full bg-violet-400 animate-ping opacity-70" />
        <div className="absolute bottom-4 left-2 w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping opacity-50" style={{ animationDelay: "0.4s" }} />
      </div>
      <h3 className="apple-text-title2 apple-label-primary mb-2">Todo libre por ahora</h3>
      <p className="apple-label-tertiary apple-text-footnote max-w-xs leading-relaxed">
        Los desbloqueos activos aparecerán aquí. Crea una nueva solicitud para comenzar.
      </p>
    </div>
  );
}

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
    if (balance <= 0.01) {
      toast.info("Este desbloqueo ya está completamente pagado", {
        description: `Total: $${total.toFixed(2)} | Pagado: $${paid.toFixed(2)}`
      });
      setSelectedUnlock(null);
      return;
    }
    const items = [{
      id: `sw-${selectedUnlock.id}`,
      name: selectedUnlock.initial_problem?.split('\n')[0] || "Software Service",
      price: total,
      cost: 0,
      taxable: false,
      type: 'service',
      qty: 1
    }];

    const state = {
      fromDashboard: true,
      workOrder: selectedUnlock,
      items,
      customer: {
        id: selectedUnlock.customer_id,
        name: selectedUnlock.customer_name,
        phone: selectedUnlock.customer_phone,
        email: selectedUnlock.customer_email
      },
      balanceDue: balance,
      openPaymentImmediately: true
    };

    if (option === "pay") {
      setSelectedUnlock(null);
      navigate(createPageUrl(`POS?workOrderId=${selectedUnlock.id}&balance=${balance}&mode=full`), { state });
    } else if (option === "deposit") {
      const depositAmt = customAmount || balance;
      setSelectedUnlock(null);
      navigate(createPageUrl(`POS?workOrderId=${selectedUnlock.id}&balance=${balance}&depositAmount=${depositAmt}&mode=deposit`), {
        state: { ...state, paymentMode: "deposit", depositAmount: depositAmt }
      });
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

  const imeiValid = formData.device_serial.length === 15;

  return (
    <div className="apple-type space-y-5">

      {/* ── HEADER HERO ── */}
      <div className="relative overflow-hidden rounded-apple-lg p-6 apple-card border-0">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-apple-md bg-apple-purple flex items-center justify-center shadow-apple-lg">
              <Unlock className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 rounded-apple-md bg-apple-purple/30 animate-ping" style={{ animationDuration: "2.5s" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="apple-text-title1 apple-label-primary leading-none mb-1">
              Desbloqueos
            </h1>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="apple-label-tertiary apple-text-footnote">Cargando...</span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 bg-apple-purple/15 text-apple-purple apple-text-caption1 font-semibold px-3 py-1 rounded-full tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-apple-purple animate-pulse inline-block" />
                    {unlocks.length} {unlocks.length === 1 ? "activo" : "activos"}
                  </span>
                  <span className="apple-label-tertiary apple-text-caption1">en progreso</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA NUEVA SOLICITUD ── */}
      <button
        onClick={() => { setShowNewForm(!showNewForm); if (showNewForm) resetForm(); }}
        className={`apple-press group relative w-full overflow-hidden rounded-apple-lg p-5 transition-all duration-300 ${
          showNewForm
            ? "apple-card border-0"
            : "bg-apple-purple hover:bg-apple-purple shadow-apple-lg hover:scale-[1.02] active:scale-[0.98]"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-apple-sm flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
            showNewForm
              ? "bg-gray-sys6 dark:bg-gray-sys5"
              : "bg-white/20 group-hover:bg-white/25 group-hover:scale-110"
          }`}>
            {showNewForm
              ? <X className="w-6 h-6 apple-label-secondary" />
              : <Plus className="w-6 h-6 text-white" strokeWidth={3} />
            }
          </div>
          <div className="text-left">
            <p className={`apple-text-headline font-semibold leading-tight ${showNewForm ? "apple-label-secondary" : "text-white"}`}>
              {showNewForm ? "Cancelar" : "Nueva Solicitud de Desbloqueo"}
            </p>
            {!showNewForm && (
              <p className="text-white/70 apple-text-caption1 mt-0.5">Registra un equipo para procesar</p>
            )}
          </div>
          {!showNewForm && (
            <ChevronRight className="w-5 h-5 text-white/70 ml-auto group-hover:translate-x-1 transition-transform" />
          )}
        </div>
      </button>

      {/* ── FORMULARIO ── */}
      {showNewForm && (
        <div className="relative rounded-apple-lg overflow-hidden apple-card border-0 shadow-apple-md">

          <div className="p-6 space-y-7">

            {/* ── SECCIÓN CLIENTE ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
                  <User className="w-4 h-4 text-apple-purple" />
                </div>
                <span className="apple-text-caption1 font-semibold apple-label-secondary">Cliente</span>
              </div>

              {!selectedCustomer && !showNewCustomer ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary pointer-events-none" />
                    <input
                      placeholder="Buscar cliente por nombre, teléfono o email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="apple-input w-full pl-11 pr-4 h-12 apple-text-footnote"
                    />
                  </div>

                  {searchTerm && filteredCustomers.length > 0 && (
                    <div className="apple-surface-elevated rounded-apple-md overflow-hidden max-h-52 overflow-y-auto">
                      {filteredCustomers.map((customer, i) => {
                        const initials = customer.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
                        return (
                          <button
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className="apple-press w-full text-left px-4 py-3 hover:bg-gray-sys6 dark:hover:bg-gray-sys5 transition-all flex items-center gap-3 group"
                            style={i !== 0 ? { borderTop: '0.5px solid rgb(var(--separator) / 0.29)' } : {}}
                          >
                            <div className="w-9 h-9 rounded-full bg-apple-purple/15 flex items-center justify-center flex-shrink-0 text-apple-purple font-semibold apple-text-caption1">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold apple-label-primary apple-text-footnote truncate">{customer.name}</p>
                              <p className="apple-text-caption1 apple-label-tertiary truncate tabular-nums">{customer.phone || customer.email || "Sin contacto"}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 apple-label-tertiary group-hover:text-apple-purple transition-all" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {searchTerm && filteredCustomers.length === 0 && (
                    <div className="text-center py-3 apple-label-tertiary apple-text-footnote">
                      Sin resultados para "{searchTerm}"
                    </div>
                  )}

                  <button
                    onClick={() => setShowNewCustomer(true)}
                    className="apple-press w-full h-11 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 hover:bg-apple-purple/12 apple-label-secondary hover:text-apple-purple apple-text-footnote font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Crear nuevo cliente
                  </button>
                </div>
              ) : (
                <div className="bg-apple-purple/12 rounded-apple-md p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-apple-purple flex items-center justify-center flex-shrink-0 text-white font-semibold apple-text-footnote shadow-apple-sm">
                    {selectedCustomer
                      ? selectedCustomer.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                      : <User className="w-5 h-5" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold apple-label-primary truncate apple-text-body">
                      {selectedCustomer ? selectedCustomer.name : "Nuevo Cliente"}
                    </p>
                    <p className="apple-text-caption1 text-apple-purple font-semibold">
                      {selectedCustomer ? "Cliente seleccionado" : "Ingresa los datos"}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); setShowNewCustomer(false); setSearchTerm(""); }}
                    className="apple-press w-8 h-8 rounded-full flex items-center justify-center apple-label-tertiary hover:apple-label-primary hover:bg-gray-sys6 dark:hover:bg-gray-sys5 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {(showNewCustomer || selectedCustomer) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="apple-text-caption2 font-semibold apple-label-tertiary ml-1">Nombre *</label>
                    <input
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      disabled={!!selectedCustomer}
                      className="apple-input w-full h-11 px-4 apple-text-footnote disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="apple-text-caption2 font-semibold apple-label-tertiary ml-1">Teléfono</label>
                    <input
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      disabled={!!selectedCustomer}
                      className="apple-input w-full h-11 px-4 apple-text-footnote disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }} />
              <div className="w-7 h-7 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center">
                <Smartphone className="w-3.5 h-3.5 apple-label-tertiary" />
              </div>
              <div className="flex-1" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }} />
            </div>

            {/* ── SECCIÓN EQUIPO ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-apple-blue" />
                </div>
                <span className="apple-text-caption1 font-semibold apple-label-secondary">Equipo</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="apple-text-caption2 font-semibold apple-label-tertiary ml-1">Marca *</label>
                  <input
                    value={formData.device_brand}
                    onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                    placeholder="Apple, Samsung…"
                    className="apple-input w-full h-11 px-4 apple-text-footnote"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="apple-text-caption2 font-semibold apple-label-tertiary ml-1">Modelo *</label>
                  <input
                    value={formData.device_model}
                    onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                    placeholder="iPhone 15 Pro…"
                    className="apple-input w-full h-11 px-4 apple-text-footnote"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="apple-text-caption2 font-semibold apple-label-tertiary ml-1">IMEI / Serial *</label>
                <div className="relative">
                  <input
                    value={formData.device_serial}
                    onChange={(e) => handleImeiChange(e.target.value)}
                    placeholder="354800000000000"
                    maxLength={15}
                    className={`apple-input w-full h-11 px-4 pr-32 apple-text-footnote font-mono tabular-nums ${
                      imeiValid ? "ring-1 ring-apple-green" : ""
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {imeiValid && (
                      <span className="inline-flex items-center gap-1 bg-apple-green/15 text-apple-green apple-text-caption2 font-semibold px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Válido
                      </span>
                    )}
                    <span className={`apple-text-caption2 font-mono font-semibold tabular-nums ${
                      formData.device_serial.length === 15 ? "text-apple-green" : "apple-label-tertiary"
                    }`}>
                      {formData.device_serial.length}/15
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }} />
              <div className="w-7 h-7 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 apple-label-tertiary" />
              </div>
              <div className="flex-1" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }} />
            </div>

            {/* ── SECCIÓN SERVICIO ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-apple-orange" />
                </div>
                <span className="apple-text-caption1 font-semibold apple-label-secondary">Servicio</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {SOFTWARE_SERVICES.map((svc) => {
                  const isSelected = formData.service_type === svc.value;
                  return (
                    <button
                      key={svc.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, service_type: svc.value })}
                      className={`apple-press relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-apple-md transition-all duration-200 text-center ${
                        isSelected
                          ? "bg-apple-purple/15 scale-[1.03]"
                          : "apple-card border-0 hover:bg-gray-sys6 dark:hover:bg-gray-sys5 active:scale-95"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-apple-purple flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                      <span className="text-xl leading-none">{svc.emoji}</span>
                      <span className={`apple-text-caption2 font-semibold leading-tight ${isSelected ? "text-apple-purple" : "apple-label-secondary"}`}>
                        {svc.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="apple-text-caption2 font-semibold apple-label-tertiary ml-1">Precio</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 apple-label-tertiary font-semibold text-base pointer-events-none">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className="apple-input w-full h-11 pl-8 pr-4 apple-text-footnote font-semibold tabular-nums"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="apple-text-caption2 font-semibold apple-label-tertiary ml-1">Notas</label>
                  <input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Opcional…"
                    className="apple-input w-full h-11 px-4 apple-text-footnote"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="apple-btn apple-btn-lg w-full h-14 rounded-apple-md bg-apple-purple hover:bg-apple-purple disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold apple-text-body shadow-apple-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creando desbloqueo…
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" strokeWidth={2.5} />
                  Crear Desbloqueo
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* ── LISTA DE DESBLOQUEOS ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-apple-md bg-apple-purple/15 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-apple-purple border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="apple-label-tertiary apple-text-footnote font-medium">Cargando desbloqueos…</span>
        </div>
      ) : unlocks.length === 0 ? (
        <div className="rounded-apple-lg apple-card border-0 overflow-hidden">
          <EmptyState />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1">
            <div className="flex-1" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }} />
            <span className="apple-text-caption2 apple-label-tertiary font-semibold tabular-nums">{unlocks.length} en proceso</span>
            <div className="flex-1" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unlocks.map((unlock) => {
              const svc = getServiceMeta(unlock);
              const imeiShort = unlock.device_serial
                ? `···${unlock.device_serial.slice(-4)}`
                : null;

              return (
                <div
                  key={unlock.id}
                  className="group relative overflow-hidden rounded-apple-lg apple-card border-0 transition-all duration-300 hover:shadow-apple-md"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center bg-apple-purple/15 text-apple-purple apple-text-caption2 font-semibold px-2.5 py-1 rounded-apple-xs tabular-nums">
                          {unlock.order_number}
                        </span>
                        <span className={`inline-flex items-center gap-1 ${svc.badge} apple-text-caption2 font-semibold px-2 py-1 rounded-apple-xs`}>
                          <span>{svc.emoji}</span>
                        </span>
                      </div>
                      <span className="apple-text-caption2 apple-label-tertiary font-mono flex-shrink-0 pt-0.5 tabular-nums">
                        {format(new Date(unlock.created_date), "dd MMM", { locale: es })}
                      </span>
                    </div>

                    <div>
                      <h4 className="apple-text-headline font-semibold apple-label-primary leading-tight truncate">
                        {unlock.customer_name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Smartphone className="w-3.5 h-3.5 apple-label-tertiary flex-shrink-0" />
                        <span className="apple-text-footnote apple-label-secondary truncate">
                          {unlock.device_brand} {unlock.device_model}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 ${svc.badge} apple-text-caption1 font-semibold px-2.5 py-1 rounded-full`}>
                        <span>{svc.emoji}</span>
                        {svc.label}
                      </span>
                      {imeiShort && (
                        <span className="font-mono apple-text-caption2 apple-label-tertiary bg-gray-sys6 dark:bg-gray-sys5 px-2 py-1 rounded-apple-xs tabular-nums">
                          {imeiShort}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="apple-text-footnote apple-label-tertiary font-semibold">$</span>
                      <span className="apple-text-title2 font-semibold text-apple-green leading-none tabular-nums">
                        {(unlock.cost_estimate || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleManageUnlock(unlock)}
                        className="apple-btn apple-press flex-1 h-10 rounded-apple-sm bg-apple-purple hover:bg-apple-purple text-white apple-text-footnote font-semibold shadow-apple-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Zap className="w-4 h-4" />
                        Gestionar
                      </button>
                      <button
                        onClick={() => { setOrderToDelete(unlock); setShowPinPrompt(true); }}
                        className="apple-press w-10 h-10 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary hover:text-apple-red hover:bg-apple-red/12 transition-all duration-200 active:scale-95 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── DIALOG DE GESTIÓN ── */}
      {selectedUnlock && (
        <UnlockManageDialog
          unlock={selectedUnlock}
          onClose={() => setSelectedUnlock(null)}
          onPaymentOption={handlePaymentOption}
          onUpdateUnlock={handleUpdateUnlock}
        />
      )}

      {/* ── PIN PROMPT ── */}
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

      {/* ── CONFIRM DELETE ── */}
      {deleteConfirmOrder && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xl"
            onClick={() => setDeleteConfirmOrder(null)}
          />
          <div className="relative z-[10001] w-full max-w-sm text-center apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 overflow-hidden">
            <div className="p-8">
              <div className="w-20 h-20 rounded-apple-md bg-apple-red/15 flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-apple-red" />
              </div>
              <h3 className="apple-text-title2 apple-label-primary mb-2">¿Eliminar desbloqueo?</h3>
              <p className="apple-label-tertiary mb-2 apple-text-footnote">
                <span className="apple-label-primary font-semibold">{deleteConfirmOrder.order_number}</span> — {deleteConfirmOrder.customer_name}
              </p>
              <p className="apple-label-tertiary apple-text-caption1 mb-8">Esta acción es irreversible y no se puede deshacer.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmOrder(null)}
                  className="apple-btn apple-btn-secondary flex-1 h-12 rounded-apple-sm apple-text-footnote font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteUnlock(deleteConfirmOrder.id)}
                  className="apple-btn apple-btn-destructive flex-1 h-12 rounded-apple-sm apple-text-footnote font-semibold transition-all"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
