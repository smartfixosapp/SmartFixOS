/**
 * Helpers para generación automática de números de secuencia
 * Sistema simple: WO-01, POS-01, RCG-01, UNL-01, CLT-01
 * Numeración continua y perpetua
 */

import appClient from "@/api/appClient";

function isFunctionNotAvailableError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("failed") ||
    msg.includes("load failed") ||
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("json parse") ||
    msg.includes("unexpected token") ||
    msg.includes("unrecognized token") ||
    msg.includes("token '<'")
  );
}

function padSequence(num) {
  return String(num).padStart(5, "0");
}

function formatSimpleOrderNumber(num) {
  const n = Number(num || 0);
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return `WO-${safe}`;
}

async function generateLocalCustomerNumberFallback() {
  // 1) Intentar calcular desde clientes existentes para evitar duplicados.
  try {
    const customers = await appClient.entities.Customer.list("-created_date", 1000);
    const maxUsed = (customers || []).reduce((max, c) => {
      const raw = String(c?.customer_number || "");
      const match = raw.match(/^CLT-(\d+)$/i);
      if (!match) return max;
      const value = Number(match[1] || 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);
    const next = maxUsed + 1;
    return `CLT-${padSequence(next)}`;
  } catch {
    // 2) Si no hay conexión, usar contador local persistente.
    const key = "smartfix_local_seq_customer";
    let current = 0;
    try {
      current = Number(localStorage.getItem(key) || 0);
    } catch {
      current = 0;
    }
    const next = current + 1;
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // no-op
    }
    return `CLT-${padSequence(next)}`;
  }
}

async function generateLocalOrderNumberFallback() {
  // Consulta la DB real y busca el primer número disponible (reusa gaps de
  // órdenes borradas). Si la DB no responde, cae a localStorage como último recurso.
  try {
    const orders = await appClient.entities.Order.list("-created_date", 10000);
    const usedNumbers = new Set();
    for (const o of orders || []) {
      const m = String(o?.order_number || "").match(/^WO-(\d+)$/i);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0) usedNumbers.add(n);
      }
    }
    // Buscar el menor número positivo NO usado (rellena gaps)
    let next = 1;
    while (usedNumbers.has(next)) next++;
    // Persistir en localStorage como espejo (solo para fallback offline)
    try { localStorage.setItem("smartfix_local_seq_order", String(next)); } catch { /* no-op */ }
    return formatSimpleOrderNumber(next);
  } catch (err) {
    console.warn("generateOrderNumber: DB unavailable, fallback a localStorage:", err?.message || err);
  }

  // Fallback offline: localStorage counter (último recurso)
  const seqKey = "smartfix_local_seq_order";
  const ordersKey = "smartfix_local_orders";
  let ordersCount = 0;
  let maxFromOrders = 0;
  try {
    const raw = localStorage.getItem(ordersKey);
    const orders = raw ? JSON.parse(raw) : [];
    if (Array.isArray(orders)) {
      ordersCount = orders.length;
      maxFromOrders = orders.reduce((max, o) => {
        const m = String(o?.order_number || "").match(/^WO-(\d+)$/i);
        const n = m ? Number(m[1] || 0) : 0;
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
    }
  } catch {
    maxFromOrders = 0;
    ordersCount = 0;
  }

  let current = 0;
  try {
    current = Number(localStorage.getItem(seqKey) || 0);
  } catch {
    current = 0;
  }

  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeMax = Number.isFinite(maxFromOrders) ? maxFromOrders : 0;
  const suspiciousInflated = safeCurrent > 0 && safeCurrent > (ordersCount + 50);
  const base = suspiciousInflated ? (ordersCount || 0) : Math.max(safeCurrent, safeMax);
  const next = base + 1;
  try {
    localStorage.setItem(seqKey, String(next));
  } catch {
    // no-op
  }
  return formatSimpleOrderNumber(next);
}

/**
 * Genera un número único para una orden de trabajo
 * Formato: WO-00001 a WO-99999
 */
export async function generateOrderNumber() {
  // Forzar secuencia local para mantener WO-1, WO-2, WO-3... en entorno actual.
  return await generateLocalOrderNumberFallback();
}

/**
 * Genera un número único para una venta POS
 * Formato: POS-00001 a POS-99999
 */
export async function generateSaleNumber() {
  try {
    const response = await appClient.functions.invoke('generateSequenceNumber', {
      sequence_type: 'sale'
    });
    const data = response.data || response;
    if (data.success && data.number) return data.number;
    throw new Error(data.error || 'Número de venta no recibido');
  } catch (error) {
    console.error('Error en generateSaleNumber:', error);
    throw new Error('Error generando número de venta: ' + error.message);
  }
}

/**
 * Genera un número único para una recarga
 * Formato: RCG-00001 a RCG-99999
 */
export async function generateRechargeNumber() {
  try {
    const response = await appClient.functions.invoke('generateSequenceNumber', {
      sequence_type: 'recharge'
    });
    const data = response.data || response;
    if (data.success && data.number) return data.number;
    throw new Error(data.error || 'Número de recarga no recibido');
  } catch (error) {
    console.error('Error en generateRechargeNumber:', error);
    throw new Error('Error generando número de recarga: ' + error.message);
  }
}

/**
 * Genera un número único para un desbloqueo
 * Formato: UNL-00001 a UNL-99999
 */
export async function generateUnlockNumber() {
  try {
    const response = await appClient.functions.invoke('generateSequenceNumber', {
      sequence_type: 'unlock'
    });
    const data = response.data || response;
    if (data.success && data.number) return data.number;
    throw new Error(data.error || 'Número de desbloqueo no recibido');
  } catch (error) {
    console.error('Error en generateUnlockNumber:', error);
    throw new Error('Error generando número de desbloqueo: ' + error.message);
  }
}

/**
 * Genera un número único para un cliente
 * Formato: CLT-00001 a CLT-99999
 */
export async function generateCustomerNumber() {
  try {
    const response = await appClient.functions.invoke('generateSequenceNumber', {
      sequence_type: 'customer'
    });
    const data = response.data || response;
    if (data.success && data.number) return data.number;
    throw new Error(data.error || 'Número de cliente no recibido');
  } catch (error) {
    if (!isFunctionNotAvailableError(error)) {
      console.error('Error en generateCustomerNumber:', error);
      throw new Error('Error generando número de cliente: ' + error.message);
    }
    console.warn("⚠️ generateSequenceNumber no disponible. Usando fallback local para cliente.");
    return await generateLocalCustomerNumberFallback();
  }
}

/**
 * Auto-genera número de orden si está vacío
 */
export async function ensureOrderNumber(orderData) {
  if (!orderData.order_number || orderData.order_number.trim() === '') {
    orderData.order_number = await generateOrderNumber();
  }
  return orderData;
}

/**
 * Auto-genera número de venta si está vacío
 */
export async function ensureSaleNumber(saleData) {
  if (!saleData.sale_number || saleData.sale_number.trim() === '') {
    saleData.sale_number = await generateSaleNumber();
  }
  return saleData;
}

/**
 * Auto-genera número de recarga si está vacío
 */
export async function ensureRechargeNumber(rechargeData) {
  if (!rechargeData.recharge_number || rechargeData.recharge_number.trim() === '') {
    rechargeData.recharge_number = await generateRechargeNumber();
  }
  return rechargeData;
}

/**
 * Auto-genera número de desbloqueo si está vacío
 */
export async function ensureUnlockNumber(unlockData) {
  if (!unlockData.order_number || unlockData.order_number.trim() === '') {
    unlockData.order_number = await generateUnlockNumber();
  }
  return unlockData;
}

/**
 * Auto-genera número de cliente si está vacío
 */
export async function ensureCustomerNumber(customerData) {
  if (!customerData.customer_number || customerData.customer_number.trim() === '') {
    customerData.customer_number = await generateCustomerNumber();
  }
  return customerData;
}

export default {
  generateOrderNumber,
  generateSaleNumber,
  generateRechargeNumber,
  generateUnlockNumber,
  generateCustomerNumber,
  ensureOrderNumber,
  ensureSaleNumber,
  ensureRechargeNumber,
  ensureUnlockNumber,
  ensureCustomerNumber
};
