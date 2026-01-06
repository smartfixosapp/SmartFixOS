/**
 * Registro unificado de estados de órdenes
 * Ahora carga dinámicamente desde SystemConfig
 */

// Estados por defecto (fallback)
const DEFAULT_ORDER_STATUSES = [
  {
    id: "intake",
    label: "Recepción",
    order: 1,
    colorClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    colorClasses: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    color: "#3B82F6",
    isActive: true,
    isTerminal: false
  },
  {
    id: "diagnosing",
    label: "Diagnóstico",
    order: 2,
    colorClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    colorClasses: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    color: "#8B5CF6",
    isActive: true,
    isTerminal: false
  },
  {
    id: "awaiting_approval",
    label: "Por Aprobar",
    order: 3,
    colorClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    colorClasses: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    color: "#EAB308",
    isActive: true,
    isTerminal: false
  },
  {
    id: "pending_order",
    label: "Pendiente a Ordenar",
    order: 4,
    colorClass: "bg-red-600/40 text-red-100 border-red-600/60",
    colorClasses: "bg-red-600/40 text-red-100 border-red-600/60",
    color: "#DC2626",
    isActive: true,
    isTerminal: false
  },
  {
    id: "waiting_parts",
    label: "Esperando Piezas",
    order: 6,
    colorClass: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    colorClasses: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    color: "#F97316",
    isActive: true,
    isTerminal: false
  },
  {
    id: "reparacion_externa",
    label: "Reparación Externa",
    order: 7,
    colorClass: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    colorClasses: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    color: "#EC4899",
    isActive: true,
    isTerminal: false
  },
  {
    id: "in_progress",
    label: "En Reparación",
    order: 8,
    colorClass: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    colorClasses: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    color: "#06B6D4",
    isActive: true,
    isTerminal: false
  },
  {
    id: "ready_for_pickup",
    label: "Listo para Recoger",
    order: 9,
    colorClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    colorClasses: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    color: "#10B981",
    isActive: true,
    isTerminal: false
  },
  {
    id: "delivered",
    label: "Entregado",
    order: 10,
    colorClass: "bg-green-600/20 text-green-300 border-green-600/30",
    colorClasses: "bg-green-600/20 text-green-300 border-green-600/30",
    color: "#059669",
    isActive: false,
    isTerminal: true
  },
  {
    id: "cancelled",
    label: "Cancelado",
    order: 11,
    colorClass: "bg-gray-600/20 text-gray-300 border-gray-600/30",
    colorClasses: "bg-gray-600/20 text-gray-300 border-gray-600/30",
    color: "#6B7280",
    isActive: false,
    isTerminal: true
  }
];

// Cache en memoria
let cachedStatuses = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Convertir color hex a clases de Tailwind
 */
function colorToClasses(hexColor) {
  if (!hexColor) return "bg-gray-600/20 text-gray-300 border-gray-600/30";
  
  const colorMap = {
    "#3B82F6": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "#8B5CF6": "bg-purple-500/20 text-purple-300 border-purple-500/30",
    "#EAB308": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    "#F97316": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    "#DC2626": "bg-red-600/20 text-red-300 border-red-600/30",
    "#EC4899": "bg-pink-500/20 text-pink-300 border-pink-500/30",
    "#06B6D4": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    "#10B981": "bg-green-600/20 text-green-300 border-green-600/30",
    "#059669": "bg-emerald-600/20 text-emerald-300 border-emerald-600/30",
    "#6B7280": "bg-gray-600/20 text-gray-300 border-gray-600/30",
    "#F59E0B": "bg-amber-500/20 text-amber-300 border-amber-500/30"
  };

  const upperColor = String(hexColor).toUpperCase();
  return colorMap[upperColor] || "bg-gray-600/20 text-gray-300 border-gray-600/30";
}

/**
 * Cargar estados desde SystemConfig (con cache)
 */
