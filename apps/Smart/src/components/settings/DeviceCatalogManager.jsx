import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronDown, Laptop, Plus, Smartphone, Trash2, Wrench } from "lucide-react";

const normalized = (value) => String(value || "").trim().toLowerCase();

function inferFamilyName(brandName, modelName, currentFamilyName = "") {
  const brand = normalized(brandName);
  const model = String(modelName || "").trim();
  const lowerModel = normalized(model);

  if (!model) {
    return currentFamilyName || "";
  }

  if (brand.includes("apple")) {
    if (/^iphone .*pro max/i.test(model)) return "iPhone Pro Max";
    if (/^iphone .*pro/i.test(model)) return "iPhone Pro";
    if (/^iphone .*plus/i.test(model)) return "iPhone Plus";
    if (/^iphone .*mini/i.test(model)) return "iPhone Mini";
    if (/^iphone /i.test(model)) return "iPhone";
    if (/^ipad .*pro/i.test(model)) return "iPad Pro";
    if (/^ipad .*air/i.test(model)) return "iPad Air";
    if (/^ipad .*mini/i.test(model)) return "iPad Mini";
    if (/^ipad /i.test(model)) return "iPad";
    if (/^macbook .*pro/i.test(model)) return "MacBook Pro";
    if (/^macbook .*air/i.test(model)) return "MacBook Air";
    if (/^macbook /i.test(model)) return "MacBook";
    if (/^watch .*ultra/i.test(model)) return "Apple Watch Ultra";
    if (/^watch /i.test(model)) return "Apple Watch";
  }

  if (brand.includes("samsung")) {
    if (/galaxy z flip/i.test(model)) return "Galaxy Z Flip";
    if (/galaxy z fold/i.test(model)) return "Galaxy Z Fold";
    if (/galaxy note/i.test(model)) return "Galaxy Note";
    if (/galaxy tab/i.test(model)) return "Galaxy Tab";
    if (/galaxy s/i.test(model)) return "Galaxy S";
    if (/galaxy a/i.test(model)) return "Galaxy A";
    if (/galaxy /i.test(model)) return "Galaxy";
  }

  if (brand.includes("google") && /pixel/i.test(model)) {
    return "Pixel";
  }

  if (brand.includes("xiaomi")) {
    if (/redmi note/i.test(model)) return "Redmi Note";
    if (/redmi /i.test(model)) return "Redmi";
    if (/poco /i.test(model)) return "POCO";
  }

  if (brand.includes("motorola")) {
    if (/moto g/i.test(model)) return "Moto G";
    if (/moto e/i.test(model)) return "Moto E";
    if (/moto edge/i.test(model)) return "Moto Edge";
    if (/razr/i.test(model)) return "Razr";
  }

  if (brand.includes("huawei")) {
    if (/matepad/i.test(model)) return "MatePad";
    if (/matebook/i.test(model)) return "MateBook";
    if (/pura/i.test(model)) return "Pura";
    if (/nova/i.test(model)) return "Nova";
    if (/mate/i.test(model)) return "Mate";
    if (/p /i.test(`${model} `)) return "P Series";
  }

  if (currentFamilyName) {
    return currentFamilyName;
  }

  if (lowerModel.includes("pro max")) return "Pro Max";
  if (lowerModel.includes("pro")) return "Pro";
  if (lowerModel.includes("plus")) return "Plus";
  if (lowerModel.includes("mini")) return "Mini";

  const tokens = model.split(/\s+/).filter(Boolean);
  return tokens.slice(0, Math.min(2, tokens.length)).join(" ");
}

