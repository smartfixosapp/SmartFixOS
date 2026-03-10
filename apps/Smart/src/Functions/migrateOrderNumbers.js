import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

/**
 * ⚠️ FUNCIÓN DE MIGRACIÓN UNA SOLA VEZ
 * Reasigna números secuenciales a todos los registros existentes
 * Solo para ejecución manual si se necesita re-migración
 */
export async function migrateOrderNumbersHandler(req) {
  console.log("🦕 migrateOrderNumbers called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    // Solo admins pueden ejecutar
    if (user?.role !== 'admin') {
      return Response.json({ 
        error: 'Solo admin puede ejecutar migraciones' 
      }, { status: 403 });
    }

    const results = {
      orders: { migrated: 0, errors: 0 },
      sales: { migrated: 0, errors: 0 },
      recharges: { migrated: 0, errors: 0 },
      unlocks: { migrated: 0, errors: 0 },
      customers: { migrated: 0, errors: 0 }
    };

    // ========== 1. MIGRAR ÓRDENES ==========
    console.log('🔄 Migrando órdenes...');
    const orders = await base44.asServiceRole.entities.Order.filter(
      { deleted: false },
      'created_date',
      10000
    );

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const newNumber = `WO-${String(i + 1).padStart(2, '0')}`;
      
      try {
        await base44.asServiceRole.entities.Order.update(order.id, {
          order_number: newNumber
        });
        results.orders.migrated++;
      } catch (err) {
        console.error(`❌ Error migrando orden ${order.id}:`, err.message);
        results.orders.errors++;
      }
    }

    // Actualizar contador
    const orderCounters = await base44.asServiceRole.entities.SequenceCounter.filter({
      sequence_type: 'order'
    });
    if (orderCounters.length > 0) {
      await base44.asServiceRole.entities.SequenceCounter.update(orderCounters[0].id, {
        current_count: orders.length
      });
    } else {
      await base44.asServiceRole.entities.SequenceCounter.create({
        sequence_type: 'order',
        period_type: 'continuous',
        period_key: 'global',
        current_count: orders.length,
        last_incremented_at: new Date().toISOString()
      });
    }

    // ========== 2. MIGRAR VENTAS ==========
    console.log('🔄 Migrando ventas...');
    const sales = await base44.asServiceRole.entities.Sale.list('created_date', 10000);

    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];
      const newNumber = `POS-${String(i + 1).padStart(2, '0')}`;
      
      try {
        await base44.asServiceRole.entities.Sale.update(sale.id, {
          sale_number: newNumber
        });
        results.sales.migrated++;
      } catch (err) {
        console.error(`❌ Error migrando venta ${sale.id}:`, err.message);
        results.sales.errors++;
      }
    }

    // Actualizar contador
    const saleCounters = await base44.asServiceRole.entities.SequenceCounter.filter({
      sequence_type: 'sale'
    });
    if (saleCounters.length > 0) {
      await base44.asServiceRole.entities.SequenceCounter.update(saleCounters[0].id, {
        current_count: sales.length
      });
    } else {
      await base44.asServiceRole.entities.SequenceCounter.create({
        sequence_type: 'sale',
        period_type: 'continuous',
        period_key: 'global',
        current_count: sales.length,
        last_incremented_at: new Date().toISOString()
      });
    }

    // ========== 3. MIGRAR RECARGAS ==========
    console.log('🔄 Migrando recargas...');
    const recharges = await base44.asServiceRole.entities.Recharge.list('created_date', 10000);

    for (let i = 0; i < recharges.length; i++) {
      const recharge = recharges[i];
      const newNumber = `RCG-${String(i + 1).padStart(2, '0')}`;
      
      try {
        await base44.asServiceRole.entities.Recharge.update(recharge.id, {
          recharge_number: newNumber
        });
        results.recharges.migrated++;
      } catch (err) {
        console.error(`❌ Error migrando recarga ${recharge.id}:`, err.message);
        results.recharges.errors++;
      }
    }

    // Actualizar contador
    const rechargeCounters = await base44.asServiceRole.entities.SequenceCounter.filter({
      sequence_type: 'recharge'
    });
    if (rechargeCounters.length > 0) {
      await base44.asServiceRole.entities.SequenceCounter.update(rechargeCounters[0].id, {
        current_count: recharges.length
      });
    } else {
      await base44.asServiceRole.entities.SequenceCounter.create({
        sequence_type: 'recharge',
        period_type: 'continuous',
        period_key: 'global',
        current_count: recharges.length,
        last_incremented_at: new Date().toISOString()
      });
    }

    // ========== 4. MIGRAR CLIENTES ==========
    console.log('🔄 Migrando clientes...');
    const customers = await base44.asServiceRole.entities.Customer.list('created_date', 10000);

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const newNumber = `CLT-${String(i + 1).padStart(2, '0')}`;
      
      try {
        await base44.asServiceRole.entities.Customer.update(customer.id, {
          customer_number: newNumber
        });
        results.customers.migrated++;
      } catch (err) {
        console.error(`❌ Error migrando cliente ${customer.id}:`, err.message);
        results.customers.errors++;
      }
    }

    // Actualizar contador
    const customerCounters = await base44.asServiceRole.entities.SequenceCounter.filter({
      sequence_type: 'customer'
    });
    if (customerCounters.length > 0) {
      await base44.asServiceRole.entities.SequenceCounter.update(customerCounters[0].id, {
        current_count: customers.length
      });
    } else {
      await base44.asServiceRole.entities.SequenceCounter.create({
        sequence_type: 'customer',
        period_type: 'continuous',
        period_key: 'global',
        current_count: customers.length,
        last_incremented_at: new Date().toISOString()
      });
    }

    console.log('✅ MIGRACIÓN COMPLETADA');
    return Response.json({
      success: true,
      message: 'Migración completada exitosamente',
      results
    });

  } catch (error) {
    console.error('❌ Error en migración:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};
