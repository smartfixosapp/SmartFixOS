import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

/**
 * Vista Virtual: Revenue by Payment Method
 * 
 * Agrupa ventas por método de pago en un rango de fechas.
 * Incluye desglose de ventas "mixed" desde payment_details.methods.
 * 
 * @param {string} date_from - Fecha inicio (YYYY-MM-DD)
 * @param {string} date_to - Fecha fin (YYYY-MM-DD)
 * 
 * @returns {object} {
 *   success: boolean,
 *   data: {
 *     cash: number,
 *     card: number,
 *     ath_movil: number,
 *     bank_transfer: number,
 *     check: number
 *   },
 *   summary: {
 *     total_revenue: number,
 *     sales_count: number,
 *     period: { from, to }
 *   }
 * }
 */
export async function getRevenueByMethodHandler(req) {
  console.log("🦕 getRevenueByMethod called");
  try {
    // Using pre-configured unified client
    
    // Autenticación requerida
    let user = null;
    try {
      user = await customClient.auth.me();
    } catch {
      return Response.json({
        success: false,
        error: 'Autenticación requerida'
      }, { status: 401 });
    }

    // Parsear parámetros
    const body = await req.json();
    const { date_from, date_to } = body;

    if (!date_from || !date_to) {
      return Response.json({
        success: false,
        error: 'date_from y date_to son requeridos (formato: YYYY-MM-DD)'
      }, { status: 400 });
    }

    console.log(`📊 [getRevenueByMethod] Calculando ingresos: ${date_from} a ${date_to}`);

    // Convertir a timestamps
    const startDate = new Date(date_from + 'T00:00:00.000Z');
    const endDate = new Date(date_to + 'T23:59:59.999Z');

    // Obtener todas las ventas (usar service role para performance)
    const allSales = await customClient.asServiceRole.entities.Sale.list('-created_date', 5000);

    // Filtrar por rango de fechas y excluir anuladas
    const salesInRange = allSales.filter(sale => {
      if (sale.voided) return false;
      
      try {
        const saleDate = new Date(sale.created_date);
        return saleDate >= startDate && saleDate <= endDate;
      } catch {
        return false;
      }
    });

    console.log(`✅ [getRevenueByMethod] ${salesInRange.length} ventas en el periodo`);

    // Inicializar contadores por método
    const revenueByMethod = {
      cash: 0,
      card: 0,
      ath_movil: 0,
      bank_transfer: 0,
      check: 0
    };

    let totalRevenue = 0;

    // Procesar cada venta
    salesInRange.forEach(sale => {
      const saleTotal = sale.total || 0;
      totalRevenue += saleTotal;

      const method = sale.payment_method;

      if (method === 'mixed' && sale.payment_details?.methods) {
        // Desglosar ventas mixtas
        sale.payment_details.methods.forEach(m => {
          const methodKey = m.method;
          const amount = m.amount || 0;
          
          if (revenueByMethod.hasOwnProperty(methodKey)) {
            revenueByMethod[methodKey] += amount;
          }
        });
      } else if (revenueByMethod.hasOwnProperty(method)) {
        // Venta simple
        revenueByMethod[method] += saleTotal;
      } else {
        // Método desconocido, sumar a cash por defecto
        console.warn(`⚠️ Método desconocido: ${method}, asignando a cash`);
        revenueByMethod.cash += saleTotal;
      }
    });

    // Calcular porcentajes
    const percentages = {};
    Object.keys(revenueByMethod).forEach(method => {
      percentages[method] = totalRevenue > 0 
        ? (revenueByMethod[method] / totalRevenue * 100).toFixed(2)
        : '0.00';
    });

    // Respuesta
    return Response.json({
      success: true,
      data: revenueByMethod,
      percentages: percentages,
      summary: {
        total_revenue: totalRevenue,
        sales_count: salesInRange.length,
        period: {
          from: date_from,
          to: date_to
        }
      },
      message: `Ingresos calculados para ${salesInRange.length} ventas`
    });

  } catch (error) {
    console.error('❌ [getRevenueByMethod] Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Error calculando ingresos'
    }, { status: 500 });
  }
}
