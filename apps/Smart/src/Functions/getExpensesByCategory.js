import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

/**
 * Vista Virtual: Expenses by Category
 * 
 * Agrupa gastos por categoría en un rango de fechas.
 * Incluye Transaction(type=expense) + CashDrawerMovement(type=expense).
 * 
 * @param {string} date_from - Fecha inicio (YYYY-MM-DD)
 * @param {string} date_to - Fecha fin (YYYY-MM-DD)
 * 
 * @returns {object} {
 *   success: boolean,
 *   data: {
 *     rent: number,
 *     utilities: number,
 *     supplies: number,
 *     payroll: number,
 *     parts: number,
 *     other_expense: number,
 *     ...
 *   },
 *   summary: {
 *     total_expenses: number,
 *     expense_count: number,
 *     period: { from, to }
 *   }
 * }
 */
export async function getExpensesByCategoryHandler(req) {
  console.log("🦕 getExpensesByCategory called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    
    // Autenticación requerida
    let user = null;
    try {
      user = await base44.auth.me();
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

    console.log(`💸 [getExpensesByCategory] Calculando gastos: ${date_from} a ${date_to}`);

    // Convertir a timestamps
    const startDate = new Date(date_from + 'T00:00:00.000Z');
    const endDate = new Date(date_to + 'T23:59:59.999Z');

    // Obtener todas las transacciones y movimientos (service role)
    const [allTransactions, allMovements] = await Promise.all([
      base44.asServiceRole.entities.Transaction.list('-created_date', 5000),
      base44.asServiceRole.entities.CashDrawerMovement.list('-created_date', 5000)
    ]);

    // Filtrar transacciones de tipo expense en el rango
    const expenseTransactions = allTransactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      
      try {
        const txDate = new Date(tx.created_date);
        return txDate >= startDate && txDate <= endDate;
      } catch {
        return false;
      }
    });

    // Filtrar movimientos de tipo expense en el rango
    const expenseMovements = allMovements.filter(mov => {
      if (mov.type !== 'expense') return false;
      
      try {
        const movDate = new Date(mov.created_date);
        return movDate >= startDate && movDate <= endDate;
      } catch {
        return false;
      }
    });

    console.log(`✅ [getExpensesByCategory] ${expenseTransactions.length} transacciones + ${expenseMovements.length} movimientos`);

    // Inicializar contadores por categoría
    const expensesByCategory = {};
    let totalExpenses = 0;
    let expenseCount = 0;

    // Procesar transacciones
    expenseTransactions.forEach(tx => {
      const amount = tx.amount || 0;
      const category = tx.category || 'other_expense';
      
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = 0;
      }
      
      expensesByCategory[category] += amount;
      totalExpenses += amount;
      expenseCount++;
    });

    // Procesar movimientos de caja
    expenseMovements.forEach(mov => {
      const amount = mov.amount || 0;
      // Los movimientos no tienen category, usar descripción o "other_expense"
      const category = 'cash_drawer_expense';
      
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = 0;
      }
      
      expensesByCategory[category] += amount;
      totalExpenses += amount;
      expenseCount++;
    });

    // Ordenar por monto descendente
    const sortedCategories = Object.entries(expensesByCategory)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    // Calcular porcentajes
    const percentages = {};
    Object.keys(sortedCategories).forEach(category => {
      percentages[category] = totalExpenses > 0 
        ? (sortedCategories[category] / totalExpenses * 100).toFixed(2)
        : '0.00';
    });

    // Respuesta
    return Response.json({
      success: true,
      data: sortedCategories,
      percentages: percentages,
      summary: {
        total_expenses: totalExpenses,
        expense_count: expenseCount,
        period: {
          from: date_from,
          to: date_to
        },
        sources: {
          transactions: expenseTransactions.length,
          movements: expenseMovements.length
        }
      },
      message: `Gastos calculados para ${expenseCount} registros`
    });

  } catch (error) {
    console.error('❌ [getExpensesByCategory] Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Error calculando gastos'
    }, { status: 500 });
  }
};
