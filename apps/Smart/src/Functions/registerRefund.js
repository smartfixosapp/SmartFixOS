import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

export async function registerRefundHandler(req) {
  console.log("🦕 registerRefund called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    if (!user || !['admin', 'manager'].includes(user.role)) {
      return Response.json(
        { success: false, error: 'Unauthorized: Admin/Manager role required' },
        { status: 403 }
      );
    }

    const {
      order_id,
      order_number,
      refund_amount, // negativo
      refund_reason,
      refund_method,
      refund_note,
      current_amount_paid,
      cost_estimate,
    } = await req.json();

    // Validaciones
    if (!order_id || !refund_amount || !refund_reason || !refund_method) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validar monto (debe ser negativo y <= amount_paid en valor absoluto)
    const absAmount = Math.abs(refund_amount);
    if (absAmount > current_amount_paid) {
      return Response.json(
        { success: false, error: 'Refund amount exceeds amount paid' },
        { status: 400 }
      );
    }

    // Generar refund_number (REF-R01, REF-R02, etc.)
    const today = new Date().toISOString().split('T')[0];
    const sequenceRecord = await base44.asServiceRole.entities.SequenceCounter.filter({
      sequence_type: 'refund',
      period_key: today,
    });

    let currentCount = 0;
    if (sequenceRecord?.length > 0) {
      currentCount = (sequenceRecord[0].current_count || 0) + 1;
      await base44.asServiceRole.entities.SequenceCounter.update(
        sequenceRecord[0].id,
        { current_count: currentCount, last_incremented_at: new Date().toISOString() }
      );
    } else {
      currentCount = 1;
      await base44.asServiceRole.entities.SequenceCounter.create({
        sequence_type: 'refund',
        period_type: 'daily',
        period_key: today,
        current_count: 1,
        last_number: 'REF-R01',
        last_incremented_at: new Date().toISOString(),
      });
    }

    const refundNumber = `REF-R${String(currentCount).padStart(2, '0')}`;

    // Crear Transaction (refund)
    const transaction = await base44.asServiceRole.entities.Transaction.create({
      type: 'refund',
      amount: refund_amount, // negativo
      description: `Reembolso orden ${order_number}`,
      category: 'refund',
      payment_method: refund_method,
      order_id: order_id,
      order_number: order_number,
      recorded_by: user.full_name || user.email,
      refund_metadata: {
        refund_number: refundNumber,
        refund_reason: refund_reason,
        refund_method: refund_method,
        refund_note: refund_note || '',
        refund_status: refund_method === 'card' ? 'pending_manual' : 'completed',
        original_amount_paid: current_amount_paid,
        approved_by: user.full_name || user.email,
        approved_at: new Date().toISOString(),
      },
    });

    // Actualizar Order
    const newAmountPaid = current_amount_paid + refund_amount; // suma de negativo = resta
    const newBalanceDue = cost_estimate - newAmountPaid;
    const newPaid = newBalanceDue <= 0.01;

    await base44.asServiceRole.entities.Order.update(order_id, {
      amount_paid: newAmountPaid,
      total_paid: newAmountPaid,
      balance_due: newBalanceDue,
      paid: newPaid,
    });

    // Crear AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'register_refund',
      entity_type: 'order',
      entity_id: order_id,
      entity_number: order_number,
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_role: user.role,
      changes: {
        refund_number: refundNumber,
        refund_amount: refund_amount,
        refund_reason: refund_reason,
        refund_method: refund_method,
        amount_paid_before: current_amount_paid,
        amount_paid_after: newAmountPaid,
        balance_due_before: cost_estimate - current_amount_paid,
        balance_due_after: newBalanceDue,
        paid_before: current_amount_paid > 0 && (cost_estimate - current_amount_paid) <= 0.01,
        paid_after: newPaid,
      },
    });

    return Response.json({
      success: true,
      refund_number: refundNumber,
      new_amount_paid: newAmountPaid,
      new_balance_due: newBalanceDue,
      new_paid: newPaid,
    });
  } catch (error) {
    console.error('Refund error:', error);
    return Response.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
};
