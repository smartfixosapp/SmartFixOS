import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search, Smartphone } from "lucide-react";

/**
 * PROMPT 4: Brand → Familia → Modelo
 * Este componente ahora solo muestra MARCAS
 */
export default function BrandIconGrid({ formData, updateFormData, onAutoAdvance, config }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // PROMPT 4: Feature flag para el nuevo selector
  const useNewSelector = config?.feature_flags?.brand_family_flow !== false;

  useEffect(() => {
    loadBrands();
  }, [formData.device_category]);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const selectedCategory = formData.device_category;
      if (!selectedCategory?.id) {
        setBrands([]);
        return;
      }

      const data = await base44.entities.Brand.filter({
        category_id: selectedCategory.id,
        active: true
      });

      const mapped = (Array.isArray(data) ? data : []).map(b => ({
        id: b.id,
        name: b.name,
        icon_url: b.icon_url,
        active: b.active
      }));

      mapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));
      setBrands(mapped);
    } catch (e) {
      console.error("Error loading brands:", e);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = useMemo(() => {
    if (!searchTerm.trim()) return brands;
    const q = searchTerm.toLowerCase();
    return brands.filter(b => (b.name || "").toLowerCase().includes(q));
  }, [brands, searchTerm]);

  const handleSelect = (brand) => {
    updateFormData("device_brand", brand);
    updateFormData("device_subcategory", null);
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

  return (
    <div className="apple-surface apple-type space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 apple-label-tertiary w-5 h-5 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar marca…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 px-4 pl-10 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 border-0 apple-label-primary"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filteredBrands.map((brand) => {
          const isSelected = formData?.device_brand?.id === brand.id;
          return (
            <button
              key={brand.id}
              onClick={() => handleSelect(brand)}
              className={`
                apple-press rounded-apple-md flex flex-col items-center gap-2 p-4 min-h-[120px]
                ${isSelected
                  ? "bg-apple-blue/12 ring-2 ring-apple-blue/70"
                  : "bg-gray-sys6 dark:bg-gray-sys5"}
              `}
            >
              {brand.icon_url ? (
                <img
                  src={brand.icon_url}
                  alt={brand.name}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <div className={`w-12 h-12 rounded-apple-sm grid place-items-center ${isSelected ? "bg-apple-blue/12" : "bg-gray-sys5 dark:bg-gray-sys4"}`}>
                  <Smartphone className={`w-6 h-6 ${isSelected ? "text-apple-blue" : "apple-label-secondary"}`} />
                </div>
              )}
              <span className="apple-text-footnote apple-label-primary text-center line-clamp-2">{brand.name}</span>
            </button>
          );
        })}
      </div>

      {filteredBrands.length === 0 && (
        <div className="text-center py-8 apple-text-footnote apple-label-tertiary">
          No se encontraron marcas
        </div>
      )}
    </div>
  );
}
