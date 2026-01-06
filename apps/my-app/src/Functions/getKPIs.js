import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

/**
 * Vista Virtual: Financial KPIs
 * 
 * Calcula KPIs financieros clave en un rango de fechas:
 * - Total Revenue
 * - Total Expenses
 * - Net Profit
 * - Sales Count
 * - Average Ticket
 * - Revenue by Method
 * - Top Products
 * - Growth vs Previous Period
 * 
 * @param {string} date_from - Fecha inicio (YYYY-MM-DD)
 * @param {string} date_to - Fecha fin (YYYY-MM-DD)
 * @param {boolean} compare_previous - Comparar con periodo anterior (default: false)
 * 
 * @returns {object} KPIs completos del periodo
 */
export async function getKPIsHandler(req) {
  console.log("🦕 getKPIs called");
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
    const { date_from, date_to, compare_previous = false } = body;

    if (!date_from || !date_to) {
      return Response.json({
        success: false,
        error: 'date_from y date_to son requeridos (formato: YYYY-MM-DD)'
      }, { status: 400 });
    }

    console.log(`📈 [getKPIs] Calculando KPIs: ${date_from} a ${date_to}`);

    // Convertir a timestamps
    const startDate = new Date(date_from + 'T00:00:00.000Z');
    const endDate = new Date(date_to + 'T23:59:59.999Z');

    // Calcular periodo anterior si se solicita comparación
    let prevStartDate, prevEndDate;
    if (compare_previous) {
      const periodLength = endDate - startDate;
      prevEndDate = new Date(startDate - 1);
      prevStartDate = new Date(prevEndDate - periodLength);
    }

    // Obtener datos (service role para performance)
    const [allSales, allTransactions] = await Promise.all([
      customClient.asServiceRole.entities.Sale.list('-created_date', 5000),
      customClient.asServiceRole.entities.Transaction.list('-created_date', 5000)
    ]);

    // ========================================
    // CALCULAR KPIs DEL PERIODO ACTUAL
    // ========================================

    // Filtrar ventas del periodo (no anuladas)
    const salesInPeriod = allSales.filter(sale => {
      if (sale.voided) return false;
      try {
        const saleDate = new Date(sale.created_date);
        return saleDate >= startDate && saleDate <= endDate;
      } catch {
        return false;
      }
    });

    // Filtrar transacciones del periodo
    const transactionsInPeriod = allTransactions.filter(tx => {
      try {
        const txDate = new Date(tx.created_date);
        return txDate >= startDate && txDate <= endDate;
      } catch {
        return false;
      }
    });

    // Calcular ingresos
    const revenueTransactions = transactionsInPeriod.filter(tx => tx.type === 'revenue');
    const totalRevenue = revenueTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Calcular gastos
    const expenseTransactions = transactionsInPeriod.filter(tx => tx.type === 'expense');
    const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Calcular utilidad neta
    const netProfit = totalRevenue - totalExpenses;

    // Cantidad de ventas
    const salesCount = salesInPeriod.length;

    // Ticket promedio
    const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;

    // Ingresos por método
    const revenueByMethod = {};
    salesInPeriod.forEach(sale => {
      const method = sale.payment_method || 'unknown';
      const total = sale.total || 0;
      
      if (method === 'mixed' && sale.payment_details?.methods) {
        sale.payment_details.methods.forEach(m => {
          const key = m.method;
          const amt = m.amount || 0;
          revenueByMethod[key] = (revenueByMethod[key] || 0) + amt;
        });
      } else {
        revenueByMethod[method] = (revenueByMethod[method] || 0) + total;
      }
    });

    // Top productos vendidos
    const productSales = {};
    salesInPeriod.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.name || 'Sin nombre';
        if (!productSales[key]) {
          productSales[key] = { name: key, qty: 0, total: 0 };
        }
        productSales[key].qty += item.quantity || 1;
        productSales[key].total += (item.price || 0) * (item.quantity || 1);
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ========================================
    // COMPARACIÓN CON PERIODO ANTERIOR
    // ========================================

    let comparison = null;
    if (compare_previous) {
      const prevSales = allSales.filter(sale => {
        if (sale.voided) return false;
        try {
          const saleDate = new Date(sale.created_date);
          return saleDate >= prevStartDate && saleDate <= prevEndDate;
        } catch {
          return false;
        }
      });

      const prevTransactions = allTransactions.filter(tx => {
        try {
          const txDate = new Date(tx.created_date);
          return txDate >= prevStartDate && txDate <= prevEndDate;
        } catch {
          return false;
        }
      });

      const prevRevenue = prevTransactions
        .filter(tx => tx.type === 'revenue')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      const prevExpenses = prevTransactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      const prevNetProfit = prevRevenue - prevExpenses;
      const prevSalesCount = prevSales.length;
      const prevAvgTicket = prevSalesCount > 0 ? prevRevenue / prevSalesCount : 0;

      comparison = {
        previous_period: {
          from: prevStartDate.toISOString().split('T')[0],
          to: prevEndDate.toISOString().split('T')[0],
          total_revenue: prevRevenue,
          total_expenses: prevExpenses,
          net_profit: prevNetProfit,
          sales_count: prevSalesCount,
          avg_ticket: prevAvgTicket
        },
        growth: {
          revenue: prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(2) : 'N/A',
          expenses: prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses * 100).toFixed(2) : 'N/A',
          profit: prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit) * 100).toFixed(2) : 'N/A',
          sales: prevSalesCount > 0 ? ((salesCount - prevSalesCount) / prevSalesCount * 100).toFixed(2) : 'N/A'
        }
      };
    }

    // ========================================
    // RESPUESTA COMPLETA
    // ========================================

    console.log(`✅ [getKPIs] KPIs calculados: Revenue=$${totalRevenue.toFixed(2)}, Profit=$${netProfit.toFixed(2)}`);

    return Response.json({
      success: true,
      kpis: {
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        sales_count: salesCount,
        avg_ticket: avgTicket,
        margin_percentage: totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(2) : '0.00'
      },
      revenue_by_method: revenueByMethod,
      top_products: topProducts,
      period: {
        from: date_from,
        to: date_to,
        days: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
      },
      comparison: comparison,
      metadata: {
        sales_processed: salesInPeriod.length,
        transactions_processed: transactionsInPeriod.length,
        calculated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [getKPIs] Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Error calculando KPIs'
    }, { status: 500 });
  }
}
