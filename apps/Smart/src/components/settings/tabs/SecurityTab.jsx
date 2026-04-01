import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  KeyRound, 
  Clock, 
  History, 
  Eye, 
  AlertTriangle,
  Zap,
  Calculator,
  FileEdit,
  Eraser,
  Undo2,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_SECURITY = {
  pin_length: 4,
  pin_max_attempts: 3,
  pin_lockout_duration: 300,
  pin_expiration_days: 0,
  require_pin_for_delete_order: true,
  require_pin_for_delete_note: false,
  require_pin_for_refund: true,
  require_pin_for_void_sale: true,
  // Nuevas políticas solicitadas
  require_pin_for_discount: true,
  require_pin_for_edit_price: true,
  require_pin_for_edit_completed_order: true,
  require_pin_for_close_cash: true,
  enable_audit_log: true,
  audit_retention_days: 365,
};

const LOCKOUT_OPTIONS = [
  { value: 60, label: "1 minuto" },
  { value: 300, label: "5 minutos" },
  { value: 600, label: "10 minutos" },
  { value: 1800, label: "30 minutos" },
  { value: 3600, label: "1 hora" },
];

export default function SecurityTab({ user }) {
  const [data, setData] = useState(DEFAULT_SECURITY);
  const [originalData, setOriginalData] = useState(DEFAULT_SECURITY);
  const [loading, setLoading] = useState(true);

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
  }, [originalData, data]);

  useEffect(() => {
    const isDirty = JSON.stringify(data) !== JSON.stringify(originalData);
    if (isDirty) {
      window.dispatchEvent(new Event("settings-dirty"));
    } else {
      window.dispatchEvent(new Event("settings-clean"));
    }
  }, [data, originalData]);

  const loadData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.security" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const merged = { ...DEFAULT_SECURITY, ...parsed };
        setData(merged);
        setOriginalData(merged);
      } else {
        setData(DEFAULT_SECURITY);
        setOriginalData(DEFAULT_SECURITY);
      }
    } catch (e) {
      console.error("Error loading security:", e);
      toast.error("Error al cargar configuración de seguridad");
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.security" });
      
      const payload = {
        key: "settings.security",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de seguridad"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.security",
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role,
        changes: { before: originalData, after: data }
      });

      setOriginalData(data);
      window.dispatchEvent(new Event("settings-clean"));
      window.dispatchEvent(new Event("force-refresh"));
      
      toast.success("Seguridad actualizada correctamente", {
        description: "Los cambios se aplicarán inmediatamente en todo el sistema."
      });
    } catch (e) {
      toast.error("Error al guardar: " + e.message);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
    </div>
  );

  const SecuritySettingRow = ({ icon: Icon, color, label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl transition-all duration-200">
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/10", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <Label className="text-sm font-bold text-white block mb-0.5">{label}</Label>
          <p className="text-[11px] text-gray-500 leading-tight max-w-[280px]">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-cyan-500"
      />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shrink-0">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
        </div>
        <div className="text-center md:text-left">
          <h3 className="text-xl font-black text-white tracking-tight">Estado de Seguridad Global</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-xl leading-relaxed">
            Configura los niveles de restricción y auditoría para proteger las operaciones críticas de tu sucursal. Los cambios afectan a todos los terminales POS y dispositivos móbiles de inmediato.
          </p>
        </div>
        <div className="md:ml-auto flex flex-col items-center gap-1 bg-black/40 px-6 py-3 rounded-2xl border border-white/5 shadow-inner">
          <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Salud del Sistema</span>
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500" />
            <span className="text-lg font-black text-white">ÓPTIMA</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Política de PIN */}
        <Card className="bg-white/[0.01] border-white/10 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-cyan-400" />
              Política de PIN de Usuario
            </CardTitle>
            <CardDescription className="text-gray-500">Reglas para el acceso y bloqueo de sesiones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Longitud de PIN</Label>
                <Input
                  type="number"
                  min="4"
                  max="8"
                  value={data.pin_length}
                  onChange={(e) => setData({ ...data, pin_length: Number(e.target.value) })}
                  className="bg-black/40 border-white/10 text-white h-12 focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Intentos Máximos</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={data.pin_max_attempts}
                  onChange={(e) => setData({ ...data, pin_max_attempts: Number(e.target.value) })}
                  className="bg-black/40 border-white/10 text-white h-12 focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                Duración del bloqueo temporal
              </Label>
              <Select
                value={String(data.pin_lockout_duration)}
                onValueChange={(v) => setData({ ...data, pin_lockout_duration: Number(v) })}
              >
                <SelectTrigger className="bg-black/40 border-white/10 text-white h-12">
                  <SelectValue placeholder="Selecciona duración" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {LOCKOUT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl">
              <Label className="text-[10px] font-black uppercase text-amber-300 tracking-widest flex items-center gap-2">
                <History className="w-3.5 h-3.5" />
                Expiración de PIN (Histórico)
              </Label>
              <Input
                type="number"
                min="0"
                value={data.pin_expiration_days}
                onChange={(e) => setData({ ...data, pin_expiration_days: Number(e.target.value) })}
                className="bg-black/20 border-amber-500/20 text-white h-10"
              />
              <p className="text-[10px] text-amber-200/40 italic">0 = PIN Permanente (No recomendado para administradores)</p>
            </div>
          </CardContent>
        </Card>

        {/* Acciones POS */}
        <Card className="bg-white/[0.01] border-white/10 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-400" />
              Restricciones del POS
            </CardTitle>
            <CardDescription className="text-gray-500">Aprobación requerida para transacciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <SecuritySettingRow 
              icon={Calculator}
              color="text-yellow-400"
              label="Aplicar Descuentos"
              description="Solicitar PIN de administrador antes de rebajar el total de una venta."
              checked={data.require_pin_for_discount}
              onChange={(v) => setData({ ...data, require_pin_for_discount: v })}
            />
            <SecuritySettingRow 
              icon={Zap}
              color="text-cyan-400"
              label="Cambiar Precios"
              description="El técnico/vendedor no podrá alterar el precio de lista sin autorización."
              checked={data.require_pin_for_edit_price}
              onChange={(v) => setData({ ...data, require_pin_for_edit_price: v })}
            />
            <SecuritySettingRow 
              icon={DollarSign}
              color="text-emerald-400"
              label="Cierre de Caja"
              description="Evita cierres accidentales o no supervisados de la terminal."
              checked={data.require_pin_for_close_cash}
              onChange={(v) => setData({ ...data, require_pin_for_close_cash: v })}
            />
            <SecuritySettingRow 
              icon={Undo2}
              color="text-red-400"
              label="Reembolsos"
              description="Máximo nivel de seguridad para salida de efectivo del sistema."
              checked={data.require_pin_for_refund}
              onChange={(v) => setData({ ...data, require_pin_for_refund: v })}
            />
          </CardContent>
        </Card>

        {/* Acciones de Órdenes */}
        <Card className="bg-white/[0.01] border-white/10 rounded-2xl overflow-hidden lg:col-span-2">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-purple-400" />
              Protección de Órdenes y Registros
            </CardTitle>
            <CardDescription className="text-gray-500">Integridad de datos históricos y notas</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            <SecuritySettingRow 
              icon={Eraser}
              color="text-red-500"
              label="Eliminar Órdenes"
              description="Impedir el borrado de boletos sin rastro administrativo."
              checked={data.require_pin_for_delete_order}
              onChange={(v) => setData({ ...data, require_pin_for_delete_order: v })}
            />
            <SecuritySettingRow 
              icon={History}
              color="text-indigo-400"
              label="Editar Orden Terminada"
              description="Bloquear cambios en boletos facturados o entregados."
              checked={data.require_pin_for_edit_completed_order}
              onChange={(v) => setData({ ...data, require_pin_for_edit_completed_order: v })}
            />
            <SecuritySettingRow 
              icon={Trash2}
              color="text-orange-400"
              label="Eliminar Notas"
              description="Proteger los recordatorios internos del dashboard."
              checked={data.require_pin_for_delete_note}
              onChange={(v) => setData({ ...data, require_pin_for_delete_note: v })}
            />
            <SecuritySettingRow 
              icon={AlertTriangle}
              color="text-red-400"
              label="Anular Ventas"
              description="Protección crítica contra fraude en la anulación de tickets."
              checked={data.require_pin_for_void_sale}
              onChange={(v) => setData({ ...data, require_pin_for_void_sale: v })}
            />
          </CardContent>
        </Card>

        {/* Auditoría */}
        <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800 rounded-2xl overflow-hidden lg:col-span-2">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="p-8 md:col-span-2 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Registro de Auditoría (Audit Log)</h4>
                    <p className="text-sm text-gray-400">Trazabilidad completa de quién hizo qué y cuándo.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white">Habilitar Auditoría Detallada</p>
                      <p className="text-xs text-gray-500">Registrar cambios en facturación, estado y stock.</p>
                    </div>
                    <Switch
                      checked={data.enable_audit_log}
                      onCheckedChange={(v) => setData({ ...data, enable_audit_log: v })}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Retención de datos históricos</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="30"
                        value={data.audit_retention_days}
                        onChange={(e) => setData({ ...data, audit_retention_days: Number(e.target.value) })}
                        className="bg-black/60 border-white/10 text-white h-12 pr-12"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">Días</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-zinc-800/10 border-l border-white/5 p-8 flex flex-col justify-center items-center text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-zinc-700" />
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Nota Legal</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed italic">
                    "La desactivación de logs de auditoría puede invalidar reportes de responsabilidad legal y fiscal según la normativa RT-30."
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
