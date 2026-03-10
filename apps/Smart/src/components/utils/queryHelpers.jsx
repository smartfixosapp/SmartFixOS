/**
 * Query Helpers - Optimizaciones y mejores prácticas
 * 
 * Helpers para queries optimizadas, paginación, y caché
 */

import { getValidatedLimit } from './databaseOptimization';

/**
 * ============================================
 * QUERY PATTERNS OPTIMIZADOS
 * ============================================
 */

/**
 * Obtener órdenes con paginación optimizada
 * 
 * @param {object} filters - Filtros (status, customer_id, etc)
 * @param {number} limit - Límite de registros
 * @param {number} skip - Offset
 * @returns {Promise<Array>} Órdenes
 */
export async function getOrders(filters = {}, limit = 50, skip = 0) {
  const { base44 } = await import('@/api/base44Client');
  
  const validatedLimit = getValidatedLimit('Order', limit, 'list');
  
  // Siempre excluir eliminadas por defecto
  const finalFilters = {
    deleted: false,
    ...filters
  };

  return await base44.entities.Order.filter(
    finalFilters,
    '-created_date',  // Ordenar por más reciente primero
    validatedLimit,
    skip
  );
}

/**
 * Obtener órdenes recientes del dashboard
 * 
 * @param {number} limit - Límite (default: 20)
 * @returns {Promise<Array>} Órdenes recientes
 */
export async function getRecentOrders(limit = 20) {
  const { base44 } = await import('@/api/base44Client');
  
  const validatedLimit = getValidatedLimit('Order', limit, 'dashboard');
  
  return await base44.entities.Order.filter(
    { deleted: false },
    '-created_date',
    validatedLimit
  );
}

/**
 * Obtener órdenes por estado con límite validado
 * 
 * @param {string} status - Estado de la orden
 * @param {number} limit - Límite
 * @returns {Promise<Array>} Órdenes
 */
export async function getOrdersByStatus(status, limit = 50) {
  const { base44 } = await import('@/api/base44Client');
  
  const validatedLimit = getValidatedLimit('Order', limit);
  
  return await base44.entities.Order.filter(
    { status, deleted: false },
    '-created_date',
    validatedLimit
  );
}

/**
 * Obtener ventas con paginación y filtros
 * 
 * @param {object} filters - Filtros
 * @param {number} limit - Límite
 * @param {number} skip - Offset
 * @returns {Promise<Array>} Ventas
 */
export async function getSales(filters = {}, limit = 50, skip = 0) {
  const { base44 } = await import('@/api/base44Client');
  
  const validatedLimit = getValidatedLimit('Sale', limit, 'list');
  
  // Excluir anuladas por defecto
  const finalFilters = {
    voided: false,
    ...filters
  };

  return await base44.entities.Sale.filter(
    finalFilters,
    '-created_date',
    validatedLimit,
    skip
  );
}

/**
 * Obtener ventas del día con límite validado
 * 
 * @param {string} date - Fecha (YYYY-MM-DD)
 * @param {number} limit - Límite
 * @returns {Promise<Array>} Ventas del día
 */
export async function getSalesByDate(date, limit = 500) {
  const { base44 } = await import('@/api/base44Client');
  const { startOfDay, endOfDay } = await import('date-fns');
  
  const validatedLimit = getValidatedLimit('Sale', limit, 'report');
  
  const start = startOfDay(new Date(date));
  const end = endOfDay(new Date(date));

  const allSales = await base44.entities.Sale.filter(
    { voided: false },
    '-created_date',
    validatedLimit
  );

  // Filtrar por rango de fecha en memoria
  return allSales.filter(s => {
    const saleDate = new Date(s.created_date);
    return saleDate >= start && saleDate <= end;
  });
}

/**
 * Obtener transacciones con límite validado
 * 
 * @param {object} filters - Filtros (type, category, etc)
 * @param {number} limit - Límite
 * @returns {Promise<Array>} Transacciones
 */
export async function getTransactions(filters = {}, limit = 100) {
  const { base44 } = await import('@/api/base44Client');
  
  const validatedLimit = getValidatedLimit('Transaction', limit);
  
  return await base44.entities.Transaction.filter(
    filters,
    '-created_date',
    validatedLimit
  );
}

/**
 * Obtener clientes con búsqueda y límite
 * 
 * @param {string} searchTerm - Término de búsqueda
 * @param {number} limit - Límite
 * @returns {Promise<Array>} Clientes
 */
export async function searchCustomers(searchTerm = '', limit = 20) {
  const { base44 } = await import('@/api/base44Client');
  
  const validatedLimit = getValidatedLimit('Customer', limit, 'search');
  
  // Obtener todos los clientes (Base44 no soporta búsqueda de texto completo)
  const allCustomers = await base44.entities.Customer.list('name', validatedLimit * 2);
  
  if (!searchTerm) {
    return allCustomers.slice(0, validatedLimit);
  }

  // Buscar en memoria
  const term = searchTerm.toLowerCase();
  const filtered = allCustomers.filter(c => 
    c.name?.toLowerCase().includes(term) ||
    c.phone?.includes(term) ||
    c.email?.toLowerCase().includes(term)
  );

  return filtered.slice(0, validatedLimit);
}

/**
 * Obtener productos activos con límite
 * 
 * @param {number} limit - Límite
 * @returns {Promise<Array>} Productos activos
 */
export async function getActiveProducts(limit = 50) {
  const { base44 } = await import('@/api/base44Client');
  
  const validatedLimit = getValidatedLimit('Product', limit);
  
  return await base44.entities.Product.filter(
    { active: true },
    'name',
    validatedLimit
  );
}

/**
 * Obtener productos con stock bajo
 * 
 * @param {number} limit - Límite
 * @returns {Promise<Array>} Productos con stock bajo
 */