export default function DeviceCatalogManager() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [normalizing, setNormalizing] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState(null);

  const [newItemName, setNewItemName] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, brds, fams, mods] = await Promise.all([
        base44.entities.DeviceCategory.filter({}, "order"),
        base44.entities.Brand.filter({}, "order"),
        base44.entities.DeviceFamily.filter({}, "order"),
        base44.entities.DeviceModel.filter({}, "order"),
      ]);

      setCategories(cats || []);
      setBrands(brds || []);
      setFamilies(fams || []);
      setModels(mods || []);
    } catch (error) {
      console.error("[DeviceCatalogManager] Error cargando catálogo:", error);
      toast.error("Error cargando catálogo");
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryBrands = useMemo(
    () => (selectedCategory ? brands.filter((brand) => brand.category_id === selectedCategory.id) : []),
    [brands, selectedCategory]
  );

  const selectedBrandFamilies = useMemo(
    () => (selectedBrand ? families.filter((family) => family.brand_id === selectedBrand.id) : []),
    [families, selectedBrand]
  );

  const selectedFamilyModels = useMemo(
    () => (
      selectedFamily
        ? models.filter(
            (model) =>
              model.family_id === selectedFamily.id ||
              normalized(model.family) === normalized(selectedFamily.name)
          )
        : []
    ),
    [models, selectedFamily]
  );

  const createCategory = async () => {
    const name = newItemName.trim();
    if (!name || creating) return;
    if (categories.some((category) => normalized(category.name) === normalized(name))) {
      toast.warning("Esa categoría ya existe");
      return;
    }

    setCreating(true);
    try {
      await base44.entities.DeviceCategory.create({
        name,
        active: true,
        order: categories.length + 1,
      });
      toast.success("Categoría creada");
      setNewItemName("");
      await loadAll();
    } catch (error) {
      console.error("[DeviceCatalogManager] Error creando categoría:", error);
      toast.error("No se pudo crear la categoría");
    } finally {
      setCreating(false);
    }
  };

  const createBrand = async () => {
    const name = newItemName.trim();
    if (!name || !selectedCategory || creating) {
      toast.error("Selecciona una categoría primero");
      return;
    }
    if (
      selectedCategoryBrands.some((brand) => normalized(brand.name) === normalized(name))
    ) {
      toast.warning("Esa marca ya existe en esta categoría");
      return;
    }

    setCreating(true);
    try {
      await base44.entities.Brand.create({
        name,
        category_id: selectedCategory.id,
        active: true,
        order: selectedCategoryBrands.length + 1,
      });
      toast.success("Marca creada");
      setNewItemName("");
      await loadAll();
    } catch (error) {
      console.error("[DeviceCatalogManager] Error creando marca:", error);
      toast.error("No se pudo crear la marca");
    } finally {
      setCreating(false);
    }
  };

  const createFamily = async () => {
    const name = newItemName.trim();
    if (!name || !selectedBrand || creating) {
      toast.error("Selecciona una marca primero");
      return;
    }
    if (
      selectedBrandFamilies.some((family) => normalized(family.name) === normalized(name))
    ) {
      toast.warning("Esa familia ya existe en esta marca");
      return;
    }

    setCreating(true);
    try {
      await base44.entities.DeviceFamily.create({
        name,
        brand_id: selectedBrand.id,
        active: true,
        order: selectedBrandFamilies.length + 1,
      });
      toast.success("Familia creada");
      setNewItemName("");
      await loadAll();
    } catch (error) {
      console.error("[DeviceCatalogManager] Error creando familia:", error);
      toast.error("No se pudo crear la familia");
    } finally {
      setCreating(false);
    }
  };

  const createModel = async () => {
    const name = newItemName.trim();
    if (!name || !selectedBrand || !selectedFamily || creating) {
      toast.error("Selecciona una familia primero");
      return;
    }
    if (
      selectedFamilyModels.some((model) => normalized(model.name) === normalized(name))
    ) {
      toast.warning("Ese modelo ya existe en esta familia");
      return;
    }

    setCreating(true);
    try {
      await base44.entities.DeviceModel.create({
        name,
        brand_id: selectedBrand.id,
        brand: selectedBrand.name,
        category_id: selectedCategory?.id,
        family_id: selectedFamily.id,
        family: selectedFamily.name,
        active: true,
        order: selectedFamilyModels.length + 1,
      });
      toast.success("Modelo creado");
      setNewItemName("");
      await loadAll();
    } catch (error) {
      console.error("[DeviceCatalogManager] Error creando modelo:", error);
      toast.error("No se pudo crear el modelo");
    } finally {
      setCreating(false);
    }
  };

  const deleteEntity = async (entityName, id, label) => {
    if (!window.confirm(`¿Eliminar ${label}?`)) return;

    try {
      await base44.entities[entityName].delete(id);
      toast.success("Eliminado");

      if (entityName === "DeviceCategory" && selectedCategory?.id === id) {
        setSelectedCategory(null);
        setSelectedBrand(null);
        setSelectedFamily(null);
      }
      if (entityName === "Brand" && selectedBrand?.id === id) {
        setSelectedBrand(null);
        setSelectedFamily(null);
      }
      if (entityName === "DeviceFamily" && selectedFamily?.id === id) {
        setSelectedFamily(null);
      }

      await loadAll();
    } catch (error) {
      console.error(`[DeviceCatalogManager] Error eliminando ${entityName}:`, error);
      toast.error("No se pudo eliminar");
    }
  };

  const normalizeFamilies = async () => {
    if (normalizing) return;
    setNormalizing(true);

    try {
      const familyIndex = new Map();
      families.forEach((family) => {
        familyIndex.set(`${family.brand_id}::${normalized(family.name)}`, family);
      });

      const familyCounts = new Map();
      families.forEach((family) => {
        const current = familyCounts.get(family.brand_id) || 0;
        familyCounts.set(family.brand_id, Math.max(current, Number(family.order) || current));
      });

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const model of models) {
        const brand = brands.find((item) => item.id === model.brand_id);
        if (!brand) {
          skippedCount += 1;
          continue;
        }

        const currentFamily = families.find((item) => item.id === model.family_id);
        const inferredFamilyName = inferFamilyName(brand.name, model.name, currentFamily?.name || model.family);

        if (!inferredFamilyName) {
          skippedCount += 1;
          continue;
        }

        const key = `${brand.id}::${normalized(inferredFamilyName)}`;
        let targetFamily = familyIndex.get(key);

        if (!targetFamily) {
          const nextOrder = (familyCounts.get(brand.id) || 0) + 1;
          targetFamily = await base44.entities.DeviceFamily.create({
            name: inferredFamilyName,
            brand_id: brand.id,
            active: true,
            order: nextOrder,
          });
          familyCounts.set(brand.id, nextOrder);
          familyIndex.set(key, targetFamily);
          createdCount += 1;
        }

        const sameFamily =
          model.family_id === targetFamily.id &&
          normalized(model.family || targetFamily.name) === normalized(targetFamily.name);

        if (sameFamily) {
          skippedCount += 1;
          continue;
        }

        await base44.entities.DeviceModel.update(model.id, {
          family_id: targetFamily.id,
          family: targetFamily.name,
        });
        updatedCount += 1;
      }

      await loadAll();
      toast.success(
        `Familias normalizadas: ${updatedCount} modelos movidos, ${createdCount} familias nuevas`
      );
      if (!updatedCount && !createdCount) {
        toast.info(`Sin cambios. ${skippedCount} modelos ya estaban organizados.`);
      }
    } catch (error) {
      console.error("[DeviceCatalogManager] Error normalizando familias:", error);
      toast.error("No se pudo normalizar el catálogo");
    } finally {
      setNormalizing(false);
    }
  };

  const creatorTitle = !selectedCategory
    ? "Nueva categoría"
    : !selectedBrand
      ? `Nueva marca para ${selectedCategory.name}`
      : !selectedFamily
        ? `Nueva familia para ${selectedBrand.name}`
        : `Nuevo modelo para ${selectedFamily.name}`;

  const creatorPlaceholder = !selectedCategory
    ? "Ej: Smartphones, Tablets..."
    : !selectedBrand
      ? "Ej: Apple, Samsung..."
      : !selectedFamily
        ? "Ej: iPhone Pro, Galaxy S, iPad Air..."
        : "Ej: iPhone 16 Pro, Galaxy S24 Ultra...";

  const creatorAction = !selectedCategory
    ? createCategory
    : !selectedBrand
      ? createBrand
      : !selectedFamily
        ? createFamily
        : createModel;

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
      <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-white theme-light:border-gray-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedBrand(null);
                setSelectedFamily(null);
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
                    setSelectedFamily(null);
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
                <button
                  onClick={() => {
                    setSelectedFamily(null);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  {selectedBrand.name}
                </button>
              </>
            )}
            {selectedFamily && (
              <>
                <ChevronDown className="w-4 h-4 text-gray-500 rotate-[-90deg]" />
                <span className="text-white font-medium theme-light:text-gray-900">
                  {selectedFamily.name}
                </span>
              </>
            )}
          </div>

          <Button
            onClick={normalizeFamilies}
            disabled={normalizing || !models.length}
            variant="outline"
            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
          >
            <Wrench className="w-4 h-4 mr-2" />
            {normalizing ? "Normalizando..." : "Normalizar familias"}
          </Button>
        </div>
      </div>

      <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
          <Plus className="w-5 h-5 text-cyan-400" />
          {creatorTitle}
        </h3>

        <div className="flex gap-2">
          <Input
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && creatorAction()}
            placeholder={creatorPlaceholder}
            className="flex-1 bg-black/30 border-white/10 text-white theme-light:bg-white theme-light:border-gray-300"
          />
          <Button onClick={creatorAction} className="bg-gradient-to-r from-cyan-600 to-emerald-600">
            <Plus className="w-4 h-4 mr-2" />
            Crear
          </Button>
        </div>
      </Card>

      {!selectedCategory && (
        <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            Tipos de dispositivo
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((category) => {
              const categoryBrands = brands.filter((brand) => brand.category_id === category.id);
              return (
                <div key={category.id} className="relative group">
                  <button
                    onClick={() => setSelectedCategory(category)}
                    className="w-full bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border border-cyan-500/20 rounded-xl p-4 hover:from-cyan-600/20 hover:to-emerald-600/20 transition-all text-left theme-light:bg-cyan-50 theme-light:border-cyan-300"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-bold theme-light:text-gray-900">{category.name}</span>
                      <Badge className="bg-cyan-600/20 text-cyan-300 text-xs">{categoryBrands.length}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 theme-light:text-gray-600">
                      {categoryBrands.length} marcas
                    </p>
                  </button>
                  <button
                    onClick={() => deleteEntity("DeviceCategory", category.id, `la categoría ${category.name}`)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 rounded-lg p-1.5"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {selectedCategory && !selectedBrand && (
        <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            Marcas de {selectedCategory.name}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {selectedCategoryBrands.map((brand) => {
              const brandFamilies = families.filter((family) => family.brand_id === brand.id);
              const brandModels = models.filter((model) => model.brand_id === brand.id);
              return (
                <div key={brand.id} className="relative group">
                  <button
                    onClick={() => setSelectedBrand(brand)}
                    className="w-full bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-xl p-4 hover:from-purple-600/20 hover:to-pink-600/20 transition-all text-left theme-light:bg-purple-50 theme-light:border-purple-300"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-bold theme-light:text-gray-900">{brand.name}</span>
                      <Badge className="bg-purple-600/20 text-purple-300 text-xs">{brandFamilies.length}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 theme-light:text-gray-600">
                      {brandFamilies.length} familias · {brandModels.length} modelos
                    </p>
                  </button>
                  <button
                    onClick={() => deleteEntity("Brand", brand.id, `la marca ${brand.name}`)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 rounded-lg p-1.5"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {selectedBrand && !selectedFamily && (
        <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Laptop className="w-5 h-5 text-cyan-400" />
            Familias de {selectedBrand.name}
          </h3>
          <p className="text-xs text-gray-400 mb-4 theme-light:text-gray-600">
            Organiza primero la lÍnea del equipo. Ejemplos: iPhone Pro, iPhone Pro Max, Galaxy S, iPad Air.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {selectedBrandFamilies.map((family) => {
              const familyModels = models.filter(
                (model) =>
                  model.family_id === family.id ||
                  normalized(model.family) === normalized(family.name)
              );
              return (
                <div key={family.id} className="relative group">
                  <button
                    onClick={() => setSelectedFamily(family)}
                    className="w-full bg-gradient-to-br from-emerald-600/10 to-green-600/10 border border-emerald-500/20 rounded-xl p-4 hover:from-emerald-600/20 hover:to-green-600/20 transition-all text-left theme-light:bg-emerald-50 theme-light:border-emerald-300"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-bold theme-light:text-gray-900">{family.name}</span>
                      <Badge className="bg-emerald-600/20 text-emerald-300 text-xs">{familyModels.length}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 theme-light:text-gray-600">
                      {familyModels.length} modelos
                    </p>
                  </button>
                  <button
                    onClick={() => deleteEntity("DeviceFamily", family.id, `la familia ${family.name}`)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 rounded-lg p-1.5"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {selectedFamily && (
        <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Laptop className="w-5 h-5 text-cyan-400" />
            Modelos de {selectedFamily.name}
          </h3>
          <p className="text-xs text-gray-400 mb-4 theme-light:text-gray-600">
            Aquí van solo los modelos específicos. Ejemplos: iPhone 15 Pro, iPhone 16 Pro, iPhone 17 Pro.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {selectedFamilyModels.map((model) => (
              <div key={model.id} className="relative group">
                <div className="w-full bg-gradient-to-br from-cyan-600/10 to-blue-600/10 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-cyan-50 theme-light:border-cyan-300">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold theme-light:text-gray-900">{model.name}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteEntity("DeviceModel", model.id, `el modelo ${model.name}`)}
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
