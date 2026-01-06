import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Building2, DollarSign, Calendar, Link as LinkIcon, Copy, CheckCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function B2BSettingsPanel({ customer, onUpdate }) {
  const [form, setForm] = useState({
    credit_limit: customer?.credit_limit || 0,
    payment_terms: customer?.payment_terms || "NET-30",
    billing_address: customer?.billing_address || "",
    portal_access_enabled: customer?.portal_access_enabled || false
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const generatePortalToken = () => {
    return `b2b_${customer.id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  };

  const handleEnablePortal = async () => {
    try {
      const token = customer.portal_access_token || generatePortalToken();
      
      await base44.entities.Customer.update(customer.id, {
        portal_access_enabled: true,
        portal_access_token: token
      });

      onUpdate?.();
      toast.success("Portal B2B habilitado");
    } catch (error) {
      console.error("Error enabling portal:", error);
      toast.error("Error al habilitar portal");
    }
  };

  const handleCopyToken = () => {
    if (customer.portal_access_token) {
      navigator.clipboard.writeText(customer.portal_access_token);
      setCopied(true);
      toast.success("Token copiado");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Customer.update(customer.id, form);
      onUpdate?.();
      toast.success("Configuración B2B guardada");
    } catch (error) {
      console.error("Error saving B2B settings:", error);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            Configuración B2B
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Portal Access */}
          <div className="bg-black/40 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-purple-400" />
                  Acceso al Portal B2B
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Permite al cliente ver sus órdenes y facturas
                </p>
              </div>
              <Badge className={
                customer.portal_access_enabled
                  ? "bg-green-600/20 text-green-300 border-green-500/30"
                  : "bg-gray-600/20 text-gray-300 border-gray-500/30"
              }>
                {customer.portal_access_enabled ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            {customer.portal_access_enabled && customer.portal_access_token ? (
              <div className="space-y-2">
                <div className="bg-black/60 rounded-lg p-3 border border-purple-500/20">
                  <p className="text-xs text-gray-400 mb-1">Token de Acceso:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-purple-300 font-mono bg-black/40 px-2 py-1 rounded break-all">
                      {customer.portal_access_token}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCopyToken}
                      className="h-8 w-8 text-purple-400 hover:bg-purple-600/20">
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Comparte este token con el cliente para que acceda al portal
                </p>
              </div>
            ) : (
              <Button
                onClick={handleEnablePortal}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                <LinkIcon className="w-4 h-4 mr-2" />
                Habilitar Portal B2B
              </Button>
            )}
          </div>

          {/* Límite de Crédito */}
          <div>
            <label className="text-xs text-gray-300 mb-1.5 block flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Límite de Crédito
            </label>
            <Input
              type="number"
              step="0.01"
              value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="bg-black/40 border-purple-500/30 text-white" />
          </div>

          {/* Términos de Pago */}
          <div>
            <label className="text-xs text-gray-300 mb-1.5 block flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Términos de Pago
            </label>
            <select
              value={form.payment_terms}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
              className="w-full h-10 px-3 rounded-md bg-black/40 border border-purple-500/30 text-white">
              <option value="Prepaid">Prepago</option>
              <option value="NET-15">NET-15 (15 días)</option>
              <option value="NET-30">NET-30 (30 días)</option>
              <option value="NET-45">NET-45 (45 días)</option>
              <option value="NET-60">NET-60 (60 días)</option>
            </select>
          </div>

          {/* Dirección de Facturación */}
          <div>
            <label className="text-xs text-gray-300 mb-1.5 block">Dirección de Facturación</label>
            <Textarea
              value={form.billing_address}
              onChange={(e) => setForm({ ...form, billing_address: e.target.value })}
              placeholder="Calle, Ciudad, Código Postal..."
              className="bg-black/40 border-purple-500/30 text-white min-h-[80px]" />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600">
            {saving ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
