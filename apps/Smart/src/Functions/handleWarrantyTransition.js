import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

/**
 * Maneja la transición de estatus cuando una orden sale de garantía
 * Marca permanentemente la orden como "pasó por garantía"
 */
export async function handleWarrantyTransitionHandler(req) {
  console.log("🦕 handleWarrantyTransition called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id, new_status } = await req.json();

    if (!order_id || !new_status) {
      return Response.json({ error: 'Missing order_id or new_status' }, { status: 400 });
    }

    // Obtener la orden actual
    const order = await base44.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Si está saliendo de garantía (de estatus "warranty" a otro)
    const isExitingWarranty = order.status === 'warranty' && new_status !== 'warranty';

    // Preparar datos de actualización
    const updateData = {
      status: new_status,
      updated_date: new Date().toISOString(),
    };

    // Si sale de garantía, marcar permanentemente
    if (isExitingWarranty) {
      updateData.passed_warranty = true;
      updateData.warranty_mode = {
        ...(order.warranty_mode || {}),
        warranty_exit_date: new Date().toISOString(),
      };
    }

    // Actualizar orden
    await base44.entities.Order.update(order_id, updateData);

    // Registrar en historial
    const statusHistory = order.status_history || [];
    statusHistory.push({
      status: new_status,
      timestamp: new Date().toISOString(),
      changed_by: user.email,
      note: isExitingWarranty ? 'Salida de garantía - marcada permanentemente' : null,
    });

    await base44.entities.Order.update(order_id, { status_history: statusHistory });

    return Response.json({
      success: true,
      message: isExitingWarranty ? 'Orden marcada como pasada por garantía' : 'Estatus actualizado',
      order_id,
      new_status,
      marked_warranty: isExitingWarranty,
    });
  } catch (error) {
    console.error('Error en handleWarrantyTransition:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
