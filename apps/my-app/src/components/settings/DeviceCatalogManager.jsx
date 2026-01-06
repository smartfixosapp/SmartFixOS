import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, Save, X, Smartphone, Laptop, Tablet,
  Watch, Monitor, Headphones, ChevronDown, ChevronUp, Search
} from "lucide-react";

export default function DeviceCatalogManager() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  
  const [editingItem, setEditingItem] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, brds, fams] = await Promise.all([
        base44.entities.DeviceCategory.filter({}, "order"),
        base44.entities.Brand.filter({}, "order"),
        base44.entities.DeviceFamily.filter({}, "order")
      ]);
      setCategories(cats || []);
      setBrands(brds || []);
      setFamilies(fams || []);
    } catch (error) {
      toast.error("Error cargando catálogo");
    } finally {
      setLoading(false);
    }
  };

  // CRUD para Categorías
  const createCategory = async () => {
    if (!newItemName.trim()) return;
    try {
      await base44.entities.DeviceCategory.create({
        name: newItemName.trim(),
        active: true,
        order: categories.length + 1
      });
      toast.success("✅ Categoría creada");
      setNewItemName("");
      loadAll();
    } catch (error) {
      toast.error("Error al crear");
    }
  };

  const updateCategory = async (id, data) => {
    try {
      await base44.entities.DeviceCategory.update(id, data);
      toast.success("✅ Actualizado");
      loadAll();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const deleteCategory = async (id) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await base44.entities.DeviceCategory.delete(id);
      toast.success("✅ Eliminado");
      loadAll();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  // CRUD para Marcas
  const createBrand = async () => {
    if (!newItemName.trim() || !selectedCategory) {
      toast.error("Selecciona una categoría primero");
      return;
    }
    try {
      await base44.entities.Brand.create({
        name: newItemName.trim(),
        category_id: selectedCategory.id,
        active: true,
        order: brands.filter(b => b.category_id === selectedCategory.id).length + 1
      });
      toast.success("✅ Marca creada");
      setNewItemName("");
      loadAll();
    } catch (error) {
      toast.error("Error al crear");
    }
  };

  const updateBrand = async (id, data) => {
    try {
      await base44.entities.Brand.update(id, data);
      toast.success("✅ Actualizado");
      loadAll();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const deleteBrand = async (id) => {
    if (!confirm("¿Eliminar esta marca?")) return;
    try {
      await base44.entities.Brand.delete(id);
      toast.success("✅ Eliminado");
      loadAll();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  // CRUD para Modelos (Familias)
  const createFamily = async () => {
    if (!newItemName.trim() || !selectedBrand) {
      toast.error("Selecciona una marca primero");
      return;
    }
    try {
      console.log("[DeviceCatalogManager] Creando modelo:", {
        name: newItemName.trim(),
        brand_id: selectedBrand.id
      });
      await base44.entities.DeviceFamily.create({
        name: newItemName.trim(),
        brand_id: selectedBrand.id,
        active: true,
        order: families.filter(f => f.brand_id === selectedBrand.id).length + 1
      });
      toast.success("✅ Modelo creado");
      setNewItemName("");
      loadAll();
    } catch (error) {
      console.error("[DeviceCatalogManager] Error al crear modelo:", error);
      toast.error("Error al crear: " + (error.message || "Intenta de nuevo"));
    }
  };

  const updateFamily = async (id, data) => {
    try {
      await base44.entities.DeviceFamily.update(id, data);
      toast.success("✅ Actualizado");
      loadAll();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const deleteFamily = async (id) => {
    if (!confirm("¿Eliminar este modelo?")) return;
    try {
      await base44.entities.DeviceFamily.delete(id);
      toast.success("✅ Eliminado");
      loadAll();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  // Filtrar datos según selección
  const filteredBrands = selectedCategory 
    ? brands.filter(b => b.category_id === selectedCategory.id)
    : [];

  const filteredFamilies = selectedBrand
    ? families.filter(f => f.brand_id === selectedBrand.id)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb de navegación */}
      <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-white theme-light:border-gray-200">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedBrand(null);
            }}
            className="text-cyan-400 hover:text-cyan-300 font-medium"
          >
            Tipo de dispositivo
          </button>
          {selectedCategory && (
            <>
              <ChevronDown className="w-4 h-4 text-gray-500 rotate-[-90deg]" />
              <button
                onClick={() => {
                  setSelectedBrand(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-medium"
              >
                {selectedCategory.name}
              </button>
            </>
          )}
          {selectedBrand && (
            <>
              <ChevronDown className="w-4 h-4 text-gray-500 rotate-[-90deg]" />
              <span className="text-white font-medium theme-light:text-gray-900">
                {selectedBrand.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Vista de Categorías */}
      {!selectedCategory && (
        <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            Tipos de Dispositivo
          </h3>
          
          <div className="flex gap-2 mb-4">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
              placeholder="Ej: Laptops, Smartphones..."
              className="flex-1 bg-black/30 border-white/10 text-white theme-light:bg-white theme-light:border-gray-300"
            />
            <Button onClick={createCategory} className="bg-gradient-to-r from-cyan-600 to-emerald-600">
              <Plus className="w-4 h-4 mr-2" />
              Crear
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat) => (
              <div key={cat.id} className="relative group">
                <button
                  onClick={() => setSelectedCategory(cat)}
                  className="w-full bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border border-cyan-500/20 rounded-xl p-4 hover:from-cyan-600/20 hover:to-emerald-600/20 transition-all text-left theme-light:bg-cyan-50 theme-light:border-cyan-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold theme-light:text-gray-900">{cat.name}</span>
                    <Badge className="bg-cyan-600/20 text-cyan-300 text-xs">
                      {brands.filter(b => b.category_id === cat.id).length}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 theme-light:text-gray-600">
                    {brands.filter(b => b.category_id === cat.id).length} marcas
                  </p>
                </button>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 rounded-lg p-1.5"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Vista de Marcas */}
      {selectedCategory && !selectedBrand && (
        <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            Marcas de {selectedCategory.name}
          </h3>
          
          <div className="flex gap-2 mb-4">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createBrand()}
              placeholder="Ej: Apple, Samsung..."
              className="flex-1 bg-black/30 border-white/10 text-white theme-light:bg-white theme-light:border-gray-300"
            />
            <Button onClick={createBrand} className="bg-gradient-to-r from-cyan-600 to-emerald-600">
              <Plus className="w-4 h-4 mr-2" />
              Crear
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredBrands.map((brand) => (
              <div key={brand.id} className="relative group">
                <button
                  onClick={() => setSelectedBrand(brand)}
                  className="w-full bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-xl p-4 hover:from-purple-600/20 hover:to-pink-600/20 transition-all text-left theme-light:bg-purple-50 theme-light:border-purple-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold theme-light:text-gray-900">{brand.name}</span>
                    <Badge className="bg-purple-600/20 text-purple-300 text-xs">
                      {families.filter(f => f.brand_id === brand.id).length}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 theme-light:text-gray-600">
                    {families.filter(f => f.brand_id === brand.id).length} modelos
                  </p>
                </button>
                <button
                  onClick={() => deleteBrand(brand.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 rounded-lg p-1.5"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Vista de Modelos (Familias) */}
      {selectedBrand && (
        <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Laptop className="w-5 h-5 text-cyan-400" />
            📦 Modelos de {selectedBrand.name}
          </h3>
          <p className="text-xs text-gray-400 mb-4 theme-light:text-gray-600">
            Los modelos son las variantes específicas de cada marca (Ej: MacBook Pro, iPhone 12, Galaxy S23)
          </p>
          
          <div className="flex gap-2 mb-4">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFamily()}
              placeholder="Ej: MacBook Pro, iPhone 12, Galaxy S23..."
              className="flex-1 bg-black/30 border-white/10 text-white theme-light:bg-white theme-light:border-gray-300"
            />
            <Button onClick={createFamily} className="bg-gradient-to-r from-cyan-600 to-emerald-600">
              <Plus className="w-4 h-4 mr-2" />
              Crear
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredFamilies.map((fam) => (
              <div key={fam.id} className="relative group">
                <div
                  className="w-full bg-gradient-to-br from-emerald-600/10 to-green-600/10 border border-emerald-500/20 rounded-xl p-4 text-left theme-light:bg-emerald-50 theme-light:border-emerald-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold theme-light:text-gray-900">{fam.name}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteFamily(fam.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 rounded-lg p-1.5"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
