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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue" />
      </div>
    );
  }

  if (subcategories.length === 0) {
    return (
      <div className="apple-surface apple-type text-center py-12">
        <p className="apple-text-callout apple-label-secondary mb-2">No hay subcategorías para {selectedBrand.name}</p>
        <p className="apple-text-caption1 apple-label-tertiary">
          Configura subcategorías en Settings → Catálogo de Dispositivos
        </p>
      </div>
    );
  }

  return (
    <div className="apple-surface apple-type space-y-4">
      <div>
        <h3 className="apple-text-title3 apple-label-primary mb-1">Subcategoría</h3>
        <p className="apple-text-footnote apple-label-secondary">
          {selectedCategory?.name} → {selectedBrand?.name}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 apple-label-tertiary w-5 h-5 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar subcategoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 px-4 pl-10 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 border-0 apple-label-primary"
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
                apple-press rounded-apple-md flex flex-col items-center gap-2 p-4 min-h-[120px]
                ${isSelected
                  ? "bg-apple-blue/12 ring-2 ring-apple-blue/70"
                  : "bg-gray-sys6 dark:bg-gray-sys5"}
              `}
            >
              {subcategory.icon_url ? (
                <img
                  src={subcategory.icon_url}
                  alt={subcategory.name}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <div className="text-4xl">{subcategory.icon}</div>
              )}
              <span className="apple-text-footnote apple-label-primary text-center line-clamp-2">{subcategory.name}</span>
            </button>
          );
        })}
      </div>

      {filteredSubcategories.length === 0 && (
        <div className="text-center py-8 apple-text-footnote apple-label-tertiary">
          No se encontraron subcategorías
        </div>
      )}
    </div>
  );
}
