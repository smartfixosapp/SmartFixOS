import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { dataClient } from "@/components/api/dataClient";
import { X, Mic, ChevronRight, CheckCircle2, ChevronLeft, Delete, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { callJENAI } from "@/lib/jenaiEngine";

const IVU_RATE = 0.115;
function toNum(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; }

// Páginas donde NO mostrar JENAI
const HIDDEN_PATHS = [
  "/Welcome", "/PinAccess", "/Setup", "/InitialSetup",
  "/VerifySetup", "/Activate", "/TenantActivate", "/returnlogin",
];

// ── Herramientas del Asistente JENAI ───────────────────────────────────────
const ARIA_TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_cliente",
      description: "Busca un cliente existente en la base de datos por nombre o teléfono.",
      parameters: {
        type: "object",
        properties: { consulta: { type: "string", description: "Nombre o teléfono" } },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obtener_tecnicos",
      description: "Obtiene la lista de técnicos disponibles para asignar a una orden.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_orden_completa",
      description: "Crea una orden de trabajo con toda la información recopilada. ÚSALA SOLO cuando tengas: cliente, equipo, problema, checklist, seguridad e indicaciones del cliente.",
      parameters: {
        type: "object",
        properties: {
          customer_name:          { type: "string",  description: "Nombre completo del cliente" },
          customer_phone:         { type: "string",  description: "Teléfono del cliente" },
          customer_id:            { type: "string",  description: "ID del cliente si ya existe en el sistema" },
          device_brand:           { type: "string",  description: "Marca del dispositivo (Apple, Samsung, etc.)" },
          device_model:           { type: "string",  description: "Modelo exacto del dispositivo" },
          device_type:            { type: "string",  description: "Tipo: Phone, Tablet, Laptop, Smartwatch, Other" },
          initial_problem:        { type: "string",  description: "Descripción del problema principal" },
          checklist_items:        { type: "string",  description: "Checklist de condición: pantalla, batería, cámara, botones, daño físico/agua, etc." },
          security_info:          { type: "string",  description: "Seguridad del dispositivo: PIN, patrón, huella, Face ID o ninguna" },
          customer_notes:         { type: "string",  description: "Indicaciones especiales del cliente" },
          assigned_technician_id: { type: "string",  description: "ID del técnico asignado (opcional)" },
        },
        required: ["customer_name", "device_brand", "device_model", "initial_problem"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_precio_inventario",
      description: "Consulta el precio de una pieza o repuesto en el inventario del taller.",
      parameters: {
        type: "object",
        properties: { busqueda: { type: "string", description: "Nombre de la pieza (ej: pantalla iPhone 14, batería Galaxy S23)" } },
        required: ["busqueda"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_total_reparacion",
      description: "Calcula costo total de una reparación: precio pieza + mano de obra.",
      parameters: {
        type: "object",
        properties: {
          precio_pieza:    { type: "number" },
          costo_mano_obra: { type: "number" },
          nombre_pieza:    { type: "string" },
          dispositivo:     { type: "string" },
        },
        required: ["precio_pieza", "costo_mano_obra"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sugerir_accesorios",
      description: "Sugiere accesorios complementarios para el dispositivo del cliente.",
      parameters: {
        type: "object",
        properties: {
          dispositivo: { type: "string" },
          marca:       { type: "string" },
        },
        required: ["dispositivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_orden",
      description: "Busca una orden por número, cliente o dispositivo.",
      parameters: {
        type: "object",
        properties: {
          consulta: { type: "string" },
          estado:   { type: "string", description: "Filtro opcional: intake, in_progress, waiting_parts, ready, completed, cancelled" },
        },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_estado_orden",
      description: "Cambia el estado de una orden de trabajo.",
      parameters: {
        type: "object",
        properties: {
          orden_id:     { type: "string" },
          nuevo_estado: { type: "string", enum: ["intake", "in_progress", "waiting_parts", "ready", "completed", "cancelled"] },
          nota:         { type: "string" },
        },
        required: ["orden_id", "nuevo_estado"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_nota_orden",
      description: "Agrega una nota o comentario interno a una orden.",
      parameters: {
        type: "object",
        properties: {
          orden_id: { type: "string" },
          nota:     { type: "string" },
        },
        required: ["orden_id", "nota"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "asignar_tecnico",
      description: "Asigna un técnico a una orden existente.",
      parameters: {
        type: "object",
        properties: {
          orden_id:       { type: "string" },
          nombre_tecnico: { type: "string" },
        },
        required: ["orden_id", "nombre_tecnico"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_mensaje_cliente",
      description: "Envía una notificación al cliente sobre su orden.",
      parameters: {
        type: "object",
        properties: {
          orden_id:              { type: "string" },
          tipo_mensaje:          { type: "string", enum: ["listo_para_recoger", "en_reparacion", "esperando_piezas", "personalizado"] },
          mensaje_personalizado: { type: "string" },
        },
        required: ["orden_id", "tipo_mensaje"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_cobro",
      description: "Registra el pago de una reparación y la marca como completada.",
      parameters: {
        type: "object",
        properties: {
          orden_id:    { type: "string" },
          monto:       { type: "number" },
          metodo_pago: { type: "string", enum: ["efectivo", "tarjeta", "transferencia", "ath_movil"] },
        },
        required: ["orden_id", "monto", "metodo_pago"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_cliente",
      description: "Crea un nuevo cliente en la base de datos.",
      parameters: {
        type: "object",
        properties: {
          nombre:   { type: "string" },
          telefono: { type: "string" },
          email:    { type: "string" },
        },
        required: ["nombre", "telefono"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "historial_cliente",
      description: "Muestra el historial de reparaciones de un cliente.",
      parameters: {
        type: "object",
        properties: {
          nombre_cliente: { type: "string" },
          cliente_id:     { type: "string" },
        },
        required: ["nombre_cliente"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_stock_bajo",
      description: "Muestra productos con stock bajo o agotado.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_caja_del_dia",
      description: "Muestra ingresos, gastos y balance de caja del día.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_gasto",
      description: "Registra un gasto de caja rápido (materiales, herramientas, limpieza, etc.).",
      parameters: {
        type: "object",
        properties: {
          descripcion: { type: "string", description: "Qué se compró o en qué se gastó" },
          monto:       { type: "number", description: "Monto en dólares" },
          categoria:   { type: "string", description: "Categoría: materiales, herramientas, servicios, limpieza, otro" },
        },
        required: ["descripcion", "monto"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_ordenes_listas",
      description: "Muestra todas las órdenes listas para recoger que aún no han sido entregadas.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_ordenes_urgentes",
      description: "Muestra órdenes urgentes, con prioridad alta o que llevan más de 3 días sin movimiento.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "ajustar_stock",
      description: "Suma o resta unidades de un producto en inventario (ej: llegaron piezas, se usó una pieza).",
      parameters: {
        type: "object",
        properties: {
          producto:  { type: "string", description: "Nombre del producto o pieza" },
          cantidad:  { type: "number", description: "Cantidad a sumar (positivo) o restar (negativo)" },
          motivo:    { type: "string", description: "Motivo: recepción de piezas, uso en reparación, ajuste, etc." },
        },
        required: ["producto", "cantidad"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_producto_inventario",
      description: "Agrega un producto o pieza nuevo al inventario del taller.",
      parameters: {
        type: "object",
        properties: {
          nombre:       { type: "string",  description: "Nombre del producto" },
          precio_venta: { type: "number",  description: "Precio de venta al público" },
          costo:        { type: "number",  description: "Costo de compra" },
          stock:        { type: "number",  description: "Cantidad inicial en stock" },
          categoria:    { type: "string",  description: "Categoría: pantalla, batería, cámara, cargador, accesorio, etc." },
          compatibilidad: { type: "string", description: "Modelos compatibles (ej: iPhone 14, 14 Plus)" },
        },
        required: ["nombre", "precio_venta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_precio_producto",
      description: "Actualiza el precio de venta o costo de un producto en inventario.",
      parameters: {
        type: "object",
        properties: {
          producto:     { type: "string", description: "Nombre del producto" },
          nuevo_precio: { type: "number", description: "Nuevo precio de venta" },
          nuevo_costo:  { type: "number", description: "Nuevo costo (opcional)" },
        },
        required: ["producto", "nuevo_precio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumen_negocio",
      description: "Muestra un resumen inteligente del negocio: ingresos de la semana, órdenes por estado, técnico más productivo.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "carga_tecnicos",
      description: "Muestra cuántas órdenes activas tiene asignada cada técnico.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_recibo",
      description: "Genera y envía por WhatsApp el recibo de una orden: recibo de entrada (cuando se recibe el equipo) o recibo de pago (cuando ya fue cobrado). Úsalo cuando el cliente pida su recibo.",
      parameters: {
        type: "object",
        properties: {
          orden_id:     { type: "string", description: "ID de la orden" },
          tipo_recibo:  { type: "string", enum: ["entrada", "pago", "auto"], description: "'entrada' = recibo de recepción, 'pago' = recibo de pago cobrado, 'auto' = detectar según estado" },
        },
        required: ["orden_id"],
      },
    },
  },
];

const STATUS_MAP = {
  buscar_cliente:          "Buscando cliente…",
  obtener_tecnicos:        "Cargando técnicos…",
  crear_orden_completa:    "Creando orden…",
  buscar_precio_inventario:"Consultando inventario…",
  calcular_total_reparacion:"Calculando…",
  sugerir_accesorios:      "Preparando sugerencias…",
  buscar_orden:            "Buscando orden…",
  actualizar_estado_orden: "Actualizando estado…",
  agregar_nota_orden:      "Guardando nota…",
  asignar_tecnico:         "Asignando técnico…",
  enviar_mensaje_cliente:  "Enviando mensaje…",
  registrar_cobro:         "Registrando cobro…",
  crear_cliente:           "Creando cliente…",
  historial_cliente:       "Cargando historial…",
  ver_stock_bajo:              "Revisando inventario…",
  ver_caja_del_dia:            "Consultando caja…",
  registrar_gasto:             "Registrando gasto…",
  ver_ordenes_listas:          "Buscando órdenes listas…",
  ver_ordenes_urgentes:        "Buscando órdenes urgentes…",
  ajustar_stock:               "Ajustando stock…",
  agregar_producto_inventario: "Agregando producto…",
  actualizar_precio_producto:  "Actualizando precio…",
  resumen_negocio:             "Analizando el negocio…",
  carga_tecnicos:              "Consultando técnicos…",
  enviar_recibo:               "Generando recibo…",
};

function readSession() {
  try {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const ACTIVE_ENGINE =
  import.meta.env.VITE_ANTHROPIC_API_KEY ? "Claude Haiku" :
  import.meta.env.VITE_OPENAI_API_KEY    ? "GPT-4o mini"  :
  "Llama 3.1";

const JENAI_TOURED_KEY    = "smartfix_najeliz_toured";
const JENAI_SHOWN_KEY     = "smartfix_najeliz_shown"; // se activa al primer auto-open (una sola vez)

export default function ARIAChat() {
  const location  = useLocation();
  const [open, setOpen]           = useState(false);
  // true = el usuario ya completó el tour → botón se esconde
  const [toured, setToured] = useState(() => localStorage.getItem(JENAI_TOURED_KEY) === "1");
  // true = el tour ya se auto-abrió una vez → no volver a abrir automáticamente
  const [tourAutoShown, setTourAutoShown] = useState(() => localStorage.getItem(JENAI_SHOWN_KEY) === "1");
  // respeta el toggle de Settings
  const [enabled, setEnabled] = useState(() => localStorage.getItem("smartfix_jenai_disabled") !== "true");
  // ocultar cuando hay orden abierta (JENAI ya esta integrado dentro)
  const [workOrderOpen, setWorkOrderOpen] = useState(() => !!window.__sfos_workOrderOpen);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [status, setStatus]       = useState("");
  const [inventory, setInventory] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [todayIncome, setTodayIncome]   = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [activeOrders, setActiveOrders]   = useState({ total: 0, urgent: 0, ready: 0 });
  const [isListening, setIsListening] = useState(false);
  const [tab, setTab]               = useState("chat"); // "chat" | "calc" | "tour"
  const [proactiveCount, setProactiveCount] = useState(0); // badge en el botón
  const proactiveCheckedRef = useRef(false); // solo chequear una vez por sesión
  const [calcParts, setCalcParts]   = useState("");
  const [calcLabor, setCalcLabor]   = useState("");
  const [calcTax, setCalcTax]       = useState(true);
  // ── Tour state ──────────────────────────────────────────────────────────────
  const navigate = useNavigate();
  const [tourStep, setTourStep]       = useState(0);
  const [tourTips, setTourTips]       = useState({});
  const [tourTipLoading, setTourTipLoading] = useState(false);
  const tourLoadedTips = useRef(new Set());
  const TOUR_STEPS = [
    { id: "welcome",   emoji: "🧩", color: "from-blue-500 via-violet-500 to-rose-500",
      title: "¡Hola! Soy JENAI 👋",  subtitle: "Tour guiado · 7 pasos · ~2 min",
      content: "Te voy a mostrar las funciones principales de SmartFixOS. Puedes volver aquí cuando quieras.",
      page: null, aiTopic: null },
    { id: "dashboard", emoji: "📊", color: "from-cyan-500 to-blue-600",
      title: "Dashboard", subtitle: "El centro de mando",
      content: "Ve todo de un vistazo: órdenes activas, caja del día, alertas y KPIs del taller.",
      page: "/Dashboard", aiTopic: "dashboard de un taller de reparación: órdenes activas, caja, alertas y KPIs" },
    { id: "orders",    emoji: "🛠️", color: "from-emerald-500 to-green-600",
      title: "Órdenes de Trabajo", subtitle: "El corazón del taller",
      content: "Crea órdenes en segundos con el wizard: cliente, dispositivo, problema, técnico y evidencia.",
      page: "/Dashboard", aiTopic: "órdenes de trabajo de reparación: wizard de pasos, estatus, técnicos asignados" },
    { id: "pos",       emoji: "🛒", color: "from-amber-500 to-orange-600",
      title: "POS — Punto de Venta", subtitle: "Caja y ventas",
      content: "Abre la caja, agrega productos al carrito y cobra. Acepta efectivo, tarjeta o ambos.",
      page: "/POS", aiTopic: "punto de venta para taller: abrir caja, agregar productos, cobrar, recibos" },
    { id: "customers", emoji: "👥", color: "from-pink-500 to-rose-600",
      title: "Clientes", subtitle: "Tu base de datos",
      content: "Historial completo de reparaciones, balances pendientes y portal de seguimiento para el cliente.",
      page: "/Customers", aiTopic: "gestión de clientes en taller: historial de reparaciones, portal, balance pendiente" },
    { id: "inventory", emoji: "📦", color: "from-teal-500 to-cyan-600",
      title: "Inventario", subtitle: "Piezas y productos",
      content: "Controla tu stock, recibe alertas de stock bajo y gestiona órdenes de compra.",
      page: "/Inventory", aiTopic: "inventario de taller: piezas, accesorios, alertas de stock bajo, órdenes de compra" },
    { id: "financial", emoji: "📈", color: "from-indigo-500 to-blue-600",
      title: "Finanzas", subtitle: "Reportes y flujo de caja",
      content: "Ingresos, gastos y neto del día o del mes. Reportes por período y análisis de rentabilidad.",
      page: "/Financial", aiTopic: "finanzas de taller: ingresos, gastos, neto, reportes por período, flujo de caja" },
    { id: "done",      emoji: "🎉", color: "from-green-500 to-emerald-600",
      title: "¡Ya eres un experto!", subtitle: "Tour completado",
      content: "Eso es todo lo básico. Recuerda que puedes volver a este tour aquí dentro de JENAI cuando quieras.",
      page: null, aiTopic: null },
  ];
  const recognitionRef = useRef(null);
  const dictRef        = useRef("");
  const endRef         = useRef(null);

  const calcTotals = useMemo(() => {
    const parts    = toNum(calcParts);
    const labor    = toNum(calcLabor);
    const subtotal = parts + labor;
    const tax      = calcTax ? subtotal * IVU_RATE : 0;
    return { parts, labor, subtotal, tax, total: subtotal + tax };
  }, [calcParts, calcLabor, calcTax]);

  // ── Tour: navegar a la página del paso ───────────────────────────────────
  useEffect(() => {
    if (tab !== "tour") return;
    const step = TOUR_STEPS[tourStep];
    if (step?.page && location.pathname !== step.page) {
      navigate(step.page);
    }
  }, [tourStep, tab]);

  // ── Tour: cargar tip IA para el paso actual ───────────────────────────────
  useEffect(() => {
    if (tab !== "tour") return;
    const step = TOUR_STEPS[tourStep];
    if (!step?.aiTopic || tourLoadedTips.current.has(tourStep)) return;
    const load = async () => {
      setTourTipLoading(true);
      try {
        const prompt = `Eres JENAI, asistente de SmartFixOS (taller de reparación). Da UN tip práctico y corto (máx 2 oraciones, máx 30 palabras) sobre: ${step.aiTopic}. Directo, sin saludos. En español.`;
        const tip = await callJENAI(prompt, { maxTokens: 80, temperature: 0.6 });
        setTourTips(prev => ({ ...prev, [tourStep]: tip }));
        tourLoadedTips.current.add(tourStep);
      } catch { /* si falla la IA, sin tip extra */ }
      finally { setTourTipLoading(false); }
    };
    load();
  }, [tourStep, tab]);

  // ── Tour: reset al abrir el tab ───────────────────────────────────────────
  useEffect(() => {
    if (tab === "tour") {
      setTourStep(0);
      setTourTips({});
      tourLoadedTips.current.clear();
    }
  }, [tab]);

  const isHidden = HIDDEN_PATHS.includes(location.pathname);

  // ── Primera visita: abrir JENAI en el tab del tour — solo UNA vez en toda la vida ──
  useEffect(() => {
    if (isHidden) return;
    if (toured) return;        // ya completó el tour
    if (tourAutoShown) return; // ya se mostró automáticamente alguna vez
    const timer = setTimeout(() => {
      localStorage.setItem(JENAI_SHOWN_KEY, "1");
      setTourAutoShown(true);
      setOpen(true);
      setTab("tour");
    }, 1200);
    return () => clearTimeout(timer);
  }, [isHidden, tourAutoShown]);

  // Cargar contexto cuando se abre el chat
  useEffect(() => {
    if (!open || isHidden) return;
    const load = async () => {
      try {
        const [prods, emps] = await Promise.all([
          inventory.length === 0
            ? dataClient.entities.Product.list("-created_date", 300)
            : Promise.resolve(inventory),
          technicians.length === 0
            ? dataClient.entities.AppEmployee.list("full_name", 50)
            : Promise.resolve(technicians),
        ]);
        if (inventory.length === 0) setInventory(prods || []);
        if (technicians.length === 0) setTechnicians(emps || []);

        const today = new Date().toISOString().slice(0, 10);
        const [orders, txs] = await Promise.all([
          dataClient.entities.Order.list("-updated_date", 100),
          dataClient.entities.Transaction.list("-created_date", 150),
        ]);
        const CLOSED = ["completed", "cancelled", "delivered", "picked_up"];
        const active = (orders || []).filter(o => !CLOSED.includes(o.status));
        setActiveOrders({
          total:  active.length,
          urgent: active.filter(o => o.status === "waiting_parts" || o.priority === "high").length,
          ready:  active.filter(o => o.status === "ready").length,
        });
        const inc = (txs || []).filter(t => t.created_date?.slice(0, 10) === today && t.type === "income")
                               .reduce((s, t) => s + (t.amount || 0), 0);
        const exp = (txs || []).filter(t => t.created_date?.slice(0, 10) === today && t.type === "expense")
                               .reduce((s, t) => s + (t.amount || 0), 0);
        setTodayIncome(inc);
        setTodayExpenses(exp);
      } catch (e) { console.error("JENAI ctx:", e); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [messages, open]);

  // ── Chequeo proactivo (1x por sesión, 30s después de montar) ─────────────
  useEffect(() => {
    if (isHidden) return;
    const timer = setTimeout(async () => {
      if (proactiveCheckedRef.current) return;
      proactiveCheckedRef.current = true;
      try {
        const orders = await dataClient.entities.Order.list("-updated_date", 150);
        const CLOSED = ["completed", "cancelled", "delivered", "picked_up"];
        const now    = Date.now();
        const activas = (orders || []).filter(o => !CLOSED.includes(o.status));
        const listas  = activas.filter(o => o.status === "ready");
        const stale   = activas.filter(o => {
          const dias = o.updated_date
            ? (now - new Date(o.updated_date).getTime()) / 86400000
            : 0;
          return dias >= 3 && o.status !== "ready";
        });
        const count = listas.length + stale.length;
        if (count > 0) setProactiveCount(count);
      } catch { /* silencioso */ }
    }, 30000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHidden]);

  // Resumen proactivo al abrir JENAI (si hay alertas y chat vacío)
  useEffect(() => {
    if (!open || messages.length > 0 || proactiveCount === 0) return;
    const runProactive = async () => {
      try {
        const orders  = await dataClient.entities.Order.list("-updated_date", 150);
        const CLOSED  = ["completed", "cancelled", "delivered", "picked_up"];
        const now     = Date.now();
        const activas = (orders || []).filter(o => !CLOSED.includes(o.status));
        const listas  = activas.filter(o => o.status === "ready");
        const stale   = activas.filter(o => {
          const dias = o.updated_date
            ? (now - new Date(o.updated_date).getTime()) / 86400000 : 0;
          return dias >= 3 && o.status !== "ready";
        });
        const prods = inventory.length > 0
          ? inventory
          : await dataClient.entities.Product.list("-created_date", 200);
        const sinStock = prods.filter(i => i.stock != null && i.min_stock != null && i.stock <= i.min_stock);

        const partes = [];
        if (listas.length > 0) partes.push(`📦 **${listas.length} orden${listas.length > 1 ? "es" : ""} lista${listas.length > 1 ? "s" : ""} para recoger** — ${listas.slice(0,3).map(o => o.customer_name).join(", ")}${listas.length > 3 ? "…" : ""}`);
        if (stale.length > 0) partes.push(`⏰ **${stale.length} orden${stale.length > 1 ? "es" : ""} sin movimiento** hace más de 3 días — ${stale.slice(0,2).map(o => `${o.customer_name} (${o.device_brand} ${o.device_model})`).join(", ")}${stale.length > 2 ? "…" : ""}`);
        if (sinStock.length > 0) partes.push(`⚠️ **${sinStock.length} producto${sinStock.length > 1 ? "s" : ""} con stock bajo** — ${sinStock.slice(0,2).map(i => i.name).join(", ")}${sinStock.length > 2 ? "…" : ""}`);

        if (partes.length > 0) {
          const msg = `Buenos días. Aquí está tu resumen:\n\n${partes.join("\n")}\n\n¿Quieres que tome acción en alguno de estos puntos?`;
          setMessages([{ role: "assistant", content: msg }]);
          setProactiveCount(0);
        }
      } catch { /* silencioso */ }
    };
    runProactive();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escuchar cambios del toggle desde Settings
  React.useEffect(() => {
    const handler = (e) => setEnabled(e.detail?.enabled !== false);
    window.addEventListener("smartfix:jenai-toggle", handler);
    return () => window.removeEventListener("smartfix:jenai-toggle", handler);
  }, []);

  // Ocultar cuando hay orden de trabajo abierta (JENAI ya esta integrado dentro)
  const [forceOpen, setForceOpen] = React.useState(false);
  React.useEffect(() => {
    const handler = (e) => setWorkOrderOpen(e.detail?.open === true);
    window.addEventListener("smartfix:workorder-open", handler);
    return () => window.removeEventListener("smartfix:workorder-open", handler);
  }, []);

  // Force-open JEANI from work order sidebar (with order context)
  const [orderContext, setOrderContext] = React.useState(null);
  React.useEffect(() => {
    const forceHandler = (e) => {
      console.log("[JEANI] Force-open from sidebar");
      const orderData = e.detail?.order || null;
      if (orderData) setOrderContext(orderData);
      setForceOpen(true);
      setOpen(true);
    };
    window.addEventListener("wo:open-jeani", forceHandler);
    document.addEventListener("wo:open-jeani", forceHandler);
    return () => {
      window.removeEventListener("wo:open-jeani", forceHandler);
      document.removeEventListener("wo:open-jeani", forceHandler);
    };
  }, []);

  // Reset force-open when chat is closed
  React.useEffect(() => {
    if (!open) {
      setForceOpen(false);
      setOrderContext(null);
    }
  }, [open]);

  // Auto-greet with order context when opened from sidebar
  React.useEffect(() => {
    if (!forceOpen || !orderContext || !open) return;
    const oc = orderContext;
    const greeting = `Estoy viendo la orden **#${oc.order_number || ""}** de **${oc.customer_name || "cliente"}** — ${oc.device_brand || ""} ${oc.device_model || ""}.\n\nProblema: *${oc.initial_problem || "no especificado"}*\n\n¿En qué te ayudo? Puedo sugerir diagnósticos, recomendar piezas, estimar costos, o analizar fotos.`;
    setMessages([{ role: "assistant", content: greeting }]);
    setTab("chat");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen, open]);

  if (forceOpen) { /* bypass all checks — sidebar requested JEANI */ }
  else if (isHidden || !enabled || workOrderOpen) return null;

  // ── Construye el prompt de sistema ───────────────────────────────────────────
  const buildSystem = () => {
    const session  = readSession();
    const bizName  = session?.storeName || "SmartFixOS";

    // Build order context if available
    let orderBlock = "";
    if (orderContext) {
      const oc = orderContext;
      const items = Array.isArray(oc.order_items) ? oc.order_items : [];
      const photos = Array.isArray(oc.photos_metadata) ? oc.photos_metadata : [];
      const history = Array.isArray(oc.status_history) ? oc.status_history : [];
      orderBlock = `

═══ ORDEN ACTUAL (estás asistiendo con esta orden) ═══
Orden: #${oc.order_number || "N/A"}
Estado: ${oc.status || "desconocido"}
Cliente: ${oc.customer_name || "N/A"} | Tel: ${oc.customer_phone || "N/A"} | Email: ${oc.customer_email || "N/A"}
Dispositivo: ${oc.device_brand || ""} ${oc.device_model || ""} (${oc.device_type || "N/A"})
Color: ${oc.device_color || "N/A"} | IMEI: ${oc.device_imei || "N/A"}
Problema reportado: ${oc.initial_problem || "No especificado"}
${items.length > 0 ? `Items (${items.length}): ${items.map(i => `${i.name || "Item"} $${Number(i.price || 0).toFixed(2)}`).join(", ")}` : "Sin items registrados"}
Total: $${Number(oc.total || oc.cost_estimate || 0).toFixed(2)} | Pagado: $${Number(oc.amount_paid || oc.total_paid || 0).toFixed(2)} | Balance: $${Number(oc.balance_due || 0).toFixed(2)}
Fotos: ${photos.length} foto(s) adjunta(s)
${oc.repair_checklist_done ? "Checklist de cierre: COMPLETO" : ""}
${oc.warranty_verdict ? `Veredicto garantía: ${oc.warranty_verdict}` : ""}
Historial: ${history.length} cambios de estado

Con esta información puedes:
- Sugerir diagnósticos basados en el problema y tipo de dispositivo
- Recomendar piezas necesarias para la reparación
- Estimar costos de reparación
- Explicar el estado actual de la orden
- Ayudar a redactar notas técnicas
- Analizar fotos si el usuario las comparte`;
    }

    return `Eres JENAI, asistente de ${bizName} (taller de reparación).
Idioma: ESPAÑOL. Respuestas cortas. UNA sola pregunta por mensaje.

Negocio: ${activeOrders.total} activas | $${todayIncome.toFixed(0)} hoy${orderBlock}

═══ CREAR ORDEN — PROTOCOLO OBLIGATORIO ═══
Cuando el usuario quiera crear una orden, DEBES recopilar estos datos EN ORDEN, UNO POR UNO.
JAMÁS llames a crear_orden_completa sin tener TODOS los campos obligatorios (*).

CAMPOS OBLIGATORIOS que debes preguntar en este orden:
1. (*) Nombre y apellido del cliente → luego llama buscar_cliente
2.     Si no existe: ¿lo creamos? → llama crear_cliente con nombre + teléfono
3.     Técnico → llama obtener_tecnicos, muestra la lista y pregunta cuál asignar
4. (*) Marca del equipo (Apple, Samsung, Motorola…)
5. (*) Modelo exacto (iPhone 15 Pro Max, Galaxy S24, etc.)
6. (*) Problema principal / síntomas
7. (*) Checklist según síntomas — pregunta lo relevante:
   - Mojado/agua: ¿corrosión?, ¿enciende?, ¿puertos dañados?
   - Pantalla: ¿rota físicamente?, ¿táctil funciona?, ¿líneas/manchas?
   - Batería/apagado: ¿se apaga solo?, ¿carga lento o no carga?, ¿batería hinchada?
   - Cámara: ¿lente roto?, ¿fotos borrosas?
   - Laptop: ¿carga?, ¿teclado dañado?, ¿pantalla parpadea?
8. (*) Seguridad: PIN / patrón / Face ID / huella / ninguna (pide el código si aplica)
9.     Indicaciones especiales del cliente
10. Muestra resumen → pide "¿confirmamos?" → llama crear_orden_completa

REGLA CRÍTICA: Si crear_orden_completa responde con error "FALTAN_DATOS",
pregunta inmediatamente al usuario por el primer campo que falta.

═══ OTRAS ACCIONES ═══
• Órdenes: buscar_orden, actualizar_estado_orden, agregar_nota_orden, asignar_tecnico, ver_ordenes_listas, ver_ordenes_urgentes
• Clientes: enviar_mensaje_cliente, historial_cliente
• Cobros: registrar_cobro, registrar_gasto
• Inventario: buscar_precio_inventario, calcular_total_reparacion, sugerir_accesorios, ajustar_stock, agregar_producto_inventario, actualizar_precio_producto, ver_stock_bajo
• Caja/Reportes: ver_caja_del_dia, resumen_negocio, carga_tecnicos`;
  };

  // ── Ejecutor de herramientas ─────────────────────────────────────────────────
  const executeToolCall = async (toolName, args) => {
    const session   = readSession();
    const createdBy = session?.full_name || session?.userName || session?.email || "JENAI";

    switch (toolName) {
      case "buscar_cliente": {
        try {
          const term = (args.consulta || "").toLowerCase();
          const all  = await dataClient.entities.Customer.list("-created_date", 200);
          const res  = (all || []).filter(c =>
            c.full_name?.toLowerCase().includes(term) ||
            c.phone?.includes(args.consulta) ||
            c.email?.toLowerCase().includes(term)
          );
          if (!res.length) return JSON.stringify({ encontrado: false, mensaje: "No existe ese cliente. Puedo crearlo." });
          return JSON.stringify({ encontrado: true, clientes: res.slice(0, 3).map(c => ({ id: c.id, nombre: c.full_name, telefono: c.phone, email: c.email })) });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "obtener_tecnicos": {
        try {
          const list = technicians.length > 0
            ? technicians
            : await dataClient.entities.AppEmployee.list("full_name", 50);
          const techs = list.filter(e =>
            ["technician", "tech"].includes((e.role || e.position || e.userRole || "").toLowerCase())
          );
          const shown = (techs.length > 0 ? techs : list).slice(0, 12).map(e => ({ id: e.id, nombre: e.full_name }));
          return JSON.stringify({ tecnicos: shown });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "crear_orden_completa": {
        // Validación de campos obligatorios — fuerza al AI a completar el wizard
        const camposFaltantes = [];
        if (!args.customer_name?.trim())   camposFaltantes.push("nombre del cliente");
        if (!args.device_brand?.trim())    camposFaltantes.push("marca del equipo");
        if (!args.device_model?.trim())    camposFaltantes.push("modelo del equipo");
        if (!args.initial_problem?.trim()) camposFaltantes.push("problema/síntomas");
        if (!args.checklist_items?.trim()) camposFaltantes.push("checklist de condición del equipo");
        if (!args.security_info?.trim())   camposFaltantes.push("seguridad del dispositivo (PIN/patrón/Face ID/huella)");

        if (camposFaltantes.length > 0) {
          return JSON.stringify({
            error: "FALTAN_DATOS",
            campos_faltantes: camposFaltantes,
            instruccion: `Pregunta al usuario por: "${camposFaltantes[0]}" antes de continuar.`,
          });
        }

        try {
          // Construye el problema completo con toda la info recopilada
          let fullProblem = args.initial_problem || "";
          if (args.checklist_items) fullProblem += `\n\n📋 CHECKLIST:\n${args.checklist_items}`;
          if (args.security_info)   fullProblem += `\n\n🔒 SEGURIDAD: ${args.security_info}`;
          if (args.customer_notes)  fullProblem += `\n\n📝 INDICACIONES CLIENTE: ${args.customer_notes}`;

          const orderData = {
            customer_name:   args.customer_name,
            customer_phone:  args.customer_phone || "",
            device_brand:    args.device_brand,
            device_model:    args.device_model,
            device_type:     args.device_type || "Phone",
            initial_problem: fullProblem,
            status:          "intake",
            order_items:     [],
            photos_metadata: [],
          };
          if (args.customer_id)            orderData.customer_id = args.customer_id;
          if (args.assigned_technician_id) orderData.assigned_to = args.assigned_technician_id;

          const created = await dataClient.entities.Order.create(orderData);
          setMessages(m => [...m, {
            role: "assistant", type: "action", action: "order_created",
            data: {
              order_number: created.order_number || `#${created.id?.slice(-6)}`,
              customer: args.customer_name,
              device:   `${args.device_brand} ${args.device_model}`,
              problem:  args.initial_problem,
            },
          }]);
          return JSON.stringify({ exito: true, orden_numero: created.order_number, id: created.id });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "buscar_precio_inventario": {
        const terms   = (args.busqueda || "").toLowerCase().split(" ").filter(t => t.length > 2);
        const matches = inventory.filter(item => {
          const n      = (item.name || "").toLowerCase();
          const compat = (item.compatibility_models || []).join(" ").toLowerCase();
          return terms.some(t => n.includes(t) || compat.includes(t));
        }).slice(0, 5);
        if (!matches.length) return JSON.stringify({ encontrado: false, mensaje: "No se encontró esa pieza en inventario." });
        return JSON.stringify({ encontrado: true, piezas: matches.map(i => ({ nombre: i.name, precio: i.price, costo: i.cost, stock: i.stock })) });
      }

      case "calcular_total_reparacion": {
        const total = (args.precio_pieza || 0) + (args.costo_mano_obra || 0);
        return JSON.stringify({ pieza: args.nombre_pieza || "Pieza", dispositivo: args.dispositivo || "", precio_pieza: args.precio_pieza, mano_obra: args.costo_mano_obra, total });
      }

      case "sugerir_accesorios":
        return JSON.stringify({
          dispositivo: args.dispositivo,
          accesorios: ["Funda/cover protectora", "Vidrio templado (pantalla)", "Protector de lente de cámara", "Cable cargador certificado", "Cargador inalámbrico (si es compatible)"],
        });

      case "buscar_orden": {
        try {
          const term = (args.consulta || "").toLowerCase();
          const all  = await dataClient.entities.Order.list("-created_date", 150);
          const res  = (all || []).filter(o => {
            if (args.estado && o.status !== args.estado) return false;
            return (
              o.customer_name?.toLowerCase().includes(term) ||
              o.device_model?.toLowerCase().includes(term) ||
              o.device_brand?.toLowerCase().includes(term) ||
              o.order_number?.toLowerCase().includes(term) ||
              o.initial_problem?.toLowerCase().includes(term)
            );
          }).slice(0, 5);
          if (!res.length) return JSON.stringify({ encontrado: false, mensaje: "No se encontró ninguna orden." });
          return JSON.stringify({ encontrado: true, ordenes: res.map(o => ({ id: o.id, numero: o.order_number, cliente: o.customer_name, dispositivo: `${o.device_brand} ${o.device_model}`, estado: o.status, problema: o.initial_problem })) });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "actualizar_estado_orden": {
        try {
          const LABELS = { intake: "Diagnóstico/Entrada", in_progress: "En Reparación", waiting_parts: "Esperando Piezas", ready: "Listo para Recoger", completed: "Completado", cancelled: "Cancelado" };
          await dataClient.entities.Order.update(args.orden_id, { status: args.nuevo_estado });
          await dataClient.entities.WorkOrderEvent.create({ order_id: args.orden_id, event_type: "status_change", description: args.nota || `Estado: ${LABELS[args.nuevo_estado]}`, created_by: createdBy });
          setMessages(m => [...m, { role: "assistant", type: "action", action: "orden_actualizada", data: { estado: LABELS[args.nuevo_estado] || args.nuevo_estado } }]);
          return JSON.stringify({ exito: true, mensaje: `Estado → "${LABELS[args.nuevo_estado] || args.nuevo_estado}"` });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "agregar_nota_orden": {
        try {
          await dataClient.entities.WorkOrderEvent.create({ order_id: args.orden_id, event_type: "note", description: args.nota, created_by: createdBy });
          return JSON.stringify({ exito: true, mensaje: "Nota agregada." });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "asignar_tecnico": {
        try {
          const term = (args.nombre_tecnico || "").toLowerCase();
          const tech = technicians.find(e => e.full_name?.toLowerCase().includes(term));
          if (!tech) return JSON.stringify({ error: `No se encontró técnico "${args.nombre_tecnico}". Lista: ${technicians.map(t => t.full_name).join(", ")}` });
          await dataClient.entities.Order.update(args.orden_id, { assigned_to: tech.id });
          return JSON.stringify({ exito: true, tecnico: tech.full_name });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "enviar_mensaje_cliente": {
        try {
          const order = await dataClient.entities.Order.get(args.orden_id);
          if (!order) return JSON.stringify({ error: "Orden no encontrada." });
          // Link al recibo/estado online del cliente
          const baseUrl  = window.location.origin;
          const recibUrl = `${baseUrl}/CustomerPortal?order_id=${order.id}`;
          const textos = {
            listo_para_recoger: `¡Hola ${order.customer_name}! 🎉 Tu ${order.device_brand} ${order.device_model} está listo para recoger.\n\nVe tu recibo aquí: ${recibUrl}\n\n¡Gracias por confiar en nosotros!`,
            en_reparacion:      `¡Hola ${order.customer_name}! 🔧 Tu equipo está en proceso de reparación. Te avisamos cuando esté listo.\n\nSeguimiento: ${recibUrl}`,
            esperando_piezas:   `¡Hola ${order.customer_name}! ⏳ Estamos esperando la pieza para tu equipo. Te mantenemos informado.\n\nSeguimiento: ${recibUrl}`,
            personalizado:      args.mensaje_personalizado ? `${args.mensaje_personalizado}\n\nVer orden: ${recibUrl}` : "",
          };
          const texto = textos[args.tipo_mensaje];
          // Generar link de WhatsApp
          const phone   = (order.customer_phone || "").replace(/\D/g, "");
          const waUrl   = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(texto)}` : null;
          await dataClient.entities.Notification.create({ title: `Mensaje a ${order.customer_name}`, message: texto, type: "sms", status: "sent", customer_id: order.customer_id });
          setMessages(m => [...m, { role: "assistant", type: "action", action: "mensaje_enviado", data: { cliente: order.customer_name, waUrl, recibUrl, texto } }]);
          return JSON.stringify({ exito: true, cliente: order.customer_name, whatsapp_url: waUrl, recibo_url: recibUrl });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "registrar_cobro": {
        try {
          const order = await dataClient.entities.Order.get(args.orden_id);
          await dataClient.entities.Transaction.create({ order_id: args.orden_id, amount: args.monto, payment_method: args.metodo_pago, type: "income", description: `Reparación: ${order?.device_brand || ""} ${order?.device_model || ""}`, customer_name: order?.customer_name });
          await dataClient.entities.Order.update(args.orden_id, { status: "completed" });
          setMessages(m => [...m, { role: "assistant", type: "action", action: "cobro_registrado", data: { monto: args.monto, metodo: args.metodo_pago, cliente: order?.customer_name } }]);
          return JSON.stringify({ exito: true, monto: args.monto });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "crear_cliente": {
        try {
          const created = await dataClient.entities.Customer.create({ full_name: args.nombre, phone: args.telefono, email: args.email || "" });
          setMessages(m => [...m, { role: "assistant", type: "action", action: "cliente_creado", data: { nombre: args.nombre, telefono: args.telefono } }]);
          return JSON.stringify({ exito: true, cliente_id: created.id });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "historial_cliente": {
        try {
          const term   = (args.nombre_cliente || "").toLowerCase();
          const all    = await dataClient.entities.Order.list("-created_date", 200);
          const orders = (all || []).filter(o => {
            if (args.cliente_id) return o.customer_id === args.cliente_id;
            return o.customer_name?.toLowerCase().includes(term);
          }).slice(0, 10);
          if (!orders.length) return JSON.stringify({ encontrado: false, mensaje: "No hay órdenes para ese cliente." });
          const total = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
          return JSON.stringify({ encontrado: true, total_reparaciones: orders.length, total_gastado: total, ordenes: orders.map(o => ({ numero: o.order_number, dispositivo: `${o.device_brand} ${o.device_model}`, estado: o.status, fecha: o.created_date?.slice(0, 10) })) });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "ver_stock_bajo": {
        const bajos = inventory.filter(i => i.stock != null && i.min_stock != null && i.stock <= i.min_stock);
        if (!bajos.length) return JSON.stringify({ mensaje: "¡Todo en orden! Sin stock crítico." });
        return JSON.stringify({ total: bajos.length, items: bajos.map(i => ({ nombre: i.name, stock: i.stock, minimo: i.min_stock })) });
      }

      case "ver_caja_del_dia":
        return JSON.stringify({ ingresos: todayIncome, gastos: todayExpenses, neto: todayIncome - todayExpenses });

      case "registrar_gasto": {
        try {
          await dataClient.entities.Transaction.create({
            amount:       args.monto,
            type:         "expense",
            description:  args.descripcion,
            category:     args.categoria || "otro",
            payment_method: "efectivo",
            created_by:   createdBy,
          });
          setMessages(m => [...m, { role: "assistant", type: "action", action: "gasto_registrado", data: { monto: args.monto, descripcion: args.descripcion } }]);
          return JSON.stringify({ exito: true, mensaje: `Gasto de $${args.monto} registrado: ${args.descripcion}` });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "ver_ordenes_listas": {
        try {
          const all   = await dataClient.entities.Order.list("-updated_date", 100);
          const listas = (all || []).filter(o => o.status === "ready");
          if (!listas.length) return JSON.stringify({ mensaje: "No hay órdenes listas para recoger." });
          return JSON.stringify({
            total: listas.length,
            ordenes: listas.map(o => ({
              numero:  o.order_number,
              cliente: o.customer_name,
              equipo:  `${o.device_brand} ${o.device_model}`,
              desde:   o.updated_date?.slice(0, 10),
              telefono: o.customer_phone,
            })),
          });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "ver_ordenes_urgentes": {
        try {
          const all    = await dataClient.entities.Order.list("-updated_date", 150);
          const CLOSED = ["completed", "cancelled", "delivered", "picked_up"];
          const now    = Date.now();
          const urgentes = (all || []).filter(o => {
            if (CLOSED.includes(o.status)) return false;
            const diasSinMov = o.updated_date
              ? (now - new Date(o.updated_date).getTime()) / 86400000
              : 99;
            return o.priority === "high" || o.status === "waiting_parts" || diasSinMov > 3;
          }).slice(0, 10);
          if (!urgentes.length) return JSON.stringify({ mensaje: "¡Sin órdenes urgentes! Todo bajo control." });
          return JSON.stringify({
            total: urgentes.length,
            ordenes: urgentes.map(o => {
              const dias = o.updated_date
                ? Math.floor((now - new Date(o.updated_date).getTime()) / 86400000)
                : "?";
              return { numero: o.order_number, cliente: o.customer_name, equipo: `${o.device_brand} ${o.device_model}`, estado: o.status, dias_sin_movimiento: dias, prioridad: o.priority };
            }),
          });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "ajustar_stock": {
        try {
          const term = (args.producto || "").toLowerCase().split(" ").filter(t => t.length > 2);
          const prod = inventory.find(i => term.some(t => (i.name || "").toLowerCase().includes(t)));
          if (!prod) return JSON.stringify({ error: `No se encontró "${args.producto}" en inventario.` });
          const nuevoStock = Math.max(0, (prod.stock || 0) + args.cantidad);
          await dataClient.entities.Product.update(prod.id, { stock: nuevoStock });
          setInventory(inv => inv.map(i => i.id === prod.id ? { ...i, stock: nuevoStock } : i));
          return JSON.stringify({ exito: true, producto: prod.name, stock_anterior: prod.stock, stock_nuevo: nuevoStock, cambio: args.cantidad > 0 ? `+${args.cantidad}` : args.cantidad });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "agregar_producto_inventario": {
        try {
          const created = await dataClient.entities.Product.create({
            name:                  args.nombre,
            price:                 args.precio_venta,
            cost:                  args.costo || 0,
            stock:                 args.stock || 0,
            category:              args.categoria || "repuesto",
            compatibility_models:  args.compatibilidad ? [args.compatibilidad] : [],
            is_active:             true,
          });
          setInventory(inv => [...inv, created]);
          setMessages(m => [...m, { role: "assistant", type: "action", action: "producto_creado", data: { nombre: args.nombre, precio: args.precio_venta } }]);
          return JSON.stringify({ exito: true, id: created.id, mensaje: `"${args.nombre}" agregado al inventario a $${args.precio_venta}` });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "actualizar_precio_producto": {
        try {
          const term = (args.producto || "").toLowerCase().split(" ").filter(t => t.length > 2);
          const prod = inventory.find(i => term.some(t => (i.name || "").toLowerCase().includes(t)));
          if (!prod) return JSON.stringify({ error: `No se encontró "${args.producto}" en inventario.` });
          const updates = { price: args.nuevo_precio };
          if (args.nuevo_costo != null) updates.cost = args.nuevo_costo;
          await dataClient.entities.Product.update(prod.id, updates);
          setInventory(inv => inv.map(i => i.id === prod.id ? { ...i, ...updates } : i));
          return JSON.stringify({ exito: true, producto: prod.name, precio_anterior: prod.price, precio_nuevo: args.nuevo_precio });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "resumen_negocio": {
        try {
          const [orders, txs] = await Promise.all([
            dataClient.entities.Order.list("-created_date", 300),
            dataClient.entities.Transaction.list("-created_date", 300),
          ]);
          const CLOSED = ["completed", "cancelled", "delivered"];
          const now    = new Date();
          const semana = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
          const mes    = now.toISOString().slice(0, 7);

          const ingSemana = (txs || [])
            .filter(t => t.type === "income" && t.created_date?.slice(0, 10) >= semana)
            .reduce((s, t) => s + (t.amount || 0), 0);
          const ingMes = (txs || [])
            .filter(t => t.type === "income" && t.created_date?.slice(0, 7) === mes)
            .reduce((s, t) => s + (t.amount || 0), 0);
          const gastMes = (txs || [])
            .filter(t => t.type === "expense" && t.created_date?.slice(0, 7) === mes)
            .reduce((s, t) => s + (t.amount || 0), 0);

          const activas   = (orders || []).filter(o => !CLOSED.includes(o.status));
          const porEstado = {};
          activas.forEach(o => { porEstado[o.status] = (porEstado[o.status] || 0) + 1; });

          // técnico más productivo del mes
          const completadasMes = (orders || []).filter(o => o.status === "completed" && o.updated_date?.slice(0, 7) === mes);
          const porTecnico = {};
          completadasMes.forEach(o => { if (o.assigned_to) porTecnico[o.assigned_to] = (porTecnico[o.assigned_to] || 0) + 1; });
          const topTechId = Object.entries(porTecnico).sort((a,b)=>b[1]-a[1])[0];
          const topTech   = topTechId ? technicians.find(t => t.id === topTechId[0]) : null;

          return JSON.stringify({
            ingresos_semana: ingSemana,
            ingresos_mes:    ingMes,
            gastos_mes:      gastMes,
            neto_mes:        ingMes - gastMes,
            ordenes_activas: activas.length,
            por_estado:      porEstado,
            tecnico_top:     topTech ? { nombre: topTech.full_name, ordenes: topTechId[1] } : null,
          });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "carga_tecnicos": {
        try {
          const all    = await dataClient.entities.Order.list("-updated_date", 200);
          const CLOSED = ["completed", "cancelled", "delivered", "picked_up"];
          const activas = (all || []).filter(o => !CLOSED.includes(o.status) && o.assigned_to);
          const conteo  = {};
          activas.forEach(o => { conteo[o.assigned_to] = (conteo[o.assigned_to] || 0) + 1; });
          const resultado = Object.entries(conteo).map(([id, total]) => {
            const tech = technicians.find(t => t.id === id);
            return { tecnico: tech?.full_name || id, ordenes_activas: total };
          }).sort((a, b) => b.ordenes_activas - a.ordenes_activas);
          const sinAsignar = (all || []).filter(o => !CLOSED.includes(o.status) && !o.assigned_to).length;
          return JSON.stringify({ tecnicos: resultado, sin_asignar: sinAsignar });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      case "enviar_recibo": {
        try {
          const order = await dataClient.entities.Order.get(args.orden_id);
          if (!order) return JSON.stringify({ error: "Orden no encontrada." });

          const baseUrl    = window.location.origin;
          const reciboUrl  = `${baseUrl}/Receipt?order_id=${order.id}`;
          const PAID       = ["completed", "delivered", "picked_up"];
          const tipoAuto   = PAID.includes(order.status) ? "pago" : "entrada";
          const tipo       = args.tipo_recibo === "auto" || !args.tipo_recibo ? tipoAuto : args.tipo_recibo;
          const tipoLabel  = tipo === "pago" ? "recibo de pago" : "recibo de recepción";

          const texto = tipo === "pago"
            ? `¡Hola ${order.customer_name}! 🧾 Aquí está tu ${tipoLabel} de ${order.device_brand} ${order.device_model}:\n\n${reciboUrl}\n\n¡Gracias por confiar en nosotros! 🙌`
            : `¡Hola ${order.customer_name}! 📋 Aquí está tu ${tipoLabel} de ${order.device_brand} ${order.device_model}. Confirma que recibimos tu equipo:\n\n${reciboUrl}\n\nTe avisamos cuando esté listo. ✅`;

          const phone  = (order.customer_phone || "").replace(/\D/g, "");
          const waUrl  = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(texto)}` : null;

          setMessages(m => [...m, {
            role: "assistant", type: "action", action: "recibo_enviado",
            data: { cliente: order.customer_name, tipo, reciboUrl, waUrl },
          }]);
          return JSON.stringify({ exito: true, tipo, recibo_url: reciboUrl, whatsapp_url: waUrl });
        } catch (e) { return JSON.stringify({ error: e.message }); }
      }

      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${toolName}` });
    }
  };

  // ── Dictado por voz ──────────────────────────────────────────────────────────
  const startDictation = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMessages(m => [...m, { role: "assistant", content: "⚠️ Tu navegador no soporta dictado. Usa Chrome o Safari." }]);
      return;
    }
    dictRef.current = "";
    const r = new SR();
    recognitionRef.current = r;
    r.lang = "es";
    r.continuous = false;
    r.interimResults = true;
    r.onstart  = () => setIsListening(true);
    r.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join("");
      dictRef.current = t;
      setInput(t);
    };
    r.onerror  = () => setIsListening(false);
    r.onend    = () => {
      setIsListening(false);
      const t = dictRef.current.trim();
      if (t) { dictRef.current = ""; setInput(""); sendMessage(t); }
    };
    r.start();
  };

  // ── Enviar mensaje con loop agéntico ────────────────────────────────────────
  const sendMessage = async (text) => {
    if (!text?.trim() || loading) return;
    const userMsg = { role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setStatus("");

    try {
      const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const OPENAI_KEY    = import.meta.env.VITE_OPENAI_API_KEY;
      const GROQ_KEY      = import.meta.env.VITE_GROQ_API_KEY;
      if (!ANTHROPIC_KEY && !OPENAI_KEY && !GROQ_KEY)
        throw new Error("No hay API key configurada. Agrega VITE_OPENAI_API_KEY en Vercel.");

      const systemPrompt = buildSystem();
      const cleanHistory = history
        .filter(m => m.role === "user" || (m.role === "assistant" && !m.type))
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      // ── Loop genérico para APIs compatibles con OpenAI (OpenAI + Groq) ────
      const runOpenAICompat = async ({ url, key, model, maxTokens = 500 }) => {
        let conv = cleanHistory;
        let iter = 6;
        while (iter-- > 0) {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
            body: JSON.stringify({
              model,
              messages: [{ role: "system", content: systemPrompt }, ...conv],
              tools: ARIA_TOOLS,
              tool_choice: "auto",
              temperature: 0.3,
              max_tokens: maxTokens,
            }),
          });
          const data = await res.json();
          if (data?.error) {
            const errMsg = data.error.message || "";
            const errLow = errMsg.toLowerCase();
            if (data.error.type === "tokens" || errLow.includes("rate_limit") || errLow.includes("rate limit")) {
              const wait = parseInt(errMsg.match(/(\d+(?:\.\d+)?)s/)?.[1] || "20") * 1000;
              setStatus(`Límite de velocidad — reintentando en ${Math.ceil(wait / 1000)}s…`);
              await new Promise(r => setTimeout(r, Math.min(wait, 25000)));
              setStatus("");
              continue;
            }
            // Billing/quota errors — throw so caller can fallback to next engine
            throw new Error(errMsg || "Error de IA");
          }
          const choice = data?.choices?.[0];
          const aMsg   = choice?.message;
          if (choice?.finish_reason === "tool_calls" && aMsg?.tool_calls?.length) {
            const results = [];
            for (const tc of aMsg.tool_calls) {
              let tArgs = {};
              try { tArgs = JSON.parse(tc.function.arguments); } catch (_) {}
              setStatus(STATUS_MAP[tc.function.name] || "Procesando…");
              const result = await executeToolCall(tc.function.name, tArgs);
              results.push({ role: "tool", tool_call_id: tc.id, content: result });
            }
            conv = [...conv, aMsg, ...results];
            setStatus("");
          } else {
            if (aMsg?.content) setMessages(m => [...m, { role: "assistant", content: aMsg.content }]);
            break;
          }
        }
      };

      const runOpenAI = () => runOpenAICompat({
        url: "https://api.openai.com/v1/chat/completions",
        key: OPENAI_KEY,
        model: "gpt-4o-mini",
        maxTokens: 500,
      });

      const runGroq = () => {
        if (!GROQ_KEY) throw new Error("No hay API key de IA disponible.");
        return runOpenAICompat({
          url: "https://api.groq.com/openai/v1/chat/completions",
          key: GROQ_KEY,
          model: "llama-3.1-8b-instant",
          maxTokens: 300,
        });
      };

      // ── Claude (Anthropic) con fallback a OpenAI → Groq ───────────────────
      if (ANTHROPIC_KEY) {
        const claudeTools = ARIA_TOOLS.map(t => ({
          name:         t.function.name,
          description:  t.function.description,
          input_schema: t.function.parameters,
        }));
        let claudeMsgs = cleanHistory;
        let claudeOk   = true;
        try {
          let iter = 6;
          while (iter-- > 0) {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
              },
              body: JSON.stringify({
                model: "claude-3-5-haiku-20241022",
                max_tokens: 1024,
                system: systemPrompt,
                messages: claudeMsgs,
                tools: claudeTools,
                tool_choice: { type: "auto" },
              }),
            });
            const data = await res.json();
            if (data?.error) {
              const msg = data.error.message || "";
              if (msg.includes("credit") || msg.includes("billing") || data.error.type === "authentication_error") {
                claudeOk = false; break;
              }
              throw new Error(msg || "Error de Claude");
            }
            if (data.stop_reason === "tool_use") {
              const toolUses = data.content.filter(b => b.type === "tool_use");
              const toolResults = [];
              for (const tu of toolUses) {
                setStatus(STATUS_MAP[tu.name] || "Procesando…");
                const result = await executeToolCall(tu.name, tu.input || {});
                toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
              }
              claudeMsgs = [
                ...claudeMsgs,
                { role: "assistant", content: data.content },
                { role: "user",      content: toolResults },
              ];
              setStatus("");
            } else {
              const textBlock = data.content?.find(b => b.type === "text");
              if (textBlock?.text) setMessages(m => [...m, { role: "assistant", content: textBlock.text }]);
              break;
            }
          }
        } catch (_) { claudeOk = false; }
        if (!claudeOk) {
          if (OPENAI_KEY) await runOpenAI(); else await runGroq();
        }
      } else if (OPENAI_KEY) {
        let openaiOk = true;
        try { await runOpenAI(); }
        catch (e) {
          console.warn("[JEANI] OpenAI failed, falling back to Groq:", e.message);
          openaiOk = false;
        }
        if (!openaiOk && GROQ_KEY) await runGroq();
        else if (!openaiOk) throw new Error("No hay API de IA disponible");
      } else {
        await runGroq();
      }

    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: "⚠️ " + err.message }]);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-[104px] md:bottom-6 right-5 z-[9999] flex flex-col items-end gap-3 pointer-events-none">

      {/* Panel de chat */}
      {open && (
        <div
          className="w-[calc(100vw-2.5rem)] sm:w-[380px] bg-[#0e0e0e]/98 backdrop-blur-3xl border border-blue-500/20 rounded-[28px] shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
          style={{ height: "min(480px, calc(100dvh - 220px))", boxShadow: "0 24px 80px rgba(59,130,246,0.20), 0 0 60px rgba(239,68,68,0.08), 0 0 80px rgba(234,179,8,0.06)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 overflow-hidden"
                style={{ background: "conic-gradient(from 135deg, #ef4444 0deg, #ef4444 90deg, #f59e0b 90deg, #f59e0b 180deg, #22c55e 180deg, #22c55e 270deg, #3b82f6 270deg, #3b82f6 360deg)" }}>
                <span className="text-sm">🧩</span>
              </div>
              <div>
                <p className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 leading-none">JENAI</p>
                <p className="text-[9px] text-blue-400/60 font-bold uppercase tracking-widest leading-none mt-0.5">
                  SmartFixOS · {ACTIVE_ENGINE}
                </p>
              </div>
            </div>
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1 mx-2">
              <button
                onClick={() => setTab("chat")}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${tab === "chat" ? "bg-blue-600 text-white shadow" : "text-white/30 hover:text-white/60"}`}
              >💬</button>
              <button
                onClick={() => setTab("calc")}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${tab === "calc" ? "bg-cyan-600 text-white shadow" : "text-white/30 hover:text-white/60"}`}
              >🧮</button>
              <button
                onClick={() => setTab("tour")}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${tab === "tour" ? "bg-emerald-600 text-white shadow" : "text-white/30 hover:text-white/60"}`}
              >🗺️</button>
            </div>
            <div className="flex items-center gap-1.5">
              {tab === "chat" && messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-[9px] text-white/20 hover:text-white/50 font-bold uppercase tracking-widest transition-colors"
                >
                  Limpiar
                </button>
              )}
              {tab === "calc" && (
                <button
                  onClick={() => { setCalcParts(""); setCalcLabor(""); }}
                  className="text-[9px] text-white/20 hover:text-white/50 font-bold uppercase tracking-widest transition-colors"
                >
                  Reset
                </button>
              )}
              {tab === "tour" && tourStep > 0 && (
                <button
                  onClick={() => { setTourStep(0); setTourTips({}); tourLoadedTips.current.clear(); }}
                  className="text-[9px] text-white/20 hover:text-white/50 font-bold uppercase tracking-widest transition-colors"
                >
                  Reiniciar
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/40" />
              </button>
            </div>
          </div>

          {/* ── Calculadora Tab ── */}
          {tab === "calc" && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/40 font-bold uppercase tracking-widest">Piezas / Partes</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={calcParts}
                    onChange={e => setCalcParts(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/40 font-bold uppercase tracking-widest">Mano de obra</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={calcLabor}
                    onChange={e => setCalcLabor(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCalcTax(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!calcTax ? "bg-cyan-600 text-white" : "bg-white/[0.04] text-white/30 border border-white/[0.08]"}`}
                >Sin IVU</button>
                <button
                  onClick={() => setCalcTax(true)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${calcTax ? "bg-emerald-600 text-white" : "bg-white/[0.04] text-white/30 border border-white/[0.08]"}`}
                >Con IVU 11.5%</button>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-900/20 to-cyan-900/10 p-4 space-y-1.5">
                {[
                  ["Piezas",      `$${calcTotals.parts.toFixed(2)}`],
                  ["Mano de obra", `$${calcTotals.labor.toFixed(2)}`],
                  ["Subtotal",    `$${calcTotals.subtotal.toFixed(2)}`],
                  ...(calcTax ? [["IVU (11.5%)", `$${calcTotals.tax.toFixed(2)}`]] : []),
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm text-white/60">
                    <span>{label}</span><span>{val}</span>
                  </div>
                ))}
                <div className="h-px bg-white/10 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Total</span>
                  <span className="text-2xl font-black text-emerald-300">${calcTotals.total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const txt = `Calcula reparación: piezas $${calcTotals.parts.toFixed(2)}, mano de obra $${calcTotals.labor.toFixed(2)}${calcTax ? ", con IVU" : ""}. Total: $${calcTotals.total.toFixed(2)}`;
                  setTab("chat");
                  setTimeout(() => sendMessage(txt), 100);
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                🧩 Enviar a JENAI para registrar cobro
              </button>
            </div>
          )}

          {/* ── Tour Tab ─────────────────────────────────────────────────────── */}
          {tab === "tour" && (() => {
            const step = TOUR_STEPS[tourStep];
            const isFirst = tourStep === 0;
            const isLast  = tourStep === TOUR_STEPS.length - 1;
            const tip     = tourTips[tourStep];
            const progress = tourStep / (TOUR_STEPS.length - 1);
            return (
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Cabecera degradado del paso */}
                <div className={`bg-gradient-to-r ${step.color} px-4 py-3 flex items-center gap-3 shrink-0`}>
                  <span className="text-2xl">{step.emoji}</span>
                  <div>
                    <p className="text-white font-black text-sm leading-tight">{step.title}</p>
                    <p className="text-white/70 text-[10px] font-semibold">{step.subtitle}</p>
                  </div>
                </div>

                {/* Contenido del paso */}
                <div className="flex-1 px-4 py-3 space-y-3">
                  <AnimatePresence mode="wait">
                    <motion.div key={tourStep}
                      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}
                      className="space-y-3"
                    >
                      <p className="text-white/80 text-sm leading-relaxed">{step.content}</p>

                      {/* Tip IA */}
                      <AnimatePresence>
                        {(tip || tourTipLoading) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3"
                          >
                            <div className="flex items-start gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                              {tourTipLoading ? (
                                <div className="flex gap-1 items-center">
                                  {[0,1,2].map(i => (
                                    <span key={i} className={`w-1.5 h-1.5 rounded-full animate-bounce ${["bg-red-400","bg-yellow-400","bg-blue-400"][i]}`}
                                      style={{ animationDelay: `${i*150}ms` }} />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-blue-200/90 text-[11px] leading-relaxed">{tip}</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </AnimatePresence>

                  {/* Barra de progreso */}
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 to-blue-600"
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </div>

                  {/* Puntos + contador */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {TOUR_STEPS.map((_, i) => (
                        <button key={i} onClick={() => setTourStep(i)}
                          className={`rounded-full transition-all ${i === tourStep ? "w-4 h-1.5 bg-gradient-to-r from-blue-400 to-cyan-400" : i < tourStep ? "w-1.5 h-1.5 bg-blue-400/50" : "w-1.5 h-1.5 bg-white/15"}`}
                        />
                      ))}
                    </div>
                    <span className="text-white/30 text-[10px]">{tourStep + 1} / {TOUR_STEPS.length}</span>
                  </div>

                  {/* Botones navegación */}
                  <div className="flex gap-2 pt-1">
                    {!isFirst && (
                      <button onClick={() => setTourStep(s => s - 1)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-xs font-bold transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Atrás
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (isLast) {
                          // Tour completado — esconder el botón flotante permanentemente
                          localStorage.setItem(JENAI_TOURED_KEY, "1");
                          setToured(true);
                          setOpen(false);
                        } else {
                          setTourStep(s => s + 1);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-black transition-all ${
                        isLast
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25"
                          : "bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-400 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                      }`}
                    >
                      {isLast ? "🎉 ¡Listo! Ir al chat" : isFirst ? <>Empezar <ChevronRight className="w-4 h-4" /></> : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Mensajes — solo en tab chat */}
          {tab === "chat" && <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/20 via-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl">🧩</span>
                </div>
                <p className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400">Hola, soy JENAI</p>
                <p className="text-xs text-white/25 leading-relaxed">
                  Tu asistente inteligente. Creo órdenes paso a paso, consulto precios, actualizo estados y más.
                </p>
                <div className="flex flex-col gap-1.5 w-full mt-2">
                  {[
                    "Quiero crear una nueva orden",
                    "¿Qué órdenes están listas para recoger?",
                    "Enviar recibo al cliente",
                    "Resumen del negocio esta semana",
                    "¿Cómo va la carga de los técnicos?",
                    "Gasté $30 en cable USB",
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-blue-500/10 hover:border-blue-500/20 text-xs text-white/40 hover:text-white/70 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              // Tarjetas de acción
              if (msg.type === "action") {
                if (msg.action === "order_created") return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[95%] rounded-2xl rounded-bl-md overflow-hidden border border-emerald-500/30 bg-emerald-900/20">
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Orden Creada</span>
                        <span className="ml-auto text-xs text-emerald-300 font-mono font-bold">{msg.data.order_number}</span>
                      </div>
                      <div className="px-4 py-3 space-y-0.5">
                        <p className="text-sm text-white/90 font-semibold">{msg.data.customer}</p>
                        <p className="text-xs text-white/50">{msg.data.device}</p>
                        <p className="text-xs text-white/35 italic mt-1">"{msg.data.problem}"</p>
                      </div>
                    </div>
                  </div>
                );
                if (msg.action === "orden_actualizada") return (
                  <div key={i} className="flex justify-start">
                    <div className="px-4 py-2.5 rounded-2xl rounded-bl-md border border-blue-500/30 bg-blue-900/20 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-sm text-blue-300 font-medium">Estado → <strong>{msg.data.estado}</strong></span>
                    </div>
                  </div>
                );
                if (msg.action === "cobro_registrado") return (
                  <div key={i} className="flex justify-start">
                    <div className="px-4 py-2.5 rounded-2xl rounded-bl-md border border-emerald-500/30 bg-emerald-900/20 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-sm text-emerald-300 font-bold">${msg.data.monto} · {msg.data.metodo}</p>
                        <p className="text-[11px] text-white/40">{msg.data.cliente}</p>
                      </div>
                    </div>
                  </div>
                );
                if (msg.action === "cliente_creado") return (
                  <div key={i} className="flex justify-start">
                    <div className="px-4 py-2.5 rounded-2xl rounded-bl-md border border-blue-500/30 bg-blue-900/20 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <div>
                        <p className="text-sm text-blue-300 font-semibold">{msg.data.nombre}</p>
                        <p className="text-[11px] text-white/40">{msg.data.telefono}</p>
                      </div>
                    </div>
                  </div>
                );
                if (msg.action === "gasto_registrado") return (
                  <div key={i} className="flex justify-start">
                    <div className="px-4 py-2.5 rounded-2xl rounded-bl-md border border-red-500/30 bg-red-900/20 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <div>
                        <p className="text-sm text-red-300 font-semibold">-${msg.data.monto} registrado</p>
                        <p className="text-[11px] text-white/40">{msg.data.descripcion}</p>
                      </div>
                    </div>
                  </div>
                );
                if (msg.action === "producto_creado") return (
                  <div key={i} className="flex justify-start">
                    <div className="px-4 py-2.5 rounded-2xl rounded-bl-md border border-cyan-500/30 bg-cyan-900/20 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <div>
                        <p className="text-sm text-cyan-300 font-semibold">{msg.data.nombre}</p>
                        <p className="text-[11px] text-white/40">${msg.data.precio} · Inventario actualizado</p>
                      </div>
                    </div>
                  </div>
                );
                if (msg.action === "recibo_enviado") return (
                  <div key={i} className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md border border-blue-500/30 bg-blue-900/20 space-y-2 max-w-[95%]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <div>
                          <p className="text-sm text-blue-300 font-semibold">Recibo {msg.data.tipo === "pago" ? "de pago" : "de entrada"}</p>
                          <p className="text-[10px] text-white/35">{msg.data.cliente}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {msg.data.waUrl && (
                          <a href={msg.data.waUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">
                            💬 WhatsApp
                          </a>
                        )}
                        <a href={msg.data.reciboUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors">
                          🧾 Ver recibo
                        </a>
                      </div>
                    </div>
                  </div>
                );
                if (msg.action === "mensaje_enviado") return (
                  <div key={i} className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md border border-emerald-500/30 bg-emerald-900/20 space-y-2 max-w-[95%]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <p className="text-sm text-emerald-300 font-semibold">Mensaje a {msg.data.cliente}</p>
                      </div>
                      {msg.data.waUrl && (
                        <a
                          href={msg.data.waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors w-fit"
                        >
                          💬 Abrir en WhatsApp
                        </a>
                      )}
                      {!msg.data.waUrl && (
                        <p className="text-[11px] text-white/30">Sin teléfono — notificación interna guardada</p>
                      )}
                    </div>
                  </div>
                );
              }
              // Mensajes normales
              return (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-br-md"
                      : "bg-white/[0.06] border border-white/[0.08] text-white/85 rounded-bl-md"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Indicador de carga */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.06] border border-white/[0.08] px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  {status && <span className="text-[10px] text-blue-400/70 ml-1 font-medium">{status}</span>}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>}

          {/* Input — solo en tab chat */}
          {tab === "chat" && <div className="px-3 py-3 border-t border-white/[0.06] shrink-0">
            <div className={`flex gap-2 items-center bg-white/[0.04] border rounded-2xl px-3 py-2 transition-colors ${
              isListening
                ? "border-red-500/50 bg-red-950/20"
                : "border-white/[0.08] focus-within:border-blue-500/40"
            }`}>
              <button
                onClick={startDictation}
                disabled={loading}
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  isListening ? "bg-red-500 animate-pulse" : "hover:bg-white/[0.08]"
                }`}
                title={isListening ? "Detener dictado" : "Dictar por voz"}
              >
                <Mic className={`w-3.5 h-3.5 ${isListening ? "text-white" : "text-white/30"}`} />
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={isListening ? "Escuchando…" : "Escribe o dicta…"}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
                disabled={loading || isListening}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-30 flex items-center justify-center transition-all active:scale-90 shrink-0"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>}
        </div>
      )}

      {/* Botón flotante — se esconde tras completar el tour (salvo que haya alertas) */}
      {(!toured || proactiveCount > 0 || open) && (
      <div className="relative pointer-events-auto">
        {/* Badge de notificaciones */}
        {proactiveCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-black flex items-center justify-center z-10">
            <span className="text-[9px] font-black text-white leading-none">{proactiveCount > 9 ? "9+" : proactiveCount}</span>
          </span>
        )}

        {/* Anillo exterior pulsante (solo cuando está cerrado) */}
        {!open && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.5, repeat: 2, ease: "easeInOut" }}
            style={{
              background: "conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #ef4444)",
              filter: "blur(4px)",
            }}
          />
        )}

        <button
          onClick={() => setOpen(p => !p)}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 hover:scale-105 relative overflow-hidden"
          style={{
            boxShadow: open
              ? "0 8px 32px rgba(29,78,216,0.6)"
              : "0 6px 24px rgba(59,130,246,0.5), 0 0 12px rgba(239,68,68,0.3), 0 0 18px rgba(34,197,94,0.2)",
          }}
        >
          {/* Fondo sólido oscuro */}
          <div className="absolute inset-0 rounded-full bg-[#0a0a0f]" />

          {/* Gradiente giratorio — los 4 colores del autismo fluyendo */}
          {!open && (
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: "200%",
                height: "200%",
                top: "-50%",
                left: "-50%",
                background: "conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
                opacity: 0.85,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: 2, ease: "linear" }}
            />
          )}

          {/* Fondo cuando está abierto */}
          {open && <div className="absolute inset-0 rounded-full bg-blue-700" />}

          {/* Círculo interior oscuro para efecto de anillo */}
          {!open && (
            <div
              className="absolute rounded-full bg-[#0e0e16]"
              style={{ inset: "3px" }}
            />
          )}

          {/* Icono centrado */}
          <span className="relative z-10 flex items-center justify-center">
            {loading ? (
              <motion.span
                className="text-lg"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: "linear" }}
              >⟳</motion.span>
            ) : open ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <span className="text-xl">🧩</span>
            )}
          </span>
        </button>
      </div>
      )}
    </div>
  );
}
