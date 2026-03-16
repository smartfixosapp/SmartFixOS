import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { catalogCache } from "@/components/utils/dataCache";
import { toast } from "sonner";
import { ChevronDown, Laptop, Plus, Smartphone, Trash2, Wrench } from "lucide-react";

const normalized = (value) => String(value || "").trim().toLowerCase();
const normalizedNameKey = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const LOCAL_DEVICE_CATALOG_KEY = "smartfix_local_device_catalog";
const DEVICE_CATALOG_UPDATED_EVENT = "smartfix:device-catalog-updated";

function isLocalCatalogId(id) {
  return String(id || "").startsWith("local-device-");
}

function getCatalogOrderValue(item) {
  const value = Number(item?.order);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function isPreferredCatalogEntry(next, current) {
  const nextActive = next?.active !== false;
  const currentActive = current?.active !== false;
  if (nextActive !== currentActive) return nextActive;

  const nextRemote = !isLocalCatalogId(next?.id);
  const currentRemote = !isLocalCatalogId(current?.id);
  if (nextRemote !== currentRemote) return nextRemote;

  const nextOrder = getCatalogOrderValue(next);
  const currentOrder = getCatalogOrderValue(current);
  if (nextOrder !== currentOrder) return nextOrder < currentOrder;

  return String(next?.id || "") < String(current?.id || "");
}

function dedupeCatalogEntries(list = [], keyBuilder = (item) => item?.id) {
  const out = [];
  const keyToIndex = new Map();

  for (const item of list) {
    if (!item) continue;
    const key = keyBuilder(item);
    if (!key) continue;

    const existingIndex = keyToIndex.get(key);
    if (existingIndex === undefined) {
      keyToIndex.set(key, out.length);
      out.push(item);
      continue;
    }

    if (isPreferredCatalogEntry(item, out[existingIndex])) {
      out[existingIndex] = item;
    }
  }

  return out.sort((a, b) => {
    const orderDiff = getCatalogOrderValue(a) - getCatalogOrderValue(b);
    if (orderDiff !== 0) return orderDiff;
    return normalizedNameKey(a?.name).localeCompare(normalizedNameKey(b?.name));
  });
}

function dispatchDeviceCatalogUpdated() {
  window.dispatchEvent(new CustomEvent(DEVICE_CATALOG_UPDATED_EVENT));
}

function normalizeLocalDeviceCatalog(catalog = {}) {
  const input = {
    categories: Array.isArray(catalog?.categories) ? catalog.categories : [],
    brands: Array.isArray(catalog?.brands) ? catalog.brands : [],
    families: Array.isArray(catalog?.families) ? catalog.families : [],
    models: Array.isArray(catalog?.models) ? catalog.models : []
  };

  const categories = [];
  const categoryMap = new Map();
  const categoryIdMap = new Map();
  for (const category of dedupeCatalogEntries(input.categories, (item) => normalizedNameKey(item?.name))) {
    const key = normalizedNameKey(category?.name);
    if (!key) continue;
    const canonical = categoryMap.get(key) || {
      ...category,
      name: String(category?.name || "").trim()
    };
    if (!categoryMap.has(key)) {
      categoryMap.set(key, canonical);
      categories.push(canonical);
    }
    if (category?.id) categoryIdMap.set(category.id, canonical.id);
  }
  categories.forEach((item, index) => {
    item.order = index + 1;
  });

  const brands = [];
  const brandMap = new Map();
  const brandIdMap = new Map();
  for (const brand of dedupeCatalogEntries(input.brands, (item) => {
    const scopedCategoryId = categoryIdMap.get(item?.category_id) || item?.category_id || "";
    return `${scopedCategoryId}::${normalizedNameKey(item?.name)}`;
  })) {
    const canonicalCategoryId = categoryIdMap.get(brand?.category_id) || brand?.category_id || "";
    const key = `${canonicalCategoryId}::${normalizedNameKey(brand?.name)}`;
    if (!normalizedNameKey(brand?.name)) continue;
    const canonical = brandMap.get(key) || {
      ...brand,
      name: String(brand?.name || "").trim(),
      category_id: canonicalCategoryId || null
    };
    if (!brandMap.has(key)) {
      brandMap.set(key, canonical);
      brands.push(canonical);
    }
    if (brand?.id) brandIdMap.set(brand.id, canonical.id);
  }
  brands.forEach((item, index) => {
    item.order = index + 1;
  });

  const families = [];
  const familyMap = new Map();
  const familyIdMap = new Map();
  for (const family of dedupeCatalogEntries(input.families, (item) => {
    const scopedBrandId = brandIdMap.get(item?.brand_id) || item?.brand_id || "";
    return `${scopedBrandId}::${normalizedNameKey(item?.name)}`;
  })) {
    const canonicalBrandId = brandIdMap.get(family?.brand_id) || family?.brand_id || "";
    const key = `${canonicalBrandId}::${normalizedNameKey(family?.name)}`;
    if (!normalizedNameKey(family?.name)) continue;
    const canonical = familyMap.get(key) || {
      ...family,
      name: String(family?.name || "").trim(),
      brand_id: canonicalBrandId || null
    };
    if (!familyMap.has(key)) {
      familyMap.set(key, canonical);
      families.push(canonical);
    }
    if (family?.id) familyIdMap.set(family.id, canonical.id);
  }
  families.forEach((item, index) => {
    item.order = index + 1;
  });

  const familyNameById = new Map(families.map((item) => [item.id, item.name]));
  const models = [];
  const modelMap = new Map();
  for (const model of dedupeCatalogEntries(input.models, (item) => {
    const scopedBrandId = brandIdMap.get(item?.brand_id) || item?.brand_id || "";
    const scopedFamilyId = familyIdMap.get(item?.family_id) || item?.family_id || normalizedNameKey(item?.family);
    return `${scopedBrandId}::${scopedFamilyId}::${normalizedNameKey(item?.name)}`;
  })) {
    const canonicalBrandId = brandIdMap.get(model?.brand_id) || model?.brand_id || "";
    const canonicalFamilyId = familyIdMap.get(model?.family_id) || model?.family_id || null;
    const canonicalFamilyName = canonicalFamilyId
      ? familyNameById.get(canonicalFamilyId) || model?.family || ""
      : model?.family || "";
    const key = `${canonicalBrandId}::${canonicalFamilyId || normalizedNameKey(canonicalFamilyName)}::${normalizedNameKey(model?.name)}`;
    if (!normalizedNameKey(model?.name) || modelMap.has(key)) continue;
    modelMap.set(key, true);
    models.push({
      ...model,
      name: String(model?.name || "").trim(),
      brand_id: canonicalBrandId || null,
      family_id: canonicalFamilyId,
      family: canonicalFamilyName ? String(canonicalFamilyName).trim() : ""
    });
  }
  models.forEach((item, index) => {
    item.order = index + 1;
  });

  return { categories, brands, families, models };
}

function readLocalDeviceCatalog() {
  try {
    const raw = localStorage.getItem(LOCAL_DEVICE_CATALOG_KEY);
    const parsed = raw ? JSON.parse(raw) : { categories: [], brands: [], families: [], models: [] };
    const normalizedCatalog = normalizeLocalDeviceCatalog(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalizedCatalog)) {
      localStorage.setItem(LOCAL_DEVICE_CATALOG_KEY, JSON.stringify(normalizedCatalog));
    }
    return normalizedCatalog;
  } catch {
    return { categories: [], brands: [], families: [], models: [] };
  }
}

