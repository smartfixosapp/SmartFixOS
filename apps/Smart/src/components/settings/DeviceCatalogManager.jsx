import React, { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { catalogCache } from "@/components/utils/dataCache";
import { toast } from "sonner";
import { ChevronDown, GripVertical, Pencil, Plus, RefreshCw, Smartphone, Trash2, Wrench } from "lucide-react";

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

function updateLocalCatalogEntryName(level, entry, nextName, context = {}) {
  const catalog = readLocalDeviceCatalog();
  const currentNameKey = normalizedNameKey(entry?.name);
  const nextNameKey = normalizedNameKey(nextName);
  const categoryKey = normalizedNameKey(context?.categoryName);
  const brandKey = normalizedNameKey(context?.brandName);
  const familyKey = normalizedNameKey(context?.familyName);
  let changed = false;

  if (level === "category") {
    catalog.categories = catalog.categories.map((item) => {
      if (normalizedNameKey(item?.name) !== currentNameKey) return item;
      changed = true;
      return { ...item, name: nextName };
    });
  }

  if (level === "brand") {
    const categoryIds = new Set(
      catalog.categories
        .filter((item) => normalizedNameKey(item?.name) === categoryKey)
        .map((item) => item.id)
    );
    catalog.brands = catalog.brands.map((item) => {
      if (!categoryIds.has(item?.category_id) || normalizedNameKey(item?.name) !== currentNameKey) return item;
      changed = true;
      return { ...item, name: nextName };
    });
  }

  if (level === "family") {
    const brandIds = new Set(
      catalog.brands
        .filter((item) => normalizedNameKey(item?.name) === brandKey)
        .map((item) => item.id)
    );
    catalog.families = catalog.families.map((item) => {
      if (!brandIds.has(item?.brand_id) || normalizedNameKey(item?.name) !== currentNameKey) return item;
      changed = true;
      return { ...item, name: nextName };
    });
    catalog.models = catalog.models.map((item) => {
      if (normalizedNameKey(item?.family) !== currentNameKey) return item;
      changed = true;
      return { ...item, family: nextName };
    });
  }

  if (level === "model") {
    catalog.models = catalog.models.map((item) => {
      const sameFamily = !familyKey || normalizedNameKey(item?.family) === familyKey;
      if (!sameFamily || normalizedNameKey(item?.name) !== currentNameKey) return item;
      changed = true;
      return { ...item, name: nextName };
    });
  }

  if (!changed || !nextNameKey) return false;
  writeLocalDeviceCatalog(catalog);
  return true;
}

function reorderLocalCatalogEntries(level, orderedItems, context = {}) {
  const catalog = readLocalDeviceCatalog();
  const categoryKey = normalizedNameKey(context?.categoryName);
  const brandKey = normalizedNameKey(context?.brandName);
  const familyKey = normalizedNameKey(context?.familyName);
  const orderMap = new Map(orderedItems.map((item, index) => [normalizedNameKey(item?.name), index + 1]));

  const applyOrder = (item, match) => {
    if (!match) return item;
    const nextOrder = orderMap.get(normalizedNameKey(item?.name));
    if (!nextOrder) return item;
    return { ...item, order: nextOrder };
  };

  if (level === "category") {
    catalog.categories = catalog.categories.map((item) =>
      applyOrder(item, orderMap.has(normalizedNameKey(item?.name)))
    );
  }

  if (level === "brand") {
    const categoryIds = new Set(
      catalog.categories
        .filter((item) => normalizedNameKey(item?.name) === categoryKey)
        .map((item) => item.id)
    );
    catalog.brands = catalog.brands.map((item) =>
      applyOrder(
        item,
        categoryIds.has(item?.category_id) && orderMap.has(normalizedNameKey(item?.name))
      )
    );
  }

  if (level === "family") {
    const brandIds = new Set(
      catalog.brands
        .filter((item) => normalizedNameKey(item?.name) === brandKey)
        .map((item) => item.id)
    );
    catalog.families = catalog.families.map((item) =>
      applyOrder(
        item,
        brandIds.has(item?.brand_id) && orderMap.has(normalizedNameKey(item?.name))
      )
    );
  }

  if (level === "model") {
    catalog.models = catalog.models.map((item) =>
      applyOrder(
        item,
        normalizedNameKey(item?.family) === familyKey && orderMap.has(normalizedNameKey(item?.name))
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
  const [rawCategories, setRawCategories] = useState([]);
  const [rawBrands, setRawBrands] = useState([]);
  const [rawFamilies, setRawFamilies] = useState([]);
  const [rawModels, setRawModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState(null);

  const [newItemName, setNewItemName] = useState("");

  const getCategoryIdsByName = (categoryName) => {
    const categoryKey = normalizedNameKey(categoryName);
    return rawCategories
      .filter((item) => normalizedNameKey(item?.name) === categoryKey)
      .map((item) => item.id);
  };

  const getBrandIdsByContext = (categoryName, brandName) => {
    const categoryKey = normalizedNameKey(categoryName);
    const brandKey = normalizedNameKey(brandName);
    const categoryIds = getCategoryIdsByName(categoryName);
    return rawBrands
      .filter(
        (item) =>
          normalizedNameKey(item?.name) === brandKey &&
          (
            categoryIds.includes(item?.category_id) ||
            normalizedNameKey(item?.category) === categoryKey ||
            !categoryKey
          )
      )
      .map((item) => item.id);
  };

  const getFamilyIdsByContext = (categoryName, brandName, familyName) => {
    const familyKey = normalizedNameKey(familyName);
    const brandIds = getBrandIdsByContext(categoryName, brandName);
    return rawFamilies
      .filter(
        (item) =>
          brandIds.includes(item?.brand_id) &&
          normalizedNameKey(item?.name) === familyKey
      )
      .map((item) => item.id);
  };

  useEffect(() => {
    const init = async () => {
      await loadAll();
      const localCatalog = readLocalDeviceCatalog();
      const hasLocal = [...localCatalog.categories, ...localCatalog.brands, ...localCatalog.families, ...localCatalog.models].some((e) => isLocalCatalogId(e.id));
      if (hasLocal) await syncLocalToSupabase(true);
    };
    init();
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
      const allCategories = [...(localCatalog.categories || []), ...(cats || [])];
      const allBrands = [...(localCatalog.brands || []), ...(brds || [])];
      const allFamilies = [...(localCatalog.families || []), ...(fams || [])];
      const allModels = [...(localCatalog.models || []), ...(mods || [])];
      const mergedCategories = dedupeCatalogEntries(
        allCategories,
        (item) => normalizedNameKey(item?.name)
      );
      const mergedBrands = dedupeCatalogEntries(
        allBrands,
        (item) => `${normalizedNameKey(item?.category_id || "")}::${normalizedNameKey(item?.name)}::${normalizedNameKey(item?.category || "")}`
      );
      const mergedFamilies = dedupeCatalogEntries(
        allFamilies,
        (item) => `${normalizedNameKey(item?.brand_id || "")}::${normalizedNameKey(item?.name)}`
      );
      const mergedModels = dedupeCatalogEntries(
        allModels,
        (item) => `${normalizedNameKey(item?.brand_id || "")}::${normalizedNameKey(item?.family_id || item?.family || "")}::${normalizedNameKey(item?.name)}`
      );

      setRawCategories(allCategories);
      setRawBrands(allBrands);
      setRawFamilies(allFamilies);
      setRawModels(allModels);
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

  // ── Helpers para cascade-upsert en Supabase ────────────────────────────
  // Cada helper busca el elemento por nombre; si no existe, lo crea.
  // Esto garantiza que la jerarquía completa exista en Supabase aunque
  // el dato original haya sido guardado localmente con local-device-* IDs.

  const ensureRemoteCategory = async (name, remoteCats) => {
    const match = (remoteCats || []).find((c) => normalizedNameKey(c.name) === normalizedNameKey(name));
    if (match?.id) return match;
    return await base44.entities.DeviceCategory.create({ name, active: true, order: (remoteCats || []).length + 1 });
  };

  const ensureRemoteBrand = async (name, categoryId, remoteBrands) => {
    const match = (remoteBrands || []).find(
      (b) => normalizedNameKey(b.name) === normalizedNameKey(name) && b.category_id === categoryId
    );
    if (match?.id) return match;
    return await base44.entities.Brand.create({
      name, category_id: categoryId, active: true,
      order: (remoteBrands || []).filter((b) => b.category_id === categoryId).length + 1,
    });
  };

  const ensureRemoteFamily = async (name, brandId, remoteFams) => {
    const match = (remoteFams || []).find(
      (f) => normalizedNameKey(f.name) === normalizedNameKey(name) && f.brand_id === brandId
    );
    if (match?.id) return match;
    return await base44.entities.DeviceFamily.create({
      name, brand_id: brandId, active: true,
      order: (remoteFams || []).filter((f) => f.brand_id === brandId).length + 1,
    });
  };

  // Detectar si el error es realmente de red (sin conexión)
  const isNetworkError = (error) => {
    if (!navigator.onLine) return true;
    const msg = String(error?.message || error || "").toLowerCase();
    return msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch") || msg.includes("connection refused");
  };

  // ── Sync local → Supabase con cascade-upsert ───────────────────────────
  // Resuelve IDs locales (local-device-*) usando búsqueda por NOMBRE en Supabase,
  // así no se saltan entradas aunque su categoría/marca tampoco esté en idMap.
  const syncLocalToSupabase = async (silent = false) => {
    const localCatalog = readLocalDeviceCatalog();
    const localCats   = localCatalog.categories.filter((c) => isLocalCatalogId(c.id));
    const localBrands = localCatalog.brands.filter((b) => isLocalCatalogId(b.id));
    const localFams   = localCatalog.families.filter((f) => isLocalCatalogId(f.id));
    const localMods   = localCatalog.models.filter((m) => isLocalCatalogId(m.id));

    if (!localCats.length && !localBrands.length && !localFams.length && !localMods.length) {
      if (!silent) toast.info("No hay datos locales pendientes de sincronizar");
      return;
    }

    setSyncing(true);
    const idMap = new Map(); // local-id → supabase-id
    let syncCount = 0;

    try {
      // 1. Categorías
      const remoteCats = await base44.entities.DeviceCategory.filter({ active: true }, "order").catch(() => []);
      for (const cat of localCats) {
        const existing = (remoteCats || []).find((r) => normalizedNameKey(r.name) === normalizedNameKey(cat.name));
        if (existing) {
          idMap.set(cat.id, existing.id);
        } else {
          try {
            const created = await base44.entities.DeviceCategory.create({ name: cat.name, active: true, order: cat.order || 1 });
            if (created?.id) { idMap.set(cat.id, created.id); syncCount++; }
          } catch { /* no-op */ }
        }
      }

      // 2. Marcas — resuelve category_id por idMap o por nombre (cascade)
      const remoteBrands = await base44.entities.Brand.filter({ active: true }, "order").catch(() => []);
      for (const brand of localBrands) {
        let resolvedCategoryId = idMap.get(brand.category_id) || brand.category_id;
        // Si sigue siendo un ID local, buscar categoría por nombre en Supabase
        if (!resolvedCategoryId || isLocalCatalogId(resolvedCategoryId)) {
          const catName = brand.category || "";
          if (catName) {
            const byName = (remoteCats || []).find((c) => normalizedNameKey(c.name) === normalizedNameKey(catName));
            if (byName?.id) resolvedCategoryId = byName.id;
          }
        }
        if (!resolvedCategoryId || isLocalCatalogId(resolvedCategoryId)) continue;

        const existing = (remoteBrands || []).find(
          (r) => normalizedNameKey(r.name) === normalizedNameKey(brand.name) && r.category_id === resolvedCategoryId
        );
        if (existing) {
          idMap.set(brand.id, existing.id);
        } else {
          try {
            const created = await base44.entities.Brand.create({ name: brand.name, category_id: resolvedCategoryId, active: true, order: brand.order || 1 });
            if (created?.id) { idMap.set(brand.id, created.id); syncCount++; }
          } catch { /* no-op */ }
        }
      }

      // 3. Familias — resuelve brand_id por idMap o por nombre (cascade)
      const remoteFams = await base44.entities.DeviceFamily.filter({ active: true }, "order").catch(() => []);
      for (const fam of localFams) {
        let resolvedBrandId = idMap.get(fam.brand_id) || fam.brand_id;
        if (!resolvedBrandId || isLocalCatalogId(resolvedBrandId)) {
          const brandName = fam.brand || "";
          if (brandName) {
            const byName = (remoteBrands || []).find((b) => normalizedNameKey(b.name) === normalizedNameKey(brandName));
            if (byName?.id) resolvedBrandId = byName.id;
          }
        }
        if (!resolvedBrandId || isLocalCatalogId(resolvedBrandId)) continue;

        const existing = (remoteFams || []).find(
          (r) => normalizedNameKey(r.name) === normalizedNameKey(fam.name) && r.brand_id === resolvedBrandId
        );
        if (existing) {
          idMap.set(fam.id, existing.id);
        } else {
          try {
            const created = await base44.entities.DeviceFamily.create({ name: fam.name, brand_id: resolvedBrandId, active: true, order: fam.order || 1 });
            if (created?.id) { idMap.set(fam.id, created.id); syncCount++; }
          } catch { /* no-op */ }
        }
      }

      // 4. Modelos — resuelve brand_id y family_id por idMap o por nombre
      const remoteMods = await base44.entities.DeviceModel.filter({ active: true }, "order").catch(() => []);
      for (const mod of localMods) {
        let resolvedBrandId = idMap.get(mod.brand_id) || mod.brand_id;
        if (!resolvedBrandId || isLocalCatalogId(resolvedBrandId)) {
          const brandName = mod.brand || "";
          if (brandName) {
            const byName = (remoteBrands || []).find((b) => normalizedNameKey(b.name) === normalizedNameKey(brandName));
            if (byName?.id) resolvedBrandId = byName.id;
          }
        }
        if (!resolvedBrandId || isLocalCatalogId(resolvedBrandId)) continue;

        let resolvedFamilyId = idMap.get(mod.family_id) || mod.family_id;
        if (!resolvedFamilyId || isLocalCatalogId(resolvedFamilyId)) {
          const famName = mod.family || "";
          if (famName) {
            const byName = (remoteFams || []).find(
              (f) => normalizedNameKey(f.name) === normalizedNameKey(famName) && f.brand_id === resolvedBrandId
            );
            if (byName?.id) resolvedFamilyId = byName.id;
          }
        }
        const validFamilyId = resolvedFamilyId && !isLocalCatalogId(resolvedFamilyId) ? resolvedFamilyId : null;

        const existing = (remoteMods || []).find(
          (r) => normalizedNameKey(r.name) === normalizedNameKey(mod.name) && r.brand_id === resolvedBrandId
        );
        if (existing) {
          idMap.set(mod.id, existing.id);
        } else {
          try {
            await base44.entities.DeviceModel.create({
              name: mod.name, brand_id: resolvedBrandId,
              ...(validFamilyId ? { family_id: validFamilyId } : {}),
              brand: mod.brand || "",
              active: true, order: mod.order || 1,
            });
            syncCount++;
          } catch { /* no-op */ }
        }
      }

      // Limpiar del localStorage los que fueron subidos (o ya existían en remoto)
      const synced = new Set(idMap.keys());
      // También limpiar los modelos nuevos que no generan idMap entry pero sí se crearon
      const updated = readLocalDeviceCatalog();
      updated.categories = updated.categories.filter((c) => !synced.has(c.id));
      updated.brands     = updated.brands.filter((b) => !synced.has(b.id));
      updated.families   = updated.families.filter((f) => !synced.has(f.id));
      // Para modelos: si tenía ID local y su brand pudo resolverse, considerarlo sincronizado
      updated.models = updated.models.filter((m) => {
        if (!isLocalCatalogId(m.id)) return true;
        const brandResolved = idMap.get(m.brand_id) || (!isLocalCatalogId(m.brand_id) ? m.brand_id : null);
        return !brandResolved; // si no se pudo resolver brand, mantener
      });
      writeLocalDeviceCatalog(updated);

      catalogCache.delete?.("device_categories");
      await loadAll();

      if (!silent) {
        toast.success(syncCount > 0 ? `☁️ ${syncCount} elementos sincronizados a la nube` : "Catálogo ya sincronizado");
      } else if (syncCount > 0) {
        toast.success(`☁️ Catálogo sincronizado automáticamente (${syncCount} elementos)`);
      }
    } catch (error) {
      console.error("[DeviceCatalogManager] Error sincronizando:", error);
      if (!silent) toast.error("Error durante la sincronización — intenta de nuevo");
    } finally {
      setSyncing(false);
    }
  };

  const selectedCategoryBrands = useMemo(
    () => {
      if (!selectedCategory) return [];
      const selectedCategoryKey = normalizedNameKey(selectedCategory.name);
      const categoryIds = rawCategories
        .filter((category) => normalizedNameKey(category.name) === selectedCategoryKey)
        .map((category) => category.id);
      return dedupeCatalogEntries(
        rawBrands.filter(
          (brand) =>
            categoryIds.includes(brand.category_id) ||
            normalizedNameKey(brand.category) === selectedCategoryKey
        ),
        (item) => `${selectedCategoryKey}::${normalizedNameKey(item?.name)}`
      );
    },
    [rawBrands, rawCategories, selectedCategory]
  );

  const selectedBrandFamilies = useMemo(
    () => {
      if (!selectedBrand || !selectedCategory) return [];
      const selectedBrandKey = normalizedNameKey(selectedBrand.name);
      const brandIds = getBrandIdsByContext(selectedCategory.name, selectedBrand.name);
      return dedupeCatalogEntries(
        rawFamilies.filter((family) => brandIds.includes(family.brand_id)),
        (item) => `${selectedBrandKey}::${normalizedNameKey(item?.name)}`
      );
    },
    [rawFamilies, rawBrands, rawCategories, selectedBrand, selectedCategory]
  );

  const selectedFamilyModels = useMemo(
    () => {
      if (!selectedFamily || !selectedBrand) return [];
      const selectedBrandKey = normalizedNameKey(selectedBrand.name);
      const selectedFamilyKey = normalizedNameKey(selectedFamily.name);
      const brandIds = getBrandIdsByContext(selectedCategory?.name || "", selectedBrand.name);
      const familyIds = getFamilyIdsByContext(selectedCategory?.name || "", selectedBrand.name, selectedFamily.name);
      return dedupeCatalogEntries(
        rawModels.filter(
          (model) =>
            brandIds.includes(model.brand_id) &&
            (familyIds.includes(model.family_id) || normalizedNameKey(model.family) === selectedFamilyKey)
        ),
        (item) => `${selectedFamilyKey}::${normalizedNameKey(item?.name)}`
      );
    },
    [rawModels, rawBrands, rawFamilies, rawCategories, selectedBrand, selectedFamily, selectedCategory]
  );

  const countBrandsForCategory = (categoryName) => {
    const categoryKey = normalizedNameKey(categoryName);
    const categoryIds = getCategoryIdsByName(categoryName);
    return dedupeCatalogEntries(
      rawBrands.filter(
        (item) =>
          categoryIds.includes(item?.category_id) ||
          normalizedNameKey(item?.category) === categoryKey
      ),
      (item) => `${categoryKey}::${normalizedNameKey(item?.name)}`
    ).length;
  };

  const countFamiliesForBrand = (categoryName, brandName) => {
    const brandKey = normalizedNameKey(brandName);
    const brandIds = getBrandIdsByContext(categoryName, brandName);
    return dedupeCatalogEntries(
      rawFamilies.filter((item) => brandIds.includes(item?.brand_id)),
      (item) => `${brandKey}::${normalizedNameKey(item?.name)}`
    ).length;
  };

  const countModelsForFamily = (brandName, familyName) => {
    const familyKey = normalizedNameKey(familyName);
    const brandIds = getBrandIdsByContext(selectedCategory?.name || "", brandName);
    const familyIds = getFamilyIdsByContext(selectedCategory?.name || "", brandName, familyName);
    return dedupeCatalogEntries(
      rawModels.filter(
        (item) =>
          brandIds.includes(item?.brand_id) &&
          (familyIds.includes(item?.family_id) || normalizedNameKey(item?.family) === familyKey)
      ),
      (item) => `${familyKey}::${normalizedNameKey(item?.name)}`
    ).length;
  };

  const createCategory = async () => {
    const name = newItemName.trim();
    if (!name || creating) return;
    if (categories.some((category) => normalized(category.name) === normalized(name))) {
      toast.warning("Esa categoría ya existe");
      return;
    }

    setCreating(true);
    try {
      // ☁️ Cloud-first: guardar directamente en Supabase
      const existingRemote = await base44.entities.DeviceCategory.filter({ active: true }, "order").catch(() => null);
      if (existingRemote === null) throw new Error("Sin conexión");
      const remoteMatch = existingRemote.find((item) => normalizedNameKey(item?.name) === normalizedNameKey(name));
      if (!remoteMatch) {
        await base44.entities.DeviceCategory.create({ name, active: true, order: existingRemote.length + 1 });
      }
      catalogCache.delete?.("device_categories");
      toast.success("Categoría guardada en la nube ☁️");
      setNewItemName("");
      await loadAll();
    } catch (error) {
      console.warn("[DeviceCatalogManager] Sin conexión — guardando categoría localmente:", error);
      // Fallback offline: guardar local para sync posterior
      const localCatalog = readLocalDeviceCatalog();
      if (!localCatalog.categories.some((item) => normalizedNameKey(item?.name) === normalizedNameKey(name))) {
        localCatalog.categories.unshift({
          id: `local-device-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name, active: true, order: localCatalog.categories.length + 1
        });
        writeLocalDeviceCatalog(localCatalog);
      }
      toast.warning("Sin conexión — guardado localmente, se sincronizará automáticamente");
      setNewItemName("");
      await loadAll();
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
    if (selectedCategoryBrands.some((brand) => normalized(brand.name) === normalized(name))) {
      toast.warning("Esa marca ya existe en esta categoría");
      return;
    }

    setCreating(true);
    try {
      // ☁️ Cloud-first con cascade-upsert:
      // Si la categoría no existe en Supabase (tenía ID local), la crea primero.
      const remoteCats = await base44.entities.DeviceCategory.filter({ active: true }, "order");
      const remoteBrandsAll = await base44.entities.Brand.filter({ active: true }, "order").catch(() => []);

      const remoteCategory = await ensureRemoteCategory(selectedCategory.name, remoteCats);
      if (!remoteCategory?.id) throw new Error("No se pudo crear/encontrar la categoría en Supabase");

      await ensureRemoteBrand(name, remoteCategory.id, remoteBrandsAll);

      // Limpiar del local cualquier entrada duplicada con ID local para esta marca
      const lc = readLocalDeviceCatalog();
      lc.brands = lc.brands.filter((b) => !(isLocalCatalogId(b.id) && normalizedNameKey(b.name) === normalizedNameKey(name)));
      writeLocalDeviceCatalog(lc);

      catalogCache.delete?.(`brands_${normalizedNameKey(selectedCategory.name)}`);
      toast.success("Marca guardada en la nube ☁️");
      setNewItemName("");
      await loadAll();
    } catch (error) {
      console.warn("[DeviceCatalogManager] Error creando marca:", error);
      const lc = readLocalDeviceCatalog();
      ensureLocalBrand(lc, selectedCategory.name, name);
      writeLocalDeviceCatalog(lc);
      if (isNetworkError(error)) {
        toast.warning("Sin conexión — guardado localmente, se sincronizará automáticamente");
      } else {
        toast.warning(`Guardado localmente (${error.message}) — se sincronizará automáticamente`);
      }
      setNewItemName("");
      await loadAll();
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
    if (selectedBrandFamilies.some((family) => normalized(family.name) === normalized(name))) {
      toast.warning("Esa familia ya existe en esta marca");
      return;
    }

    setCreating(true);
    try {
      // ☁️ Cloud-first con cascade-upsert:
      // Si la categoría o la marca tienen IDs locales, las crea en Supabase primero.
      const remoteCats    = await base44.entities.DeviceCategory.filter({ active: true }, "order");
      const remoteBrandsAll = await base44.entities.Brand.filter({ active: true }, "order").catch(() => []);
      const remoteFamsAll   = await base44.entities.DeviceFamily.filter({ active: true }, "order").catch(() => []);

      const remoteCategory = await ensureRemoteCategory(selectedCategory?.name || "", remoteCats);
      if (!remoteCategory?.id) throw new Error("No se pudo crear/encontrar la categoría");

      const remoteBrand = await ensureRemoteBrand(selectedBrand.name, remoteCategory.id, remoteBrandsAll);
      if (!remoteBrand?.id) throw new Error("No se pudo crear/encontrar la marca");

      await ensureRemoteFamily(name, remoteBrand.id, remoteFamsAll);

      // Limpiar duplicados locales
      const lc = readLocalDeviceCatalog();
      lc.brands  = lc.brands.filter((b) => !(isLocalCatalogId(b.id) && normalizedNameKey(b.name) === normalizedNameKey(selectedBrand.name)));
      lc.families = lc.families.filter((f) => !(isLocalCatalogId(f.id) && normalizedNameKey(f.name) === normalizedNameKey(name)));
      writeLocalDeviceCatalog(lc);

      catalogCache.delete?.(`families_${normalizedNameKey(selectedCategory?.name || "")}_${normalizedNameKey(selectedBrand.name)}`);
      toast.success("Familia guardada en la nube ☁️");
      setNewItemName("");
      await loadAll();
    } catch (error) {
      console.warn("[DeviceCatalogManager] Error creando familia:", error);
      const lc = readLocalDeviceCatalog();
      ensureLocalFamily(lc, selectedCategory?.name || "", selectedBrand.name, name);
      writeLocalDeviceCatalog(lc);
      if (isNetworkError(error)) {
        toast.warning("Sin conexión — guardado localmente, se sincronizará automáticamente");
      } else {
        toast.warning(`Guardado localmente (${error.message}) — se sincronizará automáticamente`);
      }
      setNewItemName("");
      await loadAll();
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
    if (selectedFamilyModels.some((model) => normalized(model.name) === normalized(name))) {
      toast.warning("Ese modelo ya existe en esta familia");
      return;
    }

    setCreating(true);
    try {
      // ☁️ Cloud-first con cascade-upsert completo:
      // Garantiza que categoría → marca → familia existan en Supabase,
      // creándolas si es necesario (aunque vinieran de localStorage con IDs locales).
      const remoteCats      = await base44.entities.DeviceCategory.filter({ active: true }, "order");
      const remoteBrandsAll = await base44.entities.Brand.filter({ active: true }, "order").catch(() => []);
      const remoteFamsAll   = await base44.entities.DeviceFamily.filter({ active: true }, "order").catch(() => []);
      const remoteModsAll   = await base44.entities.DeviceModel.filter({ active: true }, "order").catch(() => []);

      const remoteCategory = await ensureRemoteCategory(selectedCategory?.name || "", remoteCats);
      if (!remoteCategory?.id) throw new Error("No se pudo crear/encontrar la categoría");

      const remoteBrand = await ensureRemoteBrand(selectedBrand.name, remoteCategory.id, remoteBrandsAll);
      if (!remoteBrand?.id) throw new Error("No se pudo crear/encontrar la marca");

      const remoteFamily = await ensureRemoteFamily(selectedFamily.name, remoteBrand.id, remoteFamsAll);
      if (!remoteFamily?.id) throw new Error("No se pudo crear/encontrar la familia");

      // Crear el modelo solo si no existe ya
      const existingModel = (remoteModsAll || []).find((m) =>
        normalizedNameKey(m.name) === normalizedNameKey(name) &&
        m.brand_id === remoteBrand.id &&
        m.family_id === remoteFamily.id
      );
      if (!existingModel) {
        await base44.entities.DeviceModel.create({
          name,
          brand_id: remoteBrand.id,
          brand: remoteBrand.name,
          category_id: remoteCategory.id,
          family_id: remoteFamily.id,
          active: true,
          order: (remoteModsAll || []).filter((m) => m.family_id === remoteFamily.id).length + 1,
        });
      }

      // Limpiar duplicados locales de toda la jerarquía que acaba de subirse
      const lc = readLocalDeviceCatalog();
      lc.brands   = lc.brands.filter((b)   => !(isLocalCatalogId(b.id) && normalizedNameKey(b.name) === normalizedNameKey(selectedBrand.name)));
      lc.families = lc.families.filter((f) => !(isLocalCatalogId(f.id) && normalizedNameKey(f.name) === normalizedNameKey(selectedFamily.name)));
      lc.models   = lc.models.filter((m)   => !(isLocalCatalogId(m.id) && normalizedNameKey(m.name) === normalizedNameKey(name)));
      writeLocalDeviceCatalog(lc);

      catalogCache.delete?.(`models_${remoteBrand.id}_${remoteFamily.id}`);
      toast.success("Modelo guardado en la nube ☁️");
      setNewItemName("");
      await loadAll();
    } catch (error) {
      console.warn("[DeviceCatalogManager] Error creando modelo:", error);
      const lc = readLocalDeviceCatalog();
      const { family, brand } = ensureLocalFamily(lc, selectedCategory?.name || "", selectedBrand.name, selectedFamily.name);
      const exists = lc.models.some((item) => item?.brand_id === brand.id && normalizedNameKey(item?.name) === normalizedNameKey(name));
      if (!exists) {
        lc.models.unshift({
          id: `local-device-model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name, brand_id: brand.id, family_id: family.id,
          family: family.name, brand: selectedBrand.name, active: true,
          order: lc.models.filter((item) => item?.family_id === family.id).length + 1,
        });
        writeLocalDeviceCatalog(lc);
      }
      if (isNetworkError(error)) {
        toast.warning("Sin conexión — guardado localmente, se sincronizará automáticamente");
      } else {
        toast.warning(`Guardado localmente (${error.message}) — se sincronizará automáticamente`);
      }
      setNewItemName("");
      await loadAll();
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

  const handleEditCurrentItem = async (item) => {
    const level = !selectedCategory ? "category" : !selectedBrand ? "brand" : !selectedFamily ? "family" : "model";
    const currentName = String(item?.name || "").trim();
    if (!currentName) return;
    const nextName = window.prompt(`Nuevo nombre para ${currentName}`, currentName);
    const cleanName = String(nextName || "").trim();
    if (!cleanName || cleanName === currentName) return;

    try {
      if (isLocalCatalogId(item?.id)) {
        const changed = updateLocalCatalogEntryName(level, item, cleanName, {
          categoryName: selectedCategory?.name || "",
          brandName: selectedBrand?.name || "",
          familyName: selectedFamily?.name || ""
        });
        if (!changed) throw new Error("No se pudo editar localmente");
      } else {
        if (level === "category") await base44.entities.DeviceCategory.update(item.id, { name: cleanName });
        if (level === "brand") await base44.entities.Brand.update(item.id, { name: cleanName });
        if (level === "family") await base44.entities.DeviceFamily.update(item.id, { name: cleanName });
        if (level === "model") await base44.entities.DeviceModel.update(item.id, { name: cleanName });
      }

      await loadAll();
      toast.success("Elemento actualizado");
    } catch (error) {
      console.error("[DeviceCatalogManager] Error editando elemento:", error);
      toast.error("No se pudo actualizar");
    }
  };

  const handleCatalogDragEnd = async (result) => {
    const { destination, source } = result;
    if (!destination || destination.index === source.index) return;

    const level = !selectedCategory ? "category" : !selectedBrand ? "brand" : !selectedFamily ? "family" : "model";
    const entityName = level === "category" ? "DeviceCategory" : level === "brand" ? "Brand" : level === "family" ? "DeviceFamily" : "DeviceModel";
    const items = Array.from(currentItems);
    const [moved] = items.splice(source.index, 1);
    items.splice(destination.index, 0, moved);

    try {
      reorderLocalCatalogEntries(level, items, {
        categoryName: selectedCategory?.name || "",
        brandName: selectedBrand?.name || "",
        familyName: selectedFamily?.name || ""
      });

      await Promise.all(
        items.map((item, index) => {
          if (isLocalCatalogId(item?.id)) return Promise.resolve();
          return base44.entities[entityName].update(item.id, { order: index + 1 }).catch((error) => {
            console.warn(`[DeviceCatalogManager] No se pudo reordenar ${entityName}:`, error);
          });
        })
      );

      await loadAll();
    } catch (error) {
      console.error("[DeviceCatalogManager] Error reordenando catálogo:", error);
      toast.error("No se pudo reorganizar");
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

  const breadcrumbItems = [
    {
      key: "root",
      label: "Tipo de dispositivo",
      onClick: () => {
        setSelectedCategory(null);
        setSelectedBrand(null);
        setSelectedFamily(null);
      }
    },
    ...(selectedCategory
      ? [
          {
            key: `category-${selectedCategory.name}`,
            label: selectedCategory.name,
            onClick: () => {
              setSelectedBrand(null);
              setSelectedFamily(null);
            }
          }
        ]
      : []),
    ...(selectedBrand
      ? [
          {
            key: `brand-${selectedBrand.name}`,
            label: selectedBrand.name,
            onClick: () => {
              setSelectedFamily(null);
            }
          }
        ]
      : []),
    ...(selectedFamily
      ? [
          {
            key: `family-${selectedFamily.name}`,
            label: selectedFamily.name,
            onClick: () => {}
          }
        ]
      : [])
  ];

  const currentItems = !selectedCategory
    ? categories
    : !selectedBrand
      ? selectedCategoryBrands
      : !selectedFamily
        ? selectedBrandFamilies
        : selectedFamilyModels;

  const sectionTitle = !selectedCategory
    ? "Categorías disponibles"
    : !selectedBrand
      ? `Marcas de ${selectedCategory.name}`
      : !selectedFamily
        ? `Líneas de ${selectedBrand.name}`
        : `Modelos de ${selectedFamily.name}`;

  const sectionDescription = !selectedCategory
    ? "Mismo catálogo que usa el wizard principal. Selecciona una categoría para administrar su contenido."
    : !selectedBrand
      ? "Selecciona una marca para ver y organizar sus líneas."
      : !selectedFamily
        ? "Selecciona una línea para ver y organizar los modelos específicos."
        : "Aquí administras los modelos exactos que verá el módulo principal.";

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
      <div className="rounded-[28px] border border-cyan-500/20 bg-gradient-to-br from-[#07131d] via-black to-[#08171a] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-[0_10px_30px_rgba(6,182,212,0.35)]">
                <Smartphone className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white">Catálogo conectado</h3>
                <p className="text-sm text-white/50">
                  El mismo catálogo del módulo principal, pero con edición avanzada.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {breadcrumbItems.map((item, index) => (
                <React.Fragment key={item.key}>
                  {index > 0 && <ChevronDown className="h-4 w-4 rotate-[-90deg] text-white/30" />}
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
                  >
                    {item.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Sincronización automática — botones manuales eliminados */}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-black/40 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 text-cyan-300">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">{creatorTitle}</h3>
            <p className="text-sm text-white/45">Crea contenido en el nivel que tienes abierto.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && creatorAction()}
            placeholder={creatorPlaceholder}
            className="flex-1 border-white/10 bg-black/30 text-white theme-light:border-gray-300 theme-light:bg-white"
          />
          <Button onClick={creatorAction} className="bg-gradient-to-r from-cyan-600 to-emerald-600">
            <Plus className="mr-2 h-4 w-4" />
            Crear
          </Button>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#141625] to-black p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{sectionTitle}</h3>
            <p className="mt-1 text-sm text-white/45">{sectionDescription}</p>
          </div>
          <Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
            {currentItems.length}
          </Badge>
        </div>

        {currentItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-5 text-sm text-white/45">
            No hay elementos en este nivel todavía.
          </div>
        ) : (
          <DragDropContext onDragEnd={handleCatalogDragEnd}>
            <Droppable droppableId="advanced-catalog-items" direction="vertical">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-3"
                >
                  {currentItems.map((item, index) => {
                    const isCategory = !selectedCategory;
                    const isBrand = selectedCategory && !selectedBrand;
                    const isFamily = selectedBrand && !selectedFamily;
                    const nextCount = isCategory
                      ? countBrandsForCategory(item.name)
                      : isBrand
                        ? countFamiliesForBrand(selectedCategory?.name || "", item.name)
                        : isFamily
                          ? countModelsForFamily(selectedBrand?.name || "", item.name)
                          : 0;
                    const isLeaf = Boolean(selectedFamily);
                    const palette = isCategory
                      ? "from-cyan-500/20 to-emerald-500/20 border-cyan-400/30"
                      : isBrand
                        ? "from-purple-500/20 to-pink-500/20 border-purple-400/30"
                        : isFamily
                          ? "from-emerald-500/20 to-green-500/20 border-emerald-400/30"
                          : "from-sky-500/20 to-blue-500/20 border-sky-400/30";

                    return (
                      <Draggable key={item.id || item.name} draggableId={String(item.id || item.name)} index={index}>
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className="group relative"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (isCategory) {
                                  setSelectedCategory(item);
                                  setSelectedBrand(null);
                                  setSelectedFamily(null);
                                } else if (isBrand) {
                                  setSelectedBrand(item);
                                  setSelectedFamily(null);
                                } else if (isFamily) {
                                  setSelectedFamily(item);
                                }
                              }}
                              className={`w-full rounded-[22px] border bg-gradient-to-br ${palette} px-5 py-4 pr-24 pl-11 text-left transition-all hover:border-white/30`}
                            >
                              <div
                                {...dragProvided.dragHandleProps}
                                className="absolute left-3 top-3 hidden sm:flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white/45 transition-colors hover:text-white/80"
                                title="Mantén y arrastra para reorganizar"
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>
                              {/* Botones move up/down (móvil táctil) */}
                              <div className="absolute left-2 top-2 sm:hidden flex flex-col gap-1 z-10">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (index === 0) return;
                                    handleCatalogDragEnd({ source: { index }, destination: { index: index - 1 } });
                                  }}
                                  disabled={index === 0}
                                  className="w-7 h-6 rounded bg-black/40 border border-white/15 text-white/70 text-xs flex items-center justify-center disabled:opacity-20 disabled:pointer-events-none active:scale-95"
                                  aria-label="Mover arriba"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (index >= currentItems.length - 1) return;
                                    handleCatalogDragEnd({ source: { index }, destination: { index: index + 1 } });
                                  }}
                                  disabled={index >= currentItems.length - 1}
                                  className="w-7 h-6 rounded bg-black/40 border border-white/15 text-white/70 text-xs flex items-center justify-center disabled:opacity-20 disabled:pointer-events-none active:scale-95"
                                  aria-label="Mover abajo"
                                >
                                  ▼
                                </button>
                              </div>
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-lg font-semibold text-white">{item.name}</p>
                                  <p className="mt-2 text-sm text-white/55">
                                    {isLeaf
                                      ? "Modelo disponible en el módulo principal"
                                      : `${nextCount} ${isCategory ? "marcas" : isBrand ? "líneas" : "modelos"}`}
                                  </p>
                                </div>
                                {!isLeaf && (
                                  <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/75">
                                    {nextCount}
                                  </span>
                                )}
                              </div>
                            </button>
                            <div className="absolute right-3 bottom-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => handleEditCurrentItem(item)}
                                className="rounded-full border border-white/10 bg-white/10 p-2 text-white/80 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100"
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteEntity(
                                    !selectedCategory ? "DeviceCategory" : !selectedBrand ? "Brand" : !selectedFamily ? "DeviceFamily" : "DeviceModel",
                                    item.id,
                                    `${!selectedCategory ? "la categoría" : !selectedBrand ? "la marca" : !selectedFamily ? "la familia" : "el modelo"} ${item.name}`
                                  )
                                }
                                className="rounded-full border border-red-400/20 bg-red-500/15 p-2 text-red-200 opacity-0 transition-opacity hover:bg-red-500/25 group-hover:opacity-100"
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
