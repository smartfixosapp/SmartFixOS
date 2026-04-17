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

  if (loading) return <div className="apple-type apple-label-tertiary apple-text-body">Cargando catálogos...</div>;

  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="apple-text-title3 apple-label-primary flex items-center gap-2">
                <Archive className="w-5 h-5 text-apple-red" />
                Gestión de Catálogos
              </CardTitle>
              <CardDescription className="apple-text-subheadline apple-label-secondary">Administrar categorías, marcas y modelos</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={exportCatalog}
                className="apple-btn apple-btn-secondary apple-press"
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
              <Label className="apple-label-primary apple-text-headline tabular-nums">Categorías ({categories.length})</Label>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setShowCategoryDialog(true);
                }}
                className="apple-btn apple-btn-primary apple-press"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nueva
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <Card key={cat.id} className="apple-surface-elevated border-0">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.icon || "📱"}</span>
                      <span className="apple-label-primary apple-text-subheadline">{cat.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 apple-press"
                        aria-label={`Editar categoría ${cat.name}`}
                        onClick={() => {
                          setEditingItem(cat);
                          setShowCategoryDialog(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4 apple-label-tertiary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 apple-press"
                        aria-label={`Eliminar categoría ${cat.name}`}
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        <Trash2 className="w-4 h-4 text-apple-red" />
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
              <Label className="apple-label-primary apple-text-headline tabular-nums">Marcas ({brands.length})</Label>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setShowBrandDialog(true);
                }}
                className="apple-btn apple-btn-primary apple-press"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nueva
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {brands.map((brand) => (
                <Card key={brand.id} className="apple-surface-elevated border-0">
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="apple-label-primary apple-text-subheadline">{brand.name}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 apple-press"
                        aria-label={`Editar marca ${brand.name}`}
                        onClick={() => {
                          setEditingItem(brand);
                          setShowBrandDialog(true);
                        }}
                      >
                        <Edit2 className="w-3 h-3 apple-label-tertiary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 apple-press"
                        aria-label={`Eliminar marca ${brand.name}`}
                        onClick={() => handleDeleteBrand(brand.id)}
                      >
                        <Trash2 className="w-3 h-3 text-apple-red" />
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
              <Label className="apple-label-primary apple-text-headline tabular-nums">Modelos ({models.length})</Label>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setShowModelDialog(true);
                }}
                className="apple-btn apple-btn-primary apple-press"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nuevo
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between apple-surface-elevated p-3 rounded-apple-md">
                  <div>
                    <p className="apple-label-primary apple-text-subheadline">{model.name}</p>
                    <p className="apple-text-caption1 apple-label-tertiary">{brands.find(b => b.id === model.brand_id)?.name || "Sin marca"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 apple-press"
                      aria-label={`Editar modelo ${model.name}`}
                      onClick={() => {
                        setEditingItem(model);
                        setShowModelDialog(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4 apple-label-tertiary" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 apple-press"
                      aria-label={`Eliminar modelo ${model.name}`}
                      onClick={() => handleDeleteModel(model.id)}
                    >
                      <Trash2 className="w-4 h-4 text-apple-red" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-apple-orange/12 rounded-apple-md">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-apple-orange flex-shrink-0" />
              <div className="apple-text-subheadline text-apple-orange">
                <p className="apple-text-headline mb-1">Gestión Avanzada</p>
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
