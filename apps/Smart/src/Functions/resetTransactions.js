import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

export async function resetTransactionsHandler(req) {
  console.log("🦕 resetTransactions called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    // ✅ ADMIN ONLY
    if (user?.position !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { confirmation_code, reason } = await req.json();

    // ✅ VERIFY CONFIRMATION CODE (must be RESET-TRANSACTIONS-<date>)
    const today = new Date().toISOString().split('T')[0];
    const expectedCode = `RESET-TRANSACTIONS-${today}`;

    if (confirmation_code !== expectedCode) {
      return Response.json(
        { error: `Invalid confirmation code. Expected: ${expectedCode}` },
        { status: 400 }
      );
    }

    if (!reason) {
      return Response.json({ error: 'Missing reason' }, { status: 400 });
    }

    // ✅ Get ALL transactions (to reset them)
    const allTransactions = await base44.asServiceRole.entities.Transaction.list(
      undefined,
      1000
    );

    let resetCount = 0;
    const now = new Date().toISOString();

    // ✅ Soft delete all transactions
    for (const tx of allTransactions) {
      if (!tx.is_deleted) {
        await base44.asServiceRole.entities.Transaction.update(tx.id, {
          is_deleted: true,
          deleted_by: user.full_name,
          deleted_at: now,
          delete_reason: `system_reset: ${reason}`
        });
        resetCount++;
      }
    }

    // ✅ Get ALL orders and reset to amount_paid=0
    const allOrders = await base44.asServiceRole.entities.Order.list(
      undefined,
      1000
    );

    let resetOrderCount = 0;
    for (const order of allOrders) {
      if (!order.is_deleted) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          amount_paid: 0,
          balance_due: order.cost_estimate || 0,
          paid: false
        });
        resetOrderCount++;
      }
    }

    // ✅ Log in AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'reset_transactions',
      entity_type: 'transaction',
      entity_id: 'system_reset',
      entity_number: 'RESET_ALL',
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.position,
      changes: {
        before: {
          total_transactions: allTransactions.length,
          total_orders_with_payments: allOrders.filter(o => o.amount_paid > 0).length
        },
        after: {
          total_transactions_deleted: resetCount,
          total_orders_reset: resetOrderCount,
          all_orders_amount_paid: 0
        }
      },
      severity: 'critical',
      metadata: {
        reason,
        confirmation_code,
        timestamp: now,
        transactions_reset: resetCount,
        orders_reset: resetOrderCount
      }
    });

    return Response.json({
      success: true,
      message: 'System reset complete: all transactions deleted, all orders reset to amount_paid=0',
      affected: {
        transactions: resetCount,
        orders: resetOrderCount
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
