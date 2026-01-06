import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search, Smartphone } from "lucide-react";

export default function SubcategoryIconGrid({ formData, updateFormData, onAutoAdvance }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectedBrand = formData.device_brand;
  const selectedCategory = formData.device_category;

  useEffect(() => {
    if (!selectedBrand?.id) {
      setSubcategories([]);
      setLoading(false);
      return;
    }
    loadSubcategories();
  }, [selectedBrand, selectedCategory]);

  const loadSubcategories = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.DeviceSubcategory.filter({
        brand_id: selectedBrand.id,
        active: true
      });

      const mapped = (Array.isArray(data) ? data : []).map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon || "📱",
        icon_url: s.icon_url,
        active: s.active
      }));

      mapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));
      setSubcategories(mapped);
    } catch (e) {
      console.error("Error loading subcategories:", e);
      setSubcategories([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubcategories = useMemo(() => {
    if (!searchTerm.trim()) return subcategories;
    const q = searchTerm.toLowerCase();
    return subcategories.filter(s => (s.name || "").toLowerCase().includes(q));
  }, [subcategories, searchTerm]);

  const handleSelect = (subcategory) => {
    updateFormData("device_subcategory", subcategory);
    updateFormData("device_family", null);
    updateFormData("device_model", null);

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

  if (subcategories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No hay subcategorías para {selectedBrand.name}</p>
        <p className="text-xs text-gray-500">
          Configura subcategorías en Settings → Catálogo de Dispositivos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-white mb-1">Subcategoría</h3>
        <p className="text-sm text-gray-400">
          {selectedCategory?.name} → {selectedBrand?.name}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar subcategoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 px-4 pl-10 rounded-lg bg-black/40 border border-white/15 text-slate-100"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filteredSubcategories.map((subcategory) => {
          const isSelected = formData?.device_subcategory?.id === subcategory.id;
          return (
            <button
              key={subcategory.id}
              onClick={() => handleSelect(subcategory)}
              className={`
                flex flex-col items-center gap-2 p-4 rounded-xl transition-all min-h-[120px]
                ${isSelected
                  ? "bg-gradient-to-br from-red-600 to-red-800 border-2 border-red-500 shadow-lg shadow-red-600/40"
                  : "bg-black/40 border-2 border-white/10 hover:border-red-600/50"}
              `}
            >
              {subcategory.icon_url ? (
                <img
                  src={subcategory.icon_url}
                  alt={subcategory.name}
                  className={`w-12 h-12 object-contain ${isSelected ? "" : "brightness-[0] invert-[1]"}`}
                />
              ) : (
                <div className="text-4xl">{subcategory.icon}</div>
              )}
              <span className="text-sm text-white text-center line-clamp-2">{subcategory.name}</span>
            </button>
          );
        })}
      </div>

      {filteredSubcategories.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No se encontraron subcategorías
        </div>
      )}
    </div>
  );
}
