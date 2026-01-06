import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// ===== ICONOS GENÉRICOS POR CATEGORÍA =====
const GENERIC_DEVICE_ICONS = {
  phone: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect rx="16" ry="16" width="96" height="96" fill="%2311161b"/><rect x="28" y="12" width="40" height="72" rx="8" fill="%23212a31"/><circle cx="48" cy="76" r="4" fill="%236b7280"/></svg>',
  watch: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="30" y="24" width="36" height="48" rx="8" fill="%23212a31"/><rect x="38" y="16" width="20" height="8" rx="3" fill="%23343b46"/><rect x="38" y="72" width="20" height="8" rx="3" fill="%23343b46"/></svg>',
  laptop: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="14" y="20" width="68" height="38" rx="6" fill="%23212a31"/><rect x="10" y="60" width="76" height="8" rx="3" fill="%23343b46"/></svg>',
  desktop: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="10" y="16" width="76" height="44" rx="6" fill="%23212a31"/><rect x="36" y="62" width="24" height="6" rx="2" fill="%23343b46"/><rect x="28" y="68" width="40" height="8" rx="2" fill="%23343b46"/></svg>',
  tablet: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect rx="12" ry="12" width="96" height="96" fill="%2311161b"/><rect x="18" y="12" width="60" height="72" rx="8" fill="%23212a31"/></svg>',
  earbuds: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><circle cx="34" cy="40" r="10" fill="%23212a31"/><rect x="30" y="50" width="8" height="16" rx="3" fill="%23343b46"/><circle cx="62" cy="40" r="10" fill="%23212a31"/><rect x="58" y="50" width="8" height="16" rx="3" fill="%23343b46"/></svg>',
  console: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="18" y="36" width="60" height="24" rx="8" fill="%23212a31"/><circle cx="32" cy="48" r="4" fill="%236b7280"/><circle cx="64" cy="48" r="4" fill="%236b7280"/></svg>',
  camera: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="18" y="30" width="60" height="36" rx="8" fill="%23212a31"/><circle cx="48" cy="48" r="12" fill="%23343b46"/></svg>',
  tv: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="10" y="18" width="76" height="46" rx="6" fill="%23212a31"/><rect x="28" y="66" width="40" height="6" rx="2" fill="%23343b46"/></svg>',
  other: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><circle cx="48" cy="48" r="20" fill="%23212a31"/></svg>',
};

function getCategoryFromFamilyNameOrType(family, subcategory) {
  const s = (family?.name || family?.label || subcategory || "").toLowerCase();
  if (s.includes("phone") || s.includes("iphone") || s.includes("smartphone")) return "phone";
  if (s.includes("watch")) return "watch";
  if (s.includes("laptop") || s.includes("notebook") || s.includes("macbook")) return "laptop";
  if (s.includes("desktop") || s.includes("pc") || s.includes("tower")) return "desktop";
  if (s.includes("tablet") || s.includes("ipad")) return "tablet";
  if (s.includes("earbud") || s.includes("buds") || s.includes("airpods")) return "earbuds";
  if (s.includes("console")) return "console";
  if (s.includes("camera")) return "camera";
  if (s.includes("tv")) return "tv";
  return "other";
}

function naturalCompare(a = "", b = "") {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * ModelIconGrid — Muestra modelos para la familia seleccionada
 * Orden: release_date DESC, luego nombre natural.
 * Ícono: model.icon_url || family.icon || genérico por categoría.
 */
export default function ModelIconGrid({ formData, updateFormData, onAutoAdvance, config }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectedBrand = formData.device_brand;
  const selectedFamily = formData.device_family;
  const selectedSubcat = formData.device_subcategory;

  useEffect(() => {
    if (!selectedBrand?.id || !selectedFamily?.id) {
      setModels([]);
      setLoading(false);
      return;
    }
    loadModels();
  }, [selectedBrand, selectedFamily]);

  const loadModels = async () => {
    try {
      setLoading(true);
      
      const data = await base44.entities.DeviceModel.filter({
        brand_id: selectedBrand.id,
        family_id: selectedFamily.id,
        active: true
      });

      const cat = getCategoryFromFamilyNameOrType(selectedFamily, selectedSubcat);
      const fallbackIcon = GENERIC_DEVICE_ICONS[cat] || GENERIC_DEVICE_ICONS.other;

      const mapped = (Array.isArray(data) ? data : []).map(m => ({
        id: m.id,
        name: m.name,
        label: m.name,
        release_date: m.release_date || null,
        icon_url: m.icon_url || fallbackIcon,
        active: m.active
      }));

      mapped.sort((a, b) => {
        const da = a.release_date ? new Date(a.release_date).getTime() : 0;
        const db = b.release_date ? new Date(b.release_date).getTime() : 0;
        if (db !== da) return db - da;
        return naturalCompare(a.label || "", b.label || "");
      });

      setModels(mapped);
    } catch (e) {
      console.error("Error loading models:", e);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = useMemo(() => {
    if (!searchTerm.trim()) return models;
    const q = searchTerm.toLowerCase();
    return models.filter(m => (m.name || "").toLowerCase().includes(q));
  }, [models, searchTerm]);

  const handleSelect = (model) => {
    updateFormData("device_model", model.name || model.label);
    updateFormData("custom_fields", {
      ...(formData.custom_fields || {}),
      selected_model_data: model
    });
    if (onAutoAdvance) {
      setTimeout(() => onAutoAdvance(), 200);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-white mb-1">Modelo</h3>
        <p className="text-sm text-gray-400">
          {selectedBrand?.name} → {selectedSubcat?.name} → {selectedFamily?.name}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar modelo…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 px-4 pl-10 rounded-lg bg-black/40 border border-white/15 text-slate-100"
        />
      </div>

      {/* Nota de orden */}
      <div className="text-xs text-gray-500 text-center">
        Ordenado por más reciente primero; si no hay fecha, por nombre.
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filteredModels.map((model) => (
          <button
            key={model.id}
            onClick={() => handleSelect(model)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-black/40 border-2 transition-all min-h-[120px] 
              ${formData.device_model === (model.name || model.label)
                ? "border-red-600 ring-2 ring-red-600"
                : "border-white/10 hover:border-red-600/50"
              }`}
          >
            <img
              src={model.icon_url}
              alt={model.name || model.label}
              className="w-12 h-12 object-contain"
              draggable={false}
            />
            <span className="text-sm text-white text-center line-clamp-2">
              {model.name || model.label}
            </span>
            {model.release_date && (
              <span className="text-[10px] text-gray-500">
                {new Date(model.release_date).getFullYear()}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <p className="text-gray-400">No hay modelos para esta familia</p>
          <p className="text-xs text-gray-500">Puedes escribir el nombre del modelo abajo</p>
        </div>
      )}
      
      {/* Opción para agregar modelo manual */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-gray-400 mb-2">O escribe un modelo nuevo:</p>
        <Input
          type="text"
          placeholder="Ej: iPhone 12 Pro Max, Galaxy S23..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.value.trim()) {
              updateFormData("device_model", e.target.value.trim());
              if (onAutoAdvance) {
                setTimeout(() => onAutoAdvance(), 200);
              }
            }
          }}
          className="w-full h-12 px-4 rounded-lg bg-black/40 border border-white/15 text-slate-100"
        />
      </div>
    </div>
  );
}
