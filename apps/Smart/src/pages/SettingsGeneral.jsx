import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Building2, Globe, Clock, Smartphone, FileText, Palette, Receipt,
  Save, Loader2, Check, Upload, Image as ImageIcon
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function SettingsGeneral({ appConfig, setAppConfig, loading, saveAppConfig }) {
  const [uploading, setUploading] = useState(false);

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAppConfig({ ...appConfig, logo_url: file_url });
      toast.success("Logo subido correctamente");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Error al subir el logo");
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información del Negocio */}
        <Card className="apple-card">
          <CardHeader>
            <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-blue/15">
                <Building2 className="w-4 h-4 text-apple-blue" />
              </span>
              Información del Negocio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Nombre del Negocio *</label>
              <Input
                value={appConfig.business_name}
                onChange={(e) => setAppConfig({ ...appConfig, business_name: e.target.value })}
                placeholder="911 SmartFix"
                className="apple-input"
              />
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Teléfono Principal *</label>
              <Input
                value={appConfig.business_phone}
                onChange={(e) => setAppConfig({ ...appConfig, business_phone: e.target.value })}
                placeholder="(787) 123-4567"
                className="apple-input tabular-nums"
              />
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Email Principal *</label>
              <Input
                value={appConfig.business_email}
                onChange={(e) => setAppConfig({ ...appConfig, business_email: e.target.value })}
                placeholder="contacto@911smartfix.com"
                className="apple-input"
              />
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Dirección Física</label>
              <Input
                value={appConfig.business_address}
                onChange={(e) => setAppConfig({ ...appConfig, business_address: e.target.value })}
                placeholder="123 Calle Principal, San Juan, PR 00901"
                className="apple-input"
              />
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Sitio Web</label>
              <Input
                value={appConfig.website || ""}
                onChange={(e) => setAppConfig({ ...appConfig, website: e.target.value })}
                placeholder="https://www.911smartfix.com"
                className="apple-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Regional y Moneda */}
        <Card className="apple-card">
          <CardHeader>
            <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-green/15">
                <Globe className="w-4 h-4 text-apple-green" />
              </span>
              Regional y Fiscal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 apple-surface-elevated rounded-apple-lg mb-4">
              <div>
                <label className="apple-text-subheadline apple-label-primary">Cobrar Impuestos</label>
                <p className="apple-text-caption1 apple-label-secondary">Habilitar cálculo de IVU en ventas</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={appConfig.tax_enabled !== false}
                  onChange={(e) => setAppConfig({ ...appConfig, tax_enabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-sys6 dark:bg-gray-sys5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-apple-green"></div>
              </label>
            </div>

            {(appConfig.tax_enabled !== false) && (
              <div>
                <label className="apple-text-subheadline apple-label-secondary mb-2 block">Tasa de Impuesto (%)</label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={appConfig.tax_rate}
                    onChange={(e) => setAppConfig({ ...appConfig, tax_rate: parseFloat(e.target.value) })}
                    className="apple-input pr-8 tabular-nums"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 apple-label-tertiary">%</span>
                </div>
              </div>
            )}
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Moneda</label>
              <select
                value={appConfig.currency}
                onChange={(e) => setAppConfig({ ...appConfig, currency: e.target.value })}
                className="apple-input w-full"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Zona Horaria</label>
              <select
                value={appConfig.timezone}
                onChange={(e) => setAppConfig({ ...appConfig, timezone: e.target.value })}
                className="apple-input w-full"
              >
                <option value="America/Puerto_Rico">Puerto Rico (AST)</option>
                <option value="America/New_York">Nueva York (EST/EDT)</option>
                <option value="America/Los_Angeles">Los Ángeles (PST/PDT)</option>
                <option value="America/Chicago">Chicago (CST/CDT)</option>
              </select>
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Idioma Principal</label>
              <select
                value={appConfig.language}
                onChange={(e) => setAppConfig({ ...appConfig, language: e.target.value })}
                className="apple-input w-full"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Horario de Operación */}
        <Card className="apple-card">
          <CardHeader>
            <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-blue/15">
                <Clock className="w-4 h-4 text-apple-blue" />
              </span>
              Horario de Atención
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-1 block">Lunes - Viernes</label>
                <Input
                  value={appConfig.hours_weekdays || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, hours_weekdays: e.target.value })}
                  placeholder="9:00 AM - 6:00 PM"
                  className="apple-input tabular-nums"
                />
              </div>
              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-1 block">Sábados</label>
                <Input
                  value={appConfig.hours_saturday || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, hours_saturday: e.target.value })}
                  placeholder="10:00 AM - 4:00 PM"
                  className="apple-input tabular-nums"
                />
              </div>
              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-1 block">Domingos</label>
                <Input
                  value={appConfig.hours_sunday || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, hours_sunday: e.target.value })}
                  placeholder="Cerrado"
                  className="apple-input"
                />
              </div>
              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-1 block">Días Festivos</label>
                <Input
                  value={appConfig.hours_holidays || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, hours_holidays: e.target.value })}
                  placeholder="Cerrado / Especial"
                  className="apple-input"
                />
              </div>
            </div>
            <div className="bg-apple-blue/12 rounded-apple-md p-3 mt-3">
              <p className="apple-text-caption1 text-apple-blue">
                💡 Este horario se mostrará en recibos y comunicaciones con clientes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Redes Sociales */}
        <Card className="apple-card">
          <CardHeader>
            <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-green/15">
                <Smartphone className="w-4 h-4 text-apple-green" />
              </span>
              Redes Sociales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="apple-text-caption1 apple-label-secondary mb-1 block">WhatsApp Business</label>
              <Input
                value={appConfig.whatsapp || ""}
                onChange={(e) => setAppConfig({ ...appConfig, whatsapp: e.target.value })}
                placeholder="+1 787 123 4567"
                className="apple-input tabular-nums"
              />
            </div>
            <div>
              <label className="apple-text-caption1 apple-label-secondary mb-1 block">Facebook</label>
              <Input
                value={appConfig.facebook || ""}
                onChange={(e) => setAppConfig({ ...appConfig, facebook: e.target.value })}
                placeholder="https://facebook.com/911smartfix"
                className="apple-input"
              />
            </div>
            <div>
              <label className="apple-text-caption1 apple-label-secondary mb-1 block">Instagram</label>
              <Input
                value={appConfig.instagram || ""}
                onChange={(e) => setAppConfig({ ...appConfig, instagram: e.target.value })}
                placeholder="@911smartfix"
                className="apple-input"
              />
            </div>
            <div>
              <label className="apple-text-caption1 apple-label-secondary mb-1 block">Twitter / X</label>
              <Input
                value={appConfig.twitter || ""}
                onChange={(e) => setAppConfig({ ...appConfig, twitter: e.target.value })}
                placeholder="@911smartfix"
                className="apple-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Políticas de Negocio */}
        <Card className="apple-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-blue/15">
                <FileText className="w-4 h-4 text-apple-blue" />
              </span>
              Políticas y Términos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="apple-text-subheadline apple-label-secondary mb-2 block">Política de Garantía</label>
                <textarea
                  value={appConfig.warranty_policy || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, warranty_policy: e.target.value })}
                  placeholder="Ej: 90 días en reparaciones, 30 días en piezas..."
                  rows={4}
                  className="apple-input w-full resize-none"
                />
              </div>
              <div>
                <label className="apple-text-subheadline apple-label-secondary mb-2 block">Política de Devoluciones</label>
                <textarea
                  value={appConfig.return_policy || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, return_policy: e.target.value })}
                  placeholder="Ej: 14 días para devoluciones con recibo..."
                  rows={4}
                  className="apple-input w-full resize-none"
                />
              </div>
            </div>

            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Términos y Condiciones</label>
              <textarea
                value={appConfig.terms_conditions || ""}
                onChange={(e) => setAppConfig({ ...appConfig, terms_conditions: e.target.value })}
                placeholder="Términos generales del servicio..."
                rows={6}
                className="apple-input w-full resize-none"
              />
              <p className="apple-text-caption1 apple-label-tertiary mt-1">Se mostrará en órdenes y firma del cliente</p>
            </div>
          </CardContent>
        </Card>

        {/* Branding y Apariencia */}
        <Card className="apple-card">
          <CardHeader>
            <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-green/15">
                <Palette className="w-4 h-4 text-apple-green" />
              </span>
              Logo y Marca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Logo del Negocio</label>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <Input
                    value={appConfig.logo_url || ""}
                    onChange={(e) => setAppConfig({ ...appConfig, logo_url: e.target.value })}
                    placeholder="https://... o subir archivo"
                    className="apple-input mb-2"
                  />
                  <div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadLogo}
                    />
                    <Button
                      disabled={uploading}
                      onClick={() => document.getElementById("logo-upload").click()}
                      className="apple-btn apple-btn-tinted"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {uploading ? "Subiendo..." : "Subir Imagen"}
                    </Button>
                  </div>
                </div>

                {(appConfig.logo_url) && (
                  <div className="w-24 h-24 apple-surface-elevated rounded-apple-md flex items-center justify-center p-2">
                    <img
                      src={appConfig.logo_url}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Slogan / Tagline</label>
              <Input
                value={appConfig.slogan || ""}
                onChange={(e) => setAppConfig({ ...appConfig, slogan: e.target.value })}
                placeholder="Tu taller de confianza"
                className="apple-input"
              />
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Color Principal (Hex)</label>
              <div className="flex gap-2">
                <Input
                  value={appConfig.primary_color || "#DC2626"}
                  onChange={(e) => setAppConfig({ ...appConfig, primary_color: e.target.value })}
                  placeholder="#DC2626"
                  className="apple-input flex-1 tabular-nums"
                />
                <div
                  className="w-12 h-10 rounded-apple-md"
                  style={{
                    backgroundColor: appConfig.primary_color || "#DC2626",
                    border: "0.5px solid rgb(var(--separator) / 0.29)"
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuración de Recibos */}
        <Card className="apple-card">
          <CardHeader>
            <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-blue/15">
                <Receipt className="w-4 h-4 text-apple-blue" />
              </span>
              Recibos y Facturación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Mensaje en Recibos</label>
              <textarea
                value={appConfig.receipt_footer || ""}
                onChange={(e) => setAppConfig({ ...appConfig, receipt_footer: e.target.value })}
                placeholder="¡Gracias por su compra! Garantía de 90 días en reparaciones."
                rows={3}
                className="apple-input w-full resize-none"
              />
            </div>
            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-2 block">Número de Registro Mercantil</label>
              <Input
                value={appConfig.business_registration || ""}
                onChange={(e) => setAppConfig({ ...appConfig, business_registration: e.target.value })}
                placeholder="Ej: 123456789"
                className="apple-input tabular-nums"
              />
            </div>
            <label className="flex items-center gap-3 p-3 apple-surface-elevated rounded-apple-lg cursor-pointer apple-press">
              <input
                type="checkbox"
                checked={appConfig.auto_print_receipt !== false}
                onChange={(e) => setAppConfig({ ...appConfig, auto_print_receipt: e.target.checked })}
                className="hidden"
              />
              <div className={`w-5 h-5 rounded-apple-xs flex items-center justify-center ${
                appConfig.auto_print_receipt ? "bg-apple-blue" : "bg-gray-sys6 dark:bg-gray-sys5"
              }`}>
                {appConfig.auto_print_receipt && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="apple-text-subheadline apple-label-primary">Imprimir recibo automáticamente</span>
            </label>
          </CardContent>
        </Card>
      </div>

      {/* Botón de Guardar */}
      <div className="flex justify-center mt-8">
        <Button
          onClick={saveAppConfig}
          disabled={loading}
          className="apple-btn apple-btn-primary apple-btn-lg w-full max-w-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Guardar Configuración General
            </>
          )}
        </Button>
      </div>
    </>
  );
}
