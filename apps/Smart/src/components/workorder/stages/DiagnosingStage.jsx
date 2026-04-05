import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Microscope, ShoppingCart, Send, PhoneCall, MessageCircle, Mail,
  CheckCircle2, XCircle, AlertCircle, MinusCircle, Save, ClipboardCheck, ChevronDown, ChevronUp,
  FileText
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import AddItemModal from "@/components/workorder/AddItemModal";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import OrderLinksDialog from "@/components/workorder/OrderLinksDialog";
import { loadOrderLinks } from "@/components/workorder/utils/orderLinksStore";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";
import DiagnosticAI from "@/components/workorder/DiagnosticAI";

// ── Checklists por tipo de dispositivo ────────────────────────────────────────
const DEVICE_CHECKLISTS = {
  smartphone: [
    { id: "pantalla",       label: "Pantalla / Táctil" },
    { id: "bateria",        label: "Batería" },
    { id: "camara_trasera", label: "Cámara Trasera" },
    { id: "camara_frontal", label: "Cámara Frontal" },
    { id: "altavoz",        label: "Altavoz / Bocina" },
    { id: "microfono",      label: "Micrófono" },
    { id: "puerto_carga",   label: "Puerto de Carga" },
    { id: "botones",        label: "Botones Físicos" },
    { id: "sim_tray",       label: "Ranura SIM" },
    { id: "wifi_bt",        label: "Wi-Fi / Bluetooth" },
    { id: "senal_celular",  label: "Señal Celular" },
    { id: "biometrico",     label: "Huella / Face ID" },
    { id: "vibracion",      label: "Motor de Vibración" },
    { id: "software",       label: "Software / iOS / Android" },
    { id: "chasis",         label: "Chasis / Golpes / Agua" },
  ],
  tablet: [
    { id: "pantalla",         label: "Pantalla / Táctil" },
    { id: "bateria",          label: "Batería" },
    { id: "puerto_carga",     label: "Puerto de Carga" },
    { id: "camaras",          label: "Cámaras" },
    { id: "altavoces",        label: "Altavoces" },
    { id: "microfono",        label: "Micrófono" },
    { id: "wifi_bt",          label: "Wi-Fi / Bluetooth" },
    { id: "conector_teclado", label: "Conector de Teclado" },
    { id: "botones",          label: "Botones Físicos" },
    { id: "sim_tray",         label: "Ranura SIM (si aplica)" },
    { id: "biometrico",       label: "Sensor Biométrico" },
    { id: "software",         label: "Software / iPadOS / Android" },
    { id: "chasis",           label: "Chasis / Marco / Golpes" },
  ],
  laptop_windows: [
    { id: "pantalla",      label: "Pantalla / Bisagras" },
    { id: "bateria",       label: "Batería" },
    { id: "teclado",       label: "Teclado" },
    { id: "touchpad",      label: "Touchpad" },
    { id: "almacenamiento",label: "Disco / SSD" },
    { id: "ram",           label: "Memoria RAM" },
    { id: "procesador",    label: "Procesador / Temperatura" },
    { id: "gpu",           label: "Tarjeta Gráfica" },
    { id: "puertos",       label: "Puertos USB / HDMI" },
    { id: "wifi_bt",       label: "Wi-Fi / Bluetooth" },
    { id: "camara_mic",    label: "Cámara / Micrófono" },
    { id: "altavoces",     label: "Altavoces" },
    { id: "ventilacion",   label: "Ventilación / Limpieza" },
    { id: "software",      label: "Windows / Drivers" },
    { id: "cargador",      label: "Cargador / Conector" },
  ],
  macbook: [
    { id: "pantalla",      label: "Pantalla / Retina" },
    { id: "bateria",       label: "Batería (CoconutBattery)" },
    { id: "teclado",       label: "Teclado / Touch Bar" },
    { id: "trackpad",      label: "Force Touch / Trackpad" },
    { id: "almacenamiento",label: "SSD / Almacenamiento" },
    { id: "ram",           label: "Memoria RAM (unificada)" },
    { id: "procesador",    label: "CPU / GPU / Apple Silicon" },
    { id: "puertos",       label: "Puertos USB-C / Thunderbolt" },
    { id: "wifi_bt",       label: "Wi-Fi / Bluetooth" },
    { id: "camara_mic",    label: "Cámara FaceTime / Micrófono" },
    { id: "altavoces",     label: "Altavoces" },
    { id: "ventilacion",   label: "Ventilación / Polvo" },
    { id: "diagnostics",   label: "Apple Diagnostics / macOS" },
    { id: "touch_id",      label: "Touch ID" },
    { id: "bisagra",       label: "Bisagra / Chasis" },
  ],
  desktop_pc: [
    { id: "fuente_poder",   label: "Fuente de Poder" },
    { id: "placa_madre",    label: "Placa Madre" },
    { id: "procesador",     label: "Procesador / Pasta Térmica" },
    { id: "ram",            label: "Memoria RAM" },
    { id: "almacenamiento", label: "Disco Duro / SSD" },
    { id: "gpu",            label: "Tarjeta Gráfica" },
    { id: "puertos",        label: "Puertos USB / HDMI / DP" },
    { id: "ventilacion",    label: "Ventiladores / Refrigeración" },
    { id: "red",            label: "Tarjeta de Red / Wi-Fi" },
    { id: "unidad_optica",  label: "Unidad Óptica (si aplica)" },
    { id: "bios",           label: "BIOS / UEFI" },
    { id: "software",       label: "Windows / Drivers" },
    { id: "cables",         label: "Cables Internos / Conexiones" },
    { id: "chasis",         label: "Chasis / Polvo / Daños" },
  ],
  imac: [
    { id: "pantalla",       label: "Pantalla / Panel Retina" },
    { id: "fuente_poder",   label: "Fuente de Poder Interna" },
    { id: "placa_madre",    label: "Placa Madre" },
    { id: "procesador",     label: "CPU / GPU / Apple Silicon" },
    { id: "ram",            label: "Memoria RAM (según modelo)" },
    { id: "almacenamiento", label: "SSD / Fusion Drive" },
    { id: "puertos",        label: "Puertos USB-C / Thunderbolt" },
    { id: "wifi_bt",        label: "Wi-Fi / Bluetooth" },
    { id: "camara_mic",     label: "Cámara FaceTime / Micrófono" },
    { id: "altavoces",      label: "Altavoces Integrados" },
    { id: "ventilacion",    label: "Ventilación / Temperatura" },
    { id: "soporte",        label: "Soporte / Base" },
    { id: "diagnostics",    label: "Apple Diagnostics / macOS" },
    { id: "backlight",      label: "Brillo / Backlight" },
  ],
  headphones: [
    { id: "auriculares",    label: "Auriculares / Almohadillas" },
    { id: "drivers_audio",  label: "Drivers de Audio" },
    { id: "cable",          label: "Cable / Conector 3.5mm" },
    { id: "microfono",      label: "Micrófono Integrado" },
    { id: "bateria",        label: "Batería (inalámbricos)" },
    { id: "bluetooth",      label: "Bluetooth / Pareado" },
    { id: "controles",      label: "Controles / Botones" },
    { id: "anc",            label: "Cancelación de Ruido (ANC)" },
    { id: "diadema",        label: "Diadema / Estructura" },
    { id: "carga",          label: "Puerto de Carga / Estuche" },
    { id: "firmware",       label: "Firmware / App Companion" },
    { id: "balance",        label: "Balance L/R de Audio" },
  ],
  smartwatch: [
    { id: "pantalla",     label: "Pantalla / Táctil" },
    { id: "bateria",      label: "Batería / Autonomía" },
    { id: "carga",        label: "Cargador Magnético / Pines" },
    { id: "bt_wifi",      label: "Bluetooth / Wi-Fi / LTE" },
    { id: "sensor_bio",   label: "Sensor Cardíaco / SpO2" },
    { id: "sensor_mov",   label: "Acelerómetro / Giroscopio" },
    { id: "gps",          label: "GPS (si aplica)" },
    { id: "corona",       label: "Botones / Corona Digital" },
    { id: "mic_speaker",  label: "Micrófono / Altavoz" },
    { id: "agua",         label: "Sellado / Resistencia al Agua" },
    { id: "correa",       label: "Correa / Chasis" },
    { id: "firmware",     label: "Firmware / watchOS / WearOS" },
    { id: "pareo",        label: "Pareo con Teléfono" },
  ],
  game_console: [
    { id: "encendido",    label: "Encendido / Fuente de Poder" },
    { id: "video",        label: "Salida de Video / HDMI" },
    { id: "lectora",      label: "Lectora de Discos" },
    { id: "almacenamiento",label: "Disco Duro / SSD Interno" },
    { id: "ventilacion",  label: "Ventilación / Limpieza Polvo" },
    { id: "puertos_usb",  label: "Puertos USB" },
    { id: "wifi_bt",      label: "Wi-Fi / Bluetooth" },
    { id: "controles",    label: "Controles / Joysticks" },
    { id: "online",       label: "Conectividad en Línea" },
    { id: "audio",        label: "Salida de Audio" },
    { id: "firmware",     label: "Firmware del Sistema" },
    { id: "temperatura",  label: "Temperatura / Sobrecalentamiento" },
    { id: "chasis",       label: "Chasis / Daños Físicos" },
  ],
  printer: [
    { id: "cabezal",      label: "Cabezal de Impresión" },
    { id: "tinta",        label: "Cartuchos / Tóner" },
    { id: "alimentacion", label: "Alimentación de Papel" },
    { id: "rodillos",     label: "Rodillos / Fusor" },
    { id: "bandeja",      label: "Bandejas de Papel" },
    { id: "conectividad", label: "USB / Wi-Fi / Ethernet" },
    { id: "panel",        label: "Pantalla / Panel de Control" },
    { id: "calidad",      label: "Calidad de Impresión" },
    { id: "escaner",      label: "Escáner (si aplica)" },
    { id: "atascos",      label: "Sensor de Atascos" },
    { id: "firmware",     label: "Firmware / Drivers" },
    { id: "fuente_poder", label: "Fuente de Poder" },
    { id: "limpieza",     label: "Limpieza Interna / Cabezal" },
  ],
  // Fallback genérico
  generic: [
    { id: "encendido",    label: "Encendido / Energía" },
    { id: "pantalla",     label: "Pantalla / Display" },
    { id: "bateria",      label: "Batería (si aplica)" },
    { id: "conectividad", label: "Conectividad / Puertos" },
    { id: "audio",        label: "Audio" },
    { id: "software",     label: "Software / Firmware" },
    { id: "agua",         label: "Agua / Humedad" },
    { id: "chasis",       label: "Chasis / Daños Físicos" },
  ],
};

