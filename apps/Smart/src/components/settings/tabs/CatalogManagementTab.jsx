import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Edit2, Trash2, Archive, Upload, Download,
  Smartphone, Laptop, Tablet, Watch, AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function CatalogManagementTab({ user }) {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, brds, mdls] = await Promise.all([
        base44.entities.DeviceCategory.filter({ active: true }),
        base44.entities.Brand.list("-created_date", 100),
        base44.entities.DeviceModel.list("-created_date", 100)
      ]);
      setCategories(cats || []);
      setBrands(brds || []);
      setModels(mdls || []);
    } catch (e) {
      console.error("Error loading catalogs:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await base44.entities.DeviceCategory.update(id, { active: false });
      await base44.entities.AuditLog.create({
        action: "catalog_delete_category",
        entity_type: "catalog",
        entity_id: id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role
      });
      loadData();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handleDeleteBrand = async (id) => {
    if (!confirm("¿Eliminar esta marca?")) return;
    try {
      await base44.entities.Brand.update(id, { active: false });
      await base44.entities.AuditLog.create({
        action: "catalog_delete_brand",
        entity_type: "catalog",
        entity_id: id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role
      });
      loadData();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handleDeleteModel = async (id) => {
    if (!confirm("¿Eliminar este modelo?")) return;
    try {
      await base44.entities.DeviceModel.update(id, { active: false });
      await base44.entities.AuditLog.create({
        action: "catalog_delete_model",
        entity_type: "catalog",
        entity_id: id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role
      });
      loadData();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const exportCatalog = async () => {
    try {
      const data = {
        categories: await base44.entities.DeviceCategory.list(),
        brands: await base44.entities.Brand.list(),
        models: await base44.entities.DeviceModel.list(),
        subcategories: await base44.entities.DeviceSubcategory.list(),
        families: await base44.entities.DeviceFamily.list()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalog-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error al exportar: " + e.message);
    }
  };

  if (loading) return <div className="text-gray-400">Cargando catálogos...</div>;

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Archive className="w-5 h-5 text-red-500" />
                Gestión de Catálogos
              </CardTitle>
              <CardDescription>Administrar categorías, marcas y modelos</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={exportCatalog}
                className="border-gray-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Categorías */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-gray-300 text-lg">Categorías ({categories.length})</Label>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setShowCategoryDialog(true);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nueva
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <Card key={cat.id} className="bg-black/30 border-white/10">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.icon || "📱"}</span>
                      <span className="text-white font-medium">{cat.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingItem(cat);
                          setShowCategoryDialog(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Marcas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-gray-300 text-lg">Marcas ({brands.length})</Label>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setShowBrandDialog(true);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nueva
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {brands.map((brand) => (
                <Card key={brand.id} className="bg-black/30 border-white/10">
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-white text-sm">{brand.name}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingItem(brand);
                          setShowBrandDialog(true);
                        }}
                      >
                        <Edit2 className="w-3 h-3 text-gray-400" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleDeleteBrand(brand.id)}
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Modelos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-gray-300 text-lg">Modelos ({models.length})</Label>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setShowModelDialog(true);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nuevo
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-white/10">
                  <div>
                    <p className="text-white font-medium">{model.name}</p>
                    <p className="text-xs text-gray-400">{brands.find(b => b.id === model.brand_id)?.name || "Sin marca"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingItem(model);
                        setShowModelDialog(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleDeleteModel(model.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div className="text-sm text-amber-200">
                <p className="font-semibold mb-1">Gestión Avanzada</p>
                <p>Para gestión completa de catálogos, subcategorías y familias, visita la página de Inventory.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs simplificados - pueden expandirse según necesidad */}
    </div>
  );
}
