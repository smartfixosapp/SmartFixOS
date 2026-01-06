import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  X, PhoneCall, MessageCircle, Eye, EyeOff, Trash2,
  Smartphone, Laptop, Tablet, Watch, Gamepad2, Camera as CameraIcon, Box, Image as ImageIcon, List,
  CheckCircle2, PackageOpen, Pin, ActivitySquare, Plus, Minus, Search, Factory, RefreshCw, Check, ShoppingCart, DollarSign, AlertCircle,
  ClipboardList, Shield, MessageSquare, Link, Loader2, Download, Grid3x3, Lock, FileText, Hash, Printer } from
"lucide-react";
import OrderPhotosGallery from "../orders/OrderPhotosGallery";
import { ORDER_STATUSES, getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";
import NotificationService from "../notifications/NotificationService";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { base44 } from "@/api/base44Client";
import UniversalPrintDialog from "../printing/UniversalPrintDialog";
import { LinkifiedText } from "@/components/utils/linkify";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKeyboardScrollIntoView } from "@/components/utils/KeyboardAwareLayout";
import { toast } from 'react-hot-toast';
import AddItemModal from './AddItemModal';
import { createStatusChangeEmail, getBusinessInfo } from "@/components/utils/emailTemplates";
import PrintDialog from "../printing/PrintDialog";
import { downloadWorkOrderPDF } from "../invoice/WorkOrderPDFGenerator";
import SecurityEditDialog from "./SecurityEditDialog";
import AdminAuthGate from "../users/AdminAuthGate";
import { dataClient } from "@/components/api/dataClient";
import PatternDisplay from "@/components/security/PatternDisplay";

// ✅ Función helper para validar y normalizar URLs
function normalizeAndValidateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  let url = rawUrl.trim();

  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (/^www\./i.test(url)) {
    return `https://${url}`;
  }

  if (url.includes('.') && !url.startsWith('/')) {
    return `https://${url}`;
  }

  return null;
}

// ✅ Función helper para detectar y normalizar URLs de un texto
function detectAndNormalizeUrls(text) {
  if (!text || typeof text !== 'string') return [];

  // Regex to detect URLs (http/https optional, www. optional, domain, path)
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;
  const matches = text.match(urlRegex) || [];

  return matches.map((url) => {
    let normalized = url.trim();
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
    }
    return {
      original: url,
      normalized: normalized,
      domain: normalized.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] // Extract domain for label
    };
  });
}

function Lightbox({ open, items, index, onClose, onMove }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onMove(index - 1);
      if (e.key === "ArrowRight" && index < items.length - 1) onMove(index + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, index, items.length, onClose, onMove]);

  if (!open || !items.length) return null;

  const current = items[index];
  const isVideo = current?.type === "video" || current?.mime?.startsWith("video");

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
        <X className="w-6 h-6" />
      </button>

      {index > 0 &&
      <button
        onClick={(e) => {e.stopPropagation();onMove(index - 1);}}
        className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          ←
        </button>
      }

      {index < items.length - 1 &&
      <button
        onClick={(e) => {e.stopPropagation();onMove(index + 1);}}
        className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          →
        </button>
      }

      <div className="max-w-6xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
        {isVideo ?
        <video
          src={current.publicUrl || current.thumbUrl}
          controls
          autoPlay
          className="max-w-full max-h-[80vh] rounded-lg" /> :


        <img
          src={current.publicUrl || current.thumbUrl}
          alt={current.filename || "Foto"}
          className="max-w-full max-h-[80vh] rounded-lg object-contain" />

        }
        <p className="text-white text-center mt-3 text-sm">
          {index + 1} / {items.length}
          {current.filename && ` - ${current.filename}`}
        </p>
      </div>
    </div>);

}

const EVENT_CACHE_DURATION = 30 * 1000;

function getCachedEvents(orderId) {
  try {
    const key = `wo_events_${orderId}`;
    const tsKey = `wo_events_ts_${orderId}`;
    const timestamp = localStorage.getItem(tsKey);

    if (!timestamp) return null;

    const age = Date.now() - parseInt(timestamp);
    if (age > EVENT_CACHE_DURATION) {
      localStorage.removeItem(key);
      localStorage.removeItem(tsKey);
      return null;
    }

    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setCachedEvents(orderId, events) {
  try {
    const key = `wo_events_${orderId}`;
    const tsKey = `wo_events_ts_${orderId}`;
    localStorage.setItem(key, JSON.stringify(events));
    localStorage.setItem(tsKey, String(Date.now()));
  } catch (e) {
    console.warn('Event cache storage failed:', e);
  }
}

function clearEventCache(orderId) {
  try {
    const key = `wo_events_${orderId}`;
    const tsKey = `wo_events_ts_${orderId}`;
    localStorage.removeItem(key);
    localStorage.removeItem(tsKey);
  } catch {}
}

const onlyDigits = (v) => (v || "").replace(/\D+/g, "");
function safeAtob(v) {try {return atob(v || "");} catch {return "";}}
function resolveTypeId(o) {
  const src = [
  o?.device_type, o?.device_subcategory, o?.device_family, o?.device_model, o?.device_brand].
  filter(Boolean).join(" ").toLowerCase();
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
    other: { Icon: Box, label: order?.device_type || "Otro" }
  };
  const { Icon, label } = map[t] || map.other;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-[3px] text-[12px] text-gray-200">
      <Icon className="w-3 h-3" />
      {label}
    </span>);

}

function Field({ label, value, mono, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-gray-400 theme-light:text-gray-600">{label}</div>
      <div className={`text-[13px] ${mono ? "font-mono" : "font-medium"} text-white truncate theme-light:text-gray-900`}>
        {children ?? (value || "—")}
      </div>
    </div>);

}