export async function getLowStockProducts(limit = 50) {
  const { base44 } = await import('@/api/base44Client');
  
  const validatedLimit = getValidatedLimit('Product', limit);
  
  // Obtener productos activos
  const products = await base44.entities.Product.filter(
    { active: true },
    'stock',
    validatedLimit * 2
  );

  // Filtrar en memoria los que tienen stock <= min_stock
  const lowStock = products.filter(p => p.stock <= (p.min_stock || 5));

  return lowStock.slice(0, validatedLimit);
}

/**
 * ============================================
 * CACHÉ SIMPLE EN MEMORIA
 * ============================================
 */

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Query con caché
 * 
 * @param {string} cacheKey - Clave del caché
 * @param {function} queryFn - Función que ejecuta el query
 * @param {number} ttl - Time to live en ms
 * @returns {Promise<any>} Resultado
 */
export async function cachedQuery(cacheKey, queryFn, ttl = CACHE_TTL) {
  // Verificar caché
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < ttl) {
      console.log(`💾 [Cache HIT] ${cacheKey}`);
      return cached.data;
    }
  }

  // Ejecutar query
  console.log(`🔄 [Cache MISS] ${cacheKey}`);
  const data = await queryFn();

  // Guardar en caché
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
}

/**
 * Limpiar caché
 * 
 * @param {string} pattern - Patrón de claves a limpiar (opcional)
 */
export function clearCache(pattern = null) {
  if (!pattern) {
    cache.clear();
    console.log('🧹 [Cache] Limpiado completamente');
    return;
  }

  let cleared = 0;
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      cleared++;
    }
  }

  console.log(`🧹 [Cache] Limpiadas ${cleared} entradas con patrón: ${pattern}`);
}

/**
 * ============================================
 * QUERIES BATCH (múltiples entidades)
 * ============================================
 */

/**
 * Obtener datos del dashboard en una sola llamada
 * 
 * @returns {Promise<object>} { orders, sales, customers, products }
 */
export async function getDashboardData() {
  const cacheKey = 'dashboard_data';
  
  return await cachedQuery(cacheKey, async () => {
    const [orders, sales, customers, products] = await Promise.all([
      getRecentOrders(20),
      getSales({}, 10),
      searchCustomers('', 10),
      getActiveProducts(20)
    ]);

    return {
      orders,
      sales,
      customers,
      products,
      timestamp: new Date().toISOString()
    };
  }, 2 * 60 * 1000); // 2 minutos de caché
}

/**
 * Obtener datos financieros del día
 * 
 * @param {string} date - Fecha (YYYY-MM-DD)
 * @returns {Promise<object>} Datos financieros
 */
export async function getDailyFinancials(date) {
  const cacheKey = `financials_${date}`;
  
  return await cachedQuery(cacheKey, async () => {
    const { base44 } = await import('@/api/base44Client');
    const { startOfDay, endOfDay } = await import('date-fns');

    const start = startOfDay(new Date(date));
    const end = endOfDay(new Date(date));

    // Obtener ventas y transacciones
    const [allSales, allTransactions] = await Promise.all([
      base44.entities.Sale.list('-created_date', 500),
      base44.entities.Transaction.list('-created_date', 500)
    ]);

    // Filtrar por fecha
    const sales = allSales.filter(s => {
      const d = new Date(s.created_date);
      return d >= start && d <= end && !s.voided;
    });

    const transactions = allTransactions.filter(t => {
      const d = new Date(t.created_date);
      return d >= start && d <= end;
    });

    // Calcular totales
    const revenue = transactions
      .filter(t => t.type === 'revenue')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      date,
      sales: sales.length,
      revenue,
      expenses,
      netProfit: revenue - expenses,
      salesData: sales,
      transactionsData: transactions
    };
  }, 1 * 60 * 1000); // 1 minuto de caché
}

/**
 * ============================================
 * HELPERS DE RANGO DE FECHAS
 * ============================================
 */

/**
 * Filtrar registros por rango de fechas
 * 
 * @param {Array} records - Registros a filtrar
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @param {string} dateField - Campo de fecha (default: created_date)
 * @returns {Array} Registros filtrados
 */
export function filterByDateRange(records, startDate, endDate, dateField = 'created_date') {
  return records.filter(record => {
    try {
      const recordDate = new Date(record[dateField]);
      return recordDate >= startDate && recordDate <= endDate;
    } catch {
      return false;
    }
  });
}

/**
 * Agrupar registros por fecha
 * 
 * @param {Array} records - Registros
 * @param {string} dateField - Campo de fecha
 * @param {string} format - Formato de agrupación (day, month, year)
 * @returns {object} Registros agrupados por fecha
 */
export function groupByDate(records, dateField = 'created_date', format = 'day') {
  const { format: formatDate } = require('date-fns');
  
  const formatMap = {
    day: 'yyyy-MM-dd',
    month: 'yyyy-MM',
    year: 'yyyy'
  };

  const dateFormat = formatMap[format] || formatMap.day;
  const groups = {};

  records.forEach(record => {
    try {
      const date = new Date(record[dateField]);
      const key = formatDate(date, dateFormat);
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    } catch {
      // Ignorar registros con fechas inválidas
    }
  });

  return groups;
}

export default {
  // Query functions
  getOrders,
  getRecentOrders,
  getOrdersByStatus,
  getSales,
  getSalesByDate,
  getTransactions,
  searchCustomers,
  getActiveProducts,
  getLowStockProducts,
  
  // Cache functions
  cachedQuery,
  clearCache,
  
  // Batch functions
  getDashboardData,
  getDailyFinancials,
  
  // Date helpers
  filterByDateRange,
  groupByDate
};
