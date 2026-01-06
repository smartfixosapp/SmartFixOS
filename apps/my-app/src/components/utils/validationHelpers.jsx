/**
 * Helpers de validación para entidades
 * 
 * Valida datos antes de enviarlos a la base de datos
 * para prevenir errores y garantizar integridad de datos.
 */

/**
 * Valida datos de cliente
 * 
 * @param {object} customerData - Datos del cliente
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateCustomer(customerData) {
  const errors = [];

  // Nombre requerido
  if (!customerData.name || customerData.name.trim().length < 2) {
    errors.push("El nombre del cliente debe tener al menos 2 caracteres");
  }

  // Phone O Email requerido (al menos uno)
  const hasPhone = customerData.phone && customerData.phone.trim().length >= 6;
  const hasEmail = customerData.email && customerData.email.trim().length > 0;

  if (!hasPhone && !hasEmail) {
    errors.push("Debes proporcionar al menos un teléfono O un email");
  }

  // Validar formato de teléfono si se proporciona
  if (customerData.phone && !/^[0-9+()\\-\s]{6,}$/.test(customerData.phone)) {
    errors.push("El formato del teléfono no es válido");
  }

  // Validar formato de email si se proporciona
  if (customerData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) {
    errors.push("El formato del email no es válido");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida datos de orden
 * 
 * @param {object} orderData - Datos de la orden
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateOrder(orderData) {
  const errors = [];

  // customer_id REQUERIDO
  if (!orderData.customer_id || orderData.customer_id.trim().length === 0) {
    errors.push("customer_id es requerido");
  }

  // customer_name requerido
  if (!orderData.customer_name || orderData.customer_name.trim().length < 2) {
    errors.push("El nombre del cliente debe tener al menos 2 caracteres");
  }

  // customer_phone requerido
  if (!orderData.customer_phone || orderData.customer_phone.trim().length < 6) {
    errors.push("El teléfono del cliente es requerido");
  }

  // device_type requerido
  if (!orderData.device_type || orderData.device_type.trim().length < 2) {
    errors.push("El tipo de dispositivo es requerido");
  }

  // Status debe estar en valores permitidos
  const validStatuses = [
    "intake",
    "diagnosing",
    "awaiting_approval",
    "waiting_parts",
    "in_progress",
    "ready_for_pickup",
    "picked_up",
    "completed"
  ];

  if (orderData.status && !validStatuses.includes(orderData.status)) {
    errors.push(`El estado "${orderData.status}" no es válido. Debe ser uno de: ${validStatuses.join(", ")}`);
  }

  // Validar montos si existen
  if (orderData.cost_estimate !== undefined && orderData.cost_estimate < 0) {
    errors.push("El costo estimado no puede ser negativo");
  }

  if (orderData.amount_paid !== undefined && orderData.amount_paid < 0) {
    errors.push("El monto pagado no puede ser negativo");
  }

  if (orderData.deposit_amount !== undefined && orderData.deposit_amount < 0) {
    errors.push("El depósito no puede ser negativo");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida datos de venta
 * 
 * @param {object} saleData - Datos de la venta
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateSale(saleData) {
  const errors = [];

  // sale_number requerido
  if (!saleData.sale_number || saleData.sale_number.trim().length < 3) {
    errors.push("sale_number debe tener al menos 3 caracteres");
  }

  // items requeridos (al menos 1)
  if (!saleData.items || !Array.isArray(saleData.items) || saleData.items.length === 0) {
    errors.push("Debe haber al menos 1 item en la venta");
  }

  // subtotal requerido y >= 0
  if (saleData.subtotal === undefined || saleData.subtotal < 0) {
    errors.push("El subtotal debe ser mayor o igual a 0");
  }

  // total REQUERIDO y >= 0
  if (saleData.total === undefined || saleData.total < 0) {
    errors.push("El total debe ser mayor o igual a 0");
  }

  // payment_method REQUERIDO y válido
  const validPaymentMethods = ["cash", "card", "ath_movil", "transfer", "mixed"];
  
  if (!saleData.payment_method) {
    errors.push("El método de pago es requerido");
  } else if (!validPaymentMethods.includes(saleData.payment_method)) {
    errors.push(`El método de pago "${saleData.payment_method}" no es válido. Debe ser: ${validPaymentMethods.join(", ")}`);
  }

  // Si es mixed, validar payment_details
  if (saleData.payment_method === "mixed") {
    if (!saleData.payment_details || !saleData.payment_details.methods || saleData.payment_details.methods.length === 0) {
      errors.push("Para pagos mixtos, debes proporcionar payment_details.methods");
    } else {
      // Validar que cada método en mixed sea válido
      saleData.payment_details.methods.forEach((m, idx) => {
        if (!validPaymentMethods.slice(0, 4).includes(m.method)) {
          errors.push(`Método #${idx + 1} en payment_details no es válido: ${m.method}`);
        }
        if (m.amount === undefined || m.amount < 0) {
          errors.push(`Monto del método #${idx + 1} debe ser >= 0`);
        }
      });
    }
  }

  // employee requerido
  if (!saleData.employee || saleData.employee.trim().length === 0) {
    errors.push("El empleado es requerido");
  }

  // Validar montos si existen
  if (saleData.amount_paid !== undefined && saleData.amount_paid < 0) {
    errors.push("El monto pagado no puede ser negativo");
  }

  if (saleData.amount_due !== undefined && saleData.amount_due < 0) {
    errors.push("El monto pendiente no puede ser negativo");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida datos de caja registradora
 * 
 * @param {object} registerData - Datos del registro de caja
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateCashRegister(registerData) {
  const errors = [];

  // date requerido
  if (!registerData.date) {
    errors.push("La fecha es requerida");
  }

  // opening_balance requerido y >= 0
  if (registerData.opening_balance === undefined || registerData.opening_balance < 0) {
    errors.push("El balance de apertura debe ser mayor o igual a 0");
  }

  // status REQUERIDO y válido
  const validStatuses = ["open", "closed"];
  
  if (!registerData.status) {
    errors.push("El estado es requerido");
  } else if (!validStatuses.includes(registerData.status)) {
    errors.push(`El estado "${registerData.status}" no es válido. Debe ser: ${validStatuses.join(" o ")}`);
  }

  // Si está cerrada, debe tener closing_balance
  if (registerData.status === "closed" && registerData.closing_balance === undefined) {
    errors.push("Una caja cerrada debe tener closing_balance");
  }

  // Validar closing_balance si existe
  if (registerData.closing_balance !== undefined && registerData.closing_balance < 0) {
    errors.push("El balance de cierre no puede ser negativo");
  }

  // Validar montos
  if (registerData.total_revenue !== undefined && registerData.total_revenue < 0) {
    errors.push("Los ingresos totales no pueden ser negativos");
  }

  if (registerData.total_expenses !== undefined && registerData.total_expenses < 0) {
    errors.push("Los gastos totales no pueden ser negativos");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida datos de producto
 * 
 * @param {object} productData - Datos del producto
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateProduct(productData) {
  const errors = [];

  // name requerido
  if (!productData.name || productData.name.trim().length === 0) {
    errors.push("El nombre del producto es requerido");
  }

  // price y cost requeridos y >= 0
  if (productData.price === undefined || productData.price < 0) {
    errors.push("El precio debe ser mayor o igual a 0");
  }

  if (productData.cost === undefined || productData.cost < 0) {
    errors.push("El costo debe ser mayor o igual a 0");
  }

  // stock debe ser >= 0
  if (productData.stock !== undefined && productData.stock < 0) {
    errors.push("El stock no puede ser negativo");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida datos de transacción
 * 
 * @param {object} transactionData - Datos de la transacción
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateTransaction(transactionData) {
  const errors = [];

  // type requerido
  const validTypes = ["revenue", "expense", "refund"];
  if (!transactionData.type) {
    errors.push("El tipo de transacción es requerido");
  } else if (!validTypes.includes(transactionData.type)) {
    errors.push(`El tipo "${transactionData.type}" no es válido. Debe ser: ${validTypes.join(", ")}`);
  }

  // amount requerido y > 0
  if (transactionData.amount === undefined || transactionData.amount <= 0) {
    errors.push("El monto debe ser mayor a 0");
  }

  // category requerido
  if (!transactionData.category || transactionData.category.trim().length === 0) {
    errors.push("La categoría es requerida");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper genérico de validación
 * Lanza un error si la validación falla
 * 
 * @param {object} validation - Resultado de validateX()
 * @param {string} entityName - Nombre de la entidad para el mensaje
 */
