import { createPageUrl } from "./helpers";

/**
 * Standardizes navigation to the POS from any work order component.
 * Builds the required items array and navigation state.
 * 
 * @param {Object} order The work order object
 * @param {Function} navigate Router navigate function
 * @param {Object} options Additional options (e.g., fromDashboard, openPaymentImmediately)
 */
export const navigateToPOS = (order, navigate, options = {}) => {
  if (!order) return;

  const {
    fromDashboard = true,
    openPaymentImmediately = true,
    paymentMode = "full"
  } = options;

  // Build items array from all potential sources
  const items = [
    ...(order.repair_tasks || []).map(t => ({ 
      id: t.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, 
      name: t.name || t.description || 'Servicio', 
      price: t.cost || 0, 
      cost: t.labor_cost || 0, 
      taxable: t.taxable !== false && t.tax_exempt !== true, 
      type: 'service', 
      qty: 1 
    })),
    ...(order.parts_needed || []).map(p => ({ 
      id: p.id || `part-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, 
      name: p.name || 'Parte', 
      price: p.price || 0, 
      cost: p.cost_price || 0, 
      taxable: p.taxable !== false, 
      type: 'product', 
      qty: p.quantity || 1 
    })),
    ...(order.order_items || []).map(i => ({ 
      ...i, 
      id: i.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: i.name || i.description || 'Artículo',
      price: i.price || 0, 
      cost: i.cost || i.cost_price || 0, 
      taxable: i.taxable !== false && i.tax_exempt !== true, 
      qty: i.qty || i.quantity || 1 
    }))
  ];

  const total = Number(order.total || order.cost_estimate || 0);
  const totalPaid = Number(order.amount_paid ?? order.total_paid ?? 0);
  const balance = order.balance_due != null
    ? Math.max(0, Number(order.balance_due))
    : Math.max(0, total - totalPaid);

  navigate(createPageUrl(`POS?workOrderId=${order.id}&balance=${balance}&mode=${paymentMode}`), {
    state: {
      fromDashboard,
      fromWorkOrder: true,
      paymentMode,
      workOrder: order,
      items,
      customer: {
        id: order.customer_id,
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email
      },
      balanceDue: balance,
      deposit: totalPaid,
      openPaymentImmediately
    }
  });
};