// ── Labels legibles por tipo ───────────────────────────────────────────────────
const DEVICE_TYPE_LABELS = {
  smartphone:    "📱 Smartphone / Celular",
  tablet:        "📱 Tablet / iPad",
  laptop_windows:"💻 Laptop / Windows",
  macbook:       "💻 MacBook",
  desktop_pc:    "🖥️ PC Torre / Desktop",
  imac:          "🖥️ iMac",
  headphones:    "🎧 Audífonos / Headset",
  smartwatch:    "⌚ Smartwatch / Apple Watch",
  game_console:  "🎮 Consola de Videojuegos",
  printer:       "🖨️ Impresora",
  generic:       "🔧 Dispositivo General",
};

// ── Plantillas de diagnóstico por tipo de dispositivo ────────────────────────
const DIAG_TEMPLATES = {
  smartphone: [
    { label: "Pantalla rota", text: "Se recibe equipo con pantalla fracturada. El LCD presenta daño físico con cracking visible en el panel. El digitalizador táctil no responde en zona afectada. Se requiere reemplazo del módulo de pantalla completo." },
    { label: "Batería degradada", text: "Diagnóstico de batería: la batería presenta degradación avanzada (ciclos excesivos). El equipo se apaga de forma inesperada y muestra lectura de carga inconsistente. Se recomienda reemplazo de batería." },
    { label: "No carga / Puerto", text: "El equipo no carga correctamente. Se verificó el cargador original sin resultado positivo. Se detecta acumulación de polvo/daño en puerto de carga. Se recomienda limpieza o reemplazo del puerto." },
    { label: "Daño por agua", text: "Se recibe equipo con historial de contacto con líquidos. Se observan indicadores de humedad activos. Se realizará limpieza con ultrasonido y valoración de componentes afectados." },
    { label: "Sin señal / IMEI", text: "El equipo no presenta señal celular. Se verificó configuración de red sin resultado. Se sospecha fallo en módulo de radio o antena. Se procederá a diagnóstico de placa." },
  ],
  tablet: [
    { label: "Pantalla rota", text: "Se recibe tablet con pantalla fracturada y digitalizador dañado. El cristal presenta múltiples fisuras. Se requiere reemplazo del módulo de pantalla completo." },
    { label: "No enciende", text: "La tablet no responde al botón de encendido. Se verificó carga sin resultado. Se procederá a diagnóstico de placa madre y batería." },
    { label: "Botón Home roto", text: "El botón Home/físico no responde. Se verificó conector de flex sin resultado. Se requiere reemplazo del botón o módulo de pantalla (si integrado)." },
  ],
  laptop_windows: [
    { label: "No enciende", text: "El equipo no responde al encendido. Se verificó adaptador de corriente y batería. Se realizará diagnóstico de placa madre, RAM y SSD. Posible fallo en chip EC/controlador de carga." },
    { label: "Pantalla falla", text: "La pantalla presenta fallo: líneas verticales/horizontales, imagen distorsionada o sin imagen. Se verificó cable de video. Se recomienda diagnóstico de GPU o reemplazo de panel LCD." },
    { label: "Disco duro lento/falla", text: "Se detecta rendimiento degradado del sistema. Diagnóstico de almacenamiento: SSD/HDD presenta sectores dañados o velocidades fuera de rango normal. Se recomienda reemplazo de unidad." },
    { label: "Sobrecalentamiento", text: "El equipo se apaga por temperatura excesiva. Se detecta acumulación de polvo en sistema de refrigeración. Se realizará limpieza de ventiladores y reemplazo de pasta térmica." },
  ],
  macbook: [
    { label: "No enciende", text: "MacBook no responde al botón de encendido. Se verificó cargador MagSafe/USB-C sin resultado. Se realizará diagnóstico con Apple Diagnostics y valoración de placa madre." },
    { label: "Pantalla falla", text: "La pantalla Retina presenta fallo (flickering, líneas, imagen distorsionada). Se sospecha fallo en cable de video o panel LCD. Se recomienda diagnóstico completo antes de reemplazo." },
    { label: "Teclado/Mariposa falla", text: "Teclas no responden o se activan de forma repetida. Fallo típico del mecanismo de mariposa. Se recomienda reemplazo del módulo de teclado completo." },
    { label: "Líquido", text: "Se recibe MacBook con daño por líquido. Se detectan corrosiones en placa. Se realizará limpieza en ultrasonido y valoración de componentes para cotización de reparación microelectrónica." },
  ],
  desktop_pc: [
    { label: "No enciende", text: "El PC no responde al botón de encendido. Se verificó cable de corriente y toma eléctrica. Se procederá a diagnóstico de fuente de poder, placa madre y RAM." },
    { label: "Pantalla sin imagen", text: "El equipo enciende pero no hay imagen en pantalla. Se verificó conexión HDMI/DisplayPort. Posible fallo en tarjeta gráfica o RAM. Se realizará diagnóstico con GPU integrada." },
    { label: "Sobrecalentamiento", text: "El sistema se apaga o reinicia por temperatura. Se detecta polvo excesivo en disipador y ventiladores. Se realizará limpieza interna y aplicación de pasta térmica nueva." },
  ],
  generic: [
    { label: "Diagnóstico general", text: "Se recibe equipo para diagnóstico. Se realizará evaluación completa de componentes físicos y funcionales. Los resultados y cotización serán comunicados al cliente." },
    { label: "Daño físico", text: "El equipo presenta daño físico externo. Se realizará valoración de componentes internos para determinar alcance del daño y viabilidad de reparación." },
    { label: "Daño por líquido", text: "Se recibe equipo con contacto con líquidos. Se realizará limpieza y diagnóstico de circuitos. La cotización dependerá del nivel de corrosión encontrado." },
  ],
};

