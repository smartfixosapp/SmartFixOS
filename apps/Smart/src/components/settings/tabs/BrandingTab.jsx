import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon } from "lucide-react";

const DEFAULT_BRANDING = {
  business_name: "",
  logo_url: "",
  primary_color: "#FF0000",
  secondary_color: "#000000",
  address: "",
  phone: "",
  email: "",
  timezone: "America/Puerto_Rico",
  tax_rate: 0.115,
  currency: "USD",
  date_format: "MM/dd/yyyy",
};

export default function BrandingTab({ user }) {
  const [data, setData] = useState(DEFAULT_BRANDING);
  const [originalData, setOriginalData] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onSave = () => saveData();
    const onRevert = () => setData(originalData);

    window.addEventListener("settings-save", onSave);
    window.addEventListener("settings-revert", onRevert);

    return () => {
      window.removeEventListener("settings-save", onSave);
      window.removeEventListener("settings-revert", onRevert);
    };
  }, [originalData]);

  useEffect(() => {
    const isDirty = JSON.stringify(data) !== JSON.stringify(originalData);
    if (isDirty) {
      window.dispatchEvent(new Event("settings-dirty"));
    }
  }, [data, originalData]);

  const loadData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.branding" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_BRANDING, ...parsed });
        setOriginalData({ ...DEFAULT_BRANDING, ...parsed });
      } else {
        setData(DEFAULT_BRANDING);
        setOriginalData(DEFAULT_BRANDING);
      }
    } catch (e) {
      console.error("Error loading branding:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.branding" });

      const payload = {
        key: "settings.branding",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de branding y negocio"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      // ── Sync to AppSettings so email templates can access branding & business info ──
      try {
        const [brandingRows, mainRows] = await Promise.all([
          base44.entities.AppSettings.filter({ slug: "business-branding" }),
          base44.entities.AppSettings.filter({ slug: "app-main-settings" })
        ]);

        if (brandingRows?.length) {
          await base44.entities.AppSettings.update(brandingRows[0].id, {
            payload: { ...(brandingRows[0].payload || {}), logo_url: data.logo_url || "" }
          });
        } else {
          await base44.entities.AppSettings.create({
            slug: "business-branding",
            payload: { logo_url: data.logo_url || "" }
          });
        }

        const mainUpdate = {
          business_name:    data.business_name || "",
          business_phone:   data.phone         || "",
          business_address: data.address        || "",
          business_email:   data.email          || ""
        };
        if (mainRows?.length) {
          await base44.entities.AppSettings.update(mainRows[0].id, {
            payload: { ...(mainRows[0].payload || {}), ...mainUpdate }
          });
        } else {
          await base44.entities.AppSettings.create({ slug: "app-main-settings", payload: mainUpdate });
        }
      } catch (syncErr) {
        console.warn("Could not sync branding to AppSettings (non-fatal):", syncErr);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.branding",
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role,
        changes: { before: originalData, after: data }
      });

      setOriginalData(data);
      window.dispatchEvent(new Event("settings-clean"));
      window.dispatchEvent(new Event("force-refresh"));

      alert("Configuración guardada correctamente");
    } catch (e) {
      console.error("Error saving branding:", e);
      alert("Error al guardar: " + e.message);
    }
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      if (!result?.file_url) throw new Error("No se recibió URL del archivo");
      setData((prev) => ({ ...prev, logo_url: result.file_url }));
    } catch (e) {
      console.error("Error al subir logo:", e);
      alert("Error al subir logo: " + (e?.message || JSON.stringify(e)));
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="apple-type apple-label-tertiary apple-text-body">Cargando...</div>;

  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Información del Negocio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Nombre del Negocio *</Label>
              <Input
                value={data.business_name}
                onChange={(e) => setData({ ...data, business_name: e.target.value })}
                className="apple-input"
                placeholder="911 SmartFix"
              />
            </div>
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Teléfono</Label>
              <Input
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                className="apple-input tabular-nums"
                placeholder="+1 (787) 123-4567"
              />
            </div>
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Email</Label>
              <Input
                type="email"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                className="apple-input"
                placeholder="info@negocio.com"
              />
            </div>
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Zona Horaria</Label>
              <select
                value={data.timezone}
                onChange={(e) => setData({ ...data, timezone: e.target.value })}
                className="apple-input w-full h-10"
              >
                <option value="America/Puerto_Rico">America/Puerto_Rico (AST)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Chicago">America/Chicago (CST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="apple-label-secondary apple-text-footnote">Dirección</Label>
            <Textarea
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              className="apple-input"
              placeholder="Calle Principal #123, San Juan, PR 00901"
              rows={3}
            />
          </div>

          <div>
            <Label className="apple-label-secondary apple-text-footnote">Logo</Label>
            <div className="flex items-center gap-4">
              {data.logo_url && (
                <img src={data.logo_url} alt="Logo" className="w-20 h-20 object-contain bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm p-2" />
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadLogo}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("logo-upload").click()}
                  disabled={uploading}
                  className="apple-btn apple-btn-secondary apple-press"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Subiendo..." : "Subir Logo"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Configuración Financiera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Impuesto por Defecto (%)</Label>
              <Input
                type="number"
                step="0.001"
                value={data.tax_rate * 100}
                onChange={(e) => setData({ ...data, tax_rate: Number(e.target.value) / 100 })}
                className="apple-input tabular-nums"
              />
              <p className="apple-text-caption1 apple-label-tertiary mt-1">Ejemplo: 11.5 para 11.5%</p>
            </div>
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Moneda</Label>
              <select
                value={data.currency}
                onChange={(e) => setData({ ...data, currency: e.target.value })}
                className="apple-input w-full h-10"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Formato de Fecha</Label>
              <select
                value={data.date_format}
                onChange={(e) => setData({ ...data, date_format: e.target.value })}
                className="apple-input w-full h-10"
              >
                <option value="MM/dd/yyyy">MM/dd/yyyy (US)</option>
                <option value="dd/MM/yyyy">dd/MM/yyyy (EU)</option>
                <option value="yyyy-MM-dd">yyyy-MM-dd (ISO)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Colores de Marca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Color Primario</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={data.primary_color}
                  onChange={(e) => setData({ ...data, primary_color: e.target.value })}
                  className="apple-input w-20 h-10 p-1"
                />
                <Input
                  value={data.primary_color}
                  onChange={(e) => setData({ ...data, primary_color: e.target.value })}
                  className="apple-input flex-1 tabular-nums"
                  placeholder="#FF0000"
                />
              </div>
            </div>
            <div>
              <Label className="apple-label-secondary apple-text-footnote">Color Secundario</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={data.secondary_color}
                  onChange={(e) => setData({ ...data, secondary_color: e.target.value })}
                  className="apple-input w-20 h-10 p-1"
                />
                <Input
                  value={data.secondary_color}
                  onChange={(e) => setData({ ...data, secondary_color: e.target.value })}
                  className="apple-input flex-1 tabular-nums"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
