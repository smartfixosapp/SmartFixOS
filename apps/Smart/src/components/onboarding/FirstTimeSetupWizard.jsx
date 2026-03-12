import React, { useState } from "react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Phone, Mail, MapPin, CheckCircle2, Wrench, KeyRound, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

const SETUP_KEY = "smartfix_setup_complete";

export function isSetupComplete() {
  return localStorage.getItem(SETUP_KEY) === "true";
}

export default function FirstTimeSetupWizard({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    phone: "",
    email: "",
    address: "",
    new_pin: "",
    confirm_pin: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.business_name.trim()) {
      toast.error("El nombre del negocio es requerido");
      return;
    }
    if (form.new_pin && form.new_pin.length !== 4) {
      toast.error("El PIN debe tener exactamente 4 dígitos");
      return;
    }
    if (form.new_pin && form.new_pin !== form.confirm_pin) {
      toast.error("Los PINs no coinciden");
      return;
    }

    setLoading(true);
    try {
      const tenantId = localStorage.getItem("smartfix_tenant_id");

      // Guardar branding en SystemConfig
      const brandingValue = JSON.stringify({
        business_name: form.business_name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        logo_url: "",
        primary_color: "#0891b2",
        secondary_color: "#000000",
        timezone: "America/Puerto_Rico",
        tax_rate: 0.115,
        currency: "USD",
        date_format: "MM/dd/yyyy",
      });

      const { data: existing } = await supabase
        .from("system_config")
        .select("id")
        .eq("key", "settings.branding")
        .eq("tenant_id", tenantId)
        .limit(1);

      if (existing?.length) {
        await supabase.from("system_config").update({ value: brandingValue }).eq("id", existing[0].id);
      } else {
        await supabase.from("system_config").insert({
          key: "settings.branding", value: brandingValue,
          category: "general", description: "Configuración de branding", tenant_id: tenantId,
        });
      }

      // Actualizar nombre en tenant table
      if (tenantId) {
        await supabase.from("tenant").update({ name: form.business_name }).eq("id", tenantId);
      }

      // Cambiar PIN si se ingresó uno nuevo
      if (form.new_pin) {
        const session = localStorage.getItem("employee_session") || localStorage.getItem("911-session");
        if (session) {
          const parsed = JSON.parse(session);
          const employeeId = parsed?.id || parsed?.userId;
          if (employeeId) {
            await supabase.from("app_employee").update({ pin: form.new_pin }).eq("id", employeeId);
            await supabase.from("users").update({ pin: form.new_pin }).eq("id", employeeId);
            // Actualizar sesión local
            const updatedSession = { ...parsed, pin: form.new_pin };
            localStorage.setItem("employee_session", JSON.stringify(updatedSession));
            sessionStorage.setItem("911-session", JSON.stringify(updatedSession));
          }
        }
      }

      localStorage.setItem(SETUP_KEY, "true");
      toast.success("¡Listo! Tu taller está configurado.");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-white/10 px-8 py-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-cyan-500/30">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">¡Bienvenido a SmartFixOS!</h2>
          <p className="text-sm text-white/50 mt-1">Configura tu taller para comenzar</p>
        </div>

        {/* Form */}
        <div className="px-8 py-6 space-y-4">

          {/* Nombre del negocio — OBLIGATORIO */}
          <div className="space-y-1.5">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              Nombre del taller <span className="text-red-400">*</span>
            </Label>
            <Input placeholder="Ej: Master Phone Repair" value={form.business_name}
              onChange={e => set("business_name", e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50" />
          </div>

          {/* Teléfono */}
          <div className="space-y-1.5">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4 text-cyan-400" /> Teléfono
            </Label>
            <Input placeholder="787-000-0000" value={form.phone}
              onChange={e => set("phone", e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50" />
          </div>

          {/* Email de contacto */}
          <div className="space-y-1.5">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" /> Email de contacto
            </Label>
            <Input placeholder="info@tutaller.com" value={form.email}
              onChange={e => set("email", e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50" />
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" /> Dirección
            </Label>
            <Input placeholder="Calle Principal #1, San Juan, PR" value={form.address}
              onChange={e => set("address", e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50" />
          </div>

          {/* Separador */}
          <div className="border-t border-white/10 pt-2">
            <p className="text-xs text-white/40 mb-3 flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5" /> Opcional: cambia tu PIN de acceso ahora
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs">Nuevo PIN (4 dígitos)</Label>
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric" maxLength={4}
                    placeholder="••••" value={form.new_pin}
                    onChange={e => set("new_pin", e.target.value.replace(/\D/g,"").slice(0,4))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50 pr-10 tracking-widest font-mono text-center text-lg" />
                  <button type="button" onClick={() => setShowPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs">Confirmar PIN</Label>
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric" maxLength={4}
                  placeholder="••••" value={form.confirm_pin}
                  onChange={e => set("confirm_pin", e.target.value.replace(/\D/g,"").slice(0,4))}
                  className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50 tracking-widest font-mono text-center text-lg ${form.confirm_pin && form.new_pin !== form.confirm_pin ? "border-red-500/50" : form.confirm_pin && form.new_pin === form.confirm_pin ? "border-emerald-500/50" : ""}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex gap-3">
          <Button variant="ghost" onClick={handleSkip}
            className="flex-1 text-white/40 hover:text-white/70 hover:bg-white/5">
            Completar luego
          </Button>
          <Button onClick={handleSave}
            disabled={loading || !form.business_name.trim()}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Comenzar
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