// ── Detección automática del tipo de dispositivo ───────────────────────────────
function detectDeviceCategory(order) {
  const raw = [
    order?.device_type   || "",
    order?.device_brand  || "",
    order?.device_model  || "",
  ].join(" ").toLowerCase();

  if (/imac/.test(raw))                                              return "imac";
  if (/macbook|mac book/.test(raw))                                  return "macbook";
  if (/iphone|galaxy|pixel|celular|smartphone|android|oneplus|motorola|xiaomi|huawei|redmi|oppo|realme/.test(raw)) return "smartphone";
  if (/ipad|tablet|kindle|surface(?!\s*pro\s*\d)|lenovo\s*tab|samsung\s*tab/.test(raw)) return "tablet";
  if (/apple\s*watch|smartwatch|watch\s*series|galaxy\s*watch|fitbit|garmin/.test(raw)) return "smartwatch";
  if (/airpods|headphone|audifonos|audífonos|headset|earbuds|earphone|beats|bose|sony\s*wh|sony\s*wf|jabra/.test(raw)) return "headphones";
  if (/playstation|xbox|nintendo|ps4|ps5|switch|console|consola|wii|game|gaming\s*console/.test(raw)) return "game_console";
  if (/printer|impresora|epson\s*(l\d|et)|hp\s*(laserjet|deskjet|officejet|envy)|canon\s*(pixma|mg)|brother/.test(raw)) return "printer";
  if (/macbook|mac\s*pro|mac\s*mini|apple(?!\s*watch)/.test(raw))   return "macbook";
  if (/desktop|torre|pc tower|all.in.one(?!\s*imac)/.test(raw))     return "desktop_pc";
  if (/laptop|notebook|chromebook|surface\s*pro|thinkpad|ideapad|inspiron|pavilion|spectre|envy\s*\d|yoga/.test(raw)) return "laptop_windows";
  if (/tower|servidor|workstation/.test(raw))                        return "desktop_pc";

  return "generic";
}

