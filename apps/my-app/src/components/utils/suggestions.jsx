import { base44 } from "@/api/base44Client";

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function fetchSuggestedItems({ modelName, familyName, brandName, seriesName }) {
  try {
    // Cargar todos los items activos
    const allItems = await base44.entities.Product.filter({ active: true });
    
    if (!allItems || allItems.length === 0) return [];

    const results = [];
    const seen = new Set();

    // Normalizar búsquedas
    const modelNorm = norm(modelName || "");
    const familyNorm = norm(familyName || "");
    const brandNorm = norm(brandName || "");
    const seriesNorm = norm(seriesName || "");

    // Prioridad 1: Modelo exacto
    for (const item of allItems) {
      if (seen.has(item.id)) continue;

      const compatModels = item.compatibility_models || [];
      const matchModel = compatModels.some(cm => norm(cm) === modelNorm);
      
      if (matchModel) {
        results.push({ ...item, priority: 1 });
        seen.add(item.id);
        continue;
      }

      // Buscar en name/tags
      const nameNorm = norm(item.name || "");
      const tags = (item.tags || []).map(t => norm(t));
      
      if (modelNorm && (nameNorm.includes(modelNorm) || tags.some(t => t.includes(modelNorm)))) {
        results.push({ ...item, priority: 1 });
        seen.add(item.id);
      }
    }

    // Prioridad 2: Familia
    for (const item of allItems) {
      if (seen.has(item.id)) continue;

      const compatFamilies = item.compatible_families || [];
      const matchFamily = compatFamilies.some(cf => norm(cf) === familyNorm);
      
      if (matchFamily) {
        results.push({ ...item, priority: 2 });
        seen.add(item.id);
        continue;
      }

      const nameNorm = norm(item.name || "");
      const tags = (item.tags || []).map(t => norm(t));
      
      if (familyNorm && (nameNorm.includes(familyNorm) || tags.some(t => t.includes(familyNorm)))) {
        results.push({ ...item, priority: 2 });
        seen.add(item.id);
      }
    }

    // Prioridad 3: Marca
    for (const item of allItems) {
      if (seen.has(item.id)) continue;

      const compatBrands = item.compatible_brands || [];
      const matchBrand = compatBrands.some(cb => norm(cb) === brandNorm);
      
      if (matchBrand) {
        results.push({ ...item, priority: 3 });
        seen.add(item.id);
        continue;
      }

      const nameNorm = norm(item.name || "");
      const tags = (item.tags || []).map(t => norm(t));
      
      if (brandNorm && (nameNorm.includes(brandNorm) || tags.some(t => t.includes(brandNorm)))) {
        results.push({ ...item, priority: 3 });
        seen.add(item.id);
      }
    }

    // Ordenar
    results.sort((a, b) => {
      // Primero por prioridad
      if (a.priority !== b.priority) return a.priority - b.priority;
      
      // Luego por disponibilidad
      const stockA = a.stock || 0;
      const stockB = b.stock || 0;
      if (stockA > 0 && stockB <= 0) return -1;
      if (stockB > 0 && stockA <= 0) return 1;
      
      // Finalmente por precio
      return (a.price || 0) - (b.price || 0);
    });

    return results.slice(0, 40);
  } catch (e) {
    console.error("Error fetching suggested items:", e);
    return [];
  }
}
