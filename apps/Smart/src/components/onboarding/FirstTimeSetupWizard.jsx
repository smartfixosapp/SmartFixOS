import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Phone, Mail, MapPin, CheckCircle2, Wrench, KeyRound,
  Eye, EyeOff, Upload, Clock, Shield, Users, Zap, ChevronRight,
  ChevronLeft, Star, Camera, MessageSquare, Globe, Hash, Sparkles,
  LayoutDashboard, DollarSign, Package, BarChart3, Timer, Bell, Check
} from "lucide-react";
import { toast } from "sonner";

const SETUP_KEY = "smartfix_setup_complete";

export function isSetupComplete() {
  return localStorage.getItem(SETUP_KEY) === "true";
}

const DAYS = [
  { key: "mon", label: "Lun" }, { key: "tue", label: "Mar" },
  { key: "wed", label: "Mié" }, { key: "thu", label: "Jue" },
  { key: "fri", label: "Vie" }, { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];

const DEFAULT_SCHEDULE = {
  mon: { open: true,  from: "09:00", to: "18:00" },
  tue: { open: true,  from: "09:00", to: "18:00" },
  wed: { open: true,  from: "09:00", to: "18:00" },
  thu: { open: true,  from: "09:00", to: "18:00" },
  fri: { open: true,  from: "09:00", to: "18:00" },
  sat: { open: true,  from: "10:00", to: "15:00" },
  sun: { open: false, from: "09:00", to: "17:00" },
};

// Solo 2 planes: Starter ($14.99) y Pro ($39.99)
// Legacy keys (basic/business/enterprise) mapean a starter o pro
const PLAN_INFO = {
  starter:    { label: "Starter",    color: "cyan",    max_users: 999, price: "$14.99/mes" },
  pro:        { label: "Pro",        color: "emerald", max_users: 999, price: "$39.99/mes" },
  // Legacy aliases — mismas configuraciones, solo distintos keys
  basic:      { label: "Starter",    color: "cyan",    max_users: 999, price: "$14.99/mes" },
  smartfixos: { label: "Starter",    color: "cyan",    max_users: 999, price: "$14.99/mes" },
  business:   { label: "Pro",        color: "emerald", max_users: 999, price: "$39.99/mes" },
  enterprise: { label: "Pro",        color: "emerald", max_users: 999, price: "$39.99/mes" },
};

const STEPS = [
  { id: 1, label: "Identidad",  icon: Building2        },
  { id: 2, label: "Contacto",   icon: MapPin           },
  { id: 3, label: "Políticas",  icon: Shield           },
  { id: 4, label: "Dashboard",  icon: LayoutDashboard  },
  { id: 5, label: "Tu cuenta",  icon: Star             },
];

const DASHBOARD_WIDGETS = [
  { key: "revenue_today",   label: "Ingresos del día",           icon: DollarSign, desc: "Ventas y pagos de hoy"          },
  { key: "active_orders",   label: "Órdenes activas",            icon: Wrench,     desc: "Reparaciones en progreso"       },
  { key: "total_customers", label: "Clientes totales",           icon: Users,      desc: "Base de clientes"               },
  { key: "inventory_value", label: "Valor del inventario",       icon: Package,    desc: "Stock en dinero"                },
  { key: "avg_repair_time", label: "Tiempo prom. reparación",    icon: Timer,      desc: "Eficiencia del taller"          },
  { key: "top_technicians", label: "Técnicos top",               icon: Star,       desc: "Rendimiento del equipo"         },
  { key: "revenue_chart",   label: "Gráfica de ingresos",        icon: BarChart3,  desc: "Evolución por período"          },
  { key: "overdue_orders",  label: "Órdenes vencidas / urgentes",icon: Bell,       desc: "Alertas que necesitan atención" },
];

export default function FirstTimeSetupWizard({ onComplete }) {
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [logoPreview, setLogoPreview]   = useState(null);
  const [logoFile, setLogoFile]         = useState(null);
  const [tenantInfo, setTenantInfo]     = useState(null);
  const [usedSlots, setUsedSlots]       = useState(1);
  const logoInputRef = useRef();

  const [dashWidgets, setDashWidgets] = useState(() =>
    Object.fromEntries(DASHBOARD_WIDGETS.map(w => [w.key, true]))
  );

  const [form, setForm] = useState({
    // Paso 1 — Identidad
    business_name: "",
    slogan: "",
    primary_color: "#06b6d4",
    // Paso 2 — Contacto
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    city: "",
    state: "PR",
    zip: "",
    website: "",
    // Paso 3 — Políticas
    warranty_days: "90",
    receipt_note: "No nos hacemos responsables por datos almacenados en el dispositivo. Equipos no reclamados en 90 días serán donados o desechados.",
    max_retention_days: "90",
    deposit_required: false,
    deposit_amount: "20",
    schedule: DEFAULT_SCHEDULE,
    // Paso 4 — Cuenta
    new_pin: "",
    confirm_pin: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const loadTenant = async () => {
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      if (!tenantId) return;
      const { data: tenant } = await supabase.from("tenant").select("*").eq("id", tenantId).single();
      setTenantInfo(tenant);
      // Precargar nombre solo si el usuario aún no escribió nada (evita quitar el foco)
      if (tenant?.name) setForm(f => ({ ...f, business_name: f.business_name || tenant.name }));
      // Contar usuarios activos
      const { count } = await supabase.from("app_employee").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      setUsedSlots(count || 1);
    };
    loadTenant();
  }, []);

  // ── Logo upload ──────────────────────────────────────────────────────────
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("El logo no puede superar 2MB"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (tenantId) => {
    if (!logoFile) return null;
    const ext  = logoFile.name.split(".").pop();
    const path = `tenants/${tenantId}/logo.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, logoFile, { upsert: true });
    if (error) { console.error("Logo upload error:", error); return null; }
    const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
    return publicUrl;
  };

  // ── Guardar todo ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.business_name.trim()) { toast.error("El nombre del taller es requerido"); setStep(1); return; }
    if (form.new_pin && form.new_pin.length !== 4) { toast.error("El PIN debe tener 4 dígitos"); return; }
    if (form.new_pin && form.new_pin !== form.confirm_pin) { toast.error("Los PINs no coinciden"); return; }

    setLoading(true);
    try {
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      const logoUrl  = await uploadLogo(tenantId);

      const branding = {
        business_name:      form.business_name,
        slogan:             form.slogan,
        phone:              form.phone,
        whatsapp:           form.whatsapp,
        email:              form.email,
        address:            form.address,
        city:               form.city,
        state:              form.state,
        zip:                form.zip,
        website:            form.website,
        logo_url:           logoUrl || "",
        primary_color:      form.primary_color,
        secondary_color:    "#000000",
        timezone:           "America/Puerto_Rico",
        tax_rate:           0.115,
        currency:           "USD",
        date_format:        "MM/dd/yyyy",
        warranty_days:      parseInt(form.warranty_days),
        receipt_note:       form.receipt_note,
        max_retention_days: parseInt(form.max_retention_days),
        deposit_required:   form.deposit_required,
        deposit_amount:     parseFloat(form.deposit_amount) || 0,
        schedule:           form.schedule,
      };

      // Guardar en system_config
      const { data: existing } = await supabase
        .from("system_config").select("id")
        .eq("key", "settings.branding").eq("tenant_id", tenantId).limit(1);

      if (existing?.length) {
        await supabase.from("system_config").update({ value: JSON.stringify(branding) }).eq("id", existing[0].id);
      } else {
        await supabase.from("system_config").insert({
          key: "settings.branding", value: JSON.stringify(branding),
          category: "general", description: "Configuración del taller", tenant_id: tenantId,
        });
      }

      // Guardar widgets del dashboard
      const { data: existingWidgets } = await supabase
        .from("system_config").select("id")
        .eq("key", "settings.dashboard_widgets").eq("tenant_id", tenantId).limit(1);

      if (existingWidgets?.length) {
        await supabase.from("system_config").update({ value: JSON.stringify(dashWidgets) }).eq("id", existingWidgets[0].id);
      } else {
        await supabase.from("system_config").insert({
          key: "settings.dashboard_widgets", value: JSON.stringify(dashWidgets),
          category: "general", description: "Widgets habilitados en el dashboard", tenant_id: tenantId,
        });
      }

      // Actualizar nombre en tenant
      if (tenantId) await supabase.from("tenant").update({ name: form.business_name }).eq("id", tenantId);

      // Cambiar PIN si se ingresó
      if (form.new_pin) {
        const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
        if (raw) {
          const parsed = JSON.parse(raw);
          const eid = parsed?.id || parsed?.userId;
          if (eid) {
            await supabase.from("app_employee").update({ pin: form.new_pin }).eq("id", eid);
            await supabase.from("users").update({ pin: form.new_pin }).eq("id", eid);
            const updated = { ...parsed, pin: form.new_pin };
            localStorage.setItem("employee_session", JSON.stringify(updated));
            sessionStorage.setItem("911-session", JSON.stringify(updated));
          }
        }
      }

      localStorage.setItem(SETUP_KEY, "true");
      toast.success("¡Taller configurado! Bienvenido a SmartFixOS 🎉");
      onComplete?.();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(SETUP_KEY, "true");
    onComplete?.();
  };

  const planKey  = tenantInfo?.plan || "starter";
  const planData = PLAN_INFO[planKey] || PLAN_INFO.starter;
  const maxUsers = tenantInfo?.metadata?.max_users ?? planData.max_users;
  const trialEnd = tenantInfo?.trial_end_date ? new Date(tenantInfo.trial_end_date) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24))) : null;

  // ── Schedule toggle ──────────────────────────────────────────────────────
  const toggleDay = (key) => set("schedule", { ...form.schedule, [key]: { ...form.schedule[key], open: !form.schedule[key].open } });
  const setDayTime = (key, field, val) => set("schedule", { ...form.schedule, [key]: { ...form.schedule[key], [field]: val } });

  // ── Render section ────────────────────────────────────────────────────────
  const SectionCard = ({ icon: Icon, title, color = "cyan", children }) => (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${color}-500/20`}>
          <Icon className={`w-4 h-4 text-${color}-400`} />
        </div>
        <span className="text-white/80 text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );

  const Field = ({ label, children, half }) => (
    <div className={half ? "" : "col-span-2"}>
      {label && <label className="text-white/50 text-xs mb-1 block">{label}</label>}
      {children}
    </div>
  );

  const inputCls = "w-full bg-black/30 border border-white/10 text-white text-sm rounded-xl px-3 h-10 focus:outline-none focus:border-cyan-500/50 placeholder:text-white/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-[#070d14] border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-4"
      >
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-[#0d2035] via-[#0a1929] to-[#0d2035] border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 flex-shrink-0">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Configura tu Taller</h2>
              <p className="text-xs text-white/40">Completa la información para comenzar · Puedes editarla después</p>
            </div>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-1 mt-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active   = step === s.id;
              const done     = step > s.id;
              return (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => done && setStep(s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      active ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" :
                      done   ? "bg-white/10 text-white/60 cursor-pointer hover:bg-white/15" :
                               "bg-white/5 text-white/25 cursor-not-allowed"}`}
                  >
                    {done ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Icon className="w-3 h-3" />}
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-px ${step > s.id ? "bg-cyan-500/40" : "bg-white/10"}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-6 py-5 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >

              {/* ── PASO 1: Identidad ── */}
              {step === 1 && (
                <div>
                  <SectionCard icon={Building2} title="Identidad del negocio">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-white/50 text-xs mb-1 block">Nombre del taller *</label>
                        <input className={inputCls} placeholder="Ej: Master Phone Repair"
                          value={form.business_name} onChange={e => set("business_name", e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-white/50 text-xs mb-1 block">Slogan (opcional)</label>
                        <input className={inputCls} placeholder="Ej: Reparaciones rápidas y garantizadas"
                          value={form.slogan} onChange={e => set("slogan", e.target.value)} />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={Camera} title="Logo del taller" color="purple">
                    <div className="flex items-center gap-4">
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 hover:border-cyan-500/50 flex flex-col items-center justify-center cursor-pointer transition-all bg-black/20 overflow-hidden flex-shrink-0 group"
                      >
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-white/30 group-hover:text-cyan-400 mb-1 transition-colors" />
                            <span className="text-[10px] text-white/30 group-hover:text-cyan-400 transition-colors">Subir logo</span>
                          </>
                        )}
                      </div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      <div className="flex-1">
                        <p className="text-white/60 text-sm mb-1">Este logo aparecerá en:</p>
                        <ul className="text-white/40 text-xs space-y-0.5">
                          <li>• Emails de bienvenida y notificaciones</li>
                          <li>• Órdenes de trabajo e invoices</li>
                          <li>• Portal del cliente</li>
                        </ul>
                        <p className="text-white/25 text-[10px] mt-2">PNG o JPG · Máx 2MB · Recomendado 200×200px</p>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={Sparkles} title="Color principal" color="yellow">
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.primary_color}
                        onChange={e => set("primary_color", e.target.value)}
                        className="w-12 h-10 rounded-xl border border-white/10 cursor-pointer bg-transparent" />
                      <div>
                        <p className="text-white/60 text-sm">Color de tu marca</p>
                        <p className="text-white/30 text-xs">Se usa en botones y encabezados de documentos</p>
                      </div>
                      <span className="ml-auto text-white/40 text-xs font-mono">{form.primary_color}</span>
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* ── PASO 2: Contacto ── */}
              {step === 2 && (
                <div>
                  <SectionCard icon={Phone} title="Teléfonos">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Teléfono principal *</label>
                        <input className={inputCls} placeholder="787-000-0000"
                          value={form.phone} onChange={e => set("phone", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">WhatsApp (opcional)</label>
                        <input className={inputCls} placeholder="787-000-0000"
                          value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={Mail} title="Email y web">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Email de contacto</label>
                        <input className={inputCls} placeholder="info@tutaller.com" type="email"
                          value={form.email} onChange={e => set("email", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Sitio web (opcional)</label>
                        <input className={inputCls} placeholder="www.tutaller.com"
                          value={form.website} onChange={e => set("website", e.target.value)} />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={MapPin} title="Dirección" color="emerald">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-white/50 text-xs mb-1 block">Dirección</label>
                        <input className={inputCls} placeholder="Calle Principal #123, Local 2"
                          value={form.address} onChange={e => set("address", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Ciudad</label>
                        <input className={inputCls} placeholder="San Juan"
                          value={form.city} onChange={e => set("city", e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-white/50 text-xs mb-1 block">Estado</label>
                          <select className={inputCls}
                            value={form.state} onChange={e => set("state", e.target.value)}>
                            <option value="PR">PR</option><option value="FL">FL</option>
                            <option value="NY">NY</option><option value="TX">TX</option>
                            <option value="CA">CA</option><option value="NJ">NJ</option>
                            <option value="CT">CT</option><option value="MA">MA</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-white/50 text-xs mb-1 block">ZIP</label>
                          <input className={inputCls} placeholder="00901" maxLength={5}
                            value={form.zip} onChange={e => set("zip", e.target.value.replace(/\D/g,"").slice(0,5))} />
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* ── PASO 3: Políticas y Horario ── */}
              {step === 3 && (
                <div>
                  <SectionCard icon={Clock} title="Horario de operación" color="blue">
                    <div className="space-y-2">
                      {DAYS.map(({ key, label }) => {
                        const day = form.schedule[key];
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleDay(key)}
                              className={`w-12 text-center text-xs font-bold py-1.5 rounded-lg transition-all ${day.open ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-white/5 text-white/30 border border-white/10"}`}
                            >{label}</button>
                            {day.open ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="time" value={day.from} onChange={e => setDayTime(key,"from",e.target.value)}
                                  className="bg-black/30 border border-white/10 text-white text-xs rounded-lg px-2 h-8 focus:outline-none focus:border-cyan-500/40 flex-1" />
                                <span className="text-white/30 text-xs">—</span>
                                <input type="time" value={day.to} onChange={e => setDayTime(key,"to",e.target.value)}
                                  className="bg-black/30 border border-white/10 text-white text-xs rounded-lg px-2 h-8 focus:outline-none focus:border-cyan-500/40 flex-1" />
                              </div>
                            ) : (
                              <span className="text-white/25 text-xs italic flex-1">Cerrado</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>

                  <SectionCard icon={Shield} title="Políticas de servicio" color="orange">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Garantía (días)</label>
                        <select className={inputCls} value={form.warranty_days} onChange={e => set("warranty_days", e.target.value)}>
                          <option value="30">30 días</option>
                          <option value="60">60 días</option>
                          <option value="90">90 días</option>
                          <option value="180">6 meses</option>
                          <option value="365">1 año</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Retención máx.</label>
                        <select className={inputCls} value={form.max_retention_days} onChange={e => set("max_retention_days", e.target.value)}>
                          <option value="30">30 días</option>
                          <option value="60">60 días</option>
                          <option value="90">90 días</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Depósito mín.</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                          <input className={`${inputCls} pl-6`} placeholder="20" type="number" min="0"
                            value={form.deposit_amount} onChange={e => set("deposit_amount", e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Nota en recibos y órdenes de trabajo</label>
                      <textarea
                        className="w-full bg-black/30 border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500/50 placeholder:text-white/20 resize-none"
                        rows={3} value={form.receipt_note}
                        onChange={e => set("receipt_note", e.target.value)}
                        placeholder="Términos y condiciones que aparecerán en tus recibos..." />
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* ── PASO 4: Dashboard Widgets ── */}
              {step === 4 && (
                <div>
                  <SectionCard icon={LayoutDashboard} title="¿Qué quieres ver en tu Dashboard?" color="cyan">
                    <p className="text-white/40 text-xs mb-4">Activa los indicadores que quieres ver al entrar al sistema. Puedes cambiarlos después.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DASHBOARD_WIDGETS.map(w => {
                        const Icon = w.icon;
                        const enabled = dashWidgets[w.key];
                        return (
                          <button key={w.key}
                            type="button"
                            onClick={() => setDashWidgets(prev => ({ ...prev, [w.key]: !prev[w.key] }))}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                              enabled
                                ? 'bg-cyan-500/10 border-cyan-500/30 text-white'
                                : 'bg-white/[0.02] border-white/10 text-white/40 hover:bg-white/5'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${enabled ? 'bg-cyan-500/20' : 'bg-white/5'}`}>
                              <Icon className={`w-3.5 h-3.5 ${enabled ? 'text-cyan-400' : 'text-white/30'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold leading-tight truncate">{w.label}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">{w.desc}</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              enabled ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'
                            }`}>
                              {enabled && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* ── PASO 5: Tu cuenta ── */}
              {step === 5 && (
                <div>
                  {/* Plan actual */}
                  <SectionCard icon={Zap} title="Tu plan actual" color={planData.color}>
                    <div className="flex items-center justify-between bg-black/30 rounded-xl p-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-lg font-black text-${planData.color}-400`}>{planData.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-${planData.color}-500/20 text-${planData.color}-300 border border-${planData.color}-500/30`}>Activo</span>
                        </div>
                        <p className={`text-${planData.color}-300/70 text-sm font-semibold`}>{planData.price}</p>
                      </div>
                      {trialDaysLeft !== null && trialDaysLeft > 0 && (
                        <div className="text-right">
                          <p className="text-yellow-400 text-sm font-bold">{trialDaysLeft} días</p>
                          <p className="text-white/40 text-xs">de prueba restantes</p>
                        </div>
                      )}
                    </div>

                    {/* Slots de usuarios */}
                    <div className="flex items-center gap-3 bg-black/20 rounded-xl p-3">
                      <Users className="w-5 h-5 text-white/40 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/60 text-xs">Usuarios ocupados</span>
                          <span className="text-white text-xs font-bold">
                            {usedSlots} / {maxUsers === 9999 ? "∞" : maxUsers}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${usedSlots >= maxUsers ? "bg-red-500" : "bg-cyan-500"}`}
                            style={{ width: `${Math.min(100, (usedSlots / (maxUsers || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      {usedSlots >= maxUsers && maxUsers !== 9999 && (
                        <span className="text-xs text-orange-400 font-semibold">¡Límite!</span>
                      )}
                    </div>
                    {usedSlots >= maxUsers && maxUsers !== 9999 && (
                      <p className="text-orange-400/80 text-xs mt-2 text-center">
                        Actualiza tu plan para agregar más técnicos/empleados
                      </p>
                    )}
                  </SectionCard>

                  {/* Cambio de PIN */}
                  <SectionCard icon={KeyRound} title="Cambia tu PIN de acceso (opcional)" color="purple">
                    <p className="text-white/40 text-xs mb-3">Tu PIN actual es el que recibiste en el email. Cámbialo por uno que recuerdes fácil.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Nuevo PIN (4 dígitos)</label>
                        <div className="relative">
                          <input
                            type={showPin ? "text" : "password"}
                            inputMode="numeric" maxLength={4}
                            placeholder="••••" value={form.new_pin}
                            onChange={e => set("new_pin", e.target.value.replace(/\D/g,"").slice(0,4))}
                            className={`${inputCls} pr-10 tracking-widest font-mono text-center text-lg`}
                          />
                          <button type="button" onClick={() => setShowPin(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Confirmar PIN</label>
                        <input
                          type={showPin ? "text" : "password"}
                          inputMode="numeric" maxLength={4}
                          placeholder="••••" value={form.confirm_pin}
                          onChange={e => set("confirm_pin", e.target.value.replace(/\D/g,"").slice(0,4))}
                          className={`${inputCls} tracking-widest font-mono text-center text-lg ${
                            form.confirm_pin && form.new_pin !== form.confirm_pin ? "border-red-500/50" :
                            form.confirm_pin && form.new_pin === form.confirm_pin   ? "border-emerald-500/50" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  {/* Resumen */}
                  {form.business_name && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-white text-sm font-bold">{form.business_name}</p>
                        <p className="text-white/40 text-xs">Todo listo — click en "¡Comenzar!" para guardar</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-black/20">
          <button onClick={handleSkip} className="text-white/30 hover:text-white/60 text-sm transition-colors">
            Completar luego
          </button>
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-semibold transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
            )}
            {step < STEPS.length ? (
              <button
                onClick={() => {
                  if (step === 1 && !form.business_name.trim()) {
                    toast.error("El nombre del taller es requerido");
                    return;
                  }
                  setStep(s => s + 1);
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-cyan-500/20"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={loading || !form.business_name.trim()}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-40 text-white text-sm font-black transition-all shadow-lg shadow-emerald-500/20"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> ¡Comenzar!</>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