// ── Checklist por defecto (fallback) ─────────────────────────────────────────
function getChecklistForOrder(order) {
  const category = detectDeviceCategory(order);
  return { category, items: DEVICE_CHECKLISTS[category] || DEVICE_CHECKLISTS.generic };
}

const STATUS_CYCLE = { not_tested: "ok", ok: "issue", issue: "warning", warning: "not_tested" };

const STATUS_CFG = {
  not_tested: { Icon: MinusCircle,  color: "text-white/25",   ring: "border-white/10 bg-white/[0.04]",         label: "" },
  ok:         { Icon: CheckCircle2, color: "text-emerald-400", ring: "border-emerald-500/25 bg-emerald-500/10", label: "OK" },
  issue:      { Icon: XCircle,      color: "text-red-400",     ring: "border-red-500/25 bg-red-500/10",         label: "Problema" },
  warning:    { Icon: AlertCircle,  color: "text-amber-400",   ring: "border-amber-500/25 bg-amber-500/10",     label: "Revisar" },
};

export default function DiagnosingStage({ order, onUpdate, user, onOrderItemsUpdate, onRemoteSaved, onPaymentClick, compact }) {
  const [activeModal, setActiveModal]       = useState(null);
  const [showCatalog, setShowCatalog]       = useState(false);
  const [sendingQuote, setSendingQuote]     = useState(false);
  const [links, setLinks]                   = useState([]);
  const [linkOrderPreview, setLinkOrderPreview] = useState(null);
  const [openCatalogFromLink, setOpenCatalogFromLink] = useState(false);
  // Checklist
  const [checklist, setChecklist]           = useState([]);
  const [checklistNotes, setChecklistNotes] = useState("");
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [showChecklist, setShowChecklist]   = useState(false);
  const [deviceCategory, setDeviceCategory] = useState("generic");

  // Listen for sidebar action events (checklist toggle, links, quote)
  useEffect(() => {
    if (!compact) return;
    const handler = (e) => {
      const action = e.detail?.action;
      if (action === "checklist") setShowChecklist(v => !v);
      if (action === "links") setActiveModal(prev => prev === "links" ? null : "links");
    };
    document.addEventListener("wo:action", handler);
    const onLinks = () => setActiveModal(prev => prev === "links" ? null : "links");
    document.addEventListener("wo:toggle-links", onLinks);
    return () => {
      document.removeEventListener("wo:action", handler);
      document.removeEventListener("wo:toggle-links", onLinks);
    };
  }, [compact]);

  const effectiveOrder = linkOrderPreview?.id === order?.id
    ? { ...order, ...linkOrderPreview, order_items: Array.isArray(linkOrderPreview?.order_items) ? linkOrderPreview.order_items : order?.order_items }
    : order;

  useEffect(() => {
    loadLinks();
    // Detect device category and merge saved items with the correct template
    const { category, items: templateItems } = getChecklistForOrder(order);
    setDeviceCategory(category);
    const saved = Array.isArray(order?.checklist_items) ? order.checklist_items : [];
    const merged = templateItems.map(def => {
      const found = saved.find(s => s.id === def.id);
      return found ? { ...def, ...found } : { ...def, status: "not_tested", notes: "" };
    });
    setChecklist(merged);
    setChecklistNotes(order?.checklist_notes || "");
  }, [order?.id]);

  useEffect(() => {
    setLinkOrderPreview(null);
    setOpenCatalogFromLink(false);
  }, [order?.id]);

  const loadLinks = async () => {
    if (!order?.id) return;
    try {
      const result = await loadOrderLinks(order);
      setLinks(Array.isArray(result?.links) ? result.links : []);
    } catch { setLinks([]); }
  };

  const cycleStatus = (id) => {
    setChecklist(prev => prev.map(item =>
      item.id !== id ? item : { ...item, status: STATUS_CYCLE[item.status] || "not_tested" }
    ));
  };

  const setItemNote = (id, notes) => {
    setChecklist(prev => prev.map(item => item.id !== id ? item : { ...item, notes }));
  };

  const handleSaveChecklist = async () => {
    setChecklistSaving(true);
    try {
      await base44.entities.Order.update(order.id, {
        checklist_items: checklist,
        checklist_notes: checklistNotes,
      });
      onUpdate?.();
      toast.success("Checklist guardado");
    } catch { toast.error("Error al guardar checklist"); }
    finally { setChecklistSaving(false); }
  };

  const handleSendQuote = async () => {
    if (!order.customer_email) {
      toast.error("El cliente no tiene email registrado");
      return;
    }
    setSendingQuote(true);
    try {
      const { getBusinessInfo } = await import("@/components/utils/emailTemplates");
      const businessInfo = await getBusinessInfo();

      const items = Array.isArray(effectiveOrder.order_items) ? effectiveOrder.order_items : [];

      // Totals from actual line items
      const subtotal = items.reduce((sum, item) => {
        const price    = Number(item.price || 0);
        const qty      = Number(item.qty || 1);
        const discount = Number(item.discount_percentage || 0);
        return sum + price * qty * (1 - discount / 100);
      }, 0);
      const tax   = subtotal * 0.115;
      const total = subtotal + tax;

      // Line items HTML — links never exposed to client
      const itemsRowsHTML = items.length > 0
        ? items.map(item => {
            const name      = item.name || item.service_name || item.product_name || "Item";
            const price     = Number(item.price || 0);
            const qty       = Number(item.qty || 1);
            const discount  = Number(item.discount_percentage || 0);
            const lineTotal = price * qty * (1 - discount / 100);
            return `
              <tr style="border-bottom:1px solid #F3F4F6;">
                <td style="padding:12px 16px;color:#1F2937;font-size:14px;">${name}</td>
                <td style="padding:12px 16px;color:#6B7280;font-size:13px;text-align:center;">${qty > 1 ? `x${qty}` : ""}</td>
                <td style="padding:12px 16px;color:#1F2937;font-size:14px;text-align:right;font-weight:600;">$${lineTotal.toFixed(2)}</td>
              </tr>`;
          }).join("")
        : `<tr><td colspan="3" style="padding:20px;text-align:center;color:#9CA3AF;font-size:14px;">Sin ítems añadidos</td></tr>`;

      // Checklist section HTML
      const testedItems = checklist.filter(c => c.status !== "not_tested");
      const checklistHTML = testedItems.length > 0 ? `
        <div style="background:#F9FAFB;border-radius:16px;padding:24px;margin:24px 0;border:2px solid #E5E7EB;">
          <p style="color:#111827;font-size:16px;font-weight:700;margin:0 0 6px 0;">🔍 Estado del Dispositivo</p>
          <p style="color:#6B7280;font-size:13px;margin:0 0 16px 0;">Hallazgos adicionales del diagnóstico técnico:</p>
          <table style="width:100%;border-collapse:collapse;">
            ${testedItems.map(c => {
              const icon  = c.status === "ok" ? "✅" : c.status === "issue" ? "❌" : "⚠️";
              const label = c.status === "ok" ? "OK" : c.status === "issue" ? "Problema encontrado" : "Requiere revisión";
              const bg    = c.status === "ok" ? "#F0FDF4" : c.status === "issue" ? "#FEF2F2" : "#FFFBEB";
              const color = c.status === "ok" ? "#065F46" : c.status === "issue" ? "#7F1D1D" : "#78350F";
              return `<tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:10px 12px;font-size:14px;color:#1F2937;">${c.label}</td>
                <td style="padding:10px 12px;">
                  <span style="display:inline-block;padding:4px 10px;border-radius:20px;background:${bg};color:${color};font-size:12px;font-weight:700;">${icon} ${label}</span>
                </td>
              </tr>
              ${c.notes ? `<tr><td colspan="2" style="padding:4px 12px 10px;font-size:13px;color:#6B7280;font-style:italic;">${c.notes}</td></tr>` : ""}`;
            }).join("")}
          </table>
          ${checklistNotes ? `<p style="margin:16px 0 0;padding:12px;background:white;border-radius:8px;border:1px solid #E5E7EB;color:#374151;font-size:14px;line-height:1.6;">${checklistNotes}</p>` : ""}
        </div>` : "";

      const emailHTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:650px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%);padding:48px 30px;text-align:center;">
    ${businessInfo.logo_url ? `<img src="${businessInfo.logo_url}" alt="${businessInfo.business_name}" style="height:70px;width:auto;margin:0 auto 18px;display:block;filter:drop-shadow(0 4px 20px rgba(0,0,0,0.2));" />` : ""}
    <h1 style="color:white;margin:0;font-size:26px;font-weight:800;">🔍 Diagnóstico Completado</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:15px;">${businessInfo.business_name || "SmartFixOS"}</p>
  </div>
  <div style="padding:40px 36px;">
    <p style="font-size:18px;color:#111827;margin:0 0 20px;font-weight:600;">Hola <strong>${order.customer_name}</strong> 👋</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 28px;">
      Hemos completado el diagnóstico de tu <strong>${order.device_brand || ""} ${order.device_model || ""}</strong>.
      A continuación encontrarás el detalle de lo que necesita tu equipo.
    </p>

    <div style="background:#F9FAFB;border-radius:12px;padding:18px 20px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Número de orden</p>
      <p style="color:#111827;font-size:20px;font-weight:800;margin:0 0 10px;">${order.order_number}</p>
      <p style="color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Problema reportado</p>
      <p style="color:#1F2937;font-size:14px;margin:0;line-height:1.6;">${order.initial_problem || "N/A"}</p>
    </div>

    ${checklistHTML}

    <div style="background:#F9FAFB;border-radius:16px;overflow:hidden;border:2px solid #E5E7EB;margin:24px 0;">
      <div style="background:#111827;padding:16px 20px;">
        <p style="color:white;font-size:16px;font-weight:700;margin:0;">💰 Cotización de Reparación</p>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:4px 0 0;">Orden #${order.order_number}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F3F4F6;">
            <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Servicio / Pieza</th>
            <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;">Cant.</th>
            <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsRowsHTML}</tbody>
      </table>
      <div style="padding:16px 20px;border-top:2px solid #E5E7EB;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#6B7280;font-size:14px;">Subtotal</span>
          <span style="color:#1F2937;font-size:14px;font-weight:600;">$${subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
          <span style="color:#6B7280;font-size:14px;">IVU (11.5%)</span>
          <span style="color:#6B7280;font-size:14px;">$${tax.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:14px;background:linear-gradient(135deg,#7C3AED,#4F46E5);border-radius:10px;">
          <span style="color:white;font-size:16px;font-weight:800;">Total Estimado</span>
          <span style="color:white;font-size:20px;font-weight:900;">$${total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${businessInfo.phone || businessInfo.whatsapp ? `
    <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:24px 0;text-align:center;border:1px solid #E5E7EB;">
      <p style="color:#111827;font-size:14px;font-weight:600;margin:0 0 12px;">¿Aprobamos la reparación? Contáctanos:</p>
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
        ${businessInfo.phone ? `<a href="tel:${businessInfo.phone}" style="display:inline-flex;align-items:center;gap:6px;background:#111827;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">📞 Llamar</a>` : ""}
        ${businessInfo.whatsapp ? `<a href="https://wa.me/${businessInfo.whatsapp.replace(/\D/g,"")}" style="display:inline-flex;align-items:center;gap:6px;background:#10B981;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">💬 WhatsApp</a>` : ""}
      </div>
    </div>` : ""}

    <div style="margin-top:40px;padding-top:24px;border-top:1px solid #E5E7EB;text-align:center;">
      ${businessInfo.logo_url ? `<img src="${businessInfo.logo_url}" alt="${businessInfo.business_name}" style="height:36px;width:auto;margin:0 auto 10px;display:block;opacity:0.55;" />` : ""}
      <p style="color:#374151;font-size:13px;font-weight:700;margin:0;">${businessInfo.business_name || "SmartFixOS"}</p>
      ${businessInfo.address ? `<p style="color:#9CA3AF;font-size:12px;margin:4px 0 0;">${businessInfo.address}</p>` : ""}
      ${businessInfo.phone ? `<p style="color:#9CA3AF;font-size:12px;margin:4px 0 0;">📞 ${businessInfo.phone}</p>` : ""}
    </div>
  </div>
</div>
</body>
</html>`;

      await base44.integrations.Core.SendEmail({
        to: order.customer_email,
        subject: `🔍 Diagnóstico Completado - Orden #${order.order_number}`,
        body: emailHTML,
      });
      toast.success("Cotización enviada al cliente");
    } catch (error) {
      console.error(error);
      toast.error("Error al enviar cotización");
    } finally {
      setSendingQuote(false);
    }
  };

  // Listen for quote event from sidebar
  useEffect(() => {
    if (!compact) return;
    const handler = () => handleSendQuote();
    document.addEventListener("wo:send-quote", handler);
    return () => document.removeEventListener("wo:send-quote", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, order?.customer_email]);

  // Derived checklist stats
  const checkedCount  = checklist.filter(c => c.status !== "not_tested").length;
  const issueCount    = checklist.filter(c => c.status === "issue").length;
  const warningCount  = checklist.filter(c => c.status === "warning").length;
  const o = order || {};

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      {!compact && (
      <section className="relative overflow-hidden rounded-[30px] border border-purple-500/15 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_30%),linear-gradient(135deg,rgba(16,12,30,0.98),rgba(10,18,30,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />

        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-purple-200">
                Diagnostico
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Analisis tecnico
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Etapa de Diagnóstico</h2>
                <div className="inline-flex items-center rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-sm font-semibold text-purple-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Completa el checklist de diagnóstico, añade piezas y envía la cotización al cliente.
              </p>
            </div>

            {/* Info grid: 3 cards */}
            <div className="grid gap-3 md:grid-cols-3">
              {/* Cliente */}
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-purple-200">{o.customer_name || "No registrado"}</p>
              </div>

              {/* Checklist status */}
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Checklist</p>
                <p className="mb-2 truncate text-[11px] font-semibold text-purple-300">{DEVICE_TYPE_LABELS[deviceCategory]}</p>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xl font-black text-white">{checkedCount}</span>
                  <span className="text-xs text-white/40">/ {checklist.length}</span>
                  {issueCount > 0 && (
                    <Badge className="rounded-full border-red-500/30 bg-red-500/10 text-[11px] text-red-300">
                      {issueCount} {issueCount === 1 ? "problema" : "problemas"}
                    </Badge>
                  )}
                  {warningCount > 0 && issueCount === 0 && (
                    <Badge className="rounded-full border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-300">
                      {warningCount} a revisar
                    </Badge>
                  )}
                  {checkedCount === checklist.length && checklist.length > 0 && issueCount === 0 && warningCount === 0 && (
                    <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-300">
                      ✓ Completo
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => setShowChecklist(v => !v)}
                  size="sm"
                  className="w-full rounded-xl bg-purple-600 px-3 text-white hover:bg-purple-500"
                >
                  {showChecklist ? <><ChevronUp className="mr-1 h-3.5 w-3.5" /> Cerrar</> : <><ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Abrir</>}
                </Button>
              </div>

              {/* Links y Cotización */}
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Links y Cotización</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    onClick={() => setActiveModal(activeModal === "links" ? null : "links")}
                    size="sm"
                    className="w-full rounded-xl bg-cyan-600 px-3 text-white hover:bg-cyan-500 sm:w-auto"
                  >
                    {activeModal === "links" ? "Cerrar" : (links.length > 0 ? `Ver Links (${links.length})` : "Añadir Link")}
                  </Button>
                  <Button
                    onClick={handleSendQuote}
                    disabled={sendingQuote}
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    {sendingQuote ? "Enviando..." : "Cotización"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact buttons */}
        {(o.customer_phone || o.customer_email) && (() => {
          const phone  = o.customer_phone || "";
          const email  = o.customer_email || "";
          const digits = phone.replace(/\D/g, "");
          const intl   = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
          return (
            <div className="relative z-10 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {digits && (
                <a href={`tel:+${intl}`} className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/5 font-bold text-sm uppercase tracking-wide text-white transition-all hover:bg-white/10 active:scale-95">
                  <PhoneCall className="h-5 w-5 text-white/60" />{phone}
                </a>
              )}
              {digits && (
                <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer"
                  className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/12 font-bold text-sm uppercase tracking-wide text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-95">
                  <MessageCircle className="h-5 w-5" />WhatsApp
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`}
                  className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/12 font-bold text-sm uppercase tracking-wide text-blue-300 transition-all hover:bg-blue-500/20 active:scale-95">
                  <Mail className="h-5 w-5" /><span className="truncate">{email}</span>
                </a>
              )}
            </div>
          );
        })()}
      </section>
      )}

      {/* ── Piezas y Servicios ── */}
      {!compact && (
      <SharedItemsSection
        order={effectiveOrder}
        onUpdate={onUpdate}
        onOrderItemsUpdate={onOrderItemsUpdate}
        onRemoteSaved={onRemoteSaved}
        onPaymentClick={onPaymentClick}
        accentColor="purple"
        subtitle="Añade piezas o servicios sugeridos para que la cotización salga lista desde esta misma etapa."
      />
      )}

      {/* ── Checklist de Diagnóstico ── */}
      {showChecklist && (
        <section className="overflow-hidden rounded-[28px] border border-purple-500/15 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-transparent px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/15 text-purple-300 sm:h-12 sm:w-12">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Diagnóstico técnico · {DEVICE_TYPE_LABELS[deviceCategory]}</p>
                  <h3 className="text-lg font-black tracking-tight text-white sm:text-xl">Checklist del Dispositivo</h3>
                </div>
              </div>
              <p className="text-xs text-white/35">Toca para cambiar estado</p>
            </div>
          </div>

          <div className="space-y-3 p-5 sm:p-6">
            {/* Info banner */}
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/45 leading-relaxed">
              <strong className="text-white/60">Motivo de ingreso:</strong> {o.initial_problem || "No especificado"} &nbsp;·&nbsp;
              El checklist documenta lo encontrado durante el diagnóstico (puede diferir del motivo de ingreso).
            </div>

            {/* Check items */}
            <div className="grid gap-2 sm:grid-cols-2">
              {checklist.map(item => {
                const cfg    = STATUS_CFG[item.status] || STATUS_CFG.not_tested;
                const { Icon } = cfg;
                return (
                  <div key={item.id} className={`rounded-2xl border ${cfg.ring} transition-all`}>
                    <button
                      onClick={() => cycleStatus(item.id)}
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      <Icon className={`h-6 w-6 shrink-0 ${cfg.color}`} />
                      <span className="flex-1 text-sm font-semibold text-white">{item.label}</span>
                      {cfg.label && (
                        <Badge className={`shrink-0 rounded-full border-0 text-[11px] font-bold ${
                          item.status === "ok"      ? "bg-emerald-500/20 text-emerald-300" :
                          item.status === "issue"   ? "bg-red-500/20 text-red-300" :
                                                      "bg-amber-500/20 text-amber-300"
                        }`}>
                          {cfg.label}
                        </Badge>
                      )}
                    </button>
                    {item.status !== "not_tested" && (
                      <div className="border-t border-white/[0.06] px-4 pb-3 pt-2">
                        <input
                          type="text"
                          placeholder="Nota opcional..."
                          value={item.notes || ""}
                          onChange={e => setItemNote(item.id, e.target.value)}
                          className="w-full bg-transparent text-xs text-white/60 placeholder:text-white/20 outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Diagnosis templates */}
            {(DIAG_TEMPLATES[deviceCategory] || DIAG_TEMPLATES.generic).length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-black text-white/25 uppercase tracking-widest mb-2">
                  <FileText className="w-3 h-3" /> Plantillas rápidas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(DIAG_TEMPLATES[deviceCategory] || DIAG_TEMPLATES.generic).map(tpl => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setChecklistNotes(prev => prev ? `${prev}\n\n${tpl.text}` : tpl.text)}
                      className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/15 text-purple-300 text-[11px] font-bold hover:bg-purple-500/20 active:scale-95 transition-all"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* General notes */}
            <Textarea
              placeholder="Notas generales del diagnóstico (se incluyen en el email al cliente)..."
              className="min-h-[100px] resize-none rounded-[22px] border-white/10 bg-black/30 text-white placeholder:text-white/20 focus:border-purple-400/40 focus:ring-purple-500/40"
              value={checklistNotes}
              onChange={e => setChecklistNotes(e.target.value)}
            />

            {/* Save + Send */}
            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                onClick={handleSendQuote}
                disabled={sendingQuote}
                className="h-11 justify-start rounded-2xl border border-white/10 bg-white/5 px-4 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Send className="mr-2 h-4 w-4" />
                {sendingQuote ? "Enviando..." : "Enviar cotización con checklist"}
              </Button>
              <Button
                onClick={handleSaveChecklist}
                disabled={checklistSaving}
                className="h-11 rounded-2xl border-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-6 text-white shadow-lg shadow-purple-950/30 hover:from-purple-500 hover:to-indigo-500"
              >
                <Save className="mr-2 h-4 w-4" />
                {checklistSaving ? "Guardando..." : "Guardar Checklist"}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── Asistente de Diagnostico IA ── */}
      {!compact && (
      <DiagnosticAI
        order={order}
        checklist={checklist}
        deviceCategory={deviceCategory}
      />
      )}

      {/* ── Historia y Comentarios ── */}
      {!compact && (
      <WorkOrderUnifiedHub
        order={order}
        onUpdate={onUpdate}
        accent="purple"
        title="Historia y Comentarios"
        subtitle="Notas técnicas, evidencia fotográfica y actividad de la orden."
      />
      )}

      <OrderLinksDialog
        order={effectiveOrder}
        user={user}
        onUpdate={() => { loadLinks(); onUpdate?.(); }}
        onLinkSaved={(nextOrder) => {
          if (nextOrder?.id === order?.id) {
            setLinkOrderPreview(nextOrder);
            setOpenCatalogFromLink(true);
            setShowCatalog(true);
          }
        }}
        open={activeModal === "links"}
        onOpenChange={(open) => setActiveModal(open ? "links" : null)}
        accent="cyan"
        allowAdd={true}
        title="Ver y Añadir Links"
        subtitle="Links de piezas"
        onLinksChange={setLinks}
      />

      <AddItemModal
        open={showCatalog}
        onClose={() => { setShowCatalog(false); setOpenCatalogFromLink(false); }}
        order={effectiveOrder}
        initialItems={Array.isArray(effectiveOrder?.order_items) ? effectiveOrder.order_items : []}
        onUpdate={onUpdate}
        autoOpenCart={openCatalogFromLink}
      />

    </div>
  );
}
