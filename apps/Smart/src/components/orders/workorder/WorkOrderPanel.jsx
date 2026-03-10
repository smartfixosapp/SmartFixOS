import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X, PhoneCall, MessageCircle, Mail, Trash2,
  Smartphone, Laptop, Tablet, Watch, Gamepad2, Camera as CameraIcon, Box, Image as ImageIcon, List
} from "lucide-react";
import OrderPhotosGallery from "./OrderPhotosGallery";
import AdminPinPrompt from "../../auth/AdminPinPrompt";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { removeLocalOrder } from "@/components/utils/localOrderCache";

/* ===================== Utils ===================== */
const onlyDigits = (v) => (v || "").replace(/\D+/g, "");
function resolveTypeId(o) {
  const src = [
    o?.device_type, o?.device_subcategory, o?.device_family, o?.device_model, o?.device_brand,
  ].filter(Boolean).join(" ").toLowerCase();
  const has = (k) => src.includes(k);
  if (has("iphone") || has("phone") || has("smartphone") || has("cell") || has("galaxy") || has("pixel")) return "phone";
  if (has("tablet") || has("ipad") || has("surface") || has("galaxy tab")) return "tablet";
  if (has("computer") || has("laptop") || has("notebook") || has("macbook") || has("chromebook") || has("desktop") || has("pc") || has("imac")) return "computer";
  if (has("console") || has("playstation") || has("ps4") || has("ps5") || has("xbox") || has("nintendo") || has("switch") || has("wii")) return "console";
  if (has("watch") || has("reloj")) return "watch";
  if (has("camera") || has("gopro") || has("canon") || has("nikon") || has("dji") || has("drone")) return "camera";
  return "other";
}
function DeviceTypeBadge({ order }) {
  const t = resolveTypeId(order);
  const map = {
    phone: { Icon: Smartphone, label: "Smartphone / iPhone" },
    tablet: { Icon: Tablet, label: "Tablet / iPad" },
    computer: { Icon: Laptop, label: "Laptop / Desktop" },
    watch: { Icon: Watch, label: "Watch" },
    console: { Icon: Gamepad2, label: "Consola" },
    camera: { Icon: CameraIcon, label: "Cámara / Drone" },
    other: { Icon: Box, label: order?.device_type || "Otro" },
  };
  const { Icon, label } = map[t] || map.other;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-[3px] text-[12px] text-gray-200">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

/* ===================== Campos ===================== */
function Field({ label, value, mono, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className={`text-[13px] ${mono ? "font-mono" : "font-medium"} text-white truncate`}>
        {children ?? (value || "—")}
      </div>
    </div>
  );
}

/* Campo especial: teléfono con opciones de llamada / WhatsApp */
function PhoneField({ phoneRaw }) {
  const [open, setOpen] = useState(false);
  const digits = onlyDigits(phoneRaw);
  // Heurística: si tiene 10 dígitos, asumimos código país +1 (PR/US).
  const intl = digits.startsWith("1") ? digits : (digits.length === 10 ? `1${digits}` : digits);
  const telHref = digits ? `tel:+${intl}` : null;
  const waHref = digits ? `https://wa.me/${intl}` : null;

  if (!digits) return <Field label="Teléfono" value="—" />;

  return (
    <div className="relative">
      <Field label="Teléfono">
        <button
          className="text-red-300 hover:text-red-200 underline underline-offset-2"
          onClick={() => setOpen((v) => !v)}
          title="Opciones"
        >
          {phoneRaw}
        </button>
      </Field>
      {open && (
        <div
          className="absolute z-[99] mt-1 rounded-md border border-white/15 bg-[#101012] shadow-lg p-2 grid gap-1 w-40"
          onMouseLeave={() => setOpen(false)}
        >
          <a
            href={telHref || "#"}
            className={`inline-flex items-center gap-2 rounded px-2 py-1 text-[13px] ${telHref ? "hover:bg-white/10 text-white" : "text-gray-500 pointer-events-none"}`}
            onClick={() => setOpen(false)}
          >
            <PhoneCall className="w-4 h-4" /> Llamar
          </a>
          <a
            href={waHref || "#"}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-2 rounded px-2 py-1 text-[13px] ${waHref ? "hover:bg-white/10 text-white" : "text-gray-500 pointer-events-none"}`}
            onClick={() => setOpen(false)}
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

/* Campo especial: email -> mailto */
function EmailField({ email }) {
  if (!email) return <Field label="Email" value="—" />;
  return (
    <Field label="Email">
      <a
        href={`mailto:${email}`}
        className="text-red-300 hover:text-red-200 underline underline-offset-2"
        title="Enviar correo"
      >
        {email}
      </a>
    </Field>
  );
}

/* ===================== Panel principal ===================== */
export default function WorkOrderPanel({ order, onClose, onUpdate, panelVersion = "v4" }) {
  const o = order || {};
  const photos = useMemo(() => o.photos_metadata || o.device_photos || [], [o]);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Mobile detection
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const handleDeleteOrder = async () => {
    setDeleting(true);
    try {
      // Eliminar eventos relacionados (best-effort)
      try {
        const events = await base44.entities.WorkOrderEvent.filter({ order_id: o.id });
        if (Array.isArray(events) && events.length && typeof base44.entities.WorkOrderEvent.delete === "function") {
          await Promise.all(
            events.map((ev) => base44.entities.WorkOrderEvent.delete(ev.id).catch(() => null))
          );
        }
      } catch (eventsError) {
        console.warn("[LegacyWorkOrderPanel] No se pudieron eliminar eventos:", eventsError);
      }

      // Hard delete real de la orden
      await base44.entities.Order.delete(o.id);
      removeLocalOrder(o.id);

      toast.success("Orden eliminada exitosamente");
      onClose();
      
      // Refrescar lista de órdenes
      window.dispatchEvent(new Event('force-refresh'));
      
    } catch (error) {
      console.error("Error eliminando orden:", error);
      toast.error("Error al eliminar la orden");
    } finally {
      setDeleting(false);
      setShowPinPrompt(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[95] flex ${isMobile ? "items-end" : "items-start"} justify-end`} style={{ overflow: "hidden" }}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div className={`relative z-[96] w-full ${isMobile ? "max-w-full rounded-t-3xl" : "max-w-[1020px]"} ${isMobile ? "h-[95dvh]" : "h-full"} bg-[#0F0F12] ${isMobile ? "border-t" : "border-l"} border-white/10 shadow-2xl flex flex-col overflow-hidden`}>
        {/* header */}
        <div className="z-[2] flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-white font-semibold truncate">
              {o.order_number || "SIN #ORDEN"}
            </div>
            <div className="text-[12px] text-gray-400 truncate">
              {(o.device_brand || "—") + " " + (o.device_model || "")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DeviceTypeBadge order={o} />
            <Button 
              variant="outline" 
              className="h-8 px-3 border-red-500/30 text-red-400 hover:bg-red-600/20 hover:border-red-500/50" 
              onClick={() => setShowPinPrompt(true)}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Eliminar
            </Button>
            <Button variant="outline" className="h-8 px-2 border-white/15" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3" style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}>
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="bg-transparent gap-1 border-b border-white/10 rounded-none p-0">
              <TabsTrigger value="summary" className="data-[state=active]:bg-white/10">
                Resumen
              </TabsTrigger>
              <TabsTrigger value="photos" className="data-[state=active]:bg-white/10">
                Fotos <ImageIcon className="w-4 h-4 ml-1" />
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:bg-white/10">
                Tareas <List className="w-4 h-4 ml-1" />
              </TabsTrigger>
              {/* (El tab "Cliente" fue removido; su info está en Resumen) */}
            </TabsList>

            {/* ===== Resumen (incluye Cliente) ===== */}
            <TabsContent value="summary" className="mt-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Bloque principal con info de cliente + equipo */}
                <Card className="p-4 bg-[#111114] border-white/10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Cliente" value={o.customer_name} />
                    <PhoneField phoneRaw={o.customer_phone} />
                    <EmailField email={o.customer_email} />
                    {o.company_name && <Field label="Empresa" value={o.company_name} />}

                    <Field label="Equipo" value={`${o.device_brand || "—"} ${o.device_model || ""}`} />
                    <Field label="Tipo" value={o.device_type || o.device_subcategory || "—"} />
                    <Field label="Serie / IMEI" value={o.device_serial} mono />
                    <Field label="Problema inicial" value={o.initial_problem} />
                    <Field label="Términos aceptados" value={o.terms_accepted ? "Sí" : "No"} />
                  </div>
                </Card>

                {/* Totales / costos si existen */}
                <Card className="p-4 bg-[#111114] border-white/10">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Estimado" value={o.cost_estimate ? `$${Number(o.cost_estimate).toFixed(2)}` : "—"} />
                    <Field label="Saldo" value={o.balance_due ? `$${Number(o.balance_due).toFixed(2)}` : (o.amount_paid ? "$0.00" : "—")} />
                    <Field label="Pagado" value={o.amount_paid ? `$${Number(o.amount_paid).toFixed(2)}` : "—"} />
                    <Field label="Estatus" value={o.status} />
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* ===== Fotos / evidencias ===== */}
            <TabsContent value="photos" className="mt-3">
              <Card className="p-4 bg-[#111114] border-white/10">
                <OrderPhotosGallery photos={photos} />
              </Card>
            </TabsContent>

            {/* ===== Tareas (placeholder; no lo tocamos) ===== */}
            <TabsContent value="tasks" className="mt-3">
              <Card className="p-4 bg-[#111114] border-white/10">
                <div className="text-sm text-gray-400">
                  Aquí van las tareas/diagnóstico (sin cambios estructurales).
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* PIN Prompt para eliminar */}
      {showPinPrompt && (
        <AdminPinPrompt
          onSuccess={handleDeleteOrder}
          onCancel={() => setShowPinPrompt(false)}
        />
      )}
    </div>
  );
}
