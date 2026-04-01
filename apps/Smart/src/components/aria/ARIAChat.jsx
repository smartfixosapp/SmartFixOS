import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { dataClient } from "@/components/api/dataClient";
import { X, Mic, ChevronRight, CheckCircle2 } from "lucide-react";

// Páginas donde NO mostrar ARIA
const HIDDEN_PATHS = [
  "/Welcome", "/PinAccess", "/Setup", "/InitialSetup",
  "/VerifySetup", "/Activate", "/TenantActivate", "/returnlogin",
];

// ── Herramientas del Asistente ARIA ──────────────────────────────────────────
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
  ver_stock_bajo:          "Revisando inventario…",
  ver_caja_del_dia:        "Consultando caja…",
};

function readSession() {
  try {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function ARIAChat() {
  const location  = useLocation();
  const [open, setOpen]           = useState(false);
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
  const recognitionRef = useRef(null);
  const dictRef        = useRef("");
  const endRef         = useRef(null);

  const isHidden = HIDDEN_PATHS.includes(location.pathname);

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
      } catch (e) { console.error("ARIA ctx:", e); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [messages, open]);

  if (isHidden) return null;

  // ── Construye el prompt de sistema ───────────────────────────────────────────
  const buildSystem = () => {
    const session  = readSession();
    const bizName  = session?.storeName || "SmartFixOS";
    return `Eres ARIA, asistente inteligente de ${bizName} (taller de reparación de electrónicos).
Respondes siempre en ESPAÑOL. Sé conciso — máximo 3 oraciones por mensaje. Haz UNA sola pregunta a la vez.

ESTADO DEL NEGOCIO AHORA:
- Activas: ${activeOrders.total} | Urgentes: ${activeOrders.urgent} | Listas para recoger: ${activeOrders.ready}
- Ingresos hoy: $${todayIncome.toFixed(0)} | Gastos: $${todayExpenses.toFixed(0)}

━━━━ FLUJO PARA CREAR ÓRDENES (paso a paso) ━━━━
NO crees la orden hasta tener TODA la información. Guía al usuario así:

PASO 1 — Nombre y apellido del cliente
PASO 2 — Busca si existe (buscar_cliente). Si no existe, ofrécete a crearlo.
PASO 3 — Muestra técnicos disponibles (obtener_tecnicos) y pregunta cuál asignar (o ninguno).
PASO 4 — Marca y modelo del equipo
PASO 5 — Descripción del problema/síntomas principales
PASO 6 — Checklist inteligente según síntomas:
  • Mojado/agua → ¿hay corrosión visible? ¿enciende? ¿puertos dañados?
  • Pantalla rota → ¿funciona el táctil? ¿líneas o manchas en pantalla?
  • No enciende / se apaga → ¿batería hinchada? ¿carga lento o no carga?
  • Cámara → ¿lente roto? ¿fotos borrosas? ¿no abre la app?
  • Laptop → ¿teclado dañado? ¿carga? ¿pantalla parpadea?
  • Solicita solo los items relevantes para ese equipo y síntoma.
PASO 7 — Seguridad del dispositivo: ¿PIN, patrón, Face ID, huella o ninguna? (solicita el código)
PASO 8 — Indicaciones especiales del cliente
PASO 9 — Muestra resumen completo y pide confirmación
PASO 10 — Ejecuta crear_orden_completa con toda la info

━━━━ OTRAS CAPACIDADES ━━━━
buscar_precio_inventario, calcular_total_reparacion, sugerir_accesorios, buscar_orden,
actualizar_estado_orden, agregar_nota_orden, asignar_tecnico, enviar_mensaje_cliente,
registrar_cobro, historial_cliente, ver_stock_bajo, ver_caja_del_dia`;
  };

  // ── Ejecutor de herramientas ─────────────────────────────────────────────────
  const executeToolCall = async (toolName, args) => {
    const session   = readSession();
    const createdBy = session?.full_name || session?.userName || session?.email || "ARIA";

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
          const textos = {
            listo_para_recoger: `¡Hola ${order.customer_name}! Tu ${order.device_brand} ${order.device_model} está listo para recoger. ¡Gracias por confiar en nosotros!`,
            en_reparacion:      `¡Hola ${order.customer_name}! Tu equipo está en proceso de reparación. Te avisamos cuando esté listo.`,
            esperando_piezas:   `¡Hola ${order.customer_name}! Estamos esperando la pieza para tu equipo. Te mantenemos informado.`,
            personalizado:      args.mensaje_personalizado || "",
          };
          const texto = textos[args.tipo_mensaje];
          await dataClient.entities.Notification.create({ title: `Mensaje a ${order.customer_name}`, message: texto, type: "sms", status: "sent", customer_id: order.customer_id });
          return JSON.stringify({ exito: true, cliente: order.customer_name, mensaje_enviado: texto });
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
      const GROQ_KEY      = import.meta.env.VITE_GROQ_API_KEY;
      if (!ANTHROPIC_KEY && !GROQ_KEY) throw new Error("No hay API key de IA configurada. Agrega VITE_GROQ_API_KEY o VITE_ANTHROPIC_API_KEY.");

      const systemPrompt = buildSystem();
      // Historial limpio (sin tarjetas de acción)
      const cleanHistory = history
        .filter(m => m.role === "user" || (m.role === "assistant" && !m.type))
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      // ── Groq loop ─────────────────────────────────────────────────────────
      const runGroq = async () => {
        if (!GROQ_KEY) throw new Error("No hay API key disponible.");
        let conv = cleanHistory;
        let iter = 6;
        while (iter-- > 0) {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({
              model: "llama-3.1-8b-instant", // reemplazo oficial de llama3-8b-8192
              messages: [{ role: "system", content: systemPrompt }, ...conv],
              tools: ARIA_TOOLS,
              tool_choice: "auto",
              temperature: 0.3,
              max_tokens: 300,
            }),
          });
          const data = await res.json();
          if (data?.error) {
            const errMsg = data.error.message || "";
            // Rate limit: espera el tiempo sugerido y reintenta una vez
            if (data.error.type === "tokens" || errMsg.includes("rate_limit") || errMsg.toLowerCase().includes("rate limit")) {
              const wait = parseInt(errMsg.match(/(\d+(?:\.\d+)?)s/)?.[1] || "20") * 1000;
              setStatus(`Límite de velocidad — reintentando en ${Math.ceil(wait/1000)}s…`);
              await new Promise(r => setTimeout(r, Math.min(wait, 25000)));
              setStatus("");
              continue;
            }
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

      // ── Claude (Anthropic) con fallback automático a Groq ─────────────────
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
        if (!claudeOk) await runGroq();
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
    <div className="fixed bottom-6 right-5 z-[9999] flex flex-col items-end gap-3 pointer-events-none">

      {/* Panel de chat */}
      {open && (
        <div
          className="w-[340px] sm:w-[380px] bg-[#0e0e0e]/98 backdrop-blur-3xl border border-violet-500/20 rounded-[28px] shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
          style={{ height: "480px", boxShadow: "0 24px 80px rgba(139,92,246,0.25)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-900/50">
                <span className="text-sm">✨</span>
              </div>
              <div>
                <p className="text-sm font-black text-white leading-none">ARIA</p>
                <p className="text-[9px] text-violet-400/60 font-bold uppercase tracking-widest leading-none mt-0.5">
                  SmartFixOS · {import.meta.env.VITE_ANTHROPIC_API_KEY ? "Claude Haiku" : "Llama 3 8B"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-[9px] text-white/20 hover:text-white/50 font-bold uppercase tracking-widest transition-colors"
                >
                  Limpiar
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

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
                <p className="text-sm font-black text-white/60">Hola, soy ARIA</p>
                <p className="text-xs text-white/25 leading-relaxed">
                  Tu asistente inteligente. Creo órdenes paso a paso, consulto precios, actualizo estados y más.
                </p>
                <div className="flex flex-col gap-1.5 w-full mt-2">
                  {[
                    "Quiero crear una nueva orden",
                    "¿Precio pantalla iPhone 15 Pro Max?",
                    "¿Cómo va el negocio hoy?",
                    "¿Qué órdenes están listas para recoger?",
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-violet-500/10 hover:border-violet-500/20 text-xs text-white/40 hover:text-white/70 transition-all"
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
                    <div className="px-4 py-2.5 rounded-2xl rounded-bl-md border border-violet-500/30 bg-violet-900/20 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <div>
                        <p className="text-sm text-violet-300 font-semibold">{msg.data.nombre}</p>
                        <p className="text-[11px] text-white/40">{msg.data.telefono}</p>
                      </div>
                    </div>
                  </div>
                );
              }
              // Mensajes normales
              return (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-br-md"
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
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  {status && <span className="text-[10px] text-violet-400/70 ml-1 font-medium">{status}</span>}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/[0.06] shrink-0">
            <div className={`flex gap-2 items-center bg-white/[0.04] border rounded-2xl px-3 py-2 transition-colors ${
              isListening
                ? "border-red-500/50 bg-red-950/20"
                : "border-white/[0.08] focus-within:border-violet-500/40"
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
                className="w-7 h-7 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 flex items-center justify-center transition-all active:scale-90 shrink-0"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen(p => !p)}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 pointer-events-auto ${
          open
            ? "bg-violet-700 rotate-12"
            : "bg-gradient-to-br from-violet-600 to-purple-700 hover:scale-110"
        }`}
        style={{ boxShadow: "0 8px 32px rgba(139,92,246,0.55)" }}
      >
        {loading
          ? <span className="text-xl animate-spin inline-block">⟳</span>
          : open
            ? <X className="w-5 h-5 text-white" />
            : <span className="text-xl">✨</span>
        }
      </button>
    </div>
  );
}
