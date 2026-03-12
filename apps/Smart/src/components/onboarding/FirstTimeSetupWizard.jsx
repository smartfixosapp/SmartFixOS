import React, { useState } from "react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Phone, Mail, MapPin, CheckCircle2, Wrench } from "lucide-react";
import toast from "react-hot-toast";

const SETUP_KEY = "smartfix_setup_complete";

export function isSetupComplete() {
  return localStorage.getItem(SETUP_KEY) === "true";
}

export default function FirstTimeSetupWizard({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    phone: "",
    email: "",
    address: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.business_name.trim()) {
      toast.error("El nombre del negocio es requerido");
      return;
    }
    setLoading(true);
    try {
      const tenantId = localStorage.getItem("smartfix_tenant_id");
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

      // Guardar en SystemConfig
      const { data: existing } = await supabase
        .from("system_config")
        .select("id")
        .eq("key", "settings.branding")
        .eq("tenant_id", tenantId)
        .limit(1);

      if (existing?.length) {
        await supabase.from("system_config")
          .update({ value: brandingValue })
          .eq("id", existing[0].id);
      } else {
        await supabase.from("system_config").insert({
          key: "settings.branding",
          value: brandingValue,
          category: "general",
          description: "Configuración de branding y negocio",
          tenant_id: tenantId,
        });
      }

      // Actualizar nombre en tenant table
      if (tenantId) {
        await supabase.from("tenant")
          .update({ name: form.business_name })
          .eq("id", tenantId);
      }

      localStorage.setItem(SETUP_KEY, "true");
      toast.success("¡Listo! Tu negocio está configurado.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-white/10 px-8 py-7 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">¡Bienvenido a SmartFixOS!</h2>
          <p className="text-sm text-white/50 mt-1">Completa la información de tu taller para empezar</p>
        </div>

        {/* Form */}
        <div className="px-8 py-6 space-y-5">

          {/* Nombre del negocio — OBLIGATORIO */}
          <div className="space-y-1.5">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              Nombre del negocio <span className="text-red-400">*</span>
            </Label>
            <Input
              placeholder="Ej: Master Phone Repair"
              value={form.business_name}
              onChange={e => set("business_name", e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50"
            />
          </div>

          {/* Teléfono */}
          <div className="space-y-1.5">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4 text-cyan-400" />
              Teléfono del negocio
            </Label>
            <Input
              placeholder="787-000-0000"
              value={form.phone}
              onChange={e => set("phone", e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50"
            />
          </div>

          {/* Email de contacto */}
          <div className="space-y-1.5">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              Email de contacto
            </Label>
            <Input
              placeholder="info@tutaller.com"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50"
            />
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Dirección
            </Label>
            <Input
              placeholder="Calle Principal #1, San Juan, PR"
              value={form.address}
              onChange={e => set("address", e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex gap-3">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="flex-1 text-white/40 hover:text-white/70 hover:bg-white/5"
          >
            Completar luego
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !form.business_name.trim()}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Comenzar
              </span>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
