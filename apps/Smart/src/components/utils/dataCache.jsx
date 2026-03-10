// === Sistema de Caché Inteligente para Optimizar Carga de Datos ===
import { QueryClient } from "@tanstack/react-query";

// Configuración del QueryClient optimizado
export const optimizedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Caché en memoria para datos de catálogo (raramente cambian)
class CatalogCache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.TTL = 15 * 60 * 1000; // 15 minutos
  }

  set(key, data) {
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now());
  }

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.TTL) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  invalidate(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }
}

export const catalogCache = new CatalogCache();

// Prefetch común de datos para mejorar rendimiento
export async function prefetchCommonData(dataClient) {
  const promises = [];
  
  // Cachear catálogos de dispositivos
  if (!catalogCache.get('device_categories')) {
    promises.push(
      dataClient.entities.DeviceCategory.filter({ active: true }, "order")
        .then(data => {
          catalogCache.set('device_categories', data);
          return data;
        })
    );
  }
  
  // Cachear servicios activos
  if (!catalogCache.get('active_services')) {
    promises.push(
      dataClient.entities.Service.filter({ active: true }, "name")
        .then(data => {
          catalogCache.set('active_services', data);
          return data;
        })
    );
  }

  await Promise.allSettled(promises);
}

// Hook personalizado para datos con caché
export function useCachedData(key, fetchFn, dependencies = []) {
  const [data, setData] = React.useState(() => catalogCache.get(key));
  const [loading, setLoading] = React.useState(!data);

  React.useEffect(() => {
    const cached = catalogCache.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchFn()
      .then(result => {
        catalogCache.set(key, result);
        setData(result);
      })
      .catch(err => {
        console.error(`Error loading ${key}:`, err);
      })
      .finally(() => setLoading(false));
  }, dependencies);

  return { data, loading, invalidate: () => catalogCache.invalidate(key) };
}

// Debounce para búsquedas
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Batch de actualizaciones para evitar renders innecesarios
export class BatchUpdater {
  constructor(updateFn, delay = 100) {
    this.updateFn = updateFn;
    this.delay = delay;
    this.pending = [];
    this.timeout = null;
  }

  add(item) {
    this.pending.push(item);
    this.scheduleUpdate();
  }

  scheduleUpdate() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      if (this.pending.length > 0) {
        this.updateFn([...this.pending]);
        this.pending = [];
      }
    }, this.delay);
  }

  flush() {
    if (this.timeout) clearTimeout(this.timeout);
    if (this.pending.length > 0) {
      this.updateFn([...this.pending]);
      this.pending = [];
    }
  }
}
