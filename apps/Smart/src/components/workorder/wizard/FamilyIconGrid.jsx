import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search, Smartphone } from "lucide-react";

export default function FamilyIconGrid({ formData, updateFormData, onAutoAdvance }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectedBrand = formData.device_brand;
  const selectedCategory = formData.device_category;

  useEffect(() => {
    console.log("[FamilyIconGrid] useEffect triggered - selectedBrand:", selectedBrand);
    if (!selectedBrand) {
      setFamilies([]);
      setLoading(false);
      return;
    }
    loadFamilies();
  }, [selectedBrand, selectedCategory]);

  const loadFamilies = async () => {
    setLoading(true);
    try {
      console.log("[FamilyIconGrid] Cargando modelos para marca:", selectedBrand);
      
      // Si selectedBrand es un objeto con ID
      if (selectedBrand?.id) {
        const data = await base44.entities.DeviceFamily.filter({
          brand_id: selectedBrand.id,
          active: true
        });
        
        console.log("[FamilyIconGrid] Modelos encontrados:", data?.length || 0);

        const mapped = (Array.isArray(data) ? data : []).map(f => ({
          id: f.id,
          name: f.name,
          label: f.name,
          icon_url: f.icon_url,
          active: f.active
        }));

        mapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));
        setFamilies(mapped);
        return;
      }
      
      // Si selectedBrand es un string (nombre), buscar por nombre
      if (typeof selectedBrand === 'string' && selectedBrand.trim()) {
        const brandName = selectedBrand.trim();
        console.log("[FamilyIconGrid] Buscando marca por nombre:", brandName);
        
        const brands = await base44.entities.Brand.filter({ name: brandName });
        if (brands?.length) {
          const brandId = brands[0].id;
          console.log("[FamilyIconGrid] Marca encontrada, ID:", brandId);
          
          const data = await base44.entities.DeviceFamily.filter({
            brand_id: brandId,
            active: true
          });
          
          console.log("[FamilyIconGrid] Modelos encontrados:", data?.length || 0);

          const mapped = (Array.isArray(data) ? data : []).map(f => ({
            id: f.id,
            name: f.name,
            label: f.name,
            icon_url: f.icon_url,
            active: f.active
          }));

          mapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));
          setFamilies(mapped);
        } else {
          console.log("[FamilyIconGrid] No se encontró la marca");
          setFamilies([]);
        }
      } else {
        console.log("[FamilyIconGrid] selectedBrand inválido");
        setFamilies([]);
      }
    } catch (e) {
      console.error("[FamilyIconGrid] Error loading families:", e);
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredFamilies = useMemo(() => {
    if (!searchTerm.trim()) return families;
    const q = searchTerm.toLowerCase();
    return families.filter(f => (f.name || "").toLowerCase().includes(q));
  }, [families, searchTerm]);

  const handleSelect = (family) => {
    updateFormData("device_family", family);
    updateFormData("device_model", family.name); // El modelo ES la familia

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

  if (families.length === 0 && !loading) {
    return (
      <div className="apple-surface apple-type text-center py-12 space-y-4">
        <p className="apple-text-callout apple-label-secondary mb-1">
          No hay modelos para {selectedBrand.name}
        </p>
        <p className="apple-text-caption1 apple-label-tertiary mb-4">
          Configura modelos en Settings → Catálogo de Dispositivos
        </p>

        {/* Input manual para agregar modelo nuevo */}
        <div className="max-w-md mx-auto">
          <p className="apple-text-caption1 apple-label-secondary mb-2">O escribe un modelo nuevo:</p>
          <Input
            type="text"
            placeholder="Ej: MacBook Pro, iPhone 12, Galaxy S23..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                updateFormData("device_family", { name: e.target.value.trim() });
                updateFormData("device_model", e.target.value.trim());
                if (onAutoAdvance) {
                  setTimeout(() => onAutoAdvance(), 200);
                }
              }
            }}
            className="w-full h-12 px-4 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 border-0 apple-label-primary"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="apple-surface apple-type space-y-4">
      <div>
        <h3 className="apple-text-title3 apple-label-primary mb-1">Modelo</h3>
        <p className="apple-text-footnote apple-label-secondary">
          {selectedCategory?.name} → {selectedBrand?.name}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 apple-label-tertiary w-5 h-5 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar modelo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 px-4 pl-10 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 border-0 apple-label-primary"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filteredFamilies.map((family) => {
          const isSelected = formData?.device_family?.id === family.id;
          return (
            <button
              key={family.id}
              onClick={() => handleSelect(family)}
              className={`
                apple-press rounded-apple-md flex flex-col items-center gap-2 p-4 min-h-[120px]
                ${isSelected
                  ? "bg-apple-blue/12 ring-2 ring-apple-blue/70"
                  : "bg-gray-sys6 dark:bg-gray-sys5"}
              `}
            >
              {family.icon_url ? (
                <img
                  src={family.icon_url}
                  alt={family.name}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <div className={`w-12 h-12 rounded-apple-sm grid place-items-center ${isSelected ? "bg-apple-blue/12" : "bg-gray-sys5 dark:bg-gray-sys4"}`}>
                  <Smartphone className={`w-6 h-6 ${isSelected ? "text-apple-blue" : "apple-label-secondary"}`} />
                </div>
              )}
              <span className="apple-text-footnote apple-label-primary text-center line-clamp-2">{family.name}</span>
            </button>
          );
        })}
      </div>

      {filteredFamilies.length === 0 && (
        <div className="text-center py-8 apple-text-footnote apple-label-tertiary">
          No se encontraron modelos
        </div>
      )}

      {/* Input manual para agregar modelo nuevo */}
      <div className="mt-4 pt-4 border-t border-gray-sys5 dark:border-gray-sys4">
        <p className="apple-text-caption1 apple-label-secondary mb-2">O escribe un modelo nuevo:</p>
        <Input
          type="text"
          placeholder="Ej: MacBook Pro, iPhone 12, Galaxy S23..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.value.trim()) {
              updateFormData("device_family", { name: e.target.value.trim() });
              updateFormData("device_model", e.target.value.trim());
              if (onAutoAdvance) {
                setTimeout(() => onAutoAdvance(), 200);
              }
            }
          }}
          className="w-full h-12 px-4 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 border-0 apple-label-primary"
        />
      </div>
    </div>
  );
}