export function throwIfInvalid(validation, entityName = "Datos") {
  if (!validation.valid) {
    const errorMsg = `${entityName} inválidos:\n${validation.errors.map(e => `• ${e}`).join('\n')}`;
    throw new Error(errorMsg);
  }
}

/**
 * Wrapper para validar y crear entidad
 * 
 * @param {string} entityType - Tipo de entidad
 * @param {object} data - Datos a validar
 * @param {function} validator - Función de validación
 * @returns {Promise<object>} Entidad creada
 */
export async function validateAndCreate(entityType, data, validator) {
  const validation = validator(data);
  throwIfInvalid(validation, entityType);
  
  const { base44 } = await import("@/api/base44Client");
  return await base44.entities[entityType].create(data);
}

/**
 * Wrapper para validar y actualizar entidad
 * 
 * @param {string} entityType - Tipo de entidad
 * @param {string} id - ID de la entidad
 * @param {object} data - Datos a validar
 * @param {function} validator - Función de validación
 * @returns {Promise<object>} Entidad actualizada
 */
export async function validateAndUpdate(entityType, id, data, validator) {
  const validation = validator(data);
  throwIfInvalid(validation, entityType);
  
  const { base44 } = await import("@/api/base44Client");
  return await base44.entities[entityType].update(id, data);
}

export default {
  validateCustomer,
  validateOrder,
  validateSale,
  validateCashRegister,
  validateProduct,
  validateTransaction,
  throwIfInvalid,
  validateAndCreate,
  validateAndUpdate
};
