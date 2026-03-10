import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

export async function deleteOrderHandler(req) {
  console.log("🦕 deleteOrder called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    // ✅ ADMIN ONLY
    if (user?.position !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { order_id, reason } = await req.json();

    if (!order_id || !reason) {
      return Response.json(
        { error: 'Missing order_id or reason' },
        { status: 400 }
      );
    }

    // ✅ Fetch order
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // ✅ Soft delete order
    const orderDeleteData = {
      is_deleted: true,
      deleted_by: user.full_name,
      deleted_at: new Date().toISOString(),
      delete_reason: reason
    };

    await base44.asServiceRole.entities.Order.update(order_id, orderDeleteData);

    // ✅ Soft delete all transactions linked to this order
    const linkedTransactions = await base44.asServiceRole.entities.Transaction.filter({
      order_id: order_id
    });

    let deletedTransactionCount = 0;
    for (const tx of linkedTransactions) {
      if (!tx.is_deleted) {
        await base44.asServiceRole.entities.Transaction.update(tx.id, {
          is_deleted: true,
          deleted_by: user.full_name,
          deleted_at: new Date().toISOString(),
          delete_reason: `cascade_delete_from_order: ${reason}`
        });
        deletedTransactionCount++;
      }
    }

    // ✅ Soft delete all sales linked to this order
    const linkedSales = await base44.asServiceRole.entities.Sale.filter({
      order_id: order_id
    });

    let deletedSaleCount = 0;
    for (const sale of linkedSales) {
      if (!sale.is_deleted) {
        await base44.asServiceRole.entities.Sale.update(sale.id, {
          is_deleted: true,
          deleted_by: user.full_name,
          deleted_at: new Date().toISOString(),
          delete_reason: `cascade_delete_from_order: ${reason}`
        });
        deletedSaleCount++;
      }
    }

    // ✅ Log in AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'delete_order',
      entity_type: 'order',
      entity_id: order_id,
      entity_number: order.order_number,
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.position,
      changes: {
        before: {
          status: order.status,
          amount_paid: order.amount_paid,
          balance_due: order.balance_due,
          paid: order.paid
        },
        after: {
          is_deleted: true
        }
      },
      severity: 'warning',
      metadata: {
        reason,
        deleted_transactions: deletedTransactionCount,
        deleted_sales: deletedSaleCount,
        customer_id: order.customer_id,
        customer_name: order.customer_name
      }
    });

    return Response.json({
      success: true,
      message: `Order ${order.order_number} soft-deleted with cascade`,
      affected: {
        order: 1,
        transactions: deletedTransactionCount,
        sales: deletedSaleCount
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