function writeLocalDeviceCatalog(catalog) {
  const normalizedCatalog = normalizeLocalDeviceCatalog(catalog);
  localStorage.setItem(LOCAL_DEVICE_CATALOG_KEY, JSON.stringify(normalizedCatalog));
  dispatchDeviceCatalogUpdated();
}

function ensureLocalCategory(catalog, name) {
  let category = catalog.categories.find((item) => normalizedNameKey(item?.name) === normalizedNameKey(name));
  if (!category) {
    category = {
      id: `local-device-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      active: true,
      order: catalog.categories.length + 1
    };
    catalog.categories.unshift(category);
  }
  return category;
}

function ensureLocalBrand(catalog, categoryName, brandName) {
  const category = ensureLocalCategory(catalog, categoryName);
  let brand = catalog.brands.find(
    (item) =>
      item?.category_id === category.id &&
      normalizedNameKey(item?.name) === normalizedNameKey(brandName)
  );
  if (!brand) {
    brand = {
      id: `local-device-brand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: brandName,
      category_id: category.id,
      active: true,
      order: catalog.brands.filter((item) => item?.category_id === category.id).length + 1
    };
    catalog.brands.unshift(brand);
  }
  return { category, brand };
}

function ensureLocalFamily(catalog, categoryName, brandName, familyName) {
  const { category, brand } = ensureLocalBrand(catalog, categoryName, brandName);
  let family = catalog.families.find(
    (item) =>
      item?.brand_id === brand.id &&
      normalizedNameKey(item?.name) === normalizedNameKey(familyName)
  );
  if (!family) {
    family = {
      id: `local-device-family-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: familyName,
      brand_id: brand.id,
      active: true,
      order: catalog.families.filter((item) => item?.brand_id === brand.id).length + 1
    };
    catalog.families.unshift(family);
  }
  return { category, brand, family };
}

function removeLocalCatalogEntry(level, entry, context = {}) {
  const catalog = readLocalDeviceCatalog();
  const nameKey = normalizedNameKey(entry?.name);
  const categoryKey = normalizedNameKey(context?.categoryName);
  const brandKey = normalizedNameKey(context?.brandName);
  const familyKey = normalizedNameKey(context?.familyName);

  if (level === "category") {
    const categoriesToRemove = catalog.categories.filter((item) => normalizedNameKey(item?.name) === nameKey);
    const categoryIds = new Set(categoriesToRemove.map((item) => item.id));
    const brandsToRemove = catalog.brands.filter((item) => categoryIds.has(item?.category_id));
    const brandIds = new Set(brandsToRemove.map((item) => item.id));
    const familiesToRemove = catalog.families.filter((item) => brandIds.has(item?.brand_id));
    const familyIds = new Set(familiesToRemove.map((item) => item.id));
    catalog.categories = catalog.categories.filter((item) => normalizedNameKey(item?.name) !== nameKey);
    catalog.brands = catalog.brands.filter((item) => !categoryIds.has(item?.category_id));
    catalog.families = catalog.families.filter((item) => !brandIds.has(item?.brand_id));
    catalog.models = catalog.models.filter((item) => !brandIds.has(item?.brand_id) && !familyIds.has(item?.family_id));
  } else if (level === "brand") {
    const categoryIds = new Set(
      catalog.categories
        .filter((item) => normalizedNameKey(item?.name) === categoryKey)
        .map((item) => item.id)
    );
    const brandsToRemove = catalog.brands.filter(
      (item) => categoryIds.has(item?.category_id) && normalizedNameKey(item?.name) === nameKey
    );
    const brandIds = new Set(brandsToRemove.map((item) => item.id));
    const familiesToRemove = catalog.families.filter((item) => brandIds.has(item?.brand_id));
    const familyIds = new Set(familiesToRemove.map((item) => item.id));
    catalog.brands = catalog.brands.filter((item) => !brandIds.has(item?.id));
    catalog.families = catalog.families.filter((item) => !brandIds.has(item?.brand_id));
    catalog.models = catalog.models.filter((item) => !brandIds.has(item?.brand_id) && !familyIds.has(item?.family_id));
  } else if (level === "family") {
    const brandIds = new Set(
      catalog.brands
        .filter((item) => normalizedNameKey(item?.name) === brandKey)
        .map((item) => item.id)
    );
    const familiesToRemove = catalog.families.filter(
      (item) => brandIds.has(item?.brand_id) && normalizedNameKey(item?.name) === nameKey
    );
    const familyIds = new Set(familiesToRemove.map((item) => item.id));
    catalog.families = catalog.families.filter((item) => !familyIds.has(item?.id));
    catalog.models = catalog.models.filter((item) => !familyIds.has(item?.family_id) && normalizedNameKey(item?.family) !== nameKey);
  } else if (level === "model") {
    catalog.models = catalog.models.filter(
      (item) =>
        !(
          normalizedNameKey(item?.name) === nameKey &&
          normalizedNameKey(item?.family) === familyKey
        )
    );
  }

  writeLocalDeviceCatalog(catalog);
}

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
    const reloadCatalog = () => loadAll();
    window.addEventListener(DEVICE_CATALOG_UPDATED_EVENT, reloadCatalog);
    window.addEventListener("storage", reloadCatalog);
    return () => {
      window.removeEventListener(DEVICE_CATALOG_UPDATED_EVENT, reloadCatalog);
      window.removeEventListener("storage", reloadCatalog);
    };
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, brds, fams, mods] = await Promise.all([
        base44.entities.DeviceCategory.filter({ active: true }, "order").catch(() => []),
        base44.entities.Brand.filter({ active: true }, "order").catch(() => []),
        base44.entities.DeviceFamily.filter({ active: true }, "order").catch(() => []),
        base44.entities.DeviceModel.filter({ active: true }, "order").catch(() => []),
      ]);
      const localCatalog = readLocalDeviceCatalog();
      const mergedCategories = dedupeCatalogEntries(
        [...(localCatalog.categories || []), ...(cats || [])],
        (item) => normalizedNameKey(item?.name)
      );
      const mergedBrands = dedupeCatalogEntries(
        [...(localCatalog.brands || []), ...(brds || [])],
        (item) => `${normalizedNameKey(item?.category_id || "")}::${normalizedNameKey(item?.name)}::${normalizedNameKey(item?.category || "")}`
      );
      const mergedFamilies = dedupeCatalogEntries(
        [...(localCatalog.families || []), ...(fams || [])],
        (item) => `${normalizedNameKey(item?.brand_id || "")}::${normalizedNameKey(item?.name)}`
      );
      const mergedModels = dedupeCatalogEntries(
        [...(localCatalog.models || []), ...(mods || [])],
        (item) => `${normalizedNameKey(item?.brand_id || "")}::${normalizedNameKey(item?.family_id || item?.family || "")}::${normalizedNameKey(item?.name)}`
      );

      setCategories(mergedCategories);
      setBrands(mergedBrands);
      setFamilies(mergedFamilies);
      setModels(mergedModels);
    } catch (error) {
      console.error("[DeviceCatalogManager] Error cargando catálogo:", error);
      toast.error("Error cargando catálogo");
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryBrands = useMemo(
    () => {
      if (!selectedCategory) return [];
      const selectedCategoryKey = normalizedNameKey(selectedCategory.name);
      const categoryIds = categories
        .filter((category) => normalizedNameKey(category.name) === selectedCategoryKey)
        .map((category) => category.id);
      return dedupeCatalogEntries(
        brands.filter(
          (brand) =>
            categoryIds.includes(brand.category_id) ||
            normalizedNameKey(brand.category) === selectedCategoryKey
        ),
        (item) => `${selectedCategoryKey}::${normalizedNameKey(item?.name)}`
      );
    },
    [brands, categories, selectedCategory]
  );

  const selectedBrandFamilies = useMemo(
    () => {
      if (!selectedBrand || !selectedCategory) return [];
      const selectedBrandKey = normalizedNameKey(selectedBrand.name);
      const brandIds = selectedCategoryBrands
        .filter((brand) => normalizedNameKey(brand.name) === selectedBrandKey)
        .map((brand) => brand.id);
      return dedupeCatalogEntries(
        families.filter((family) => brandIds.includes(family.brand_id)),
        (item) => `${selectedBrandKey}::${normalizedNameKey(item?.name)}`
      );
    },
    [families, selectedBrand, selectedCategory, selectedCategoryBrands]
  );

  const selectedFamilyModels = useMemo(
    () => {
      if (!selectedFamily || !selectedBrand) return [];
      const selectedBrandKey = normalizedNameKey(selectedBrand.name);
      const selectedFamilyKey = normalizedNameKey(selectedFamily.name);
      const brandIds = selectedCategoryBrands
        .filter((brand) => normalizedNameKey(brand.name) === selectedBrandKey)
        .map((brand) => brand.id);
      const familyIds = selectedBrandFamilies
        .filter((family) => normalizedNameKey(family.name) === selectedFamilyKey)
        .map((family) => family.id);
      return dedupeCatalogEntries(
        models.filter(
          (model) =>
            brandIds.includes(model.brand_id) &&
            (familyIds.includes(model.family_id) || normalizedNameKey(model.family) === selectedFamilyKey)
        ),
        (item) => `${selectedFamilyKey}::${normalizedNameKey(item?.name)}`
      );
    },
    [models, selectedBrand, selectedFamily, selectedCategoryBrands, selectedBrandFamilies]
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
      const localCatalog = readLocalDeviceCatalog();
      if (!localCatalog.categories.some((item) => normalizedNameKey(item?.name) === normalizedNameKey(name))) {
        localCatalog.categories.unshift({
          id: `local-device-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          active: true,
          order: localCatalog.categories.length + 1
        });
        writeLocalDeviceCatalog(localCatalog);
      }

      const existingRemote = await base44.entities.DeviceCategory.filter({ active: true }, "order").catch(() => []);
      const remoteMatch = (existingRemote || []).find((item) => normalizedNameKey(item?.name) === normalizedNameKey(name));
      if (!remoteMatch) {
        await base44.entities.DeviceCategory.create({
          name,
          active: true,
          order: (existingRemote || []).length + 1,
        });
      }
      catalogCache.delete?.("device_categories");
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
      const localCatalog = readLocalDeviceCatalog();
      ensureLocalBrand(localCatalog, selectedCategory.name, name);
      writeLocalDeviceCatalog(localCatalog);

      const relatedCategories = await base44.entities.DeviceCategory.filter({ active: true }, "order").catch(() => []);
      const remoteCategories = relatedCategories.filter(
        (item) => normalizedNameKey(item?.name) === normalizedNameKey(selectedCategory.name)
      );
      let remoteBrandFound = false;
      for (const category of remoteCategories) {
        const remoteBrands = await base44.entities.Brand.filter({ category_id: category.id, active: true }, "order").catch(() => []);
        if (remoteBrands.some((item) => normalizedNameKey(item?.name) === normalizedNameKey(name))) {
          remoteBrandFound = true;
          break;
        }
      }
      if (!remoteBrandFound && remoteCategories[0]?.id) {
        await base44.entities.Brand.create({
          name,
          category_id: remoteCategories[0].id,
          active: true,
          order: selectedCategoryBrands.length + 1,
        });
      }
      catalogCache.delete?.("device_categories");
      catalogCache.delete?.(`brands_${selectedCategory.name}`);
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
      const localCatalog = readLocalDeviceCatalog();
      ensureLocalFamily(localCatalog, selectedCategory?.name || "", selectedBrand.name, name);
      writeLocalDeviceCatalog(localCatalog);

      const remoteBrands = await base44.entities.Brand.filter({ active: true }, "order").catch(() => []);
      const matchingRemoteBrands = remoteBrands.filter(
        (item) => normalizedNameKey(item?.name) === normalizedNameKey(selectedBrand.name)
      );
      let remoteFamilyFound = false;
      for (const brand of matchingRemoteBrands) {
        const remoteFamilies = await base44.entities.DeviceFamily.filter({ brand_id: brand.id, active: true }, "order").catch(() => []);
        if (remoteFamilies.some((item) => normalizedNameKey(item?.name) === normalizedNameKey(name))) {
          remoteFamilyFound = true;
          break;
        }
      }
      if (!remoteFamilyFound && matchingRemoteBrands[0]?.id) {
        await base44.entities.DeviceFamily.create({
          name,
          brand_id: matchingRemoteBrands[0].id,
          active: true,
          order: selectedBrandFamilies.length + 1,
        });
      }
      catalogCache.delete?.(`families_${selectedBrand.id}`);
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
      const localCatalog = readLocalDeviceCatalog();
      const { family, brand } = ensureLocalFamily(
        localCatalog,
        selectedCategory?.name || "",
        selectedBrand.name,
        selectedFamily.name
      );
      const exists = localCatalog.models.some(
        (item) =>
          item?.brand_id === brand.id &&
          (item?.family_id === family.id || normalizedNameKey(item?.family) === normalizedNameKey(family.name)) &&
          normalizedNameKey(item?.name) === normalizedNameKey(name)
      );
      if (!exists) {
        localCatalog.models.unshift({
          id: `local-device-model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          brand_id: brand.id,
          family_id: family.id,
          family: family.name,
          active: true,
          order: localCatalog.models.filter((item) => item?.family_id === family.id).length + 1
        });
      }
      writeLocalDeviceCatalog(localCatalog);

      const remoteBrands = await base44.entities.Brand.filter({ active: true }, "order").catch(() => []);
      const matchingRemoteBrands = remoteBrands.filter(
        (item) => normalizedNameKey(item?.name) === normalizedNameKey(selectedBrand.name)
      );
      let remoteModelFound = false;
      let targetBrand = null;
      let targetFamily = null;
      for (const brand of matchingRemoteBrands) {
        const remoteFamilies = await base44.entities.DeviceFamily.filter({ brand_id: brand.id, active: true }, "order").catch(() => []);
        const family = remoteFamilies.find((item) => normalizedNameKey(item?.name) === normalizedNameKey(selectedFamily.name));
        if (!family) continue;
        targetBrand = brand;
        targetFamily = family;
        const remoteModels = await base44.entities.DeviceModel.filter({ brand_id: brand.id, active: true }, "order").catch(() => []);
        if (
          remoteModels.some(
            (item) =>
              normalizedNameKey(item?.name) === normalizedNameKey(name) &&
              (item?.family_id === family.id || normalizedNameKey(item?.family) === normalizedNameKey(family.name))
          )
        ) {
          remoteModelFound = true;
          break;
        }
      }
      if (!remoteModelFound && targetBrand?.id) {
        await base44.entities.DeviceModel.create({
          name,
          brand_id: targetBrand.id,
          brand: targetBrand.name,
          category_id: targetBrand.category_id || selectedCategory?.id,
          family_id: targetFamily?.id || null,
          family: targetFamily?.name || selectedFamily.name,
          active: true,
          order: selectedFamilyModels.length + 1,
        });
      }
      catalogCache.delete?.(`models_${selectedBrand.id}_${selectedFamily.id}`);
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
      const levelMap = {
        DeviceCategory: "category",
        Brand: "brand",
        DeviceFamily: "family",
        DeviceModel: "model"
      };
      const level = levelMap[entityName];
      const currentEntry =
        entityName === "DeviceCategory"
          ? categories.find((item) => item.id === id)
          : entityName === "Brand"
            ? brands.find((item) => item.id === id)
            : entityName === "DeviceFamily"
              ? families.find((item) => item.id === id)
              : models.find((item) => item.id === id);

      if (currentEntry && level) {
        removeLocalCatalogEntry(level, currentEntry, {
          categoryName: selectedCategory?.name || currentEntry?.category,
          brandName: selectedBrand?.name || currentEntry?.brand,
          familyName: selectedFamily?.name || currentEntry?.family
        });
      }

      if (!isLocalCatalogId(id)) {
        await base44.entities[entityName].delete(id);
      }
      catalogCache.delete?.("device_categories");
      if (selectedCategory?.name) catalogCache.delete?.(`brands_${selectedCategory.name}`);
      if (selectedBrand?.id) catalogCache.delete?.(`families_${selectedBrand.id}`);
      if (selectedBrand?.id && selectedFamily?.id) {
        catalogCache.delete?.(`models_${selectedBrand.id}_${selectedFamily.id}`);
      }
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
