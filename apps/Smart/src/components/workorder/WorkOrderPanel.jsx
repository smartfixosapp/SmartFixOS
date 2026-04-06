import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  X, PhoneCall, MessageCircle, Eye, EyeOff, Trash2,
  Smartphone, Laptop, Tablet, Watch, Gamepad2, Camera as CameraIcon, Box, Image as ImageIcon, List,
  CheckCircle2, Check, PackageOpen, Pin, ActivitySquare, Plus, Minus, Search, Factory, RefreshCw, ShoppingCart, DollarSign, AlertCircle,
  ClipboardList, Shield, MessageSquare, Link, Loader2, Download, Grid3x3, Lock, FileText, Hash, Share2, Wallet, CreditCard, Mail, Printer } from
"lucide-react";
import OrderPhotosGallery from "../orders/OrderPhotosGallery";
import { ORDER_STATUSES, getStatusConfig, normalizeStatusId, getEffectiveOrderStatus } from "@/components/utils/statusRegistry";
import NotificationService from "../notifications/NotificationService";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { base44 } from "@/api/base44Client";
import { sendTemplatedEmail } from "@/api/functions";

import QuickPayModal from "@/components/pos/QuickPayModal";
import UniversalPrintDialog from "../printing/UniversalPrintDialog";
import { LinkifiedText } from "@/components/utils/linkify";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKeyboardScrollIntoView } from "@/components/utils/KeyboardAwareLayout";
import { toast } from 'sonner';
import AddItemModal from './AddItemModal';
import PrintDialog from "../printing/PrintDialog";
import { downloadWorkOrderPDF } from "../invoice/WorkOrderPDFGenerator";
import SecurityEditDialog from "./SecurityEditDialog";
import AdminAuthGate from "../users/AdminAuthGate";
import { dataClient } from "@/components/api/dataClient";
import PatternDisplay from "@/components/security/PatternDisplay";
import { ChevronRight, ChevronDown, Filter, Zap } from "lucide-react";
import CountdownBadge from "@/components/orders/CountdownBadge";
import { usePanelState } from "@/components/utils/panelContext";
import IntakeStage from "./stages/IntakeStage";
import DiagnosingStage from "./stages/DiagnosingStage";
import RepairStage from "./stages/RepairStage";
import DeliveryStage from "./stages/DeliveryStage";
import FinalizedStage from "./stages/FinalizedStage";
import PendingOrderStage from "./stages/PendingOrderStage";
import WaitingPartsStage from "./stages/WaitingPartsStage.jsx";
import PartArrivedStage from "./stages/PartArrivedStage.jsx";
import ExternalRepairStage from "./stages/ExternalRepairStage";
import WarrantyStage from "./stages/WarrantyStage";
import CancelledStage from "./stages/CancelledStage";
import AwaitingApprovalStage from "./stages/AwaitingApprovalStage";
import { getLocalOrders, getUnsyncedLocalOrders, mergeOrders, removeLocalOrder } from "@/components/utils/localOrderCache";
import { logWorkOrderPhotoEvent } from "@/components/workorder/utils/auditEvents";
import { loadSuppliersSafe } from "@/components/utils/suppliers";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import WOActionSidebar from "@/components/workorder/layout/WOActionSidebar";
import WODetailCenter from "@/components/workorder/layout/WODetailCenter";
import WOTabPanel from "@/components/workorder/layout/WOTabPanel";
import { loadOrderLinks } from "@/components/workorder/utils/orderLinksStore";
import MobileRepairDetail from "@/components/workorder/layout/mobile/MobileRepairDetail";


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

import { createPortal } from "react-dom";

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

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-50">
        <X className="w-6 h-6" />
      </button>

      {index > 0 &&
      <button
        onClick={(e) => {e.stopPropagation();onMove(index - 1);}}
        className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-50">
          ←
        </button>
      }

      {index < items.length - 1 &&
      <button
        onClick={(e) => {e.stopPropagation();onMove(index + 1);}}
        className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-50">
          →
        </button>
      }

      <div className="relative max-w-6xl max-h-[90vh] p-4 flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {isVideo ?
        <video
          src={current.publicUrl || current.thumbUrl}
          controls
          autoPlay
          className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" /> :
        <img
          src={current.publicUrl || current.thumbUrl}
          alt={current.filename || "Foto"}
          className="max-w-full max-h-[80vh] rounded-lg object-contain shadow-2xl" />
        }
        <p className="text-white text-center mt-4 text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
          {index + 1} / {items.length}
          {current.filename && ` • ${current.filename}`}
        </p>
      </div>
    </div>,
    document.body
  );
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

function findLocalOrder(orderId) {
  const all = getLocalOrders();
  const id = String(orderId || "");
  if (!id) return null;
  return all.find((o) =>
    String(o?.id || "") === id ||
    String(o?.order_number || "") === id ||
    `local-order-${String(o?.order_number || "")}` === id
  ) || null;
}

function mergeOrderSnapshot(remoteOrder, localOrder) {
  if (remoteOrder && localOrder) {
    // Remote (Supabase) must win for payment-related fields so fresh DB values
    // are never overwritten by stale localStorage cache.
    const REMOTE_WINS_FIELDS = [
      "amount_paid", "balance_due", "paid", "deposit_amount",
      "total", "subtotal", "tax_amount", "discount_amount",
      "updated_date",
      // Status fields: DB is authoritative — local cache must never override a status change
      "status", "status_metadata", "status_note", "status_history",
      "status_note_visible_to_customer",
    ];
    const merged = { ...remoteOrder, ...localOrder };
    for (const field of REMOTE_WINS_FIELDS) {
      if (remoteOrder[field] !== undefined) {
        merged[field] = remoteOrder[field];
      }
    }
    return merged;
  }
  return remoteOrder || localOrder || null;
}


function extractOrderSequence(orderNumber) {
  const raw = String(orderNumber || "").trim();
  const match = raw.match(/^WO-(\d+)$/i);
  if (!match) return 0;
  const n = Number(match[1] || 0);
  return Number.isFinite(n) ? n : 0;
}

function isAssignedToCurrentUser(order, user) {
  const normalizePerson = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const assignedKeys = [
    String(order?.assigned_to || "").trim().toLowerCase(),
    String(order?.assigned_to_name || "").trim().toLowerCase(),
  ].filter(Boolean);
  const assignedName = normalizePerson(order?.assigned_to_name || "");
  const userKeys = [
    String(user?.id || "").trim().toLowerCase(),
    String(user?.email || "").trim().toLowerCase(),
    String(user?.full_name || "").trim().toLowerCase(),
    String(user?.name || "").trim().toLowerCase(),
  ].filter(Boolean);
  const userName = normalizePerson(user?.full_name || user?.name || "");
  if (!userKeys.length) return false;

  const directMatch = assignedKeys.some((assigned) => userKeys.includes(assigned));
  if (directMatch) return true;

  // Fallback por nombre normalizado (evita fallos por acentos, mayúsculas y espacios)
  if (assignedName && userName) {
    if (assignedName === userName) return true;
    if (assignedName.includes(userName) || userName.includes(assignedName)) return true;
  }

  return false;
}