async function loadOrderStatuses() {
  if (cachedStatuses && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return cachedStatuses;
  }

  try {
    const { base44 } = await import("@/api/base44Client");
    
    const rows = await base44.entities.SystemConfig.filter({ key: "order_statuses" });
    
    if (rows && rows.length > 0) {
      const raw = rows[0].value || rows[0].value_json;
      let loadedStatuses = [];
      
      if (typeof raw === "string") {
        try {
          loadedStatuses = JSON.parse(raw);
        } catch (e) {
          console.warn("Error parsing order_statuses:", e);
          loadedStatuses = DEFAULT_ORDER_STATUSES;
        }
      } else if (Array.isArray(raw)) {
        loadedStatuses = raw;
      } else {
        loadedStatuses = DEFAULT_ORDER_STATUSES;
      }

      const fullStatuses = loadedStatuses.map((status, index) => ({
        id: status.id,
        label: status.label,
        order: index + 1,
        color: status.color || "#3B82F6",
        colorClass: colorToClasses(status.color || "#3B82F6"),
        colorClasses: colorToClasses(status.color || "#3B82F6"),
        isActive: status.isActive !== undefined ? status.isActive : true,
        isTerminal: status.isTerminal !== undefined ? status.isTerminal : false
      }));

      cachedStatuses = fullStatuses;
      cacheTimestamp = Date.now();
      
      return fullStatuses;
    }
  } catch (error) {
    console.warn("Error loading order statuses from config, using defaults:", error);
  }

  cachedStatuses = DEFAULT_ORDER_STATUSES;
  cacheTimestamp = Date.now();
  return DEFAULT_ORDER_STATUSES;
}

export let ORDER_STATUSES = DEFAULT_ORDER_STATUSES;

export async function initializeOrderStatuses() {
  ORDER_STATUSES = await loadOrderStatuses();
  return ORDER_STATUSES;
}

export function clearStatusCache() {
  cachedStatuses = null;
  cacheTimestamp = 0;
}

const STATUS_SYNONYMS = {
  "picked_up": "delivered",
  "entregado": "delivered",
  "finalizado": "delivered",
  "cerrado": "delivered",
  "completed": "delivered",
  "completado": "delivered",
  "recepcion": "intake",
  "diagnostico": "diagnosing",
  "por_aprobar": "awaiting_approval",
  "esperando_aprobacion": "awaiting_approval",
  "pendiente_ordenar": "pending_order",
  "esperando_piezas": "waiting_parts",
  "taller_externo": "reparacion_externa",
  "en_reparacion": "in_progress",
  "en_progreso": "in_progress",
  "listo": "ready_for_pickup",
  "listo_recoger": "ready_for_pickup",
  "cancelado": "cancelled"
};

export function normalizeStatusId(rawStatus) {
  if (!rawStatus) return "intake";
  
  const normalized = String(rawStatus).toLowerCase().trim().replace(/\s+/g, "_");
  
  // Check synonyms first
  if (STATUS_SYNONYMS[normalized]) {
    return STATUS_SYNONYMS[normalized];
  }
  
  const found = ORDER_STATUSES.find(s => s.id === normalized);
  
  return found ? found.id : normalized;
}

export function getStatusConfig(rawStatus) {
  const id = normalizeStatusId(rawStatus);
  return ORDER_STATUSES.find(s => s.id === id) || ORDER_STATUSES[0];
}

export function getStatusColorClasses(rawStatus) {
  const config = getStatusConfig(rawStatus);
  return config ? config.colorClasses : "bg-gray-600/20 text-gray-300 border-gray-600/30";
}

export function getStatusLabel(rawStatus) {
  const config = getStatusConfig(rawStatus);
  return config ? config.label : rawStatus;
}

export function getActiveStatuses() {
  return ORDER_STATUSES.filter(s => s.isActive);
}

export function getAllStatuses() {
  return ORDER_STATUSES;
}

export function getStatusColor(rawStatus) {
  const config = getStatusConfig(rawStatus);
  return config ? config.color : "#6B7280";
}

export function isTerminalStatus(rawStatus) {
  const config = getStatusConfig(rawStatus);
  return config ? config.isTerminal : false;
}
