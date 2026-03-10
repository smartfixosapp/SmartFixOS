import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

export async function deleteTransactionHandler(req) {
  console.log("🦕 deleteTransaction called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    // ✅ ADMIN ONLY
    if (user?.position !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { transaction_id, reason } = await req.json();

    if (!transaction_id || !reason) {
      return Response.json(
        { error: 'Missing transaction_id or reason' },
        { status: 400 }
      );
    }

    // ✅ Fetch transaction
    const transaction = await base44.asServiceRole.entities.Transaction.get(transaction_id);
    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // ✅ Soft delete transaction
    const deleteData = {
      is_deleted: true,
      deleted_by: user.full_name,
      deleted_at: new Date().toISOString(),
      delete_reason: reason
    };

    await base44.asServiceRole.entities.Transaction.update(transaction_id, deleteData);

    // ✅ If linked to order, recalculate balances
    if (transaction.order_id) {
      const order = await base44.asServiceRole.entities.Order.get(transaction.order_id);
      if (order) {
        // Recalculate amount_paid (sum of non-deleted transactions)
        const transactions = await base44.asServiceRole.entities.Transaction.filter({
          order_id: transaction.order_id,
          is_deleted: false
        });

        const newAmountPaid = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const newBalanceDue = Math.max(0, (order.cost_estimate || 0) - newAmountPaid);
        const newPaid = newBalanceDue <= 0.01;

        await base44.asServiceRole.entities.Order.update(transaction.order_id, {
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          paid: newPaid
        });

        // ✅ Log in AuditLog
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'delete_transaction',
          entity_type: 'transaction',
          entity_id: transaction_id,
          entity_number: transaction.order_number,
          user_id: user.id,
          user_name: user.full_name,
          user_role: user.position,
          changes: {
            before: {
              amount: transaction.amount,
              order_amount_paid: order.amount_paid,
              order_balance_due: order.balance_due,
              order_paid: order.paid
            },
            after: {
              amount: null,
              order_amount_paid: newAmountPaid,
              order_balance_due: newBalanceDue,
              order_paid: newPaid
            }
          },
          severity: 'warning',
          metadata: {
            reason,
            transaction_type: transaction.type,
            order_id: transaction.order_id
          }
        });
      }
    }

    return Response.json({
      success: true,
      message: `Transaction ${transaction_id} soft-deleted`,
      updated_transaction: deleteData
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
