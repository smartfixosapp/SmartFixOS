/**
 * Helpers para vistas virtuales financieras
 * 
 * Simplifica el acceso a las funciones RPC que actúan como vistas SQL.
 * Incluye caching opcional para mejorar performance.
 */

import { base44 } from "@/api/base44Client";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from "date-fns";

// Cache en memoria para evitar llamadas repetidas
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene ingresos agrupados por método de pago
 * 
 * @param {Date|string} dateFrom - Fecha inicio
 * @param {Date|string} dateTo - Fecha fin
 * @param {boolean} useCache - Usar cache (default: true)
 * @returns {Promise<object>} Revenue data por método
 */
export async function getRevenueByMethod(dateFrom, dateTo, useCache = true) {
  const from = format(new Date(dateFrom), 'yyyy-MM-dd');
  const to = format(new Date(dateTo), 'yyyy-MM-dd');
  
  const cacheKey = `revenue_${from}_${to}`;
  
  // Verificar cache
  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('💾 [getRevenueByMethod] Usando cache');
      return cached.data;
    }
  }

  try {
    console.log(`📊 [getRevenueByMethod] Consultando: ${from} a ${to}`);
    
    const result = await base44.functions.invoke('getRevenueByMethod', {
      date_from: from,
      date_to: to
    });

    if (result.success) {
      // Guardar en cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } else {
      throw new Error(result.error || 'Error obteniendo ingresos');
    }
  } catch (error) {
    console.error('❌ Error en getRevenueByMethod:', error);
    throw error;
  }
}

/**
 * Obtiene gastos agrupados por categoría
 * 
 * @param {Date|string} dateFrom - Fecha inicio
 * @param {Date|string} dateTo - Fecha fin
 * @param {boolean} useCache - Usar cache (default: true)
 * @returns {Promise<object>} Expense data por categoría
 */
export async function getExpensesByCategory(dateFrom, dateTo, useCache = true) {
  const from = format(new Date(dateFrom), 'yyyy-MM-dd');
  const to = format(new Date(dateTo), 'yyyy-MM-dd');
  
  const cacheKey = `expenses_${from}_${to}`;
  
  // Verificar cache
  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('💾 [getExpensesByCategory] Usando cache');
      return cached.data;
    }
  }

  try {
    console.log(`💸 [getExpensesByCategory] Consultando: ${from} a ${to}`);
    
    const result = await base44.functions.invoke('getExpensesByCategory', {
      date_from: from,
      date_to: to
    });

    if (result.success) {
      // Guardar en cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } else {
      throw new Error(result.error || 'Error obteniendo gastos');
    }
  } catch (error) {
    console.error('❌ Error en getExpensesByCategory:', error);
    throw error;
  }
}

/**
 * Obtiene KPIs financieros del periodo
 * 
 * @param {Date|string} dateFrom - Fecha inicio
 * @param {Date|string} dateTo - Fecha fin
 * @param {boolean} comparePrevious - Comparar con periodo anterior
 * @param {boolean} useCache - Usar cache (default: true)
 * @returns {Promise<object>} KPIs completos
 */
export async function getKPIs(dateFrom, dateTo, comparePrevious = false, useCache = true) {
  const from = format(new Date(dateFrom), 'yyyy-MM-dd');
  const to = format(new Date(dateTo), 'yyyy-MM-dd');
  
  const cacheKey = `kpis_${from}_${to}_${comparePrevious}`;
  
  // Verificar cache
  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('💾 [getKPIs] Usando cache');
      return cached.data;
    }
  }

  try {
    console.log(`📈 [getKPIs] Consultando: ${from} a ${to}`);
    
    const result = await base44.functions.invoke('getKPIs', {
      date_from: from,
      date_to: to,
      compare_previous: comparePrevious
    });

    if (result.success) {
      // Guardar en cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } else {
      throw new Error(result.error || 'Error obteniendo KPIs');
    }
  } catch (error) {
    console.error('❌ Error en getKPIs:', error);
    throw error;
  }
}

/**
 * Limpia el cache manualmente
 * Útil después de crear/actualizar ventas o gastos
 */
export function clearFinancialCache() {
  console.log('🧹 Limpiando cache de vistas financieras');
  cache.clear();
}

/**
 * Obtiene KPIs de hoy
 */
export async function getTodayKPIs() {
  const today = new Date();
  return await getKPIs(startOfDay(today), endOfDay(today), true);
}

/**
 * Obtiene KPIs de esta semana
 */
export async function getThisWeekKPIs() {
  const today = new Date();
  const weekStart = subDays(today, 7);
  return await getKPIs(weekStart, today, true);
}

/**
 * Obtiene KPIs de este mes
 */
export async function getThisMonthKPIs() {
  const today = new Date();
  return await getKPIs(startOfMonth(today), endOfMonth(today), true);
}

/**
 * Obtiene KPIs de este año
 */
export async function getThisYearKPIs() {
  const today = new Date();
  return await getKPIs(startOfYear(today), endOfYear(today), true);
}

/**
 * Hook React para KPIs con auto-refresh
 * 
 * @param {Date} dateFrom - Fecha inicio
 * @param {Date} dateTo - Fecha fin
 * @param {number} refreshInterval - Intervalo de refresh en ms (default: 5min)
 */
export function useFinancialKPIs(dateFrom, dateTo, refreshInterval = 5 * 60 * 1000) {
  const [kpis, setKpis] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let isMounted = true;
    let refreshTimer;

    const loadKPIs = async () => {
      try {
        setLoading(true);
        const data = await getKPIs(dateFrom, dateTo, true);
        if (isMounted) {
          setKpis(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadKPIs();

    // Auto-refresh
    if (refreshInterval > 0) {
      refreshTimer = setInterval(loadKPIs, refreshInterval);
    }

    return () => {
      isMounted = false;
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [dateFrom, dateTo, refreshInterval]);

  return { kpis, loading, error, refresh: () => getKPIs(dateFrom, dateTo, true, false) };
}

/**
 * Genera reporte completo de un periodo
 * Combina todas las vistas para un análisis completo
 * 
 * @param {Date} dateFrom - Fecha inicio
 * @param {Date} dateTo - Fecha fin
 * @returns {Promise<object>} Reporte completo
 */
export async function getFinancialReport(dateFrom, dateTo) {
  console.log('📄 [getFinancialReport] Generando reporte completo...');

  const [kpis, revenueByMethod, expensesByCategory] = await Promise.all([
    getKPIs(dateFrom, dateTo, true, false),
    getRevenueByMethod(dateFrom, dateTo, false),
    getExpensesByCategory(dateFrom, dateTo, false)
  ]);

  return {
    period: {
      from: format(dateFrom, 'yyyy-MM-dd'),
      to: format(dateTo, 'yyyy-MM-dd')
    },
    kpis: kpis.kpis,
    revenue_by_method: revenueByMethod.data,
    expenses_by_category: expensesByCategory.data,
    top_products: kpis.top_products,
    comparison: kpis.comparison,
    generated_at: new Date().toISOString()
  };
}

export default {
  getRevenueByMethod,
  getExpensesByCategory,
  getKPIs,
  clearFinancialCache,
  getTodayKPIs,
  getThisWeekKPIs,
  getThisMonthKPIs,
  getThisYearKPIs,
  getFinancialReport
};
