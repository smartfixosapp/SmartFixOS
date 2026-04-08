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
  { value: "unlock",          label: "Desbloqueo de Operadora",  emoji: "🔓", color: "from-violet-600 to-purple-600",   badge: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  { value: "blacklist",       label: "Remover Lista Negra",       emoji: "📵", color: "from-red-600 to-rose-600",        badge: "bg-red-500/20 text-red-300 border-red-500/30" },
  { value: "imei_change",     label: "Cambio de IMEI",            emoji: "🔢", color: "from-blue-600 to-cyan-600",       badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "icloud_bypass",   label: "Bypass iCloud",             emoji: "☁️", color: "from-sky-600 to-blue-600",        badge: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  { value: "frp_bypass",      label: "Bypass FRP (Google)",       emoji: "🔐", color: "from-orange-600 to-amber-600",    badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { value: "software_repair", label: "Reparación de Software",    emoji: "⚙️", color: "from-emerald-600 to-teal-600",   badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { value: "data_recovery",   label: "Recuperación de Datos",     emoji: "💾", color: "from-indigo-600 to-violet-600",  badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  { value: "jailbreak",       label: "Jailbreak / Root",          emoji: "🔓", color: "from-pink-600 to-rose-600",      badge: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  { value: "other",           label: "Otro Servicio",             emoji: "📱", color: "from-slate-600 to-gray-600",     badge: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
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
      <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Todo libre por ahora</h3>
      <p className="text-white/40 text-sm max-w-xs leading-relaxed">
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
    <div className="space-y-5">

      {/* ── HEADER HERO ── */}
      <div className="relative overflow-hidden rounded-[28px] p-6 bg-[#0d0d12] border border-violet-500/10"
           style={{ background: "radial-gradient(ellipse at 30% 0%, rgba(109,40,217,0.18) 0%, rgba(13,13,18,1) 65%)" }}>
        <div className="flex items-center gap-4">
          {/* Icono animado con glow */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.5)]">
              <Unlock className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={2.5} />
            </div>
            {/* Pulso */}
            <div className="absolute inset-0 rounded-2xl bg-violet-500/30 animate-ping" style={{ animationDuration: "2.5s" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">
              Desbloqueos
            </h1>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="text-white/30 text-sm">Cargando...</span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-bold px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" />
                    {unlocks.length} {unlocks.length === 1 ? "activo" : "activos"}
                  </span>
                  <span className="text-white/25 text-xs">en progreso</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA NUEVA SOLICITUD ── */}
      <button
        onClick={() => { setShowNewForm(!showNewForm); if (showNewForm) resetForm(); }}
        className={`
          group relative w-full overflow-hidden rounded-[24px] p-5 transition-all duration-300
          ${showNewForm
            ? "bg-white/5 border border-white/10 hover:bg-white/8"
            : "bg-gradient-to-r from-violet-600 via-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-[0_0_40px_rgba(139,92,246,0.35)] hover:shadow-[0_0_55px_rgba(139,92,246,0.5)] hover:scale-[1.02] active:scale-[0.98]"
          }
        `}
      >
        {/* Brillo superior */}
        {!showNewForm && (
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        )}
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
            showNewForm
              ? "bg-white/10"
              : "bg-white/20 group-hover:bg-white/25 group-hover:scale-110"
          }`}>
            {showNewForm
              ? <X className="w-6 h-6 text-white/60" />
              : <Plus className="w-6 h-6 text-white" strokeWidth={3} />
            }
          </div>
          <div className="text-left">
            <p className={`font-black text-lg leading-tight ${showNewForm ? "text-white/50" : "text-white"}`}>
              {showNewForm ? "Cancelar" : "Nueva Solicitud de Desbloqueo"}
            </p>
            {!showNewForm && (
              <p className="text-white/60 text-xs mt-0.5">Registra un equipo para procesar</p>
            )}
          </div>
          {!showNewForm && (
            <ChevronRight className="w-5 h-5 text-white/50 ml-auto group-hover:translate-x-1 transition-transform" />
          )}
        </div>
      </button>

      {/* ── FORMULARIO ── */}
      {showNewForm && (
        <div className="relative rounded-[28px] overflow-hidden border border-violet-500/15 shadow-2xl"
             style={{ background: "linear-gradient(160deg, #12121a 0%, #0e0e16 100%)" }}>

          {/* Borde superior decorativo */}
          <div className="h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

          <div className="p-6 space-y-7">

            {/* ── SECCIÓN CLIENTE ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-xs font-black text-white/50 uppercase tracking-widest">Cliente</span>
              </div>

              {!selectedCustomer && !showNewCustomer ? (
                <div className="space-y-3">
                  {/* Buscador */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      placeholder="Buscar cliente por nombre, teléfono o email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 h-12 bg-white/[0.05] border border-white/[0.08] text-white text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 placeholder:text-white/25 transition-all"
                    />
                  </div>

                  {/* Resultados */}
                  {searchTerm && filteredCustomers.length > 0 && (
                    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                      {filteredCustomers.map((customer, i) => {
                        const initials = customer.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
                        return (
                          <button
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className={`w-full text-left px-4 py-3 hover:bg-violet-500/10 transition-all flex items-center gap-3 group ${i !== 0 ? "border-t border-white/[0.05]" : ""}`}
                          >
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600/40 to-purple-600/40 flex items-center justify-center flex-shrink-0 text-violet-300 font-bold text-xs border border-violet-500/20">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{customer.name}</p>
                              <p className="text-xs text-white/35 truncate">{customer.phone || customer.email || "Sin contacto"}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-white/50 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {searchTerm && filteredCustomers.length === 0 && (
                    <div className="text-center py-3 text-white/30 text-sm">
                      Sin resultados para "{searchTerm}"
                    </div>
                  )}

                  {/* Botón nuevo cliente */}
                  <button
                    onClick={() => setShowNewCustomer(true)}
                    className="w-full h-11 rounded-2xl border border-dashed border-white/15 hover:border-violet-500/40 hover:bg-violet-500/5 text-white/40 hover:text-violet-300 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Crear nuevo cliente
                  </button>
                </div>
              ) : (
                /* Cliente seleccionado */
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center flex-shrink-0 text-white font-black text-sm shadow-lg">
                    {selectedCustomer
                      ? selectedCustomer.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                      : <User className="w-5 h-5" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">
                      {selectedCustomer ? selectedCustomer.name : "Nuevo Cliente"}
                    </p>
                    <p className="text-xs text-violet-400 font-semibold uppercase tracking-wide">
                      {selectedCustomer ? "Cliente seleccionado" : "Ingresa los datos"}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); setShowNewCustomer(false); setSearchTerm(""); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Campos adicionales del cliente */}
              {(showNewCustomer || selectedCustomer) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-white/35 uppercase tracking-widest ml-1">Nombre *</label>
                    <input
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      disabled={!!selectedCustomer}
                      className="w-full h-11 px-4 bg-white/[0.05] border border-white/[0.08] text-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-white/35 uppercase tracking-widest ml-1">Teléfono</label>
                    <input
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      disabled={!!selectedCustomer}
                      className="w-full h-11 px-4 bg-white/[0.05] border border-white/[0.08] text-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── DIVISOR ── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                <Smartphone className="w-3.5 h-3.5 text-white/30" />
              </div>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* ── SECCIÓN EQUIPO ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                </div>
                <span className="text-xs font-black text-white/50 uppercase tracking-widest">Equipo</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/35 uppercase tracking-widest ml-1">Marca *</label>
                  <input
                    value={formData.device_brand}
                    onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                    placeholder="Apple, Samsung…"
                    className="w-full h-11 px-4 bg-white/[0.05] border border-white/[0.08] text-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 placeholder:text-white/50 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/35 uppercase tracking-widest ml-1">Modelo *</label>
                  <input
                    value={formData.device_model}
                    onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                    placeholder="iPhone 15 Pro…"
                    className="w-full h-11 px-4 bg-white/[0.05] border border-white/[0.08] text-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 placeholder:text-white/50 transition-all"
                  />
                </div>
              </div>

              {/* IMEI con validación visual */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/35 uppercase tracking-widest ml-1">IMEI / Serial *</label>
                <div className="relative">
                  <input
                    value={formData.device_serial}
                    onChange={(e) => handleImeiChange(e.target.value)}
                    placeholder="354800000000000"
                    maxLength={15}
                    className={`w-full h-11 px-4 pr-32 bg-white/[0.05] border text-white text-sm rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40 placeholder:text-white/50 transition-all ${
                      imeiValid ? "border-emerald-500/40" : "border-white/[0.08]"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {imeiValid && (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Válido
                      </span>
                    )}
                    <span className={`text-[10px] font-mono font-bold tabular-nums ${
                      formData.device_serial.length === 15 ? "text-emerald-400" : "text-white/25"
                    }`}>
                      {formData.device_serial.length}/15
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── DIVISOR ── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white/30" />
              </div>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* ── SECCIÓN SERVICIO ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-xs font-black text-white/50 uppercase tracking-widest">Servicio</span>
              </div>

              {/* Grid de servicios — tarjetas con emoji */}
              <div className="grid grid-cols-3 gap-2">
                {SOFTWARE_SERVICES.map((svc) => {
                  const isSelected = formData.service_type === svc.value;
                  return (
                    <button
                      key={svc.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, service_type: svc.value })}
                      className={`
                        relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 text-center
                        ${isSelected
                          ? "bg-violet-600/20 border-violet-500/60 shadow-[0_0_16px_rgba(139,92,246,0.25)] scale-[1.03]"
                          : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/15 active:scale-95"
                        }
                      `}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-violet-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                      <span className="text-xl leading-none">{svc.emoji}</span>
                      <span className={`text-[10px] font-bold leading-tight ${isSelected ? "text-violet-200" : "text-white/45"}`}>
                        {svc.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Precio y notas */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/35 uppercase tracking-widest ml-1">Precio</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-black text-base pointer-events-none">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-11 pl-8 pr-4 bg-white/[0.05] border border-white/[0.08] text-white text-sm rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/40 placeholder:text-white/50 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/35 uppercase tracking-widest ml-1">Notas</label>
                  <input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Opcional…"
                    className="w-full h-11 px-4 bg-white/[0.05] border border-white/[0.08] text-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 placeholder:text-white/50 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* ── BOTÓN SUBMIT ── */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-base shadow-[0_0_30px_rgba(139,92,246,0.35)] hover:shadow-[0_0_45px_rgba(139,92,246,0.5)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5"
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

          {/* Borde inferior decorativo */}
          <div className="h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
        </div>
      )}

      {/* ── LISTA DE DESBLOQUEOS ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-white/30 text-sm font-medium">Cargando desbloqueos…</span>
        </div>
      ) : unlocks.length === 0 ? (
        <div className="rounded-[28px] border border-white/[0.06] overflow-hidden"
             style={{ background: "linear-gradient(160deg, #0f0f16 0%, #0b0b11 100%)" }}>
          <EmptyState />
        </div>
      ) : (
        <>
          {/* Contador sutil */}
          <div className="flex items-center gap-2 px-1">
            <div className="flex-1 h-px bg-white/[0.05]" />
            <span className="text-[11px] text-white/25 font-bold uppercase tracking-widest">{unlocks.length} en proceso</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
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
                  className="group relative overflow-hidden rounded-[24px] border transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_0_30px_rgba(139,92,246,0.08)]"
                  style={{
                    background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                    borderColor: "rgba(139,92,246,0.10)",
                    backdropFilter: "blur(8px)"
                  }}
                >
                  {/* Brillo hover en la esquina */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="p-5 space-y-4">
                    {/* Fila superior — badge + fecha */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center bg-gradient-to-r from-violet-600/30 to-purple-600/30 border border-violet-500/30 text-violet-200 text-[10px] font-black px-2.5 py-1 rounded-lg tracking-wide">
                          {unlock.order_number}
                        </span>
                        <span className={`inline-flex items-center gap-1 ${svc.badge} border text-[10px] font-bold px-2 py-1 rounded-lg`}>
                          <span>{svc.emoji}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-white/30 font-mono flex-shrink-0 pt-0.5">
                        {format(new Date(unlock.created_date), "dd MMM", { locale: es })}
                      </span>
                    </div>

                    {/* Cliente */}
                    <div>
                      <h4 className="font-black text-white text-lg leading-tight tracking-tight truncate">
                        {unlock.customer_name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Smartphone className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
                        <span className="text-sm text-white/45 truncate">
                          {unlock.device_brand} {unlock.device_model}
                        </span>
                      </div>
                    </div>

                    {/* Servicio + IMEI en pill */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 ${svc.badge} border text-[11px] font-semibold px-2.5 py-1 rounded-full`}>
                        <span>{svc.emoji}</span>
                        {svc.label}
                      </span>
                      {imeiShort && (
                        <span className="font-mono text-[10px] text-white/25 bg-white/[0.04] px-2 py-1 rounded-md border border-white/[0.06]">
                          {imeiShort}
                        </span>
                      )}
                    </div>

                    {/* Precio */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-white/30 font-bold">$</span>
                      <span className="text-2xl font-black text-emerald-400 leading-none tabular-nums">
                        {(unlock.cost_estimate || 0).toFixed(2)}
                      </span>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleManageUnlock(unlock)}
                        className="flex-1 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-bold shadow-[0_0_16px_rgba(139,92,246,0.25)] hover:shadow-[0_0_24px_rgba(139,92,246,0.4)] transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Zap className="w-4 h-4" />
                        Gestionar
                      </button>
                      <button
                        onClick={() => { setOrderToDelete(unlock); setShowPinPrompt(true); }}
                        className="w-10 h-10 rounded-xl border border-white/[0.07] text-white/25 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-200 active:scale-95 flex items-center justify-center"
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
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={() => setDeleteConfirmOrder(null)}
          />
          <div className="relative z-[10001] w-full max-w-sm text-center rounded-[32px] border border-white/[0.08] shadow-2xl overflow-hidden"
               style={{ background: "linear-gradient(160deg, #1a0a0a 0%, #120808 100%)" }}>
            {/* Borde superior rojo */}
            <div className="h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            <div className="p-8">
              <div className="w-20 h-20 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">¿Eliminar desbloqueo?</h3>
              <p className="text-white/40 mb-2 text-sm">
                <span className="text-white/70 font-semibold">{deleteConfirmOrder.order_number}</span> — {deleteConfirmOrder.customer_name}
              </p>
              <p className="text-white/30 text-xs mb-8">Esta acción es irreversible y no se puede deshacer.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmOrder(null)}
                  className="flex-1 h-12 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteUnlock(deleteConfirmOrder.id)}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-sm font-black shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all"
                >
                  Eliminar
                </button>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
          </div>
        </div>
      )}
    </div>
  );
}
