/**
 * Helpers para generación automática de números de secuencia
 * 
 * Garantiza números únicos para Order y Sale usando función RPC
 */

import { base44 } from "@/api/base44Client";

/**
 * Genera un número único para una orden de trabajo
 * Formato: WO-YYYYMMDD-XXXX
 * 
 * @param {string} periodType - 'daily' (default), 'monthly', 'yearly'
 * @returns {Promise<string>} Número de orden generado (ej: WO-20250116-0001)
 */
export async function generateOrderNumber(periodType = 'daily') {
  try {
    console.log('🔢 Generando número de orden...');
    
    const result = await base44.functions.invoke('generateSequenceNumber', {
      sequence_type: 'order',
      period_type: periodType
    });

    if (result.success) {
      console.log('✅ Número de orden generado:', result.number);
      return result.number;
    } else {
      throw new Error(result.error || 'Error generando número de orden');
    }
  } catch (error) {
    console.error('❌ Error en generateOrderNumber:', error);
    
    // Fallback: generar número basado en timestamp
    const timestamp = Date.now();
    const fallbackNumber = `WO-${timestamp}`;
    console.warn('⚠️ Usando número fallback:', fallbackNumber);
    return fallbackNumber;
  }
}

/**
 * Genera un número único para una venta
 * Formato: POS-YYYYMMDD-XXXX
 * 
 * @param {string} periodType - 'daily' (default), 'monthly', 'yearly'
 * @returns {Promise<string>} Número de venta generado (ej: POS-20250116-0001)
 */
export async function generateSaleNumber(periodType = 'daily') {
  try {
    console.log('🔢 Generando número de venta...');
    
    const result = await base44.functions.invoke('generateSequenceNumber', {
      sequence_type: 'sale',
      period_type: periodType
    });

    if (result.success) {
      console.log('✅ Número de venta generado:', result.number);
      return result.number;
    } else {
      throw new Error(result.error || 'Error generando número de venta');
    }
  } catch (error) {
    console.error('❌ Error en generateSaleNumber:', error);
    
    // Fallback: generar número basado en timestamp
    const timestamp = Date.now();
    const fallbackNumber = `POS-${timestamp}`;
    console.warn('⚠️ Usando número fallback:', fallbackNumber);
    return fallbackNumber;
  }
}

/**
 * Valida si un número de orden es válido
 * @param {string} orderNumber - Número a validar
 * @returns {boolean}
 */
export function isValidOrderNumber(orderNumber) {
  if (!orderNumber) return false;
  
  // Formato: WO-YYYYMMDD-XXXX
  const pattern = /^WO-\d{8}-\d{4}$/;
  return pattern.test(orderNumber);
}

/**
 * Valida si un número de venta es válido
 * @param {string} saleNumber - Número a validar
 * @returns {boolean}
 */
export function isValidSaleNumber(saleNumber) {
  if (!saleNumber) return false;
  
  // Formato: POS-YYYYMMDD-XXXX
  const pattern = /^POS-\d{8}-\d{4}$/;
  return pattern.test(saleNumber);
}

/**
 * Extrae información de un número de secuencia
 * @param {string} number - Número de secuencia (WO-20250116-0001)
 * @returns {object} { type, date, count }
 */
export function parseSequenceNumber(number) {
  if (!number) return null;
  
  const parts = number.split('-');
  if (parts.length !== 3) return null;
  
  const [prefix, dateStr, countStr] = parts;
  
  return {
    type: prefix === 'WO' ? 'order' : prefix === 'POS' ? 'sale' : 'unknown',
    dateString: dateStr,
    count: parseInt(countStr, 10),
    year: dateStr.substring(0, 4),
    month: dateStr.substring(4, 6),
    day: dateStr.substring(6, 8)
  };
}

/**
 * Hook React para generar números de secuencia
 * 
 * Uso:
 * const { generateOrder, generateSale, loading } = useSequenceGenerator();
 * const orderNumber = await generateOrder();
 */
export function useSequenceGenerator() {
  const [loading, setLoading] = React.useState(false);

  const generateOrder = async (periodType = 'daily') => {
    setLoading(true);
    try {
      return await generateOrderNumber(periodType);
    } finally {
      setLoading(false);
    }
  };

  const generateSale = async (periodType = 'daily') => {
    setLoading(true);
    try {
      return await generateSaleNumber(periodType);
    } finally {
      setLoading(false);
    }
  };

  return { generateOrder, generateSale, loading };
}

// ✅ AUTO-GENERAR EN CREACIÓN DE ORDEN
export async function ensureOrderNumber(orderData) {
  if (!orderData.order_number || orderData.order_number.trim() === '') {
    console.log('📝 order_number vacío, generando automáticamente...');
    orderData.order_number = await generateOrderNumber();
  }
  return orderData;
}

// ✅ AUTO-GENERAR EN CREACIÓN DE VENTA
export async function ensureSaleNumber(saleData) {
  if (!saleData.sale_number || saleData.sale_number.trim() === '') {
    console.log('📝 sale_number vacío, generando automáticamente...');
    saleData.sale_number = await generateSaleNumber();
  }
  return saleData;
}

export default {
  generateOrderNumber,
  generateSaleNumber,
  isValidOrderNumber,
  isValidSaleNumber,
  parseSequenceNumber,
  ensureOrderNumber,
  ensureSaleNumber
};