function isOwnedByCurrentUser(order, user) {
  const normalizePerson = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const createdBy = normalizePerson(order?.created_by || "");
  const userName = normalizePerson(user?.full_name || user?.name || "");
  const userEmail = String(user?.email || "").trim().toLowerCase();
  if (!createdBy) return false;
  if (userEmail && createdBy === userEmail) return true;
  if (userName && (createdBy === userName || createdBy.includes(userName) || userName.includes(createdBy))) return true;
  return false;
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

function WaitingPartsModal({ open, onClose, onSave, initialData, order }) {
  const [formData, setFormData] = useState({
    supplier: "",
    tracking: "",
    partName: "",
    carrier: "",
    deviceLocation: ""
  });
  const [err, setErr] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [hasLoadedSuppliers, setHasLoadedSuppliers] = useState(false);
  const [linkNames, setLinkNames] = useState([]);
  const [linkSummary, setLinkSummary] = useState("");
  const [catalogSuggestions, setCatalogSuggestions] = useState([]);
  const [selectedParts, setSelectedParts] = useState(new Set());

  const togglePart = (name) => {
    setSelectedParts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // Cargar catálogo de piezas cuando se abre
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    dataClient?.entities?.Product?.list("-updated_date", 200)
      .then(items => {
        if (cancelled || !Array.isArray(items)) return;
        const names = [...new Set(items.map(i => i.name).filter(Boolean))].sort();
        setCatalogSuggestions(names);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  // Cargar suplidores solo UNA VEZ cuando se abre
  useEffect(() => {
    if (!open) return;
    if (hasLoadedSuppliers) return;
    
    let mounted = true;
    setLoadingSuppliers(true);
    
    loadSuppliersSafe()
      .then(data => {
        if (mounted) {
          setSuppliers(data || []);
          setHasLoadedSuppliers(true);
        }
      })
      .catch(error => console.error("Error loading suppliers:", error))
      .finally(() => {
        if (mounted) setLoadingSuppliers(false);
      });
    
    return () => { mounted = false; };
  }, [open, hasLoadedSuppliers]);

  // Reset form solo cuando se abre con initialData
  useEffect(() => {
    if (!open) return;

    setFormData({
      supplier: initialData?.supplier || "",
      tracking: "",
      partName: initialData?.partName || "",
      carrier: "",
      deviceLocation: ""
    });
    setLinkNames(Array.isArray(initialData?.linkNames) ? initialData.linkNames : []);
    setLinkSummary(initialData?.linkSummary || "");
    setSelectedParts(new Set());
    setErr("");
  }, [
    open,
    initialData?.supplier,
    initialData?.partName,
    initialData?.linkSummary
  ]);

  useEffect(() => {
    if (!open || !order?.id) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await loadOrderLinks(order);
        if (cancelled) return;
        const links = Array.isArray(result?.links) ? result.links : [];
        const grouped = links.reduce((acc, link) => {
          const name = String(link?.partName || "").trim();
          if (!name) return acc;
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {});

        const names = Object.keys(grouped);
        const summary = names
          .map((name) => grouped[name] > 1 ? `${name} (${grouped[name]} links)` : name)
          .join(", ");

        setLinkNames(names);
        setLinkSummary(summary);
        setFormData((prev) => ({
          ...prev,
          partName: prev.partName.trim() || summary || "",
        }));
      } catch (error) {
        console.error("Error loading links for waiting parts modal:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, order?.id]);

  const handleSubmit = () => {
    // Combinar piezas seleccionadas con chips + texto manual
    const fromChips = [...selectedParts];
    const manual = formData.partName.trim();
    const combined = [...fromChips, ...(manual ? [manual] : [])].join(", ");

    if (!combined) {
      setErr("Selecciona o escribe el nombre de la(s) pieza(s).");
      return;
    }

    if (!formData.supplier.trim()) {
      setErr("Debes seleccionar un suplidor.");
      return;
    }

    if (!formData.deviceLocation) {
      setErr("Debes indicar dónde está el equipo.");
      return;
    }

    // ✅ Cerrar inmediatamente (optimista) — guardar en background
    onClose?.();
    onSave?.({
      supplier: formData.supplier.trim(),
      tracking: formData.tracking.trim(),
      partName: combined,
      carrier: formData.carrier.trim(),
      deviceLocation: formData.deviceLocation
    });
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000]">
      <div className="absolute inset-0 bg-[#000000]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto shadow-[0_30px_100px_rgba(0,0,0,0.55)] theme-light:border-gray-200"
          style={{ background: "#111114" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-white theme-light:text-gray-900">
                <PackageOpen className="w-5 h-5 text-red-400" />
                Esperando piezas
              </h3>
              <p className="mt-1 text-xs text-gray-400 theme-light:text-gray-600">
                Registra información sobre las piezas necesarias.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="mx-auto h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Ubicación del equipo */}
            <div className="bg-amber-600/10 border-2 border-amber-500/40 rounded-xl p-4 theme-light:bg-amber-50 theme-light:border-amber-300">
              <div className="text-xs text-amber-300 mb-3 font-bold flex items-center gap-2 theme-light:text-amber-800">
                <AlertCircle className="w-4 h-4" />
                ¿Dónde está el equipo? *
              </div>
              <div className="space-y-2">
                {["taller", "cliente"].map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => updateField("deviceLocation", loc)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-left ${
                      formData.deviceLocation === loc
                        ? loc === "taller"
                          ? "bg-cyan-600/30 border-cyan-500/60"
                          : "bg-emerald-600/30 border-emerald-500/60"
                        : "bg-black/20 border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.deviceLocation === loc
                        ? loc === "taller"
                          ? "border-cyan-500 bg-cyan-500"
                          : "border-emerald-500 bg-emerald-500"
                        : "border-gray-500"
                    }`}>
                      {formData.deviceLocation === loc && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-white font-semibold text-sm theme-light:text-gray-900">
                        {loc === "taller" ? "🏢 En el taller" : "👤 Lo tiene el cliente"}
                      </span>
                      <p className="text-xs text-gray-400 theme-light:text-gray-600">
                        {loc === "taller" ? "El equipo permanece aquí" : "El cliente se lo llevó"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre de pieza */}
            <div>
              <label className="text-xs text-gray-300 mb-2 block font-medium theme-light:text-gray-700">
                Pieza(s) adicionales <span className="text-white/30 font-normal">(o escribe si no aparece arriba)</span>
              </label>
              <input
                type="text"
                list="parts-suggestions"
                value={formData.partName}
                onChange={(e) => updateField("partName", e.target.value)}
                placeholder="Ej. Pantalla LCD, Batería..."
                className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
              {catalogSuggestions.length > 0 && (
                <datalist id="parts-suggestions">
                  {catalogSuggestions.map(name => <option key={name} value={name} />)}
                </datalist>
              )}

              {/* Piezas del carrito + links — multi-select */}
              {(Array.isArray(order?.order_items) && order.order_items.length > 0) || linkNames.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {/* Chips del carrito */}
                  {Array.isArray(order?.order_items) && order.order_items.length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/40 mb-1.5 font-bold uppercase tracking-wide">Piezas del carrito:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...new Map(order.order_items.map(i => [i.name, i])).values()].map((item) => {
                          const sel = selectedParts.has(item.name);
                          return (
                            <button
                              key={item.id || item.name}
                              type="button"
                              onClick={() => togglePart(item.name)}
                              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                sel
                                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                  : "border-white/15 bg-white/5 text-white/60 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-200"
                              }`}
                            >
                              {sel && <Check className="w-3 h-3 flex-shrink-0" />}
                              {item.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Chips de links */}
                  {linkNames.length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/40 mb-1.5 font-bold uppercase tracking-wide">Detectado desde links:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {linkNames.map((name) => {
                          const sel = selectedParts.has(name);
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => togglePart(name)}
                              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                sel
                                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                  : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                              }`}
                            >
                              {sel && <Check className="w-3 h-3 flex-shrink-0" />}
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Preview de lo que se guardará */}
                  {selectedParts.size > 0 && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wide mb-0.5">Se guardará como:</p>
                      <p className="text-xs text-emerald-200 font-medium">
                        {[...selectedParts, ...(formData.partName.trim() ? [formData.partName.trim()] : [])].join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Suplidor */}
            <div>
              <label className="text-xs text-gray-300 mb-2 block font-medium theme-light:text-gray-700">Suplidor *</label>
              {loadingSuppliers ? (
                <div className="flex items-center justify-center h-10 bg-black/40 rounded-md border border-white/15">
                  <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                </div>
              ) : (
                <select
                  value={formData.supplier}
                  onChange={(e) => updateField("supplier", e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                >
                  <option value="">Seleccionar suplidor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Carrier y Tracking */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-300 mb-2 block theme-light:text-gray-700">Compañía de envío</label>
                <select
                  value={formData.carrier}
                  onChange={(e) => updateField("carrier", e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                >
                  <option value="">Seleccionar...</option>
                  <option value="USPS">USPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="UPS">UPS</option>
                  <option value="DHL">DHL</option>
                  <option value="Amazon">Amazon</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-300 mb-2 block theme-light:text-gray-700">Tracking</label>
                <input
                  type="text"
                  value={formData.tracking}
                  onChange={(e) => updateField("tracking", e.target.value)}
                  placeholder="1Z999AA..."
                  className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
            </div>
          </div>

          {err && <div className="mt-3 text-xs text-amber-300 theme-light:text-amber-700">{err}</div>}

          <div className="mt-6 flex justify-end gap-2">
            <Button className="h-9 px-4 bg-white text-black hover:bg-white/90" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="h-9 px-4 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700" onClick={handleSubmit}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
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

function OrderItemsSection({ order, onUpdated, clearEventCache, loadEventsCallback, onClose, onOrderItemsUpdate }) {
  const navigate = useNavigate();
  const o = order || {};
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const items = Array.isArray(o.order_items) ? o.order_items : [];
  
  const subtotal = items.reduce((s, it) => {
    const basePrice = Number(it.price || 0);
    const discountPercent = Number(it.discount_percent || 0);
    const priceAfterDiscount = basePrice - (basePrice * (discountPercent / 100));
    return s + (priceAfterDiscount * Number(it.qty || 1));
  }, 0);
  
  const taxRate = 0.115;
  const taxableAmount = items.reduce((sum, it) => {
    const basePrice = Number(it.price || 0);
    const discountPercent = Number(it.discount_percent || 0);
    const priceAfterDiscount = basePrice - (basePrice * (discountPercent / 100));
    const itemTotal = priceAfterDiscount * Number(it.qty || 1);
    return sum + (it.taxable !== false ? itemTotal : 0);
  }, 0);
  const tax = taxableAmount * taxRate;
  const total = subtotal + tax;

  const totalPaid = Number(o.amount_paid ?? o.total_paid ?? o.deposit_amount ?? 0);
  const balance =
    o.balance_due != null
      ? Math.max(0, Number(o.balance_due || 0))
      : Math.max(0, total - totalPaid);
  const isPaid = balance <= 0.01;

  const handleDepositoClick = () => {
    setQuickPayMode("deposit");
  };


  return (
    <>
      <Card className="p-4 bg-gradient-to-br from-emerald-600/10 to-lime-600/10 border-emerald-500/20 theme-light:bg-white theme-light:border-gray-200">
        <CardHeader className="border-b border-emerald-500/20 pb-4 theme-light:border-gray-200">
          <CardTitle className="text-white flex items-center justify-between gap-2 theme-light:text-gray-900">
            <span className="flex items-center gap-2 min-w-0">
              <ShoppingCart className="w-5 h-5 flex-shrink-0 text-emerald-500 theme-light:text-emerald-600" />
              <span className="truncate">Piezas y Servicios</span>
            </span>
            <Button
              onClick={() => setShowAddItemModal(true)}
              className="flex-shrink-0 h-9 w-9 p-0 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 rounded-full"
              title="Añadir pieza o servicio"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-lg theme-light:border-gray-300">
              <ShoppingCart className="w-12 h-12 mx-auto text-gray-600 mb-3 opacity-30" />
              <p className="text-gray-400 text-sm mb-2 theme-light:text-gray-600">No hay items en esta orden</p>
              <p className="text-gray-500 text-xs theme-light:text-gray-500">Haz clic en "Añadir" para comenzar</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const basePrice = Number(item.price || 0);
                  const discountPercent = Number(item.discount_percent || 0);
                  const priceAfterDiscount = basePrice - (basePrice * (discountPercent / 100));
                  const itemTotal = priceAfterDiscount * Number(item.qty || 1);
                  const isProduct = item.__kind === 'product' || item.type === 'product';

                  return (
                    <div
                      key={`${item.__kind}-${item.__source_id}-${idx}`}
                      className="bg-black/40 border border-white/10 rounded-lg p-3 theme-light:bg-gray-50 theme-light:border-gray-200"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate theme-light:text-gray-900">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className="text-[10px] bg-blue-600/20 text-blue-300 border-blue-600/30">
                              {isProduct ? 'Producto' : 'Servicio'}
                            </Badge>
                            <span className="text-xs text-emerald-400">${basePrice.toFixed(2)} c/u</span>
                            {discountPercent > 0 && (
                              <Badge className="text-[10px] bg-orange-600/20 text-orange-400">
                                -{discountPercent}%
                              </Badge>
                            )}
                            {item.taxable === false && (
                              <Badge className="text-[10px] bg-blue-600/20 text-blue-400">
                                Sin IVU
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-white text-sm theme-light:text-gray-900">x{Number(item.qty || 1)}</span>
                          <span className="text-emerald-400 font-bold text-sm theme-light:text-emerald-600">${itemTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-emerald-500/20 pt-3 space-y-2 theme-light:border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 theme-light:text-gray-600">Subtotal</span>
                  <span className="text-white font-medium theme-light:text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 theme-light:text-gray-600">IVU (11.5%)</span>
                  <span className="text-white font-medium theme-light:text-gray-900">${tax.toFixed(2)}</span>
                </div>
                {totalPaid > 0 && (
                  <div className="flex justify-between text-sm py-2 border-y border-emerald-500/10">
                    <span className="text-blue-400 font-medium flex items-center gap-1">
                      <Wallet className="w-4 h-4" />
                      Pagado / Depósito
                    </span>
                    <span className="text-blue-400 font-bold">-${totalPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg pt-2">
                  <span className="text-emerald-400 font-bold">Total Estimado</span>
                  <span className="text-emerald-400 font-bold text-2xl">${total.toFixed(2)}</span>
                </div>
                {totalPaid > 0 && (
                  <div className={`flex justify-between text-base p-3 rounded-lg ${isPaid ? "bg-emerald-600/20" : "bg-amber-600/20"}`}>
                    <span className={`font-bold ${isPaid ? "text-emerald-300" : "text-amber-300"}`}>Balance Pendiente</span>
                    <span className={`font-bold text-xl ${isPaid ? "text-emerald-400" : "text-yellow-400"}`}>
                      ${balance.toFixed(2)}
                      {isPaid && <CheckCircle2 className="w-5 h-5 inline ml-2" />}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleDepositoClick}
            disabled={isPaid}
            title="Depósito"
            className="h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5 flex-shrink-0" />
            <span className="hidden sm:inline font-bold">Depósito</span>
          </Button>
          <Button
            onClick={handleCobrarClick}
            disabled={isPaid}
            title="Cobrar Total"
            className="h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <DollarSign className="w-5 h-5 flex-shrink-0" />
            <span className="hidden sm:inline font-bold">Cobrar Total</span>
          </Button>
        </div>
      )}

      <AddItemModal
        open={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onSave={(newItems) => {
          // Optimistic: update parent order state immediately with new items
          onOrderItemsUpdate?.(newItems);
          setShowAddItemModal(false);
        }}
        order={o}
        onUpdate={async () => {
          await clearEventCache(o.id);
          await loadEventsCallback(true);
          onUpdated?.();
        }}
      />
    </>
  );
}

export default function WorkOrderPanel({ orderId, onClose, onUpdate, onDelete, panelVersion = "v9" }) {

  const navigate = useNavigate();
  const { registerPanel, unregisterPanel } = usePanelState();
  const { can: canPlan } = usePlanLimits();

  // ✅ Registrar panel cuando se abre
  useEffect(() => {
    registerPanel('workorder-panel');
    return () => unregisterPanel('workorder-panel');
  }, [registerPanel, unregisterPanel]);

  // ✅ Proteger sesión: mientras esta orden está abierta, el sistema no
  // expulsa al técnico por inactividad (puede estar trabajando en silencio).
  useEffect(() => {
    window.__sfos_setOrderActive?.(true);
    window.__sfos_workOrderOpen = true;
    window.dispatchEvent(new CustomEvent("smartfix:workorder-open", { detail: { open: true } }));
    return () => {
      window.__sfos_setOrderActive?.(false);
      window.__sfos_workOrderOpen = false;
      window.dispatchEvent(new CustomEvent("smartfix:workorder-open", { detail: { open: false } }));
    };
  }, []);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

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
  const [stagesOpen, setStagesOpen] = useState(false);

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
    // Filter out 'awaiting_approval' as requested
    return ORDER_STATUSES.filter((s) => s.isActive && s.id !== "awaiting_approval");
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

  const [quickPayMode, setQuickPayMode] = useState(null);

  const handlePaymentClick = useCallback((mode) => {
    setQuickPayMode(mode || "full");
  }, []);

  // Legacy header button — now opens inline modal
  const handleCobrarClick = useCallback(() => {
    setQuickPayMode("full");
  }, []);

  const [showSecurityBeforePayment, setShowSecurityBeforePayment] = useState(false);

  useEffect(() => {
    const handleSaleCompleted = (event) => {
      const updatedOrder = event?.detail?.order;
      if (!updatedOrder?.id) return;
      if (String(updatedOrder.id) !== String(orderId)) return;
        setOrder((prev) => ({ ...(prev || {}), ...updatedOrder }));
    };

    window.addEventListener("sale-completed", handleSaleCompleted);
    return () => window.removeEventListener("sale-completed", handleSaleCompleted);
  }, [orderId]);

  const loadEventsCallback = useCallback(async (forceRefresh = false) => {
    if (!order?.id) return;

    if (!forceRefresh) {
      const cached = getCachedEvents(order.id);
      if (cached) {
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
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      if (!user) {
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
    const skipEmailStates = ["reparacion_externa", "waiting_order", "pending_order", "intake"];
    if (skipEmailStates.includes(newStatusId)) {
      return;
    }

    // [Email] log removed for perf
    if (!order?.customer_email) {
      console.warn("[Email] ⚠️ No hay email de cliente. Saltando.");
      return;
    }

    try {
      const deviceLine = `${order.device_brand || ""} ${order.device_family || ""} ${order.device_model || ""}`.trim();
      // [Email] log removed for perf
      const result = await sendTemplatedEmail({
        event_type: newStatusId,
        order_data: {
          order_number: order.order_number,
          customer_name: order.customer_name || "Cliente",
          customer_email: order.customer_email,
          device_info: deviceLine || order.device_type || "tu equipo",
          checklist_items: Array.isArray(order.checklist_items) ? order.checklist_items : [],
          photos_metadata: Array.isArray(order.photos_metadata) ? order.photos_metadata : [],
          initial_problem: order.initial_problem || ""
        }
      });
      // log removed for perf
      if (result?.success === false) {
        throw new Error(result?.message || "No hay plantilla activa para este estado");
      }

      let me = null;
      try {me = await base44.auth.me();} catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "email_sent",
        description: `Email enviado a ${order.customer_email} usando plantilla de ${newStatusId}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: {
          email_to: order.customer_email,
          template_event_type: newStatusId,
          template_used: result?.template_used || null,
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
    
    // ✅ GUARDAR posición de scroll ANTES de refrescar
    const scrollContainer = panelRef.current?.querySelector('.overflow-y-auto');
    const savedScrollTop = scrollContainer?.scrollTop || 0;
    
    setLoading(true);
    setLoadError(null);
    try {
      const remoteOrder = await base44.entities.Order.get(orderId);
      const mergedOrder = mergeOrderSnapshot(remoteOrder, findLocalOrder(orderId));

      // ✅ Read-after-write protection: if the remote returned fewer items than what we
      // currently have optimistically, preserve the current items. This handles the case
      // where the DB read replica hasn't caught up with the write yet.
      setOrder((prev) => {
        const currentItems = Array.isArray(prev?.order_items) ? prev.order_items : [];
        const remoteItems = Array.isArray(mergedOrder?.order_items) ? mergedOrder.order_items : [];
        const finalItems = remoteItems.length >= currentItems.length ? remoteItems : currentItems;
        return { ...mergedOrder, order_items: finalItems };
      });

      setStatus(normalizeStatusId(mergedOrder?.status || remoteOrder?.status || "intake"));
      clearEventCache(orderId);
      await loadEventsCallback(true);
      onUpdate?.();
      
      // ✅ RESTAURAR posición de scroll DESPUÉS de actualizar
      requestAnimationFrame(() => {
        if (scrollContainer) {
          scrollContainer.scrollTop = savedScrollTop;
        }
      });
    } catch (e) {
      console.error("[WorkOrderPanel] Error refreshing order:", e);
      const local = findLocalOrder(orderId);
      if (local) {
        setOrder(local);
        setStatus(normalizeStatusId(local.status || "intake"));
        setLoadError(null);
      } else {
        setLoadError(`Error al recargar la orden: ${e.message || "Error de conexión"}`);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, loadEventsCallback, onUpdate]);

  // ✅ Shared callback for all stages: optimistic merge of catalog items only.
  // Do NOT call handleRefresh() here — the DB save is still in flight at this point.
  // handleRefresh() is wired to onRemoteSaved so it fires AFTER the DB save completes.
  const handleOrderItemsSaved = useCallback((newItems) => {
    setOrder((prev) => {
      if (!prev) return prev;
      const items = Array.isArray(newItems) ? newItems : (prev.order_items || []);
      const subtotal = items.reduce((sum, it) => {
        const base = Number(it.price || 0) * Number(it.qty || 1);
        return sum + base - base * (Number(it.discount_percentage || 0) / 100);
      }, 0);
      const tax = subtotal * 0.115;
      const total = subtotal + tax;
      const paid = Number(prev.amount_paid || prev.total_paid || 0);
      return {
        ...prev,
        order_items: items,
        cost_estimate: total,
        balance_due: Math.max(0, total - paid),
      };
    });
    // NOTE: NO handleRefresh() here — that would race with the in-flight DB save
    // and overwrite the optimistic state with stale data.
  }, []);

  const handleSecuritySavedBeforePayment = useCallback(async () => {
    setShowSecurityBeforePayment(false);
    await handleRefresh(true);
    onUpdate?.();
  }, [handleRefresh, onUpdate]);

  // ✅ Listener para refrescar cuando se procese un pago desde POS
  useEffect(() => {
    const handlePaymentProcessed = async (event) => {
      const { orderId: eventOrderId } = event.detail || {};

      if (eventOrderId === order?.id) {
        // Recargar la orden desde la DB
        try {
          const freshOrder = await base44.entities.Order.get(eventOrderId);
          setOrder(mergeOrderSnapshot(freshOrder, findLocalOrder(eventOrderId)));
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
      // Eliminar eventos relacionados (best-effort)
      try {
        const events = await base44.entities.WorkOrderEvent.filter({ order_id: order.id });
        if (Array.isArray(events) && events.length && typeof base44.entities.WorkOrderEvent.delete === "function") {
          await Promise.all(
            events.map((ev) => base44.entities.WorkOrderEvent.delete(ev.id).catch(() => null))
          );
        }
      } catch (eventsError) {
        console.warn("[WorkOrderPanel] No se pudieron eliminar eventos relacionados:", eventsError);
      }

      // Hard delete real de la orden
      await base44.entities.Order.delete(order.id);
      removeLocalOrder(order.id);

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
    if (partsModalOpen) return undefined;
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [partsModalOpen]);

  // ✅ Escuchar evento para cerrar el panel desde AddItemModal
  useEffect(() => {
    const handleClosePanelEvent = () => {
      handleClose();
    };

    window.addEventListener('close-workorder-panel', handleClosePanelEvent);
    return () => window.removeEventListener('close-workorder-panel', handleClosePanelEvent);
  }, [handleClose]);

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
          console.warn("[WorkOrderPanel] Auth no disponible, continuando en modo local.");
        }

        let data = null;
        try {
          data = await base44.entities.Order.get(orderId);
        } catch (e) {
          console.error("[WorkOrderPanel] Error fetching order:", e.message || e);
        }
        data = mergeOrderSnapshot(data, findLocalOrder(orderId));

        if (!mounted) return;

        if (!data) {
          console.error("[WorkOrderPanel] Order not found:", orderId);
          setOrder(null);
          setLoading(false);
          setLoadError(`Orden con ID ${orderId} no encontrada.`);
          return;
        }

        // Regla GLOBAL de secuencia:
        // no permitir abrir una orden más alta si existe cualquier orden anterior
        // en recepción.
        const currentSeq = extractOrderSequence(data.order_number);
        const currentIsQuickOrder = data?.status_metadata?.quick_order === true;
        if (currentSeq > 0 && !currentIsQuickOrder) {
          const blockingStatuses = new Set(["intake"]);

          let recentOrders = [];
          try {
            recentOrders = await base44.entities.Order.list("-created_date", 600).catch(() => []);
          } catch (e) {
            console.warn("[WorkOrderPanel] No se pudieron cargar ordenes para regla secuencial global:", e);
            recentOrders = [];
          }

          const blockers = mergeOrders(recentOrders || [], getUnsyncedLocalOrders(recentOrders || [])).filter((ord) => {
            if (!ord || String(ord.id || "") === String(data.id || "")) return false;
            if (ord?.status_metadata?.quick_order === true) return false;
            const seq = extractOrderSequence(ord.order_number);
            if (seq <= 0 || seq >= currentSeq) return false;
            const st = getEffectiveOrderStatus(ord);
            return blockingStatuses.has(st);
          });

          if (blockers.length > 0) {
            const blockersSorted = blockers.sort((a, b) => extractOrderSequence(a.order_number) - extractOrderSequence(b.order_number));
            const list = blockersSorted.slice(0, 5).map((b) => b.order_number || b.id).join(", ");
            const msg = `Regla global activa: primero debes mover boletos anteriores en Recepcion (${list}) antes de abrir ${data.order_number}.`;
            toast.error(msg);
            setOrder(null);
            setLoading(false);
            setLoadError(msg);
            return;
          }
        }

        setOrder(data);
        // Use order.status directly — getEffectiveOrderStatus reads status_history first
        // which can lag behind the actual status field after a status change.
        setStatus(normalizeStatusId(data?.status));
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

  // Auto-refresh: only when tab is visible, every 60s instead of 30s
  useEffect(() => {
    if (!orderId || loading) return;

    let iv = null;
    const lastUpdatedRef = { current: order?.updated_date };
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const fresh = await base44.entities.Order.get(orderId);
        if (fresh && fresh.updated_date !== lastUpdatedRef.current) {
          lastUpdatedRef.current = fresh.updated_date;
          setOrder(fresh);
          setStatus(normalizeStatusId(fresh?.status));
          clearEventCache(orderId);
          loadEventsCallback(true);
        }
      } catch (e) {
        // silent
      }
    };
    const start = () => { if (!iv) iv = setInterval(refresh, 120000); };
    const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
    const onVis = () => { document.hidden ? stop() : start(); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, loading]);

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

      await logWorkOrderPhotoEvent({
        order,
        count: newItems.length,
        statusOverride: status,
        actor: {
          user_name: me?.full_name || me?.email || "Sistema",
          user_id: me?.id || null
        },
        source: "workorder_panel"
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

      const cleanPart = linkPartName.trim();
      const cleanUrl = linkText.trim();

      const createdEvent = await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "note_added",
        description: `🔗 Link para ${cleanPart}: ${cleanUrl}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: {
          link: cleanUrl,
          partName: cleanPart,
          part: cleanPart,
          entry_kind: "link_added",
          is_link: true
        }
      });

      const freshOrder = await base44.entities.Order.get(order.id).catch(() => order);
      const prevMeta = freshOrder?.status_metadata && typeof freshOrder.status_metadata === "object"
        ? freshOrder.status_metadata
        : {};
      const prevRegistry = Array.isArray(prevMeta.links_registry) ? prevMeta.links_registry : [];
      const nextRegistry = [
        {
          id: createdEvent?.id || `wo-link-${Date.now()}`,
          partName: cleanPart,
          link: cleanUrl,
          created_at: new Date().toISOString()
        },
        ...prevRegistry
      ];
      await base44.entities.Order.update(order.id, {
        status_metadata: {
          ...prevMeta,
          links_registry: nextRegistry
        }
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
    const prevStatusId = getEffectiveOrderStatus(order || { status });

    // log removed for perf

    // Bloquear avance desde intake/received si no hay al menos 1 foto
    // Solo aplica si el plan permite fotos (orders_photos)
    if (canPlan("orders_photos") && (prevStatusId === "intake" || prevStatusId === "received") && nextId !== "cancelled") {
      const prevOrder = getStatusConfig(prevStatusId).order || 0;
      const nextOrder = getStatusConfig(nextId).order || 0;
      if (nextOrder > prevOrder) {
        const photoCount =
          (Array.isArray(order?.photos_metadata) ? order.photos_metadata.length : 0) +
          (Array.isArray(order?.device_photos) ? order.device_photos.length : 0);
        if (photoCount === 0) {
          toast("Agrega al menos 1 foto del equipo antes de avanzar la orden", { icon: "📷" });
          return;
        }
      }
    }

    // Bloquear avance desde in_progress si el checklist de cierre no está completo
    if (prevStatusId === "in_progress" && nextId !== "cancelled") {
      const prevOrder = getStatusConfig(prevStatusId).order || 0;
      const nextOrder = getStatusConfig(nextId).order || 0;
      if (nextOrder > prevOrder && !order?.repair_checklist_done) {
        toast("Completa el checklist de cierre antes de avanzar la orden", { icon: "🔒" });
        return;
      }
    }

    // Bloquear avance desde warranty si no hay veredicto
    if (prevStatusId === "warranty" && nextId !== "cancelled") {
      const prevOrder = getStatusConfig(prevStatusId).order || 0;
      const nextOrder = getStatusConfig(nextId).order || 0;
      if (nextOrder > prevOrder && !order?.warranty_verdict) {
        toast("Define el veredicto de garantía antes de avanzar la orden", { icon: "🔒" });
        return;
      }
    }

    // Mostrar modales específicos SOLO si no viene de skipModalCheck
    if (!skipModalCheck) {
      if (nextId === "cancelled") {
        setCancelModalOpen(true);
        return;
      }

      if (nextId === "waiting_parts") {
        // Siempre mostrar modal para confirmar/actualizar info de piezas
        setPartsModalOpen(true);
        return;
      }

      if (nextId === "reparacion_externa") {
        // Solo mostrar modal si no hay información previa
        if (!order.external_shop && !order.external_work) {
          setExternalModalOpen(true);
          return;
        }
      }
    }

    // ✅ VERIFICACIÓN DE BALANCE PARA ESTADO "delivered"
    if (nextId === "delivered") {
      const total = Number(order.total || order.cost_estimate || 0);
      const totalPaid = Number(order.amount_paid ?? order.total_paid ?? 0);
      const balance =
        order.balance_due != null
          ? Math.max(0, Number(order.balance_due || 0))
          : Math.max(0, total - totalPaid);

      // log removed for perf

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
            setQuickPayMode("full");
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
          console.warn("[ChangeStatus] Auth no disponible. Continuando en modo local.", authError);
        }
        const actorName = me?.full_name || me?.email || "Sistema";
        const actorId = me?.id || null;

        const updateData = {
          status: nextId,
          updated_date: new Date().toISOString(),
          status_note: statusNote || null,
          status_note_visible_to_customer: false
        };

        const prevStatusMeta = order?.status_metadata && typeof order.status_metadata === "object"
          ? order.status_metadata
          : {};
        updateData.status_metadata = {
          ...prevStatusMeta,
          kind: nextId,
          ...(metadata && typeof metadata === "object" ? metadata : {})
        };

        const history = order.status_history || [];
        history.push({
          status: nextId,
          timestamp: new Date().toISOString(),
          changed_by: actorName,
          note: statusNote || null,
          visible_to_customer: false
        });
        updateData.status_history = history;

        // log removed for perf
        await base44.entities.Order.update(order.id, updateData);

        const optimisticOrder = {
          ...(order || {}),
          status: nextId,
          updated_date: updateData.updated_date,
          status_note: updateData.status_note,
          status_note_visible_to_customer: updateData.status_note_visible_to_customer,
          status_history: updateData.status_history,
          ...(updateData.status_metadata && { status_metadata: updateData.status_metadata })
        };

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
        onUpdate?.(optimisticOrder);

        // log removed for perf
        await base44.entities.WorkOrderEvent.create({
          order_id: order.id,
          order_number: order.order_number,
          event_type: "status_change",
          description: `Estado: ${getStatusConfig(prevStatusId).label} → ${getStatusConfig(nextId).label}${statusNote ? ` - ${statusNote}` : ""}`,
          user_name: actorName,
          user_id: actorId,
          metadata: { from: prevStatusId, to: nextId, ...(metadata || {}) }
        });

        sendStatusChangeEmail(nextId, prevStatusId);

        // ✅ Llamar función para iniciar contadores y enviar emails
        try {
          await base44.functions.invoke('handleStatusChange', {
            orderId: order.id,
            newStatus: nextId,
            previousStatus: prevStatusId
          });
          // log removed for perf
        } catch (counterError) {
          console.error("[ChangeStatus] Error inicializando contadores:", counterError);
        }

        if (nextId === "pending_order") {
          await base44.entities.WorkOrderEvent.create({
            order_id: order.id,
            order_number: order.order_number,
            event_type: "pending_order",
            description: "Trabajo pendiente de ordenar pieza(s)..",
            user_name: actorName,
            user_id: actorId
          });
          try {
            window.localStorage.setItem(`pending_order_${order.id}`, String(Date.now()));
            window.dispatchEvent(new Event("force-refresh"));
          } catch {}
        }

        try {
          // ✅ ESTADOS QUE NO ENVÍAN NOTIFICACIONES (solo intake y diagnosing)
          const skipNotificationStates = ["intake"];
          
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

        // log removed for perf

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
      const updatedHistory = [
        ...(Array.isArray(order.status_history) ? order.status_history : []),
        {
          status: "cancelled",
          timestamp: new Date().toISOString(),
          note: reason || null,
          visible_to_customer: false
        }
      ];
      await base44.entities.Order.update(order.id, {
        status: "cancelled",
        updated_date: new Date().toISOString(),
        status_history: updatedHistory,
        status_metadata: {
          ...(order?.status_metadata && typeof order.status_metadata === "object" ? order.status_metadata : {}),
          kind: "cancelled",
          cancellation_reason: reason
        }
      });

      setStatus("cancelled");
      setOrder((prevOrder) => ({
        ...prevOrder,
        status: "cancelled",
        updated_date: new Date().toISOString(),
        status_history: updatedHistory,
        status_metadata: {
          ...(prevOrder?.status_metadata && typeof prevOrder.status_metadata === "object" ? prevOrder.status_metadata : {}),
          kind: "cancelled",
          cancellation_reason: reason
        }
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

      sendStatusChangeEmail("cancelled", order?.status);

    } catch (err) {
      console.error("Error cancelando orden:", err);
      alert(`Error: ${err.message || "No se pudo cancelar la orden"}`);
    }
  }

  async function saveWaitingParts({ supplier, tracking, partName, carrier, deviceLocation }) {
    if (!order?.id) return;
    try {
      const locationText = deviceLocation === "taller" ? "🏢 Equipo en taller" : "👤 Cliente tiene el equipo";
      const statusNote = [
      locationText,
      partName && `Pieza: ${partName}`,
      supplier && `Proveedor: ${supplier}`,
      carrier && `Envío: ${carrier}`,
      tracking && `Tracking: ${tracking}`].
      filter(Boolean).join(" · ");

      // ✅ CAMBIAR ESTADO PRIMERO CON skipModalCheck=true
      await changeStatus("waiting_parts", statusNote, {
        supplier: supplier || "",
        tracking: tracking || "",
        part_name: partName || "",
        carrier: carrier || "",
        device_location: deviceLocation
      }, true); 

      // Actualizar campos adicionales
      await base44.entities.Order.update(order.id, {
        parts_supplier: supplier || "",
        parts_tracking: tracking || "",
        part_name: partName || "",
        parts_carrier: carrier || "", // ✅ NEW FIELD
        device_location: deviceLocation
      });

      setOrder((prevOrder) => ({
        ...prevOrder,
        parts_supplier: supplier || "",
        parts_tracking: tracking || "",
        part_name: partName || "",
        parts_carrier: carrier || "",
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
        metadata: { supplier, tracking, partName, carrier, deviceLocation }
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



  // ── Stage content renderer (used by new 3-column layout) ──
  const stageUpdateCb = async () => { await clearEventCache(o?.id); await loadEventsCallback(true); await handleRefresh(); onUpdate?.(); };
  const stageRemoteSavedCb = async () => { await new Promise((r) => setTimeout(r, 1500)); await handleRefresh(); };

  function renderStageContent() {
    if (!o?.id) return null;
    const sp = { order: o, onUpdate: stageUpdateCb, onOrderItemsUpdate: handleOrderItemsSaved, onPaymentClick: handlePaymentClick, onRemoteSaved: stageRemoteSavedCb, compact: true };
    if (status === "intake" || status === "waiting_order") return <IntakeStage {...sp} />;
    if (status === "diagnosing") return <DiagnosingStage {...sp} />;
    if (status === "pending_order") return <PendingOrderStage {...sp} />;
    if (status === "waiting_parts") return <WaitingPartsStage {...sp} />;
    if (status === "part_arrived_waiting_device") return <PartArrivedStage {...sp} />;
    if (status === "reparacion_externa") return <ExternalRepairStage {...sp} />;
    if (status === "in_progress") return <RepairStage {...sp} />;
    if (status === "warranty") return <WarrantyStage {...sp} onClose={handleClose} />;
    if (status === "ready_for_pickup") return <DeliveryStage {...sp} onClose={handleClose} />;
    if (status === "picked_up" || status === "delivered" || status === "completed") return <FinalizedStage {...sp} />;
    if (status === "cancelled") return <CancelledStage {...sp} />;
    if (status === "awaiting_approval") return <AwaitingApprovalStage {...sp} />;
    return null;
  }

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
    if (t === "contact_call" || t === "contact_whatsapp" || t === "contact_email") return { pill: "bg-indigo-500/20 text-indigo-200 border-indigo-500/30", box: "border-indigo-500/30 bg-indigo-500/10" };
    if (t === "link_added") return { pill: "bg-blue-600/20 text-blue-300 border-blue-600/30", box: "border-blue-600/30 bg-blue-600/10" }; // New style for links
    return { pill: "bg-gray-500/20 text-gray-200 border-gray-500/30", box: "border-gray-500/30 bg-gray-500/10" };
  };

  if (loading && !order && !loadError) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/90">
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
              <p className="text-red-400 text-lg mb-4">Error al recargar la orden: {loadError}</p>
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
      <div ref={panelRef} className="fixed inset-0 z-[60] bg-[#0A0A0B] overflow-hidden kb-aware-panel" data-keyboard-aware>
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

          /* ✅ PREMIUM SEQUOIA STYLES */
          .glass-panel {
            background: rgba(13, 13, 15, 0.7);
            backdrop-filter: blur(32px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }

          @media (max-width: 768px) {
            .wo-panel-content {
              padding: 1rem !important;
            }
            
            .wo-status-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 0.75rem !important;
            }

            .wo-header-title {
              font-size: 1.25rem !important;
              font-weight: 900 !important;
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

            /* Grid responsive para campos */
            .grid-cols-2 {
              grid-template-columns: 1fr !important;
            }

            .wo-header {
              padding-right: 1rem !important;
              padding-bottom: 0.75rem !important;
              padding-left: 1rem !important;
              /* padding-top is set inline via env(safe-area-inset-top) — no override */
            }

            .wo-scrollable {
              -webkit-overflow-scrolling: touch !important;
              overscroll-behavior: contain;
            }
          }
        `}</style>

        <div className="h-full flex flex-col bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] theme-light:bg-gray-50 overflow-hidden">
           {/* ✅ HEADER RESPONSIVE — hidden on mobile (MobileRepairDetail has its own header) */}
           <div
            className="flex-shrink-0 border-b border-white/[0.08] bg-[#0D0D0F] wo-header hidden lg:block"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 20px) + 14px)" }}
          >
            <div className="max-w-[1800px] mx-auto px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="group flex-shrink-0 h-10 w-10 sm:w-auto p-0 sm:px-4 rounded-full sm:rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all duration-300"
                >
                  <X className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" />
                  <span className="hidden sm:inline sm:ml-2 font-black uppercase text-[11px] tracking-wider">Cerrar</span>
                </Button>

                {order && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-white truncate wo-header-title">
                        {order.order_number}
                      </h1>
                      <Badge className={cn(
                        "rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-1 border backdrop-blur-md shadow-lg",
                        getStatusConfig(order.status).colorClasses.replace('bg-opacity-10', 'bg-opacity-20')
                      )}>
                        {getStatusConfig(order.status).label}
                      </Badge>
                    </div>
                    {order?.status_metadata?.quick_order === true && (
                      <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 shadow-sm">
                        <Zap className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-tight">Rápida</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {/* Botón compartir recibo */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowShareMenu(v => !v)}
                    className="w-10 h-10 rounded-full border border-violet-500/30 bg-white/5 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 transition-all duration-300"
                    title="Compartir recibo"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                  {showShareMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                      <div className="absolute right-0 top-12 z-50 min-w-[200px] rounded-2xl bg-[#0e0e0e] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
                        <p className="text-[9px] font-black text-white/25 uppercase tracking-widest px-3 pt-2.5 pb-1">Compartir recibo</p>
                        {/* WhatsApp */}
                        {order?.customer_phone && (() => {
                          const url  = `${window.location.origin}/Receipt?order_id=${order.id}`;
                          const PAID = ["completed", "delivered", "picked_up"];
                          const tipo = PAID.includes(order.status) ? "recibo de pago" : "recibo de recepción";
                          const msg  = `¡Hola ${order.customer_name}! 🧾 Aquí está tu ${tipo}:\n\n${url}`;
                          const wa   = `https://wa.me/${order.customer_phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
                          return (
                            <a href={wa} target="_blank" rel="noopener noreferrer"
                              onClick={() => setShowShareMenu(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                              <span className="text-base">💬</span> WhatsApp
                            </a>
                          );
                        })()}
                        {/* Email */}
                        {order?.customer_email && (() => {
                          const url  = `${window.location.origin}/Receipt?order_id=${order.id}`;
                          const subj = encodeURIComponent(`Tu recibo — ${order.order_number}`);
                          const body = encodeURIComponent(`Hola ${order.customer_name},\n\nAquí está tu recibo:\n${url}\n\nGracias.`);
                          return (
                            <a href={`mailto:${order.customer_email}?subject=${subj}&body=${body}`}
                              onClick={() => setShowShareMenu(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                              <Mail className="w-4 h-4 text-blue-400" /> Email
                            </a>
                          );
                        })()}
                        {/* Imprimir */}
                        <button
                          onClick={() => { setShowShareMenu(false); window.open(`${window.location.origin}/Receipt?order_id=${order.id}&print=1`, "_blank"); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                          <Printer className="w-4 h-4 text-white/40" /> Imprimir recibo
                        </button>
                        {/* Ver recibo */}
                        <button
                          onClick={() => { setShowShareMenu(false); window.open(`${window.location.origin}/Receipt?order_id=${order.id}`, "_blank"); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                          <FileText className="w-4 h-4 text-white/40" /> Ver recibo
                        </button>
                        {/* Copiar link */}
                        <button
                          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/Receipt?order_id=${order.id}`); setShowShareMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 pb-3 pt-1 hover:bg-white/[0.06] transition-colors text-sm text-white/40 border-t border-white/[0.06] mt-1">
                          <span className="text-base">🔗</span> Copiar link
                        </button>
                      </div>
                    </>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRequestDelete}
                  disabled={deleting}
                  className="w-10 h-10 rounded-full border border-white/10 bg-white/5 text-white/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4" />
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
            </div> : <div className="flex-1 overflow-hidden">
            {/* DESKTOP: 2 columns */}
            <div className="hidden lg:grid lg:grid-cols-[200px_1fr] h-full">
              {/* LEFT: Action sidebar */}
              <div className="overflow-y-auto border-r border-white/[0.06] p-3 bg-[#0D0D0F]">
                <WOActionSidebar
                  order={o}
                  status={status}
                  activeStatuses={activeStatuses}
                  closedStatuses={closedStatuses}
                  changingStatus={changingStatus}
                  onChangeStatus={(id) => changeStatus(id, "", {})}
                  onPaymentClick={handlePaymentClick}
                  onPrint={() => setShowPrintDialog(true)}
                  onDelete={handleRequestDelete}
                  onSecurityEdit={() => setShowSecurityDialog(true)}
                  onContextAction={(action) => {
                    document.dispatchEvent(new CustomEvent("wo:action", { detail: { action, order: o } }));
                  }}
                />
              </div>

              {/* CENTER: Order details + stage content */}
              <div className="overflow-y-auto p-4 space-y-4 wo-scrollable">
                <WODetailCenter
                  order={o}
                  onUpdate={async () => { await clearEventCache(o.id); await loadEventsCallback(true); await handleRefresh(); onUpdate?.(); }}
                  onOrderItemsUpdate={handleOrderItemsSaved}
                  onRemoteSaved={async () => { await new Promise((r) => setTimeout(r, 1500)); await handleRefresh(); }}
                  onPaymentClick={handlePaymentClick}
                  onClose={handleClose}
                >
                  {renderStageContent()}
                </WODetailCenter>
              </div>

            </div>

            {/* MOBILE: New tabbed experience */}
            <div className="lg:hidden h-full">
              <MobileRepairDetail
                order={o}
                status={status}
                activeStatuses={activeStatuses}
                closedStatuses={closedStatuses}
                changingStatus={changingStatus}
                onChangeStatus={(id) => changeStatus(id, "", {})}
                onPaymentClick={handlePaymentClick}
                onPrint={() => setShowPrintDialog(true)}
                onDelete={handleRequestDelete}
                onSecurityEdit={() => setShowSecurityDialog(true)}
                onClose={handleClose}
                onUpdate={async () => { await clearEventCache(o.id); await loadEventsCallback(true); await handleRefresh(); onUpdate?.(); }}
                onOrderItemsUpdate={handleOrderItemsSaved}
                onRemoteSaved={async () => { await new Promise((r) => setTimeout(r, 1500)); await handleRefresh(); }}
                stageContent={renderStageContent()}
              />
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
          onSave={saveWaitingParts} 
          order={order}
          initialData={(() => {
            return {
              partName: order?.part_name || "",
              supplier: order?.parts_supplier || ""
            };
          })()}
        />


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

      {quickPayMode && order && (
        <QuickPayModal
          order={order}
          paymentMode={quickPayMode}
          onClose={() => setQuickPayMode(null)}
          onSuccess={async ({ updatedOrder }) => {
            setQuickPayMode(null);
            if (updatedOrder?.id) {
              setOrder((prev) => ({ ...(prev || {}), ...updatedOrder }));
            }
            await handleRefresh(true);
            onUpdate?.();
          }}
        />
      )}
    </>
  );
}