function PhoneField({ phoneRaw }) {
  const [open, setOpen] = useState(false);
  const digits = onlyDigits(phoneRaw);
  const intl = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
  const telHref = digits ? `tel:+${intl}` : null;
  const waHref = digits ? `https://wa.me/${intl}` : null;

  if (!digits) return <Field label="Teléfono" value="—" />;

  return (
    <div className="relative">
      <Field label="Teléfono">
        <button
          className="text-red-300 hover:text-red-200 underline underline-offset-2 theme-light:text-red-600 theme-light:hover:text-red-700"
          onClick={() => setOpen((v) => !v)}
          title="Opciones">

          {phoneRaw}
        </button>
      </Field>
      {open &&
      <div
        className="absolute z-[99] mt-1 rounded-md border border-white/15 bg-[#101012] shadow-lg p-2 grid gap-1 w-40 theme-light:bg-white theme-light:border-gray-200"
        onMouseLeave={() => setOpen(false)}>

          <a
          href={telHref || "#"}
          className={`inline-flex items-center gap-2 rounded px-2 py-1 text-[13px] ${telHref ? "hover:bg-white/10 text-white theme-light:hover:bg-gray-100 theme-light:text-gray-900" : "text-gray-500 pointer-events-none"}`}
          onClick={() => setOpen(false)}>

            <PhoneCall className="w-4 h-4" /> Llamar
          </a>
          <a
          href={waHref || "#"}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-2 rounded px-2 py-1 text-[13px] ${waHref ? "hover:bg-white/10 text-white theme-light:hover:bg-gray-100 theme-light:text-gray-900" : "text-gray-500 pointer-events-none"}`}
          onClick={() => setOpen(false)}>

            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        </div>
      }
    </div>);

}

function EmailField({ email }) {
  if (!email) return <Field label="Email" value="—" />;
  return (
    <Field label="Email">
      <a
        href={`mailto:${email}`}
        className="text-red-300 hover:text-red-200 underline underline-offset-2 theme-light:text-red-600 theme-light:hover:text-red-700"
        title="Enviar correo">

        {email}
      </a>
    </Field>);

}

function PinPadModal({ open, onClose, onSubmit, title = "PIN administrativo" }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {if (open) {setPin("");setError("");}}, [open]);

  if (!open) return null;

  const push = (d) => {if (pin.length < 6) setPin(pin + d);};
  const back = () => setPin((p) => p.slice(0, -1));
  const ok = async () => {
    setError("");
    try {
      await onSubmit?.(pin);
    } catch (e) {
      setError(e?.message || "PIN incorrecto");
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <Card className="w-full max-w-xs bg-[#111114] border-white/10 p-4">
          <h3 className="text-white font-semibold mb-1">{title}</h3>
          <p className="text-[12px] text-gray-400 mb-3">Ingresa el PIN administrativo para continuar</p>

          <div className="h-10 grid place-items-center mb-3">
            <div className="font-mono tracking-[6px] text-lg text-white">{pin.replace(/./g, "•") || "••••"}</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "←", 0, "OK"].map((k) =>
            <button
              key={k}
              className={`h-10 rounded-md border border-white/15 ${k === "OK" ? "bg-red-600 text-white" : "bg-black/40 text-gray-200 hover:bg-white/10"}`}
              onClick={() => {
                if (k === "←") back();else
                if (k === "OK") ok();else
                push(String(k));
              }}>
                {k}
              </button>
            )}
          </div>

          {error && <div className="mt-3 text-[12px] text-red-300">{error}</div>}

          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" className="h-8 px-3 border-white/15" onClick={onClose}>Cancelar</Button>
            <Button className="h-8 px-3 bg-red-600 hover:bg-red-700" onClick={ok}>Confirmar</Button>
          </div>
        </Card>
      </div>
    </div>);

}

function WaitingPartsModal({ open, onClose, onSave }) {
  const [supplier, setSupplier] = useState("");
  const [tracking, setTracking] = useState("");
  const [partName, setPartName] = useState("");
  const [deviceLocation, setDeviceLocation] = useState(""); // ✅ NUEVO
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setSupplier("");
      setTracking("");
      setPartName("");
      setDeviceLocation(""); // ✅ NUEVO
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    if (!supplier.trim() && !tracking.trim() && !partName.trim()) {
      setErr("Indica al menos el suplidor, tracking o nombre de pieza.");
      return;
    }

    // ✅ VALIDACIÓN OBLIGATORIA
    if (!deviceLocation) {
      setErr("Debes indicar dónde está el equipo (obligatorio).");
      return;
    }

    await onSave?.({
      supplier: supplier.trim(),
      tracking: tracking.trim(),
      partName: partName.trim(),
      deviceLocation: deviceLocation // ✅ NUEVO
    });
  };

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Card className="w-full max-w-md bg-[#111114] border-white/10 p-4 sm:p-6 my-8 max-h-[90vh] overflow-y-auto theme-light:bg-white theme-light:border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <PackageOpen className="w-5 h-5 text-red-400 theme-light:text-red-600" />
            <h3 className="text-white font-semibold text-lg theme-light:text-gray-900">Esperando piezas</h3>
          </div>
          <p className="text-[12px] text-gray-400 mb-4 theme-light:text-gray-600">Registra información sobre las piezas necesarias.</p>

          <div className="space-y-4">
            {/* ✅ UBICACIÓN DEL EQUIPO - OBLIGATORIO */}
            <div className="bg-amber-600/10 border-2 border-amber-500/40 rounded-xl p-4 theme-light:bg-amber-50 theme-light:border-amber-300">
              <div className="text-[13px] text-amber-300 mb-3 font-bold flex items-center gap-2 theme-light:text-amber-800">
                <AlertCircle className="w-4 h-4" />
                ¿Dónde está el equipo? *
              </div>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                deviceLocation === "taller" ?
                "bg-cyan-600/30 border-cyan-500/60 theme-light:bg-cyan-100 theme-light:border-cyan-400" :
                "bg-black/20 border-white/10 hover:border-white/30 theme-light:bg-white theme-light:border-gray-300 theme-light:hover:border-gray-400"}`
                }>
                  <input
                    type="radio"
                    name="device-location"
                    value="taller"
                    checked={deviceLocation === "taller"}
                    onChange={(e) => setDeviceLocation(e.target.value)}
                    className="hidden" />

                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  deviceLocation === "taller" ?
                  "border-cyan-500 bg-cyan-500 theme-light:border-cyan-600 theme-light:bg-cyan-600" :
                  "border-gray-500 theme-light:border-gray-400"}`
                  }>
                    {deviceLocation === "taller" &&
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                    }
                  </div>
                  <div className="flex-1">
                    <span className="text-white font-semibold text-sm theme-light:text-gray-900">
                      🏢 En el taller
                    </span>
                    <p className="text-xs text-gray-400 theme-light:text-gray-600">El equipo permanece aquí mientras llegan las piezas</p>
                  </div>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                deviceLocation === "cliente" ?
                "bg-emerald-600/30 border-emerald-500/60 theme-light:bg-emerald-100 theme-light:border-emerald-400" :
                "bg-black/20 border-white/10 hover:border-white/30 theme-light:bg-white theme-light:border-gray-300 theme-light:hover:border-gray-400"}`
                }>
                  <input
                    type="radio"
                    name="device-location"
                    value="cliente"
                    checked={deviceLocation === "cliente"}
                    onChange={(e) => setDeviceLocation(e.target.value)}
                    className="hidden" />

                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  deviceLocation === "cliente" ?
                  "border-emerald-500 bg-emerald-500 theme-light:border-emerald-600 theme-light:bg-emerald-600" :
                  "border-gray-500 theme-light:border-gray-400"}`
                  }>
                    {deviceLocation === "cliente" &&
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                    }
                  </div>
                  <div className="flex-1">
                    <span className="text-white font-semibold text-sm theme-light:text-gray-900">
                      👤 Lo tiene el cliente
                    </span>
                    <p className="text-xs text-gray-400 theme-light:text-gray-600">El cliente se llevó el equipo temporalmente</p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <div className="text-[12px] text-gray-300 mb-1 font-medium theme-light:text-gray-700">Nombre de la(s) Pieza(s) *</div>
              <Input
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="Ej. Pantalla LCD, Batería, Puerto de carga..."
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

            </div>

            <div>
              <div className="text-[12px] text-gray-300 mb-1 theme-light:text-gray-700">Suplidor</div>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ej. Parts4u, Amazon..."
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

            </div>

            <div>
              <div className="text-[12px] text-gray-300 mb-1 theme-light:text-gray-700">Tracking</div>
              <Input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Ej. 1Z999AA..."
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

            </div>
          </div>

          {err && <div className="mt-3 text-[12px] text-amber-300 theme-light:text-amber-700">{err}</div>}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="h-9 px-4 border-white/15 theme-light:border-gray-300" onClick={onClose}>Cancelar</Button>
            <Button className="h-9 px-4 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700" onClick={save}>Guardar</Button>
          </div>
        </Card>
      </div>
    </div>);

}

function ExternalShopModal({ open, onClose, onSave }) {
  const [shop, setShop] = useState("");
  const [work, setWork] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setShop("");
      setWork("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    if (!shop.trim() && !work.trim()) {
      setErr("Indica el taller y/o el trabajo realizado (al menos uno).");
      return;
    }
    await onSave?.({ shop: shop.trim(), work: work.trim() });
  };

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Card className="w-full max-w-md bg-[#111114] border-white/10 p-4 sm:p-6 my-8 max-h-[90vh] overflow-y-auto theme-light:bg-white theme-light:border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Factory className="w-5 h-5 text-red-400 theme-light:text-red-600" />
            <h3 className="text-white font-semibold text-lg theme-light:text-gray-900">Taller externo</h3>
          </div>
          <p className="text-[12px] text-gray-400 mb-4 theme-light:text-gray-600">Registra a qué taller se envía y qué se le realizará.</p>

          <div className="space-y-3">
            <div>
              <div className="text-[12px] text-gray-300 mb-1 font-medium theme-light:text-gray-700">Taller</div>
              <Input
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                placeholder="Ej. MicroSolderPro"
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

            </div>
            <div>
              <div className="text-[12px] text-gray-300 mb-1 font-medium theme-light:text-gray-700">Trabajo a realizar</div>
              <Textarea
                value={work}
                onChange={(e) => setWork(e.target.value)}
                placeholder="Ej. Reballing PMIC, Data recovery…"
                className="bg-black/40 border-white/15 text-white min-h-[80px] theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

            </div>
          </div>

          {err && <div className="mt-3 text-[12px] text-amber-300 theme-light:text-amber-700">{err}</div>}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="h-9 px-4 border-white/15 theme-light:border-gray-300" onClick={onClose}>Cancelar</Button>
            <Button className="h-9 px-4 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700" onClick={save}>Guardar</Button>
          </div>
        </Card>
      </div>
    </div>);

}

function CancelOrderModal({ open, onClose, onSave }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    if (!reason.trim()) {
      setErr("Debes indicar la razón de cancelación.");
      return;
    }
    await onSave?.(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Card className="w-full max-w-md bg-[#111114] border-white/10 p-4 sm:p-6 my-8 max-h-[90vh] overflow-y-auto theme-light:bg-white theme-light:border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <X className="w-5 h-5 text-red-400 theme-light:text-red-600" />
            <h3 className="text-white font-semibold text-lg theme-light:text-gray-900">Cancelar orden</h3>
          </div>
          <p className="text-[12px] text-gray-400 mb-4 theme-light:text-gray-600">Indica el motivo de cancelación de esta orden.</p>

          <div className="space-y-3">
            <div>
              <div className="text-[12px] text-gray-300 mb-1 font-medium theme-light:text-gray-700">Motivo de cancelación *</div>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Cliente decidió no reparar, costo muy alto, etc."
                className="bg-black/40 border-white/15 text-white min-h-[100px] theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

            </div>
          </div>

          {err && <div className="mt-3 text-[12px] text-red-300 theme-light:text-red-700">{err}</div>}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="h-9 px-4 border-white/15 theme-light:border-gray-300" onClick={onClose}>Cancelar</Button>
            <Button className="h-9 px-4 bg-red-600 hover:bg-red-700" onClick={save}>Confirmar cancelación</Button>
          </div>
        </Card>
      </div>
    </div>);

}

// CommentSection component is no longer used in the UI, keeping its definition for potential future use or modularity.
// But it's functionally replaced by the new "Notas y Links" card's text input for comments.
function CommentSection({ order, onUpdated }) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    try {
      let me = null;
      try {me = await base44.auth.me();} catch {}

      // Crear solo el comentario normal - los links se muestran en el texto
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "note_added",
        description: comment,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: {
          for_customer: true
        }
      });

      setComment("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      clearEventCache(order.id);
      onUpdated?.(true);
    } catch (e) {
      console.error("Error adding comment:", e);
      alert("Error al agregar comentario");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e) => {
    setComment(e.target.value);
    if (textareaRef.current) {
      textarea.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-200">
        <h3 className="text-white font-semibold mb-3 theme-light:text-gray-900">Añadir Comentario</h3>
        <div className="space-y-3">
          <Textarea
            ref={textareaRef}
            placeholder="Escribe un comentario... (Enter para enviar, Shift+Enter para nueva línea)"
            value={comment}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            className="bg-black/40 border-cyan-500/20 text-white min-h-[80px] resize-none theme-light:bg-gray-50 theme-light:border-gray-300 theme-light:text-gray-900" />


          <Button
            onClick={handleSubmit}
            disabled={loading || !comment.trim()}
            className="w-full bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800">

            {loading ? "Guardando..." : "Agregar comentario"}
          </Button>
        </div>
      </Card>
    </div>);

}

function DepositModal({ open, onClose, onSave, currentBalance }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setMethod("cash");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("El monto debe ser un número mayor a 0");
      return;
    }

    setLoading(true);
    try {
      await onSave(amountNum, method);
      onClose();
    } catch (e) {
      console.error("Error saving deposit:", e);
      alert("Error al registrar el depósito");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <Card className="w-full max-w-md bg-[#111114] border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-semibold">Registrar Depósito</h3>
          </div>
          <p className="text-[12px] text-gray-400 mb-3">
            Balance pendiente: <span className="text-amber-400 font-semibold">${currentBalance.toFixed(2)}</span>
          </p>

          <div className="space-y-3">
            <div>
              <Label className="text-gray-300 text-sm mb-1">Monto del depósito *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-black/40 border-white/15 text-white"
                autoFocus />

            </div>
            <div>
              <Label className="text-gray-300 text-sm mb-1">Método de pago</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white">
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="ath_movil">ATH Móvil</option>
                <option value="zelle">Zelle</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="border-white/15" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={loading}>
              {loading ? "Procesando..." : "Registrar depósito"}
            </Button>
          </div>
        </Card>
      </div>
    </div>);

}

function OrderItemsSection({ order, onUpdated, clearEventCache, loadEventsCallback }) {
  const navigate = useNavigate();
  const o = order || {};
  const [items, setItems] = useState(() => Array.isArray(o.order_items) ? o.order_items : []);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ Sincronizar items cuando cambia la orden
  useEffect(() => {
    console.log("[OrderItems] Order items changed:", o.order_items);
    setItems(Array.isArray(o.order_items) ? o.order_items : []);
  }, [o.order_items, o.id]);

  useEffect(() => {
    if (!o.id || !o.device_model) return;
    loadSuggestedProducts();
  }, [o.id, o.device_model]);

  async function loadSuggestedProducts() {
    if (!o.device_model) {
      setSuggestedProducts([]);
      return;
    }

    try {
      const allProducts = await base44.entities.Product.filter({ active: true }, undefined, 200);

      const modelLower = (o.device_model || "").toLowerCase();
      const filtered = allProducts.filter((p) => {
        const nameLower = (p.name || "").toLowerCase();
        const descLower = (p.description || "").toLowerCase();
        const compatModels = Array.isArray(p.compatibility_models) ? p.compatibility_models : [];
        const hasCompatMatch = compatModels.some((m) => (m || "").toLowerCase().includes(modelLower));

        return nameLower.includes(modelLower) || descLower.includes(modelLower) || hasCompatMatch;
      });

      setSuggestedProducts(filtered.slice(0, 5));
    } catch (err) {
      console.error("Error loading suggested products:", err);
      setSuggestedProducts([]);
    }
  }

  async function addLine(r, qty = 1) {
    if (saving) return;

    console.log("[OrderItems] Adding line:", r, "qty:", qty);

    setSaving(true);
    try {
      // Construir el nuevo array de items
      const existsIdx = items.findIndex((x) => x.__kind === r.__kind && x.__source_id === r.__source_id);
      let next = [];

      if (existsIdx >= 0) {
        next = items.map((x, i) => i === existsIdx ? { ...x, qty: Number(x.qty || 1) + qty } : x);
      } else {
        next = [...items, { ...r, qty: qty }];
      }

      console.log("[OrderItems] New items array:", next);

      // Guardar en la DB
      await persist(next);

      // Crear evento
      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "item_added",
        description: `Item agregado: ${r.name} (x${qty})`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { item_kind: r.__kind, item_id: r.__source_id, item_name: r.name, quantity: qty, custom: r.custom || false }
      });

      clearEventCache(o.id);
      await loadEventsCallback(true);

      console.log("[OrderItems] Item added successfully");
      toast.success(`✅ ${r.name} añadido`);

    } catch (e) {
      console.error("[OrderItems] Error adding item:", e);
      toast.error("Error al añadir item");
    } finally {
      setSaving(false);
    }
  }

  function setQty(i, qty) {
    const qn = Math.max(1, Number(qty || 1));
    const next = items.map((x, idx) => idx === i ? { ...x, qty: qn } : x);
    setItems(next);
  }

  async function removeLine(i) {
    if (saving) return;

    setSaving(true);
    try {
      const itemToRemove = items[i];
      const next = items.filter((_, idx) => idx !== i);

      console.log("[OrderItems] Removing item:", itemToRemove);

      await persist(next);

      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "item_removed",
        description: `Item removido: ${itemToRemove.name} (x${itemToRemove.qty})`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { item_kind: itemToRemove.__kind, item_id: itemToRemove.__source_id, item_name: itemToRemove.name, quantity: itemToRemove.qty, custom: itemToRemove.custom || false }
      });

      clearEventCache(o.id);
      await loadEventsCallback(true);

      toast.success(`✅ ${itemToRemove.name} eliminado`);

    } catch (e) {
      console.error("[OrderItems] Error removing item:", e);
      toast.error("Error al eliminar item");
    } finally {
      setSaving(false);
    }
  }

  async function persist(itemsToSave) {
    console.log("[OrderItems] Persisting items:", itemsToSave);

    try {
      const itemsWithTotal = itemsToSave.map((it) => ({
        ...it,
        total: Number(it.price || 0) * Number(it.qty || 1)
      }));

      const subtotal = itemsWithTotal.reduce((s, it) => s + (it.total || 0), 0);
      const taxRate = 0.115;
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      console.log("[OrderItems] Calculated totals:", { subtotal, tax, total });

      // ✅ ACTUALIZAR cost_estimate Y balance_due
      const currentPaid = Number(o.total_paid || o.amount_paid || 0);
      const newBalance = Math.max(0, total - currentPaid);

      await base44.entities.Order.update(o.id, {
        order_items: itemsWithTotal,
        total: total,
        cost_estimate: total,
        balance_due: newBalance
      });

      console.log("[OrderItems] Items saved successfully with cost_estimate:", total);

      // ✅ Actualizar el estado local inmediatamente
      setItems(itemsWithTotal);

      // ✅ Notificar al componente padre para refrescar
      clearEventCache(o.id);
      await loadEventsCallback(true);
      onUpdated?.();
      setIsEditing(false);

    } catch (e) {
      console.error("[OrderItems] Error saving items:", e);
      alert("Error guardando items");
      throw e;
    }
  }

  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  const taxRate = 0.115;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const getStockBadge = (item) => {
    if (item.__kind === "service" || item.type === "service") {
      return <Badge className="text-[10px] bg-blue-600/20 text-blue-300 border-blue-600/30">Servicio</Badge>;
    }

    if (item.custom) {
      return <Badge className="text-[10px] bg-purple-600/20 text-purple-300 border-purple-600/30">Personalizado</Badge>;
    }

    const stock = Number(item.stock || 0);
    const minStock = Number(item.min_stock || 0);

    if (stock <= 0) {
      return <Badge className="text-[10px] bg-red-600/20 text-red-300 border-red-600/30">Agotado</Badge>;
    }
    if (stock <= minStock) {
      return <Badge className="text-[10px] bg-amber-600/20 text-amber-300 border-amber-600/30">Bajo ({stock})</Badge>;
    }
    return <Badge className="text-[10px] bg-emerald-600/20 text-emerald-300 border-emerald-600/30">{stock} unid.</Badge>;
  };

  // ✅ Calcular valores en tiempo real
  const totalPaid = Number(o.total_paid || o.amount_paid || 0);
  const balance = Math.max(0, total - totalPaid);
  const isPaid = balance <= 0.01;

  const handleCobrarClick = () => {
    // Si es orden de software/desbloqueo sin info de seguridad, mostrar diálogo primero
    const isSoftware = o.device_type === "Software" || (o.order_number && o.order_number.startsWith("SW-"));
    const hasSecurity = o.device_security && (o.device_security.device_pin || o.device_security.device_password || o.device_security.pattern_vector);
    
    if (isSoftware && !hasSecurity) {
      setShowSecurityBeforePayment(true);
      return;
    }
    
    navigate(createPageUrl(`POS?workOrderId=${o.id}&balance=${balance}&mode=full`), {
      state: { fromDashboard: true, paymentMode: "full" }
    });
  };

  const handleDepositoClick = () => {
    navigate(createPageUrl(`POS?workOrderId=${o.id}&balance=${balance}&mode=deposit`), {
      state: { fromDashboard: true, paymentMode: "deposit" }
    });
  };

  const handleSecuritySavedBeforePayment = async () => {
    setShowSecurityBeforePayment(false);
    await handleRefresh(true);
    // Ahora sí ir al POS
    const total = Number(order.total || 0);
    const totalPaid = Number(order.total_paid || order.amount_paid || 0);
    const balance = Math.max(0, total - totalPaid);
    navigate(createPageUrl(`POS?workOrderId=${order.id}&balance=${balance}&mode=full`), {
      state: { fromDashboard: true, paymentMode: "full" }
    });
  };

  return (
    <>
      <Card className="p-4 bg-gradient-to-br from-emerald-600/10 to-lime-600/10 border-emerald-500/20 theme-light:bg-white theme-light:border-gray-200">
        <CardHeader className="border-b border-emerald-500/20 pb-4 theme-light:border-gray-200">
          <CardTitle className="text-white flex items-center justify-between theme-light:text-gray-900">
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-500 theme-light:text-emerald-600" />
              Piezas y Servicios
              {saving && <span className="text-xs text-gray-400 theme-light:text-gray-600">(guardando...)</span>}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex gap-2 flex-shrink-0">
                {items.length > 0 && (
                  <Button
                    onClick={() => {
                      if (isEditing) {
                        persist(items);
                      } else {
                        setIsEditing(true);
                      }
                    }}
                    disabled={saving}
                    variant="outline"
                    className="h-10 px-4 border-white/15 bg-slate-800 hover:bg-slate-700 text-white theme-light:border-gray-300 theme-light:bg-white theme-light:hover:bg-gray-50 theme-light:text-gray-900"
                  >
                    {isEditing ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Guardar
                      </>
                    ) : (
                      "Editar"
                    )}
                  </Button>
                )}
                <Button
                  onClick={() => setShowAddItemModal(true)}
                  disabled={saving}
                  className="h-10 px-4 bg-gradient-to-r from-emerald-600 to-lime-600 hover:from-emerald-700 hover:to-lime-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {o.device_model && suggestedProducts.length > 0 &&
          <div className="space-y-3 pb-4 border-b border-white/10 theme-light:border-gray-200">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide theme-light:text-gray-600">
                💡 Piezas sugeridas para {o.device_model}
              </p>
              <div className="space-y-2">
                {suggestedProducts.map((product) => {
                const isAdded = items.some((i) => i.__kind === "product" && i.__source_id === product.id);
                const isOutOfStock = product.stock <= 0;

                return (
                  <div
                    key={`suggested-${product.id}`}
                    className={`bg-black/40 border rounded-lg p-3 transition-colors ${
                    isAdded ? "border-emerald-500/50" : "border-white/10 hover:bg-black/60"} theme-light:bg-gray-50 theme-light:border-gray-200`
                    }>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate theme-light:text-gray-900">{product.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {product.sku && <span className="text-xs text-gray-400 theme-light:text-gray-600">{product.sku}</span>}
                            {getStockBadge(product)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <span className="text-emerald-400 font-semibold theme-light:text-emerald-600">
                            ${product.price.toFixed(2)}
                          </span>
                          <Button
                          size="sm"
                          onClick={() => addLine({
                            ...product,
                            __kind: "product",
                            __source_id: product.id,
                            type: "product",
                            from_inventory: true
                          })}
                          disabled={isOutOfStock || isAdded || saving}
                          className={`disabled:opacity-50 disabled:cursor-not-allowed h-8 px-3 flex-shrink-0 ${
                          isAdded ? "bg-emerald-600/50 text-white" : "bg-red-600 hover:bg-red-700"}`
                          }>

                            {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>);

              })}
              </div>
            </div>
          }

          {items.length > 0 &&
          <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide theme-light:text-gray-600">
                ITEMS EN LA ORDEN ({items.length})
              </p>
              <div className="space-y-2">
                {items.map((item, idx) => {
                const isProduct = item.__kind === 'product' || item.type === 'product';
                const itemTotal = Number(item.price || 0) * Number(item.qty || 1);

                return (
                  <div
                    key={`${item.__kind}-${item.__source_id}-${idx}`}
                    className="bg-black/40 border border-white/10 rounded-lg p-3 flex items-center justify-between gap-3 theme-light:bg-gray-50 theme-light:border-gray-200">

                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate theme-light:text-gray-900">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-slate-50 px-2.5 py-0.5 text-xs font-semibold rounded-md inline-flex items-center border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            {isProduct ? '📦 Producto' : '🔧 Servicio'}
                          </Badge>
                          {item.sku && <span className="text-xs text-gray-500 theme-light:text-gray-600">{item.sku}</span>}
                          {getStockBadge(item)}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {isEditing ?
                      <>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 border-white/15 theme-light:border-gray-300"
                            onClick={() => setQty(idx, Number(item.qty || 1) - 1)}
                            disabled={Number(item.qty || 1) <= 1 || saving}>

                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input
                            value={Number(item.qty || 1)}
                            onChange={(e) => setQty(idx, e.target.value)}
                            className="w-12 h-7 text-center bg-black/40 border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                            type="number"
                            min="1"
                            disabled={saving} />

                              <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 border-white/15 theme-light:border-gray-300"
                            onClick={() => setQty(idx, Number(item.qty || 1) + 1)}
                            disabled={saving}>

                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <span className="text-emerald-400 font-semibold text-sm flex-shrink-0 theme-light:text-emerald-600">
                              ${itemTotal.toFixed(2)}
                            </span>
                            <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 border-white/15 hover:border-red-500 hover:text-red-300 flex-shrink-0 theme-light:border-gray-300"
                          onClick={() => removeLine(idx)}
                          disabled={saving}>

                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </> :

                      <>
                            <span className="text-white text-sm flex-shrink-0 theme-light:text-gray-900">
                              x{Number(item.qty || 1)}
                            </span>
                            <span className="text-emerald-400 font-semibold text-sm flex-shrink-0 theme-light:text-emerald-600">
                              ${itemTotal.toFixed(2)}
                            </span>
                          </>
                      }
                      </div>
                    </div>);

              })}
              </div>
            </div>
          }

          {items.length === 0 &&
          <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-lg theme-light:border-gray-300">
              <ShoppingCart className="w-12 h-12 mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm mb-2 theme-light:text-gray-600">No hay items en esta orden</p>
              <p className="text-gray-500 text-xs theme-light:text-gray-500">Añade productos o servicios para comenzar</p>
            </div>
          }

          {items.length > 0 &&
          <div className="border-t border-emerald-500/20 pt-3 space-y-2 theme-light:border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 theme-light:text-gray-600">Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span>
                <span className="text-white font-medium theme-light:text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 theme-light:text-gray-600">IVU (11.5%)</span>
                <span className="text-white font-medium theme-light:text-gray-900">${tax.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-400 theme-light:text-gray-600">Total pagado</span>
                <span className={`font-medium ${totalPaid > 0 ? "text-emerald-400 theme-light:text-emerald-600" : "text-gray-500"}`}>
                  ${totalPaid.toFixed(2)}
                </span>
              </div>

              <div className={`flex justify-between text-base p-3 rounded-lg ${
            isPaid ? "bg-emerald-600/20 border border-emerald-600/30 theme-light:bg-emerald-50 theme-light:border-emerald-300" : "bg-amber-600/20 border border-amber-600/30 theme-light:bg-amber-50 theme-light:border-amber-300"}`
            }>
                <span className={`font-semibold ${isPaid ? "text-emerald-300 theme-light:text-emerald-700" : "text-amber-300 theme-light:text-amber-700"}`}>
                  Balance pendiente
                </span>
                <span className={`font-bold text-lg ${isPaid ? "text-emerald-400 theme-light:text-emerald-600" : "text-amber-400 theme-light:text-amber-600"}`}>
                  ${balance.toFixed(2)}
                  {isPaid && <CheckCircle2 className="w-5 h-5 inline ml-2" />}
                </span>
              </div>
            </div>
          }
        </CardContent>
      </Card>

      {Array.isArray(o.order_items) && o.order_items.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleDepositoClick}
            disabled={saving}
            className="h-12 bg-emerald-600 hover:bg-emerald-700 flex flex-col items-center justify-center gap-1"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              <span className="font-bold">Depósito</span>
            </div>
            {!isPaid && <span className="text-[10px] opacity-80">(No cambia estado)</span>}
          </Button>
          <Button
            onClick={handleCobrarClick}
            disabled={isPaid || saving}
            className="h-12 bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              <span className="font-bold">Cobrar</span>
            </div>
            {isPaid && <span className="text-[10px] opacity-80">(Saldado)</span>}
          </Button>
        </div>
      )}

      <AddItemModal
        open={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onSave={(item) => {
          addLine(item, 1);
          setShowAddItemModal(false);
        }}
        order={o} />

    </>);

}

export default function WorkOrderPanel({ orderId, onClose, onUpdate, onDelete, panelVersion = "v9" }) {
  console.log("[WorkOrderPanel] Props received:", { orderId, hasOnClose: !!onClose, hasOnUpdate: !!onUpdate });

  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const o = order || {};

  const [status, setStatus] = useState("intake");

  const photos = useMemo(() => o.photos_metadata || o.device_photos || [], [o]);

  const sec = o.device_security || {};
  const hasPassword = !!sec.device_password;
  const hasPin = !!sec.device_pin;
  const hasPattern = !!sec.pattern_vector || !!sec.pattern_image;
  const hasAnySecurity = hasPassword || hasPin || hasPattern;
  const [showPass, setShowPass] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [pinModal, setPinModal] = useState({ open: false, targetNoteId: null, forOrder: false });
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [externalModalOpen, setExternalModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkPartName, setLinkPartName] = useState(""); // Added linkPartName state
  const [savingNote, setSavingNote] = useState(false);
  const [savingLink, setSavingLink] = useState(false);

  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);

  const [changingStatus, setChangingStatus] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ✅ Soporte de teclado para confirmación de eliminación
  useEffect(() => {
    if (!showDeleteConfirm) return;
    
    const handleKey = (e) => {
      if (e.key === 'Enter' && !deleting) {
        e.preventDefault();
        handleConfirmDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDeleteConfirm(false);
      }
    };
    
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showDeleteConfirm, deleting]);

  const isSoftwareOrder = useMemo(() => {
    return (
      order?.device_type === "Software" ||
      (Array.isArray(order?.tags) && order.tags.includes("software"))
    );
  }, [order]);

  const activeStatuses = useMemo(() => {
    // Para órdenes de software, mostrar solo estados limitados
    if (isSoftwareOrder) {
      return ORDER_STATUSES.filter((s) => 
        s.id === "in_progress" || 
        s.id === "ready_for_pickup"
      );
    }
    return ORDER_STATUSES.filter((s) => s.isActive);
  }, [isSoftwareOrder]);

  const closedStatuses = useMemo(() => {
    // Para órdenes de software, solo mostrar entregado y cancelado
    if (isSoftwareOrder) {
      return ORDER_STATUSES.filter((s) => 
        s.id === "delivered" || 
        s.id === "cancelled"
      );
    }
    return ORDER_STATUSES.filter((s) => s.id !== "intake" && !s.isActive);
  }, [isSoftwareOrder]);

  // ✅ Ref para scroll inteligente con teclado
  const panelRef = useRef(null);
  useKeyboardScrollIntoView(panelRef);

  // Updated handleCobrarClick for header button to potentially handle full payment
  const handleCobrarClick = useCallback(() => {
    if (!order) return;
    const total = Number(order.total || 0);
    const totalPaid = Number(order.total_paid || order.amount_paid || 0);
    const balance = Math.max(0, total - totalPaid);

    // Default behavior for header button: go to POS for full payment
    navigate(createPageUrl(`POS?workOrderId=${order.id}&balance=${balance}&mode=full`), { state: { fromDashboard: true, paymentMode: "full" } });
  }, [order, navigate]);

  const [showSecurityBeforePayment, setShowSecurityBeforePayment] = useState(false);

  const loadEventsCallback = useCallback(async (forceRefresh = false) => {
    if (!order?.id) return;

    if (!forceRefresh) {
      const cached = getCachedEvents(order.id);
      if (cached) {
        console.log(`[WorkOrderPanel] Using cached events for order ${order.id}`);
        setEvents(cached);
        return;
      }
    }

    setLoadingEvents(true);
    try {
      let user = null;
      try {
        user = await base44.auth.me();
      } catch (e) {
        console.log("[WorkOrderPanel] No authenticated user, cannot load events");
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      if (!user) {
        console.log("[WorkOrderPanel] User not authenticated, cannot load events");
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      const rows = await base44.entities.WorkOrderEvent.filter({ order_id: order.id }, "-created_at", 200).catch((e) => {
        console.error("[WorkOrderPanel] Error loading events:", e.message || e);
        return [];
      });

      const list = (rows || []).sort((a, b) => new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0));

      setEvents(list);
      setCachedEvents(order.id, list);
    } catch (err) {
      console.error("[WorkOrderPanel] Error loading events:", err.message || err);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [order?.id]);

  // ✅ FUNCIÓN MEJORADA PARA ENVIAR EMAILS CON TEMPLATES
  const sendStatusChangeEmail = async (newStatusId, previousStatusId) => {
    console.log("[Email] Iniciando envío de email para estado:", newStatusId);

    const skipEmailStates = ["reparacion_externa", "waiting_order", "pending_order", "intake"];
    if (skipEmailStates.includes(newStatusId)) {
      console.log("[Email] Estado omitido, no se envía email:", newStatusId);
      return;
    }

    if (!order?.customer_email) {
      console.log("[Email] No hay email del cliente, omitiendo envío");
      return;
    }

    console.log("[Email] Preparando email profesional para:", order.customer_email);

    try {
      const businessInfo = await getBusinessInfo();
      const deviceLine = `${order.device_brand || ""} ${order.device_family || ""} ${order.device_model || ""}`.trim();
      const customerName = order.customer_name || "Cliente";

      const emailData = createStatusChangeEmail({
        orderNumber: order.order_number,
        customerName,
        deviceInfo: deviceLine || order.device_type || "tu equipo",
        newStatus: newStatusId,
        previousStatus: previousStatusId,
        businessInfo
      });

      console.log("[Email] Enviando email profesional...");

      const emailResult = await base44.integrations.Core.SendEmail({
        from_name: businessInfo.business_name || "SmartFixOS",
        to: order.customer_email,
        subject: emailData.subject,
        body: emailData.body
      });

      console.log("[Email] ✅ Email enviado exitosamente");

      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "email_sent",
        description: `Email enviado a ${order.customer_email}: ${emailData.subject}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: {
          email_to: order.customer_email,
          subject: emailData.subject,
          reason: "status_change",
          new_status: newStatusId,
          previous_status: previousStatusId
        }
      });

    } catch (error) {
      console.error("[Email] ❌ ERROR:", error);

      let me = null;
      try {me = await base44.auth.me();} catch {}

      try {
        await base44.entities.WorkOrderEvent.create({
          order_id: order.id,
          order_number: order.order_number,
          event_type: "email_failed",
          description: `Error al enviar email a ${order.customer_email}: ${error.message || 'Error desconocido'}`,
          user_name: me?.full_name || me?.email || "Sistema",
          user_id: me?.id || null,
          metadata: {
            error: error.message || 'Error desconocido',
            new_status: newStatusId,
            email_to: order.customer_email
          }
        });
      } catch (e) {
        console.error("[Email] No se pudo registrar el error:", e);
      }
    }
  };

  const handleRefresh = useCallback(async (force = false) => {
    if (!orderId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await base44.entities.Order.get(orderId);
      setOrder(data);
      setStatus(normalizeStatusId(data.status || "intake"));
      clearEventCache(orderId);
      await loadEventsCallback(true);
      onUpdate?.();
    } catch (e) {
      console.error("[WorkOrderPanel] Error refreshing order:", e);
      setLoadError(`Error al recargar la orden: ${e.message || "Error de conexión"}`);
    } finally {
      setLoading(false);
    }
  }, [orderId, loadEventsCallback, onUpdate]);

  // ✅ Listener para refrescar cuando se procese un pago desde POS
  useEffect(() => {
    const handlePaymentProcessed = async (event) => {
      const { orderId: eventOrderId } = event.detail || {};

      if (eventOrderId === order?.id) {
        console.log(`[WorkOrderPanel] Payment processed for order ${eventOrderId}. Refreshing data...`);

        // Recargar la orden desde la DB
        try {
          const freshOrder = await base44.entities.Order.get(eventOrderId);
          setOrder(freshOrder);
          clearEventCache(eventOrderId);
          await loadEventsCallback(true);
          onUpdate?.();
        } catch (e) {
          console.error("[WorkOrderPanel] Error refreshing after payment:", e);
        }
      }
    };

    window.addEventListener('order-payment-processed', handlePaymentProcessed);

    return () => {
      window.removeEventListener('order-payment-processed', handlePaymentProcessed);
    };
  }, [order?.id, loadEventsCallback, onUpdate]);

  const handleClose = useCallback(() => {
    document.body.classList.remove("wo-fullscreen");
    if (onClose) onClose();
  }, [onClose]);

  const handlePhotoClick = useCallback((index) => {
    setLbIndex(index);
    setLbOpen(true);
  }, []);

  const handleRequestDelete = async () => {
    setShowAdminAuth(true);
  };

  const handleAuthSuccess = () => {
    setShowAdminAuth(false);
    setShowDeleteConfirm(true);
  };

  const handleAuthCancel = () => {
    setShowAdminAuth(false);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const user = await base44.auth.me();
      
      // Marcar orden como eliminada
      await base44.entities.Order.update(order.id, {
        deleted: true,
        deleted_by: user?.email || "unknown",
        deleted_at: new Date().toISOString()
      });

      // ✅ ENVIAR UN SOLO EMAIL CONSOLIDADO A TODOS LOS ADMINS
      try {
        const admins = await base44.entities.User.filter({ role: "admin", active: true });
        const adminEmails = admins.map(a => a.email).filter(Boolean);
        
        if (adminEmails.length > 0) {
          // Enviar un solo email con todos los admins en CC
          await dataClient.mail.send({
            to: adminEmails.join(','), // Enviar a todos en un solo email
            subject: `⚠️ Orden eliminada: ${order.order_number}`,
            body: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #dc2626; margin-bottom: 20px;">🗑️ Orden Eliminada</h2>
                  <p style="color: #333; margin-bottom: 15px;">La siguiente orden ha sido eliminada del sistema:</p>
                  
                  <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Orden:</strong> ${order.order_number}</p>
                    <p style="margin: 5px 0;"><strong>Cliente:</strong> ${order.customer_name}</p>
                    <p style="margin: 5px 0;"><strong>Dispositivo:</strong> ${order.device_brand} ${order.device_model}</p>
                    <p style="margin: 5px 0;"><strong>Problema:</strong> ${order.initial_problem || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Estado:</strong> ${order.status}</p>
                  </div>
                  
                  <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <p style="margin: 5px 0; color: #666;"><strong>Eliminada por:</strong> ${user?.full_name || user?.email}</p>
                    <p style="margin: 5px 0; color: #666;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-PR')}</p>
                  </div>
                  
                  <p style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                    SmartFixOS - Sistema de Gestión
                  </p>
                </div>
              </div>
            `
          });
          
          console.log("✅ Email de eliminación enviado a:", adminEmails.join(', '));
        }
      } catch (emailError) {
        console.error("Error enviando email:", emailError);
      }

      setShowDeleteConfirm(false);
      toast.success("✅ Orden eliminada");
      handleClose();
      onDelete?.(order.id);
      
    } catch (error) {
      console.error("Error eliminando orden:", error);
      toast.error("Error al eliminar la orden");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      // Ignorar si está escribiendo en un input, textarea o contenteditable
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;
      
      if (!isInput && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadOrderData = async () => {
      if (!orderId) {
        console.error("[WorkOrderPanel] No orderId provided");
        if (mounted) {
          setLoading(false);
          setLoadError("No se proporcionó un ID de orden.");
        }
        return;
      }

      document.body.classList.add("wo-fullscreen");

      setLoading(true);
      setLoadError(null);
      setOrder(null);

      try {
        let user = null;
        try {
          user = await base44.auth.me();
        } catch (e) {
          console.error("[WorkOrderPanel] Authentication error:", e.message || e);
          if (mounted) {
            setLoading(false);
            setLoadError("Sesión expirada. Por favor, recargue la página.");
          }
          return;
        }

        if (!user) {
          if (mounted) {
            setLoading(false);
            setLoadError("Usuario no autenticado. No se puede cargar la orden.");
          }
          return;
        }

        console.log("[WorkOrderPanel] Loading order with ID:", orderId);

        const data = await base44.entities.Order.get(orderId).catch((e) => {
          console.error("[WorkOrderPanel] Error fetching order:", e.message || e);
          throw new Error(`No se pudo cargar la orden: ${e.message || "Error de red"}`);
        });

        if (!mounted) return;

        if (!data) {
          console.error("[WorkOrderPanel] Order not found:", orderId);
          setOrder(null);
          setLoading(false);
          setLoadError(`Orden con ID ${orderId} no encontrada.`);
          return;
        }

        console.log("[WorkOrderPanel] Order loaded:", data.order_number);
        setOrder(data);
        setStatus(normalizeStatusId(data.status || "intake"));
        setLoading(false);

      } catch (e) {
        console.error("[WorkOrderPanel] Error loading order:", e.message || e);
        if (mounted) {
          setLoading(false);
          setLoadError(`Error al cargar la orden: ${e.message || "Error de conexión. Verifique su internet."}`);
        }
      }
    };
    loadOrderData();

    return () => {
      mounted = false;
      document.body.classList.remove("wo-fullscreen");
    };
  }, [orderId]);

  useEffect(() => {
    if (order?.id) {
      loadEventsCallback(false);
    }
  }, [order?.id, loadEventsCallback]);

  useEffect(() => {
    if (!orderId) return;
    if (loading) return;

    const iv = setInterval(async () => {
      try {
        const fresh = await base44.entities.Order.get(orderId);
        if (fresh && fresh.updated_date !== order?.updated_date) {
          console.log("[WO] Auto-refresh detectó cambios");
          setOrder(fresh);
          setStatus(normalizeStatusId(fresh.status || "intake"));
          clearEventCache(orderId);
          loadEventsCallback(true);
        }
      } catch (e) {
        console.warn("[WO] Auto-refresh falló (no crítico):", e.message);
      }
    }, 30000);

    return () => clearInterval(iv);
  }, [orderId, loading, order?.updated_date, loadEventsCallback]);

  async function askDeleteNote(noteId) {
    setPinModal({ open: true, targetNoteId: noteId, forOrder: false });
  }

  async function verifyAdminPin(pin) {
    const rows = await base44.entities.SystemConfig.filter({ key: "admin_pin" });
    const stored = rows?.[0]?.value || rows?.[0]?.value_json || "";
    const saved = typeof stored === "string" ? stored : stored?.pin || "";
    if (!saved || String(saved) !== String(pin)) {
      const err = new Error("PIN incorrecto");
      err.code = "BAD_PIN";
      throw err;
    }
    return true;
  }

  async function deleteNote(noteId, pin) {
    if (!order?.id) return;
    await verifyAdminPin(pin);
    await base44.entities.WorkOrderEvent.delete(noteId);
    clearEventCache(order.id);
    await loadEventsCallback(true);
    onUpdate?.();
    setPinModal({ open: false, targetNoteId: null, forOrder: false });
  }

  async function handleUploadMore(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !order?.id) return;
    setUploadErr("");
    setUploading(true);
    try {
      const newItems = [];
      for (const file of files) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          newItems.push({
            id: `${Date.now()}-${file.name}`,
            type: file.type?.startsWith("video") ? "video" : "image",
            mime: file.type || "image/jpeg",
            filename: file.name,
            publicUrl: `${file_url}?v=${Date.now()}`,
            thumbUrl: `${file_url}?v=${Date.now()}`
          });
        } catch (err) {
          console.error("Upload error:", err);
          setUploadErr("Algunas imágenes no se pudieron subir.");
        }
      }
      const next = [...photos, ...newItems];
      await base44.entities.Order.update(order.id, { photos_metadata: next });
      onUpdate?.();

      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "photo_upload",
        description: `Se subieron ${newItems.length} archivo(s).`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { count: newItems.length }
      });
      clearEventCache(order.id);
      await loadEventsCallback(true);
    } catch (err) {
      console.error(err);
      setUploadErr("Error subiendo imágenes.");
    } finally {
      e.target.value = "";
      setUploading(false);
    }
  }

  async function addNote() {
    if (!noteText.trim() || !order?.id) return;
    setSavingNote(true);

    try {
      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "note_added",
        description: noteText, // Direct comment
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { for_customer: false, internal_only: true } // Internal note
      });

      clearEventCache(order.id);
      await loadEventsCallback(true);
      setNoteText("");
      toast.success("✅ Nota interna añadida");
    } catch (err) {
      console.error("Error añadiendo nota:", err);
      alert(`Error: ${err.message || "No se pudo añadir la nota"}`);
    } finally {
      setSavingNote(false);
    }
  }

  async function addLink() {
    if (!linkText.trim() || !linkPartName.trim() || !order?.id) {
      toast.error("Nombre de pieza y link son obligatorios");
      return;
    }
    setSavingLink(true);

    try {
      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "link_added",
        description: `🔗 ${linkPartName}: ${linkText}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { link: linkText, partName: linkPartName }
      });

      clearEventCache(order.id);
      await loadEventsCallback(true);
      setLinkText("");
      setLinkPartName(""); // Reset link part name
      toast.success("✅ Link añadido");
    } catch (err) {
      console.error("Error añadiendo link:", err);
      toast.error("Error al añadir link");
    } finally {
      setSavingLink(false);
    }
  }

  async function changeStatus(newStatusRaw, statusNote = "", metadata = {}, skipModalCheck = false) {
    if (!order?.id) return;
    const nextId = normalizeStatusId(newStatusRaw);
    const prevStatusId = normalizeStatusId(order.status || status || "intake");

    console.log("[ChangeStatus] Iniciando cambio:", prevStatusId, "→", nextId);

    // Mostrar modales específicos SOLO si no viene de skipModalCheck
    if (!skipModalCheck) {
      if (nextId === "cancelled") {
        setCancelModalOpen(true);
        return;
      }

      if (nextId === "waiting_parts") {
        setPartsModalOpen(true);
        return;
      }

      if (nextId === "reparacion_externa") {
        setExternalModalOpen(true);
        return;
      }
    }

    // ✅ VERIFICACIÓN DE BALANCE PARA ESTADO "delivered"
    if (nextId === "delivered") {
      const total = Number(order.total || order.cost_estimate || 0); // Prioritize 'total' if available, then 'cost_estimate'
      const totalPaid = Number(order.total_paid || order.amount_paid || 0);
      const balance = Math.max(0, total - totalPaid);

      console.log("[ChangeStatus] Verificando balance para 'delivered' status:", { total, totalPaid, balance });

      if (balance > 0.01) {
        // ✅ Crear div temporal para alert con z-index máximo
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = 'position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; padding: 20px;';

        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = 'background: white; padding: 30px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.5);';
        contentDiv.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
          <h2 style="color: #DC2626; font-size: 24px; font-weight: bold; margin-bottom: 16px;">BALANCE PENDIENTE</h2>
          <p style="color: #374151; font-size: 18px; margin-bottom: 24px;">Esta orden tiene un balance de <strong style="color: #DC2626;">$${balance.toFixed(2)}</strong></p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button id="goPOS" style="background: linear-gradient(to right, #10B981, #059669); color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; font-size: 16px;">✅ Ir al POS</button>
            <button id="closeAnyway" style="background: #6B7280; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; font-size: 16px;">Cerrar sin cobrar</button>
            <button id="cancelAction" style="background: #DC2626; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; font-size: 16px;">❌ Cancelar</button>
          </div>
        `;

        alertDiv.appendChild(contentDiv);
        document.body.appendChild(alertDiv);

        return new Promise((resolve) => {
          document.getElementById('goPOS').onclick = () => {
            document.body.removeChild(alertDiv);
            window.location.href = createPageUrl(`POS?workOrderId=${order.id}&balance=${balance}&mode=full`);
            resolve();
          };

          document.getElementById('closeAnyway').onclick = () => {
            document.body.removeChild(alertDiv);

            // Confirmar que sí quiere cerrar sin cobrar
            if (window.confirm(`⚠️ ¿Confirmas cerrar la orden SIN cobrar los $${balance.toFixed(2)}?`)) {
              proceedWithStatusChange();
            }
            resolve();
          };

          document.getElementById('cancelAction').onclick = () => {
            document.body.removeChild(alertDiv);
            resolve();
          };
        });
      }
    }

    // ✅ Función helper para proceder con el cambio
    async function proceedWithStatusChange() {
      setChangingStatus(true);
      try {
        let me = null;
        try {
          me = await base44.auth.me();
        } catch (authError) {
          console.error("[ChangeStatus] Error de autenticación:", authError);
          throw new Error("Sesión expirada. Por favor, recargue la página.");
        }

        if (!me) {
          throw new Error("Usuario no autenticado.");
        }

        const updateData = {
          status: nextId,
          updated_date: new Date().toISOString(),
          status_note: statusNote || null,
          status_note_visible_to_customer: false
        };

        if (metadata && Object.keys(metadata).length > 0) {
          updateData.status_metadata = {
            kind: nextId,
            ...metadata
          };
        }

        const history = order.status_history || [];
        history.push({
          status: nextId,
          timestamp: new Date().toISOString(),
          changed_by: me.full_name || me.email,
          note: statusNote || null,
          visible_to_customer: false
        });
        updateData.status_history = history;

        console.log("[ChangeStatus] Actualizando orden en DB...");
        await base44.entities.Order.update(order.id, updateData);

        setStatus(nextId);
        setOrder((prevOrder) => ({
          ...prevOrder,
          status: nextId,
          updated_date: updateData.updated_date,
          status_note: updateData.status_note,
          status_note_visible_to_customer: updateData.status_note_visible_to_customer,
          status_history: updateData.status_history,
          ...(updateData.status_metadata && { status_metadata: updateData.status_metadata })
        }));

        console.log("[ChangeStatus] Creando evento...");
        await base44.entities.WorkOrderEvent.create({
          order_id: order.id,
          order_number: order.order_number,
          event_type: "status_change",
          description: `Estado: ${getStatusConfig(prevStatusId).label} → ${getStatusConfig(nextId).label}${statusNote ? ` - ${statusNote}` : ""}`,
          user_name: me?.full_name || me?.email || "Sistema",
          user_id: me?.id || null,
          metadata: { from: prevStatusId, to: nextId, ...(metadata || {}) }
        });

        console.log("[ChangeStatus] Llamando a sendStatusChangeEmail...");
        await sendStatusChangeEmail(nextId, prevStatusId);
        console.log("[ChangeStatus] Email procesado");

        if (nextId === "pending_order") {
          await base44.entities.WorkOrderEvent.create({
            order_id: order.id,
            order_number: order.order_number,
            event_type: "pending_order",
            description: "Trabajo pendiente de ordenar pieza(s)..",
            user_name: me?.full_name || me?.email || "Sistema",
            user_id: me?.id || null
          });
          try {
            window.localStorage.setItem(`pending_order_${order.id}`, String(Date.now()));
            window.dispatchEvent(new Event("force-refresh"));
          } catch {}
        }

        try {
          // ✅ ESTADOS QUE NO ENVÍAN NOTIFICACIONES (solo intake y diagnosing)
          const skipNotificationStates = ["intake", "diagnosing"];
          
          if (!skipNotificationStates.includes(nextId)) {
            const statusLabels = {
              intake: "Recepción",
              diagnosing: "Diagnóstico",
              awaiting_approval: "Esperando aprobación",
              waiting_parts: "Esperando piezas",
              waiting_order: "Esperando orden",
              pending_order: "Pendiente a ordenar",
              reparacion_externa: "Reparación externa",
              in_progress: "En reparación",
              ready_for_pickup: "Listo para recoger",
              picked_up: "Entregado",
              delivered: "Entregado",
              completed: "Completado/Entregado",
              cancelled: "Cancelado"
            };

            // 1️⃣ Notificar al técnico asignado (si existe y no es quien hizo el cambio)
            if (order.assigned_to && order.assigned_to !== me?.id) {
              await NotificationService.createNotification({
                userId: order.assigned_to,
                userEmail: order.assigned_to_name || "",
                type: "status_change",
                title: `Orden #${order.order_number} → ${statusLabels[nextId] || nextId}`,
                body: `${order.customer_name} - ${order.device_brand || ""} ${order.device_model || ""}`,
                relatedEntityType: "order",
                relatedEntityId: order.id,
                relatedEntityNumber: order.order_number,
                actionUrl: `/Orders?order=${order.id}`,
                actionLabel: "Ver orden",
                priority: ["ready_for_pickup", "delivered", "cancelled"].includes(nextId) ? "high" : "normal",
                metadata: {
                  old_status: prevStatusId,
                  new_status: nextId,
                  customer_name: order.customer_name
                }
              });
            }

            // 2️⃣ Notificar a admins y managers (excepto quien hizo el cambio)
            const admins = await base44.entities.User.filter({});
            const eligibleUsers = (admins || []).filter((u) =>
              (u.role === "admin" || u.role === "manager") && u.id !== me?.id
            );

            for (const targetUser of eligibleUsers) {
              await NotificationService.createNotification({
                userId: targetUser.id,
                userEmail: targetUser.email,
                type: "status_change",
                title: `Orden #${order.order_number} → ${statusLabels[nextId] || nextId}`,
                body: `${order.customer_name} - ${order.device_brand || ""} ${order.device_model || ""}`,
                relatedEntityType: "order",
                relatedEntityId: order.id,
                relatedEntityNumber: order.order_number,
                actionUrl: `/Orders?order=${order.id}`,
                actionLabel: "Ver orden",
                priority: ["ready_for_pickup", "delivered", "cancelled"].includes(nextId) ? "high" : "normal",
                metadata: {
                  old_status: prevStatusId,
                  new_status: nextId,
                  customer_name: order.customer_name
                }
              });
            }
          }
        } catch (notifError) {
          console.error("Error sending status change notification:", notifError);
        }

        clearEventCache(order.id);
        await loadEventsCallback(true);
        await handleRefresh();
        onUpdate?.();

        setShowStatusModal(false);

        console.log("[ChangeStatus] ✅ Cambio de estado completado");

      } catch (err) {
        console.error("[ChangeStatus] ❌ Error:", err);
        alert(`Error al cambiar estado:\n${err.message || "Verifique su conexión a internet"}`);
      } finally {
        setChangingStatus(false);
      }
    }

    await proceedWithStatusChange();
  }

  async function saveCancelReason(reason) {
    if (!order?.id) return;
    try {
      await base44.entities.Order.update(order.id, {
        status: "cancelled",
        updated_date: new Date().toISOString(),
        status_metadata: {
          kind: "cancelled",
          cancellation_reason: reason
        }
      });

      setStatus("cancelled");
      setOrder((prevOrder) => ({
        ...prevOrder,
        status: "cancelled",
        updated_date: new Date().toISOString(),
        status_metadata: { kind: "cancelled", cancellation_reason: reason }
      }));

      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "status_change",
        description: `Orden cancelada. Motivo: ${reason}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { to: "cancelled", reason }
      });

      setCancelModalOpen(false);
      onUpdate?.();
      clearEventCache(order.id);
      await loadEventsCallback(true);

      await NotificationService.notifyOrderStatusChange(
        { ...order, status: "cancelled", status_metadata: { kind: "cancelled", cancellation_reason: reason } },
        "cancelled",
        me
      );

    } catch (err) {
      console.error("Error cancelando orden:", err);
      alert(`Error: ${err.message || "No se pudo cancelar la orden"}`);
    }
  }

  async function saveWaitingParts({ supplier, tracking, partName, deviceLocation }) {
    if (!order?.id) return;
    try {
      const locationText = deviceLocation === "taller" ? "🏢 Equipo en taller" : "👤 Cliente tiene el equipo";
      const statusNote = [
      locationText,
      partName && `Pieza: ${partName}`,
      supplier && `Proveedor: ${supplier}`,
      tracking && `Tracking: ${tracking}`].
      filter(Boolean).join(" · ");

      // ✅ CAMBIAR ESTADO PRIMERO CON skipModalCheck=true
      await changeStatus("waiting_parts", statusNote, {
        supplier: supplier || "",
        tracking: tracking || "",
        part_name: partName || "",
        device_location: deviceLocation
      }, true); // ✅ PARÁMETRO PARA SALTAR VERIFICACIÓN DE MODAL

      // Actualizar campos adicionales
      await base44.entities.Order.update(order.id, {
        parts_supplier: supplier || "",
        parts_tracking: tracking || "",
        part_name: partName || "",
        device_location: deviceLocation
      });

      setOrder((prevOrder) => ({
        ...prevOrder,
        parts_supplier: supplier || "",
        parts_tracking: tracking || "",
        part_name: partName || "",
        device_location: deviceLocation,
        status: "waiting_parts"
      }));

      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "parts_info",
        description: statusNote,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { supplier, tracking, partName, deviceLocation }
      });

      setPartsModalOpen(false);
      onUpdate?.();
      clearEventCache(order.id);
      await loadEventsCallback(true);

      // ✅ TOAST DE CONFIRMACIÓN
      toast.success("✅ Estado cambiado a 'Esperando Piezas'");

    } catch (err) {
      console.error("Error guardando datos de piezas:", err);
      alert(`Error: ${err.message || "No se pudieron guardar los datos"}`);
    }
  }

  async function saveExternalShop({ shop, work }) {
    if (!order?.id) return;
    try {
      const statusNote = `Taller: ${shop || "—"} · Trabajo: ${work || "—"}`;
      
      // ✅ CAMBIAR ESTADO CON skipModalCheck=true para evitar loop
      await changeStatus("reparacion_externa", statusNote, {
        shop: shop || "",
        work: work || ""
      }, true);

      // Actualizar campos adicionales
      await base44.entities.Order.update(order.id, {
        external_shop: shop || "",
        external_work: work || ""
      });

      setOrder((prevOrder) => ({
        ...prevOrder,
        external_shop: shop || "",
        external_work: work || "",
        status: "reparacion_externa"
      }));

      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "external_shop",
        description: statusNote,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { shop, work }
      });

      setExternalModalOpen(false);
      onUpdate?.();
      clearEventCache(order.id);
      await loadEventsCallback(true);
      toast.success("✅ Estado cambiado a 'Reparación Externa'");
    } catch (err) {
      console.error("Error guardando taller externo:", err);
      alert(`Error: ${err.message || "No se pudieron guardar los datos"}`);
    }
  }

  const SecurityItem = ({ label, masked, onToggle, visibleValue }) =>
  <div className="min-w-0">
      <div className="text-[11px] text-gray-400 theme-light:text-gray-600">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-white font-mono tracking-widest theme-light:text-gray-900">
          {masked ? "••••••" : visibleValue || "—"}
        </span>
        <button className="text-gray-300 hover:text-white theme-light:text-gray-600 theme-light:hover:text-gray-900" onClick={onToggle} title="Mostrar/Ocultar">
          {masked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
    </div>;



  const eventStyle = (type) => {
    const t = String(type || "").toLowerCase();
    if (t === "note" || t === "note_added") return { pill: "bg-cyan-500/20 text-cyan-200 border-cyan-500/30 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300", box: "border-cyan-500/30 bg-cyan-500/10 theme-light:border-cyan-200 theme-light:bg-cyan-50" };
    if (t === "status_change") return { pill: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300", box: "border-emerald-500/30 bg-emerald-500/10 theme-light:border-emerald-200 theme-light:bg-emerald-50" };
    if (t === "parts_info") return { pill: "bg-lime-500/20 text-lime-200 border-lime-500/30 theme-light:bg-lime-100 theme-light:text-lime-700 theme-light:border-lime-300", box: "border-lime-500/30 bg-lime-500/10 theme-light:border-lime-200 theme-light:bg-lime-50" };
    if (t === "external_shop") return { pill: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/30", box: "border-fuchsia-500/10" };
    if (t === "photo_upload") return { pill: "bg-purple-500/20 text-purple-200 border-purple-500/30", box: "border-purple-500/30 bg-purple-500/10" };
    if (t === "stock_adjust") return { pill: "bg-teal-500/20 text-teal-200 border-teal-500/30", box: "border-teal-500/30 bg-teal-500/10" };
    if (t === "stock_warning") return { pill: "bg-orange-500/20 text-orange-200 border-orange-500/30", box: "border-orange-500/30 bg-orange-500/10" };
    if (t === "create") return { pill: "bg-emerald-600/20 text-emerald-200 border-emerald-600/30 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300", box: "border-emerald-600/30 bg-emerald-600/10 theme-light:border-emerald-200 theme-light:bg-emerald-50" };
    if (t === "initial_problem") return { pill: "bg-rose-500/20 text-rose-200 border-rose-500/30", box: "border-rose-500/30 bg-rose-500/10" };
    if (t === "pending_order") return { pill: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30", box: "border-yellow-500/30 bg-yellow-500/10" };
    if (t === "cancelled") return { pill: "bg-red-500/20 text-red-200 border-red-500/30", box: "border-red-500/30 bg-red-500/10" };
    if (t === "payment") return { pill: "bg-green-500/20 text-green-200 border-green-500/30", box: "border-green-500/30 bg-green-500/10" };
    if (t === "item_added" || t === "item_removed") return { pill: "bg-cyan-500/20 text-cyan-200 border-cyan-500/30 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300", box: "border-cyan-500/30 bg-cyan-500/10 theme-light:border-cyan-200 theme-light:bg-cyan-50" };
    if (t === "email_sent") return { pill: "bg-blue-500/20 text-blue-200 border-blue-500/30", box: "border-blue-500/30 bg-blue-500/10" };
    if (t === "email_failed") return { pill: "bg-red-500/20 text-red-200 border-red-500/30", box: "border-red-500/30 bg-red-500/10" };
    if (t === "link_added") return { pill: "bg-blue-600/20 text-blue-300 border-blue-600/30", box: "border-blue-600/30 bg-blue-600/10" }; // New style for links
    return { pill: "bg-gray-500/20 text-gray-200 border-gray-500/30", box: "border-gray-500/30 bg-gray-500/10" };
  };

  if (loading && !order && !loadError) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm">
        <style>{`
          body.wo-fullscreen nav[aria-orientation="vertical"],
          body.wo-fullscreen .sidebar,
          body.wo-fullscreen .left-nav,
          body.wo-fullscreen [data-sidebar],
          body.wo-fullscreen [aria-label="Sidebar"],
          body.wo-fullscreen [data-global-dock] {
            display: none !important;
          }
          body.wo-fullscreen .with-sidebar,
          body.wo-fullscreen .content,
          body.wo-fullscreen main,
          body.wo-fullscreen #root {
            margin-left: 0 !important;
            padding-left: 0 !important;
          }
        `}</style>
        <div className="absolute inset-0 grid place-items-center">
          <div className="bg-[#0F0F12] rounded-lg p-8 border border-white/10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
              <p className="text-white text-lg">Cargando orden...</p>
            </div>
          </div>
        </div>
      </div>);

  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm">
        <style>{`
          body.wo-fullscreen nav[aria-orientation="vertical"],
          body.wo-fullscreen .sidebar,
          body.wo-fullscreen .left-nav,
          body.wo-fullscreen [data-sidebar],
          body.wo-fullscreen [aria-label="Sidebar"],
          body.wo-fullscreen [data-global-dock] {
            display: none !important;
          }
          body.wo-fullscreen .with-sidebar,
          body.wo-fullscreen .content,
          body.wo-fullscreen main,
          body.wo-fullscreen #root {
            margin-left: 0 !important;
            padding-left: 0 !important;
          }
        `}</style>
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="bg-[#0F0F12] rounded-lg p-8 border border-white/10 max-w-md w-full">
            <div className="text-center">
              <p className="text-red-400 text-lg mb-4">Error al recargar la orden: ${loadError}</p>
              <Button onClick={handleClose} className="bg-red-600 hover:bg-red-700">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </div>);

  }

  if (!order) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm">
        <style>{`
          body.wo-fullscreen nav[aria-orientation="vertical"],
          body.wo-fullscreen .sidebar,
          body.wo-fullscreen .left-nav,
          body.wo-fullscreen [data-sidebar],
          body.wo-fullscreen [aria-label="Sidebar"],
          body.wo-fullscreen [data-global-dock] {
            display: none !important;
          }
          body.wo-fullscreen .with-sidebar,
          body.wo-fullscreen .content,
          body.wo-fullscreen main,
          body.wo-fullscreen #root {
            margin-left: 0 !important;
            padding-left: 0 !important;
          }
        `}</style>
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="bg-[#0F0F12] rounded-lg p-8 border border-white/10 max-w-md w-full">
            <div className="text-center">
              <p className="text-red-400 text-lg mb-4">Orden no disponible o no encontrada.</p>
              <Button onClick={handleClose} className="bg-red-600 hover:bg-red-700">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </div>);

  }

  return (
    <>
      <div ref={panelRef} className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm overflow-hidden kb-aware-panel" data-keyboard-aware>
        <style>{`
          body.wo-fullscreen nav[aria-orientation="vertical"],
          body.wo-fullscreen .sidebar,
          body.wo-fullscreen .left-nav,
          body.wo-fullscreen [data-sidebar],
          body.wo-fullscreen [aria-label="Sidebar"],
          body.wo-fullscreen [data-global-dock] {
            display: none !important;
          }
          body.wo-fullscreen .with-sidebar,
          body.wo-fullscreen .content,
          body.wo-fullscreen main,
          body.wo-fullscreen #root {
            margin-left: 0 !important;
            padding-left: 0 !important;
          }

          /* ✅ MOBILE RESPONSIVE - OPTIMIZADO PARA 6.5" */
          @media (max-width: 768px) {
            .wo-panel-content {
              padding: 0.75rem !important;
            }
            
            .wo-status-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 0.5rem !important;
            }

            .wo-header-title {
              font-size: 1.125rem !important;
            }

            /* Optimizar cards para móvil */
            .mobile-card-compact {
              padding: 0.75rem !important;
            }

            /* Botones más grandes para touch */
            button {
              min-height: 44px;
              min-width: 44px;
            }

            /* Inputs más legibles */
            input, textarea, select {
              font-size: 16px !important;
            }

            /* Espaciado entre secciones */
            .space-y-6 > * + * {
              margin-top: 1rem !important;
            }

            .space-y-4 > * + * {
              margin-top: 0.75rem !important;
            }

            /* Grid responsive para campos */
            .grid-cols-2 {
              grid-template-columns: 1fr !important;
            }

            /* Header más compacto */
            .wo-header {
              padding: 0.5rem 0.75rem !important;
            }
          }

          /* Pantallas muy pequeñas (< 400px) */
          @media (max-width: 400px) {
            .wo-panel-content {
              padding: 0.5rem !important;
            }

            .wo-status-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        <div className="h-full flex flex-col bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] theme-light:bg-gray-50">
          {/* ✅ HEADER RESPONSIVE */}
          <div className="flex-shrink-0 border-b border-gray-800 bg-black/60 backdrop-blur theme-light:border-gray-200 theme-light:bg-white/80 wo-header">
            <div className="max-w-[1800px] mx-auto px-2 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-4 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="text-gray-400 hover:text-white flex-shrink-0 h-8 w-8 sm:w-auto p-0 sm:px-3 theme-light:text-gray-600 theme-light:hover:text-gray-900">
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline sm:ml-2">Cerrar</span>
                </Button>

                {order &&
                <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
                    <h1 className="text-sm sm:text-xl font-bold text-white truncate wo-header-title theme-light:text-gray-900">
                      {order.order_number}
                    </h1>
                    <Badge className={`${getStatusConfig(order.status).colorClasses} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 whitespace-nowrap`}>
                      {getStatusConfig(order.status).label}
                    </Badge>
                  </div>
                }
              </div>

              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPrintDialog(true)}
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20 hover:border-cyan-500/50 w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0"
                  title="Imprimir orden"
                >
                  <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRequestDelete}
                  disabled={deleting}
                  className="border-red-500/30 text-red-400 hover:bg-red-600/20 hover:border-red-500/50 w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0"
                  title="Eliminar orden"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </div>
          </div>

          {loading && !order ?
          <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
                <p className="text-white text-lg theme-light:text-gray-900">Cargando orden...</p>
              </div>
            </div> :
          loadError ?
          <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-[#0F0F12] rounded-lg p-6 sm:p-8 border border-white/10 max-w-md w-full theme-light:bg-white theme-light:border-gray-200">
                <div className="text-center">
                  <p className="text-red-400 text-base sm:text-lg mb-4 theme-light:text-red-600">{loadError}</p>
                  <Button onClick={handleClose} className="bg-red-600 hover:bg-red-700">
                    Cerrar
                  </Button>
                </div>
              </div>
            </div> :
          !order ?
          <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-[#0F0F12] rounded-lg p-6 sm:p-8 border border-white/10 max-w-md w-full theme-light:bg-white theme-light:border-gray-200">
                <div className="text-center">
                  <p className="text-red-400 text-base sm:text-lg mb-4 theme-light:text-red-600">Orden no disponible o no encontrada.</p>
                  <Button onClick={handleClose} className="bg-red-600 hover:bg-red-700">
                    Cerrar
                  </Button>
                </div>
              </div>
            </div> :

          <div className="flex-1 overflow-y-auto">
              <div className="max-w-[1800px] mx-auto px-2 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6 wo-panel-content">

                {/* ✅ ESTADO - GRID RESPONSIVE */}
                <Card className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-200 mobile-card-compact">
                  <CardHeader className="border-b border-cyan-500/20 pb-2 sm:pb-4 theme-light:border-gray-200 p-3 sm:p-6">
                    <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-lg theme-light:text-gray-900">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      Estado de la Orden
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 sm:pt-6 p-3 sm:p-6">
                    <div className="mb-3 sm:mb-6 p-2.5 sm:p-4 rounded-lg bg-gradient-to-r from-cyan-600/20 to-emerald-600/20 border-2 border-cyan-500/50 theme-light:from-cyan-50 theme-light:to-emerald-50 theme-light:border-cyan-300">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1 theme-light:text-gray-600">Estado Actual</p>
                          <p className="text-lg sm:text-2xl font-bold text-white theme-light:text-gray-900">
                            {(isSoftwareOrder && status === "in_progress") ? "En Progreso" : getStatusConfig(status).label}
                          </p>
                        </div>
                        <div className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full border ${getStatusConfig(status).colorClasses}`}>
                          <span className="text-[10px] sm:text-sm font-semibold">
                            {(isSoftwareOrder && status === "in_progress") ? "En Progreso" : getStatusConfig(status).label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                      <p className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wide">
                        Cambiar Estado
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-3 wo-status-grid">
                        {activeStatuses.map((s) => {
                        const config = getStatusConfig(s.id);
                        const isCurrent = normalizeStatusId(status) === s.id;

                        return (
                          <button
                            key={s.id}
                            onClick={() => !isCurrent && changeStatus(s.id, "", {})}
                            disabled={isCurrent || changingStatus}
                            className={`
                                p-2 sm:p-3 rounded-lg border-2 transition-all text-left
                                ${isCurrent ?
                            `${config.colorClasses} opacity-50 cursor-not-allowed` :
                            `border-white/10 bg-black/40 hover:${config.colorClasses.replace('text-', 'border-').split(' ')[0]} hover:bg-white/5 theme-light:bg-gray-50 theme-light:border-gray-200`}
                              `
                            }>

                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-semibold ${isCurrent ? '' : 'text-gray-400 theme-light:text-gray-600'}`}>
                                  {config.label}
                                </span>
                                {isCurrent && <Check className="w-3 h-3 sm:w-4 sm:h-4" />}
                              </div>
                              {isCurrent &&
                            <div className="text-[10px] text-gray-300 mt-1 theme-light:text-gray-500">
                                  Estado actual
                                </div>
                            }
                            </button>);

                      })}
                      </div>
                    </div>

                    <div className="mt-3 sm:mt-6 pt-3 sm:pt-6 border-t border-white/10 theme-light:border-gray-200">
                      <p className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2 sm:mb-3">
                        Estados Finales
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                        {closedStatuses.map((s) => {
                        const config = getStatusConfig(s.id);
                        const isCurrent = normalizeStatusId(status) === s.id;

                        return (
                          <button
                            key={s.id}
                            onClick={() => !isCurrent && changeStatus(s.id, "", {})}
                            disabled={isCurrent || changingStatus}
                            className={`
                                p-2 sm:p-3 rounded-lg border-2 transition-all text-left min-h-[44px]
                                ${isCurrent ?
                            `${config.colorClasses} opacity-50 cursor-not-allowed` :
                            `border-white/10 bg-black/40 hover:${config.colorClasses.replace('text-', 'border-').split(' ')[0]} hover:bg-white/5 theme-light:bg-gray-50 theme-light:border-gray-200`}
                              `
                            }>

                              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                                <span className={`text-[10px] sm:text-xs font-semibold ${isCurrent ? '' : 'text-gray-400 theme-light:text-gray-600'}`}>
                                  {config.label}
                                </span>
                                {isCurrent && <Check className="w-3 h-3 sm:w-4 sm:h-4" />}
                              </div>
                              {isCurrent &&
                            <div className="text-[9px] sm:text-[10px] text-gray-300 mt-0.5 sm:mt-1 theme-light:text-gray-500">
                                  Estado actual
                                </div>
                            }
                            </button>);

                      })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ✅ CHECKLIST VISUAL MEJORADO */}
                {Array.isArray(order.checklist_items) && order.checklist_items.length > 0 &&
              <Card className="bg-[#0F0F12] border-white/10 p-5 theme-light:bg-white theme-light:border-gray-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <CheckCircle2 className="w-6 h-6 text-red-600" />
                        Checklist de Recepción
                        <Badge className="bg-white/10 text-white ml-2">
                          {order.checklist_items.length} condiciones
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                    const categoryMap = {
                      "screen_broken": "Pantalla",
                      "screen_no_image": "Pantalla",
                      "screen_lines": "Pantalla",
                      "screen_spots": "Pantalla",
                      "screen_discoloration": "Pantalla",
                      "touch_not_working": "Touch",
                      "touch_intermittent": "Touch",
                      "touch_ghost": "Touch",
                      "touch_zones_dead": "Touch",
                      "battery_drains": "Batería",
                      "battery_no_charge": "Batería",
                      "battery_swollen": "Batería",
                      "battery_percentage_stuck": "Batería",
                      "port_damaged": "Carga",
                      "port_dirty": "Carga",
                      "charging_slow": "Carga",
                      "wireless_charging_issue": "Carga",
                      "no_power": "Encendido",
                      "random_shutdown": "Encendido",
                      "boot_loop": "Encendido",
                      "power_button_stuck": "Encendido",
                      "volume_button_issue": "Botones",
                      "home_button_issue": "Botones",
                      "back_button_issue": "Botones",
                      "no_sound": "Audio",
                      "speaker_distorted": "Audio",
                      "mic_not_working": "Audio",
                      "earpiece_issue": "Audio",
                      "headphone_jack": "Audio",
                      "rear_camera_issue": "Cámaras",
                      "front_camera_issue": "Cámaras",
                      "camera_black_screen": "Cámaras",
                      "flash_not_working": "Cámaras",
                      "wifi_not_working": "Conectividad",
                      "bluetooth_issue": "Conectividad",
                      "signal_issue": "Conectividad",
                      "imei_null": "Conectividad",
                      "gps_not_working": "Conectividad",
                      "faceid_not_tested": "Seguridad",
                      "faceid_not_working": "Seguridad",
                      "pattern_not_tested": "Seguridad",
                      "system_slow": "Software",
                      "apps_crash": "Software",
                      "icloud_locked": "Software",
                      "google_locked": "Software",
                      "system_corrupted": "Software",
                      "housing_damage": "Físico",
                      "back_glass_broken": "Físico",
                      "water_damage": "Físico",
                      "corrosion": "Físico",
                      "bent_frame": "Físico",
                      "missing_screws": "Extras",
                      "third_party_parts": "Extras",
                      "accessories_included": "Extras"
                    };

                    const grouped = {};
                    order.checklist_items.forEach((item) => {
                      const category = categoryMap[item.id] || "Otros";
                      if (!grouped[category]) grouped[category] = [];
                      grouped[category].push(item);
                    });

                    return Object.entries(grouped).map(([category, items]) =>
                    <div key={category} className="mb-6 last:mb-0">
                            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
                              <span className="text-red-400">▸</span>
                              {category}
                              <Badge className="bg-white/10 text-white text-xs">
                                {items.length}
                              </Badge>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {items.map((item, idx) =>
                        <div
                          key={`${item.id}-${idx}`}
                          className="group relative bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-300/30 rounded-lg p-3 hover:shadow-lg hover:shadow-red-600/20 transition-all">

                                  {/* Efecto glass animado */}
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                                  
                                  {/* Contenido */}
                                  <div className="relative flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-xs sm:text-sm font-medium leading-tight">
                                        {item.label}
                                      </p>
                                      {item.notes &&
                              <p className="text-gray-400 text-xs mt-1 italic">
                                          {item.notes}
                                        </p>
                              }
                                    </div>
                                  </div>
                                </div>
                        )}
                            </div>
                          </div>
                    );
                  })()}
                    </CardContent>
                  </Card>
              }

                {/* RESUMEN - Con tema claro */}
                <Card className="p-2.5 sm:p-4 bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-200 mobile-card-compact">
                  <h3 className="text-white font-semibold mb-2.5 sm:mb-3 text-sm sm:text-base flex items-center gap-2 theme-light:text-gray-900">
                    <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500 theme-light:text-cyan-600" />
                    Resumen
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:gap-4">
                    <Field label="Cliente" value={o.customer_name} />
                    <PhoneField phoneRaw={o.customer_phone} />
                    <EmailField email={o.customer_email} />
                    {o.company_name && <Field label="Empresa" value={o.company_name} />}

                    <Field label="Equipo" value={`${o.device_brand || "—"} ${o.device_family || ""} ${o.device_model || ""}`} />
                    <Field label="Tipo" value={o.device_type || o.device_subcategory || "—"} />
                    <Field label="Serie / IMEI" value={o.device_serial} mono />
                    <Field label="Términos aceptados" value={o.terms_accepted ? "Sí" : "No"} />

                    {(o.parts_supplier || o.parts_tracking || o.part_name || o.device_location) &&
                  <>
                        {o.device_location &&
                    <Field label="Ubicación del equipo">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${
                      o.device_location === "taller" ?
                      "bg-cyan-600/20 text-cyan-300 border-cyan-500/30 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300" :
                      "bg-emerald-600/20 text-emerald-300 border-emerald-500/30 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300"}`
                      }>
                              {o.device_location === "taller" ? "🏢 En taller" : "👤 Con cliente"}
                            </span>
                          </Field>
                    }
                        <Field label="Pieza" value={o.part_name} />
                        <Field label="Suplidor (piezas)" value={o.parts_supplier} />
                        <Field label="Tracking (piezas)" value={o.parts_tracking} />
                      </>
                  }

                    {(o.external_shop || o.external_work) &&
                  <>
                        <Field label="Taller externo" value={o.external_shop} />
                        <Field label="Trabajo externo" value={o.external_work} />
                      </>
                  }

                    {o.status === "cancelled" && o.status_metadata?.cancellation_reason &&
                  <div className="sm:col-span-2">
                        <Field label="Motivo de cancelación" value={o.status_metadata.cancellation_reason} />
                      </div>
                  }
                  </div>
                </Card>

                {/* PIEZAS Y SERVICIOS - Con tema claro */}
                <OrderItemsSection
                order={o}
                onUpdated={onUpdate}
                clearEventCache={clearEventCache}
                loadEventsCallback={loadEventsCallback} />


                {/* SEGURIDAD - Con tema claro */}
                <Card className="p-2.5 sm:p-4 bg-gradient-to-br from-lime-600/10 to-emerald-600/10 border-lime-500/20 theme-light:bg-white theme-light:border-gray-200 mobile-card-compact">
                  <div className="flex items-center justify-between mb-2.5 sm:mb-3 gap-2">
                    <h3 className="text-white font-semibold text-sm sm:text-base flex items-center gap-2 theme-light:text-gray-900">
                      <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-lime-500 theme-light:text-lime-600" />
                      <span className="hidden xs:inline">Seguridad del Dispositivo</span>
                      <span className="xs:hidden">Seguridad</span>
                    </h3>
                    <Button
                      onClick={() => setShowSecurityDialog(true)}
                      size="sm"
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8 px-2 sm:px-3 text-xs flex-shrink-0"
                    >
                      {hasAnySecurity ? "✏️ Editar" : "+ Añadir"}
                    </Button>
                  </div>
                  {!hasAnySecurity ?
                <div className="p-4 border-2 border-dashed border-white/10 rounded-lg text-center theme-light:border-gray-300">
                    <Lock className="w-8 h-8 mx-auto text-gray-600 mb-2 theme-light:text-gray-400" />
                    <p className="text-[13px] text-gray-400 theme-light:text-gray-600">Sin información de seguridad</p>
                    <p className="text-[11px] text-gray-500 mt-1">Haz clic en "Añadir" para configurar PIN, Password o Patrón</p>
                  </div> :

                <div className="space-y-3">
                      {hasPin &&
                  <div className="bg-black/30 border border-cyan-500/20 rounded-lg p-3 theme-light:bg-cyan-50 theme-light:border-cyan-300">
                          <SecurityItem
                        label="📱 PIN Numérico"
                        masked={!showPin}
                        onToggle={() => setShowPin((v) => !v)}
                        visibleValue={safeAtob(sec.device_pin)} />
                        </div>
                  }
                      
                      {hasPassword &&
                  <div className="bg-black/30 border border-emerald-500/20 rounded-lg p-3 theme-light:bg-emerald-50 theme-light:border-emerald-300">
                          <SecurityItem
                        label="🔒 Password / Contraseña"
                        masked={!showPass}
                        onToggle={() => setShowPass((v) => !v)}
                        visibleValue={safeAtob(sec.device_password)} />
                        </div>
                  }
                      
                      {hasPattern &&
                  <div className="bg-black/30 border border-purple-500/30 rounded-lg p-3 theme-light:bg-purple-50 theme-light:border-purple-300">
                          <div className="text-[11px] text-gray-400 mb-2 font-semibold theme-light:text-gray-600">🔲 Patrón de Bloqueo (Android)</div>
                          {sec.pattern_vector ? (
                            <div className="flex flex-col items-center gap-3">
                              <PatternDisplay patternVector={sec.pattern_vector} size={200} />
                              <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-lg p-2 w-full">
                                <p className="text-xs text-cyan-300 font-mono text-center theme-light:text-cyan-700">
                                  {sec.pattern_vector}
                                </p>
                              </div>
                            </div>
                          ) : sec.pattern_image ? (
                            <img
                              src={sec.pattern_image}
                              alt="Patrón de bloqueo"
                              className="w-full max-w-[250px] h-auto object-contain rounded-md border border-purple-400/30 bg-white shadow-lg theme-light:border-purple-300" />
                          ) : null}
                        </div>
                  }

                      {sec.security_notes && 
                    <div className="bg-black/30 border border-gray-500/20 rounded-lg p-3 theme-light:bg-gray-50 theme-light:border-gray-300">
                        <div className="text-[11px] text-gray-400 mb-1 font-semibold theme-light:text-gray-600">📝 Notas</div>
                        <p className="text-[12px] text-gray-200 whitespace-pre-wrap theme-light:text-gray-700">{sec.security_notes}</p>
                      </div>
                    }
                    </div>
                }
                </Card>

                {/* FOTOS/EVIDENCIAS - Con tema claro */}
                <Card className="p-2.5 sm:p-4 bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-200 mobile-card-compact">
                  <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3 flex-wrap">
                    <h3 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base theme-light:text-gray-900">
                      <span className="hidden xs:inline">Fotos / Evidencias</span>
                      <span className="xs:hidden">Fotos</span>
                      <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </h3>
                    <div className="flex items-center gap-2">
                      <label className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 h-8 sm:h-9 rounded-md cursor-pointer text-xs sm:text-sm ${uploading ? "bg-gray-700 text-gray-300" : "bg-red-600 hover:bg-red-700 text-white"}`}>
                        {uploading ? "..." : "Subir"}
                        <input type="file" accept="image/*,video/*" multiple onChange={handleUploadMore} className="hidden" disabled={uploading} />
                      </label>
                    </div>
                  </div>

                  {uploadErr && <div className="text-[12px] text-amber-300 mb-2 theme-light:text-amber-700">{uploadErr}</div>}

                  <OrderPhotosGallery photos={photos} onPhotoClick={handlePhotoClick} />
                </Card>

                {/* ✅ NOTAS Y LINKS - LADO A LADO */}
                <Card className="bg-[#0F0F12] border-white/10 theme-light:bg-white theme-light:border-gray-200 mobile-card-compact">
                  <CardHeader className="border-b border-white/10 pb-2.5 sm:pb-4 theme-light:border-gray-200 p-2.5 sm:p-6">
                    <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-lg theme-light:text-gray-900">
                      <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                      Notas y Links
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 sm:pt-6 space-y-3 sm:space-y-4 p-2.5 sm:p-6">
                    {/* Grid para inputs lado a lado en desktop, apilados en móvil */}
                    <div className="grid grid-cols-1 gap-3">
                      {/* Añadir Comentario */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide theme-light:text-gray-600">
                          💬 Añadir Comentario
                        </label>
                        <div className="flex gap-2">
                          <Input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Escribe una nota interna..."
                          className="flex-1 bg-black/40 border-white/15 text-white h-10 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              addNote();
                            }
                          }} />

                          <Button
                          onClick={addNote}
                          disabled={savingNote || !noteText.trim()}
                          className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 h-10 px-4">

                            {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Añadir Link con Nombre de Pieza */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide theme-light:text-gray-600">
                          🔗 Añadir Link de Pieza
                        </label>
                        <div className="space-y-2">
                          <Input
                          value={linkPartName}
                          onChange={(e) => setLinkPartName(e.target.value)}
                          placeholder="Nombre de la pieza *"
                          className="bg-black/40 border-white/15 text-white h-10 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

                          <div className="flex gap-2">
                            <Input
                            value={linkText}
                            onChange={(e) => setLinkText(e.target.value)}
                            placeholder="https://proveedor.com/pieza..."
                            className="flex-1 bg-black/40 border-white/15 text-white h-10 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                            type="url"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                addLink();
                              }
                            }} />

                            <Button
                            onClick={addLink}
                            disabled={savingLink || !linkText.trim() || !linkPartName.trim()}
                            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 h-10 px-4">

                              {savingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* TIMELINE DE ACTIVIDAD - Con tema claro */}
                <Card className="p-2.5 sm:p-4 bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-200 mobile-card-compact">
                  <h4 className="text-white font-semibold mb-2.5 sm:mb-3 flex items-center gap-2 text-sm sm:text-base theme-light:text-gray-900">
                    <span className="hidden xs:inline">Timeline de actividad</span>
                    <span className="xs:hidden">Actividad</span>
                    <ActivitySquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </h4>

                  {loadingEvents &&
                <div className="text-center py-4 text-gray-400 text-xs sm:text-sm theme-light:text-gray-600">Cargando eventos...</div>
                }

                  {(o.initial_problem || "").trim() &&
                <div className={`mb-3 p-3 rounded-md border ${eventStyle("initial_problem").box} theme-light:bg-rose-50 theme-light:border-rose-200`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Pin className="w-4 h-4 text-rose-300 theme-light:text-rose-600" />
                          <span className="text-white font-medium text-xs sm:text-sm theme-light:text-gray-900">Problema inicial</span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-gray-300 theme-light:text-gray-600">
                          {o.created_date || o.created_at ? new Date(o.created_date || o.created_at).toLocaleString() : "—"}
                        </div>
                      </div>
                      <div className="mt-1 text-[12px] sm:text-[13px] text-gray-100 whitespace-pre-wrap break-words theme-light:text-gray-700">
                        <LinkifiedText text={o.initial_problem} />
                      </div>
                    </div>
                }

                  {!loadingEvents && events.length === 0 ?
                <div className="text-[12px] sm:text-[13px] text-gray-400 theme-light:text-gray-600">Sin actividad aún.</div> :

                <ul className="space-y-3">
                      {events.map((ev) => {
                    const ts = new Date(ev.created_at || ev.created_date || ev.createdOn || Date.now());
                    const name = ev.user_name || "Sistema";
                    const initials = (name || "?").split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("");
                    const styles = eventStyle(ev.event_type);

                    const isComment = ev.event_type === "note" || ev.event_type === "note_added";
                    const commentMeta = isComment ? ev.metadata || {} : {};
                    let commentTarget = "";
                    if (isComment) {
                      if (commentMeta.for_customer) {
                        commentTarget = "(Cliente)";
                      } else if (commentMeta.internal_only) {
                        commentTarget = "(Interno)";
                      } else if (commentMeta.target_user_id) {
                        commentTarget = `(Usuario: ${commentMeta.target_user_name || commentMeta.target_user_id})`;
                      }
                    }

                    return (
                      <li key={ev.id} className={`p-2 sm:p-3 rounded-md border ${styles.box}`}>
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 text-white grid place-items-center text-[11px] sm:text-[12px] flex-shrink-0 theme-light:bg-gray-200 theme-light:text-gray-700">
                                {initials || "?"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[12px] sm:text-[13px] text-white font-medium truncate theme-light:text-gray-900">{name}</span>
                                    <span className={`text-[9px] sm:text-[10px] border rounded-full px-1.5 py-[1px] ${styles.pill}`}>
                                      {ev.event_type || "evento"} {commentTarget && <span className="ml-1">{commentTarget}</span>}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-[10px] sm:text-[11px] text-gray-300 whitespace-nowrap theme-light:text-gray-600">
                                      {ts.toLocaleString()}
                                    </div>
                                    {isComment &&
                                <button
                                  className="text-gray-300 hover:text-cyan-400 theme-light:text-gray-500 theme-light:hover:text-cyan-600"
                                  title="Eliminar comentario"
                                  onClick={() => setPinModal({ open: true, targetNoteId: ev.id, forOrder: false })}>

                                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                      </button>
                                }
                                  </div>
                                </div>
                                <div className="text-[12px] sm:text-[13px] text-gray-100 mt-1 whitespace-pre-wrap break-words theme-light:text-gray-700">
                                  <LinkifiedText text={ev.description || ""} />
                                </div>
                              </div>
                            </div>
                          </li>);

                  })}
                    </ul>
                }
                </Card>

              </div>
            </div>
          }
        </div>

        {/* ✅ MODALES CON Z-INDEX CORRECTO */}
        <PinPadModal
          open={pinModal.open}
          onClose={() => setPinModal({ open: false, targetNoteId: null, forOrder: false })}
          title="PIN administrativo"
          onSubmit={async (pin) => {
            if (pinModal.forOrder) {
              console.warn("Order deletion attempted via PIN modal, but UI button is removed.");
              throw new Error("Acción no permitida desde esta interfaz");
            } else if (pinModal.targetNoteId) {
              await deleteNote(pinModal.targetNoteId, pin);
            }
          }} />


        <WaitingPartsModal
          open={partsModalOpen}
          onClose={() => setPartsModalOpen(false)}
          onSave={saveWaitingParts} />


        <ExternalShopModal
          open={externalModalOpen}
          onClose={() => setExternalModalOpen(false)}
          onSave={saveExternalShop} />


        <CancelOrderModal
          open={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onSave={saveCancelReason} />


        <Lightbox
          open={lbOpen}
          items={photos}
          index={lbIndex}
          onClose={() => setLbOpen(false)}
          onMove={(next) => setLbIndex(next)} />

        <SecurityEditDialog
          open={showSecurityDialog}
          onClose={() => setShowSecurityDialog(false)}
          order={order}
          onUpdate={async () => {
            await handleRefresh(true);
            onUpdate?.();
          }}
        />

        {/* ⚠️ DIÁLOGO DE SEGURIDAD ANTES DE PAGO */}
        {showSecurityBeforePayment && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-950 rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-purple-500/30 shadow-[0_0_100px_rgba(168,85,247,0.4)]">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mx-auto mb-4 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.6)]">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                  Información de Seguridad
                </h2>
                <p className="text-purple-300/70 text-sm">
                  Antes de cobrar, ingresa el PIN, password o patrón del dispositivo
                </p>
              </div>

              <SecurityEditDialog
                open={true}
                onClose={() => setShowSecurityBeforePayment(false)}
                order={order}
                onUpdate={handleSecuritySavedBeforePayment}
                embedded={true}
              />

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 border-purple-500/30 bg-slate-900/60 hover:bg-slate-800/80"
                  onClick={() => setShowSecurityBeforePayment(false)}
                >
                  Omitir y Cobrar
                </Button>
              </div>
            </div>
          </div>
        )}

        {showAdminAuth && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <AdminAuthGate
              onSuccess={handleAuthSuccess}
              onCancel={handleAuthCancel}
            />
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 rounded-3xl p-8 max-w-md w-full border border-cyan-500/30 shadow-[0_0_100px_rgba(6,182,212,0.4)]">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-600 to-emerald-600 mx-auto mb-6 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.6)]">
                  <Trash2 className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 mb-3">
                  ¿Confirmar eliminación?
                </h2>
                
                <p className="text-gray-400 mb-6">
                  Esta acción no se puede deshacer. La orden <strong className="text-cyan-400">#{order?.order_number}</strong> será eliminada permanentemente.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-cyan-500/30 bg-slate-900/60 hover:bg-slate-800/80"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 shadow-[0_8px_32px_rgba(239,68,68,0.5)]"
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
                  </Button>
                </div>

                <p className="text-slate-600 text-xs mt-4">
                  Presiona Enter para confirmar • ESC para cancelar
                </p>
              </div>
            </div>
          </div>
        )}

        {showPrintDialog && order && (
          <UniversalPrintDialog
            open={showPrintDialog}
            onClose={() => setShowPrintDialog(false)}
            type="order"
            data={order}
            customer={{
              name: order.customer_name,
              phone: order.customer_phone,
              email: order.customer_email
            }}
          />
        )}

      </div>
    </>
  );
}
