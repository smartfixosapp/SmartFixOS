import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Building2, Globe, Clock, Smartphone, FileText, Palette, Receipt,
  Save, Loader2, Check
} from "lucide-react";

export default function SettingsGeneral({ appConfig, setAppConfig, loading, saveAppConfig }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información del Negocio */}
        <Card className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Building2 className="w-5 h-5 text-cyan-500 theme-light:text-cyan-600" />
              Información del Negocio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Nombre del Negocio *</label>
              <Input
                value={appConfig.business_name}
                onChange={(e) => setAppConfig({ ...appConfig, business_name: e.target.value })}
                placeholder="911 SmartFix"
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Teléfono Principal *</label>
              <Input
                value={appConfig.business_phone}
                onChange={(e) => setAppConfig({ ...appConfig, business_phone: e.target.value })}
                placeholder="(787) 123-4567"
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Email Principal *</label>
              <Input
                value={appConfig.business_email}
                onChange={(e) => setAppConfig({ ...appConfig, business_email: e.target.value })}
                placeholder="contacto@911smartfix.com"
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Dirección Física</label>
              <Input
                value={appConfig.business_address}
                onChange={(e) => setAppConfig({ ...appConfig, business_address: e.target.value })}
                placeholder="123 Calle Principal, San Juan, PR 00901"
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Sitio Web</label>
              <Input
                value={appConfig.website || ""}
                onChange={(e) => setAppConfig({ ...appConfig, website: e.target.value })}
                placeholder="https://www.911smartfix.com"
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
          </CardContent>
        </Card>

        {/* Regional y Moneda */}
        <Card className="bg-gradient-to-br from-emerald-600/10 to-lime-600/10 backdrop-blur-xl border-emerald-500/20 shadow-[0_8px_32px_rgba(16,185,129,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Globe className="w-5 h-5 text-emerald-500 theme-light:text-emerald-600" />
              Regional y Fiscal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">IVU / Impuesto (%)</label>
              <Input
                type="number"
                step="0.1"
                value={appConfig.tax_rate}
                onChange={(e) => setAppConfig({ ...appConfig, tax_rate: parseFloat(e.target.value) })}
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1 theme-light:text-gray-600">Tasa de impuesto aplicada a las ventas</p>
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Moneda</label>
              <select
                value={appConfig.currency}
                onChange={(e) => setAppConfig({ ...appConfig, currency: e.target.value })}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Zona Horaria</label>
              <select
                value={appConfig.timezone}
                onChange={(e) => setAppConfig({ ...appConfig, timezone: e.target.value })}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              >
                <option value="America/Puerto_Rico">Puerto Rico (AST)</option>
                <option value="America/New_York">Nueva York (EST/EDT)</option>
                <option value="America/Los_Angeles">Los Ángeles (PST/PDT)</option>
                <option value="America/Chicago">Chicago (CST/CDT)</option>
              </select>
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Idioma Principal</label>
              <select
                value={appConfig.language}
                onChange={(e) => setAppConfig({ ...appConfig, language: e.target.value })}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Horario de Operación */}
        <Card className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Clock className="w-5 h-5 text-cyan-500 theme-light:text-cyan-600" />
              Horario de Atención
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-300 text-xs mb-1 block theme-light:text-gray-700">Lunes - Viernes</label>
                <Input
                  value={appConfig.hours_weekdays || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, hours_weekdays: e.target.value })}
                  placeholder="9:00 AM - 6:00 PM"
                  className="bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
              <div>
                <label className="text-gray-300 text-xs mb-1 block theme-light:text-gray-700">Sábados</label>
                <Input
                  value={appConfig.hours_saturday || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, hours_saturday: e.target.value })}
                  placeholder="10:00 AM - 4:00 PM"
                  className="bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
              <div>
                <label className="text-gray-300 text-xs mb-1 block theme-light:text-gray-700">Domingos</label>
                <Input
                  value={appConfig.hours_sunday || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, hours_sunday: e.target.value })}
                  placeholder="Cerrado"
                  className="bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
              <div>
                <label className="text-gray-300 text-xs mb-1 block theme-light:text-gray-700">Días Festivos</label>
                <Input
                  value={appConfig.hours_holidays || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, hours_holidays: e.target.value })}
                  placeholder="Cerrado / Especial"
                  className="bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
            </div>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3 mt-3">
              <p className="text-blue-300 text-xs theme-light:text-blue-700">
                💡 Este horario se mostrará en recibos y comunicaciones con clientes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Redes Sociales */}
        <Card className="bg-gradient-to-br from-emerald-600/10 to-lime-600/10 backdrop-blur-xl border-emerald-500/20 shadow-[0_8px_32px_rgba(16,185,129,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Smartphone className="w-5 h-5 text-emerald-500 theme-light:text-emerald-600" />
              Redes Sociales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-gray-300 text-xs mb-1 block theme-light:text-gray-700">WhatsApp Business</label>
              <Input
                value={appConfig.whatsapp || ""}
                onChange={(e) => setAppConfig({ ...appConfig, whatsapp: e.target.value })}
                placeholder="+1 787 123 4567"
                className="bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-xs mb-1 block theme-light:text-gray-700">Facebook</label>
              <Input
                value={appConfig.facebook || ""}
                onChange={(e) => setAppConfig({ ...appConfig, facebook: e.target.value })}
                placeholder="https://facebook.com/911smartfix"
                className="bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-xs mb-1 block theme-light:text-gray-700">Instagram</label>
              <Input
                value={appConfig.instagram || ""}
                onChange={(e) => setAppConfig({ ...appConfig, instagram: e.target.value })}
                placeholder="@911smartfix"
                className="bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-xs mb-1 block theme-light:text-gray-700">Twitter / X</label>
              <Input
                value={appConfig.twitter || ""}
                onChange={(e) => setAppConfig({ ...appConfig, twitter: e.target.value })}
                placeholder="@911smartfix"
                className="bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
          </CardContent>
        </Card>

        {/* Políticas de Negocio */}
        <Card className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.3)] lg:col-span-2 theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <FileText className="w-5 h-5 text-cyan-500 theme-light:text-cyan-600" />
              Políticas y Términos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Política de Garantía</label>
                <textarea
                  value={appConfig.warranty_policy || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, warranty_policy: e.target.value })}
                  placeholder="Ej: 90 días en reparaciones, 30 días en piezas..."
                  rows={4}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm resize-none theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Política de Devoluciones</label>
                <textarea
                  value={appConfig.return_policy || ""}
                  onChange={(e) => setAppConfig({ ...appConfig, return_policy: e.target.value })}
                  placeholder="Ej: 14 días para devoluciones con recibo..."
                  rows={4}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm resize-none theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Términos y Condiciones</label>
              <textarea
                value={appConfig.terms_conditions || ""}
                onChange={(e) => setAppConfig({ ...appConfig, terms_conditions: e.target.value })}
                placeholder="Términos generales del servicio..."
                rows={6}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm resize-none theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1 theme-light:text-gray-600">Se mostrará en órdenes y firma del cliente</p>
            </div>
          </CardContent>
        </Card>

        {/* Branding y Apariencia */}
        <Card className="bg-gradient-to-br from-emerald-600/10 to-lime-600/10 backdrop-blur-xl border-emerald-500/20 shadow-[0_8px_32px_rgba(16,185,129,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Palette className="w-5 h-5 text-emerald-500 theme-light:text-emerald-600" />
              Logo y Marca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">URL del Logo</label>
              <Input
                value={appConfig.logo_url || ""}
                onChange={(e) => setAppConfig({ ...appConfig, logo_url: e.target.value })}
                placeholder="https://..."
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1 theme-light:text-gray-600">Aparecerá en recibos y emails</p>
            </div>
            {appConfig.logo_url && (
              <div className="p-4 bg-black/30 rounded-lg border border-white/10 theme-light:bg-gray-50 theme-light:border-gray-200">
                <p className="text-xs text-gray-400 mb-2 theme-light:text-gray-600">Vista previa:</p>
                <img
                  src={appConfig.logo_url}
                  alt="Logo preview"
                  className="h-16 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Slogan / Tagline</label>
              <Input
                value={appConfig.slogan || ""}
                onChange={(e) => setAppConfig({ ...appConfig, slogan: e.target.value })}
                placeholder="Tu taller de confianza"
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Color Principal (Hex)</label>
              <div className="flex gap-2">
                <Input
                  value={appConfig.primary_color || "#DC2626"}
                  onChange={(e) => setAppConfig({ ...appConfig, primary_color: e.target.value })}
                  placeholder="#DC2626"
                  className="bg-black/40 border-white/15 text-white flex-1 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
                <div
                  className="w-12 h-10 rounded-lg border-2 border-white/20 theme-light:border-gray-300"
                  style={{ backgroundColor: appConfig.primary_color || "#DC2626" }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuración de Recibos */}
        <Card className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Receipt className="w-5 h-5 text-cyan-500 theme-light:text-cyan-600" />
              Recibos y Facturación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Mensaje en Recibos</label>
              <textarea
                value={appConfig.receipt_footer || ""}
                onChange={(e) => setAppConfig({ ...appConfig, receipt_footer: e.target.value })}
                placeholder="¡Gracias por su compra! Garantía de 90 días en reparaciones."
                rows={3}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm resize-none theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Número de Registro Mercantil</label>
              <Input
                value={appConfig.business_registration || ""}
                onChange={(e) => setAppConfig({ ...appConfig, business_registration: e.target.value })}
                placeholder="Ej: 123456789"
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <label className="flex items-center gap-3 p-3 bg-black/30 border border-cyan-500/20 rounded-xl cursor-pointer theme-light:bg-cyan-50 theme-light:border-cyan-300">
              <input
                type="checkbox"
                checked={appConfig.auto_print_receipt !== false}
                onChange={(e) => setAppConfig({ ...appConfig, auto_print_receipt: e.target.checked })}
                className="hidden"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                appConfig.auto_print_receipt ? "bg-cyan-600 border-cyan-600 theme-light:bg-cyan-500 theme-light:border-cyan-500" : "border-gray-500"
              }`}>
                {appConfig.auto_print_receipt && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-white text-sm theme-light:text-gray-900">Imprimir recibo automáticamente</span>
            </label>
          </CardContent>
        </Card>
      </div>

      {/* Botón de Guardar - Con colores del logo */}
      <div className="flex justify-center mt-8">
        <Button
          onClick={saveAppConfig}
          disabled={loading}
          className="bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 px-8 h-12 text-lg shadow-[0_8px_32px_rgba(0,168,232,0.4)] w-full max-w-sm"
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
