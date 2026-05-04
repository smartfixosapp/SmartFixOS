import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const DEVICE_TYPE_OPTIONS = [
  "Celular",
  "Tableta",
  "Laptop",
  "Smartwatch",
  "Consola de juegos",
  "iMac",
  "PC Torre/Desktop",
];

export default function DeviceEditDialog({ open, onClose, order, onUpdate }) {
  const [deviceType, setDeviceType] = useState("");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceColor, setDeviceColor] = useState("");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && order) {
      setDeviceType(order.device_type || "");
      setDeviceBrand(order.device_brand || "");
      setDeviceModel(order.device_model || "");
      setDeviceColor(order.device_color || "");
      setDeviceSerial(order.device_serial || order.device_imei || "");
    }
  }, [open, order]);

  const handleSave = async () => {
    if (!order?.id) return;
    setSaving(true);
    try {
      const before = {
        type: order.device_type || "",
        brand: order.device_brand || "",
        model: order.device_model || "",
        color: order.device_color || "",
        serial: order.device_serial || "",
      };
      const after = {
        type: deviceType.trim(),
        brand: deviceBrand.trim(),
        model: deviceModel.trim(),
        color: deviceColor.trim(),
        serial: deviceSerial.trim(),
      };

      await base44.entities.Order.update(order.id, {
        device_type: after.type || null,
        device_brand: after.brand || null,
        device_model: after.model || null,
        device_color: after.color || null,
        device_serial: after.serial || null,
      });

      const changed = Object.keys(before).filter(k => before[k] !== after[k]);
      if (changed.length) {
        let me = null;
        try { me = await base44.auth.me(); } catch {}
        const labelMap = { type: "Tipo", brand: "Marca", model: "Modelo", color: "Color", serial: "Serial/IMEI" };
        const summary = changed
          .map(k => `${labelMap[k]}: "${before[k] || "—"}" → "${after[k] || "—"}"`)
          .join(" · ");
        try {
          await base44.entities.WorkOrderEvent.create({
            order_id: order.id,
            order_number: order.order_number,
            event_type: "device_updated",
            description: `Dispositivo actualizado — ${summary}`,
            user_name: me?.full_name || me?.email || "Sistema",
            user_id: me?.id || null,
          });
        } catch {}
      }

      toast.success("Dispositivo actualizado");
      onUpdate?.();
      onClose();
    } catch (err) {
      console.error("Error saving device:", err);
      toast.error("Error al guardar dispositivo");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "h-12 rounded-2xl border-white/10 bg-black/35 px-4 text-base font-medium text-white placeholder:text-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-cyan-400/35 focus:ring-cyan-500/20";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl overflow-hidden border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.14),transparent_30%),linear-gradient(180deg,rgba(4,8,22,0.985),rgba(2,6,18,0.99))] p-0 shadow-[0_40px_140px_rgba(0,0,0,0.62)] max-h-[92vh] z-[99999] flex flex-col">
        <DialogHeader className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(6,182,212,0.10),rgba(124,58,237,0.10))] px-6 py-5">
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(124,58,237,0.14))] text-cyan-200">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.34em] text-cyan-200/55">Editar dispositivo</p>
              <h2 className="mt-0.5 text-2xl font-semibold tracking-[-0.02em]">Información del equipo</h2>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6 overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-white/60">Tipo</Label>
            <Input
              list="device-type-options"
              value={deviceType}
              onChange={e => setDeviceType(e.target.value)}
              placeholder="Celular, Laptop, Tableta..."
              className={inputCls}
            />
            <datalist id="device-type-options">
              {DEVICE_TYPE_OPTIONS.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-white/60">Marca</Label>
              <Input
                value={deviceBrand}
                onChange={e => setDeviceBrand(e.target.value)}
                placeholder="Apple, Samsung..."
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-white/60">Modelo</Label>
              <Input
                value={deviceModel}
                onChange={e => setDeviceModel(e.target.value)}
                placeholder="MacBook Pro M2, iPhone 15..."
                className={inputCls}
                autoFocus
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-white/60">Color</Label>
              <Input
                value={deviceColor}
                onChange={e => setDeviceColor(e.target.value)}
                placeholder="Space Gray, Negro..."
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-white/60">Serial / IMEI</Label>
              <Input
                value={deviceSerial}
                onChange={e => setDeviceSerial(e.target.value)}
                placeholder="C02XXXX o IMEI..."
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="h-12 rounded-2xl border border-white/15 bg-white text-base font-semibold text-slate-950 hover:bg-white/90"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-12 rounded-2xl bg-[linear-gradient(90deg,#06b6d4,#7c3aed)] text-base font-semibold text-white shadow-[0_20px_45px_rgba(124,58,237,0.32)] hover:brightness-110"
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
