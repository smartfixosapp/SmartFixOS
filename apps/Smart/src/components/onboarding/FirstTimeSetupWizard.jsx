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
  starter:    { label: "Starter",    color: "blue",    max_users: 999, price: "$14.99/mes" },
  pro:        { label: "Pro",        color: "green",   max_users: 999, price: "$39.99/mes" },
  // Legacy aliases — mismas configuraciones, solo distintos keys
  basic:      { label: "Starter",    color: "blue",    max_users: 999, price: "$14.99/mes" },
  smartfixos: { label: "Starter",    color: "blue",    max_users: 999, price: "$14.99/mes" },
  business:   { label: "Pro",        color: "green",   max_users: 999, price: "$39.99/mes" },
  enterprise: { label: "Pro",        color: "green",   max_users: 999, price: "$39.99/mes" },
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
  const SectionCard = ({ icon: Icon, title, color = "blue", children }) => (
    <div className="apple-card border-0 rounded-apple-md p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-apple-sm flex items-center justify-center bg-apple-${color}/15`}>
          <Icon className={`w-4 h-4 text-apple-${color}`} />
        </div>
        <span className="apple-label-primary apple-text-subheadline font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );

  const Field = ({ label, children, half }) => (
    <div className={half ? "" : "col-span-2"}>
      {label && <label className="apple-label-tertiary apple-text-caption1 mb-1 block">{label}</label>}
      {children}
    </div>
  );

  const inputCls = "apple-input w-full h-10 apple-text-footnote";

  return (
    <div className="apple-type fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 overflow-hidden my-4"
      >
        {/* ── Header ── */}
        <div className="apple-surface px-6 py-5" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-apple-md bg-apple-blue flex items-center justify-center shadow-apple-md flex-shrink-0">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="apple-text-headline apple-label-primary">Configura tu Taller</h2>
              <p className="apple-text-caption1 apple-label-tertiary">Completa la información para comenzar · Puedes editarla después</p>
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
                    className={`apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-full apple-text-caption1 font-semibold transition-all ${
                      active ? "bg-apple-blue/15 text-apple-blue" :
                      done   ? "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary cursor-pointer" :
                               "bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary cursor-not-allowed"}`}
                  >
                    {done ? <CheckCircle2 className="w-3 h-3 text-apple-green" /> : <Icon className="w-3 h-3" />}
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && <div className="flex-1" style={{ borderTop: `0.5px solid ${step > s.id ? 'rgb(var(--apple-blue))' : 'rgb(var(--separator) / 0.29)'}` }} />}
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
                        className="apple-press w-24 h-24 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 hover:bg-apple-blue/12 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden flex-shrink-0 group"
                      >
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 apple-label-tertiary group-hover:text-apple-blue mb-1 transition-colors" />
                            <span className="apple-text-caption2 apple-label-tertiary group-hover:text-apple-blue transition-colors">Subir logo</span>
                          </>
                        )}
                      </div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      <div className="flex-1">
                        <p className="apple-label-secondary apple-text-footnote mb-1">Este logo aparecerá en:</p>
                        <ul className="apple-label-tertiary apple-text-caption1 space-y-0.5">
                          <li>• Emails de bienvenida y notificaciones</li>
                          <li>• Órdenes de trabajo e invoices</li>
                          <li>• Portal del cliente</li>
                        </ul>
                        <p className="apple-label-tertiary apple-text-caption2 mt-2">PNG o JPG · Máx 2MB · Recomendado 200×200px</p>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={Sparkles} title="Color principal" color="yellow">
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.primary_color}
                        onChange={e => set("primary_color", e.target.value)}
                        className="w-12 h-10 rounded-apple-sm cursor-pointer bg-transparent" />
                      <div>
                        <p className="apple-label-secondary apple-text-footnote">Color de tu marca</p>
                        <p className="apple-label-tertiary apple-text-caption1">Se usa en botones y encabezados de documentos</p>
                      </div>
                      <span className="ml-auto apple-label-tertiary apple-text-caption1 font-mono">{form.primary_color}</span>
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
                              className={`apple-press w-12 text-center apple-text-caption1 font-semibold py-1.5 rounded-apple-sm transition-all ${day.open ? "bg-apple-blue/15 text-apple-blue" : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary"}`}
                            >{label}</button>
                            {day.open ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="time" value={day.from} onChange={e => setDayTime(key,"from",e.target.value)}
                                  className="apple-input apple-text-caption1 h-8 tabular-nums flex-1" />
                                <span className="apple-label-tertiary apple-text-caption1">—</span>
                                <input type="time" value={day.to} onChange={e => setDayTime(key,"to",e.target.value)}
                                  className="apple-input apple-text-caption1 h-8 tabular-nums flex-1" />
                              </div>
                            ) : (
                              <span className="apple-label-tertiary apple-text-caption1 italic flex-1">Cerrado</span>
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
                      <label className="apple-label-tertiary apple-text-caption1 mb-1 block">Nota en recibos y órdenes de trabajo</label>
                      <textarea
                        className="apple-input w-full apple-text-caption1 resize-none"
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
                  <SectionCard icon={LayoutDashboard} title="¿Qué quieres ver en tu Dashboard?" color="blue">
                    <p className="apple-label-tertiary apple-text-caption1 mb-4">Activa los indicadores que quieres ver al entrar al sistema. Puedes cambiarlos después.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DASHBOARD_WIDGETS.map(w => {
                        const Icon = w.icon;
                        const enabled = dashWidgets[w.key];
                        return (
                          <button key={w.key}
                            type="button"
                            onClick={() => setDashWidgets(prev => ({ ...prev, [w.key]: !prev[w.key] }))}
                            className={`apple-press flex items-center gap-3 p-3 rounded-apple-sm transition-all text-left ${
                              enabled
                                ? 'bg-apple-blue/12 apple-label-primary'
                                : 'bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary hover:bg-gray-sys5'
                            }`}
                          >
                            <div className={`p-1.5 rounded-apple-xs flex-shrink-0 ${enabled ? 'bg-apple-blue/20' : 'bg-gray-sys5 dark:bg-gray-sys4'}`}>
                              <Icon className={`w-3.5 h-3.5 ${enabled ? 'text-apple-blue' : 'apple-label-tertiary'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="apple-text-caption1 font-semibold leading-tight truncate">{w.label}</p>
                              <p className="apple-text-caption2 apple-label-tertiary mt-0.5">{w.desc}</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                              enabled ? 'bg-apple-blue' : 'bg-gray-sys5 dark:bg-gray-sys4'
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
                    <div className="flex items-center justify-between bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm p-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`apple-text-headline font-semibold text-apple-${planData.color}`}>{planData.label}</span>
                          <span className={`apple-text-caption1 px-2 py-0.5 rounded-full bg-apple-${planData.color}/15 text-apple-${planData.color}`}>Activo</span>
                        </div>
                        <p className={`text-apple-${planData.color} apple-text-footnote font-semibold`}>{planData.price}</p>
                      </div>
                      {trialDaysLeft !== null && trialDaysLeft > 0 && (
                        <div className="text-right">
                          <p className="text-apple-yellow apple-text-footnote font-semibold tabular-nums">{trialDaysLeft} días</p>
                          <p className="apple-label-tertiary apple-text-caption1">de prueba restantes</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm p-3">
                      <Users className="w-5 h-5 apple-label-tertiary flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="apple-label-secondary apple-text-caption1">Usuarios ocupados</span>
                          <span className="apple-label-primary apple-text-caption1 font-semibold tabular-nums">
                            {usedSlots} / {maxUsers === 9999 ? "∞" : maxUsers}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-sys5 dark:bg-gray-sys4 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${usedSlots >= maxUsers ? "bg-apple-red" : "bg-apple-blue"}`}
                            style={{ width: `${Math.min(100, (usedSlots / (maxUsers || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      {usedSlots >= maxUsers && maxUsers !== 9999 && (
                        <span className="apple-text-caption1 text-apple-orange font-semibold">¡Límite!</span>
                      )}
                    </div>
                    {usedSlots >= maxUsers && maxUsers !== 9999 && (
                      <p className="text-apple-orange apple-text-caption1 mt-2 text-center">
                        Actualiza tu plan para agregar más técnicos/empleados
                      </p>
                    )}
                  </SectionCard>

                  {/* Cambio de PIN */}
                  <SectionCard icon={KeyRound} title="Cambia tu PIN de acceso (opcional)" color="purple">
                    <p className="apple-label-tertiary apple-text-caption1 mb-3">Tu PIN actual es el que recibiste en el email. Cámbialo por uno que recuerdes fácil.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="apple-label-tertiary apple-text-caption1 mb-1 block">Nuevo PIN (4 dígitos)</label>
                        <div className="relative">
                          <input
                            type={showPin ? "text" : "password"}
                            inputMode="numeric" maxLength={4}
                            placeholder="••••" value={form.new_pin}
                            onChange={e => set("new_pin", e.target.value.replace(/\D/g,"").slice(0,4))}
                            className={`${inputCls} pr-10 font-mono text-center apple-text-headline tabular-nums`}
                          />
                          <button type="button" onClick={() => setShowPin(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 apple-label-tertiary hover:apple-label-secondary">
                            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="apple-label-tertiary apple-text-caption1 mb-1 block">Confirmar PIN</label>
                        <input
                          type={showPin ? "text" : "password"}
                          inputMode="numeric" maxLength={4}
                          placeholder="••••" value={form.confirm_pin}
                          onChange={e => set("confirm_pin", e.target.value.replace(/\D/g,"").slice(0,4))}
                          className={`${inputCls} font-mono text-center apple-text-headline tabular-nums ${
                            form.confirm_pin && form.new_pin !== form.confirm_pin ? "ring-1 ring-apple-red" :
                            form.confirm_pin && form.new_pin === form.confirm_pin   ? "ring-1 ring-apple-green" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  {form.business_name && (
                    <div className="bg-apple-green/12 rounded-apple-md p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-apple-green flex-shrink-0" />
                      <div>
                        <p className="apple-label-primary apple-text-footnote font-semibold">{form.business_name}</p>
                        <p className="apple-label-tertiary apple-text-caption1">Todo listo — click en "¡Comenzar!" para guardar</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 flex items-center justify-between bg-gray-sys6 dark:bg-gray-sys5" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <button onClick={handleSkip} className="apple-label-tertiary hover:apple-label-secondary apple-text-footnote transition-colors">
            Completar luego
          </button>
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="apple-btn apple-btn-secondary flex items-center gap-1.5 px-4 py-2 rounded-apple-sm apple-text-footnote font-semibold transition-all"
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
                className="apple-btn apple-btn-primary flex items-center gap-1.5 px-5 py-2 rounded-apple-sm apple-text-footnote font-semibold transition-all"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={loading || !form.business_name.trim()}
                className="apple-btn apple-btn-lg flex items-center gap-2 px-6 py-2 rounded-apple-sm bg-apple-green hover:bg-apple-green disabled:opacity-40 text-white apple-text-footnote font-semibold transition-all shadow-apple-md"
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
