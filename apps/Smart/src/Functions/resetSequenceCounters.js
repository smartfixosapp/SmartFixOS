import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

/**
 * HERRAMIENTA DE REPARACIÓN: Resincroniza todos los contadores de secuencia
 * con los números reales más altos en la base de datos.
 * 
 * Uso: POST /resetSequenceCounters con body {}
 * SOLO ACCESO ADMIN
 */
export async function resetSequenceCountersHandler(req) {
  console.log("🦕 resetSequenceCounters called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const sequence_types = [
      { type: 'order', entity: 'Order', field: 'order_number', prefix: 'WO' },
      { type: 'sale', entity: 'Sale', field: 'sale_number', prefix: 'POS' },
      { type: 'recharge', entity: 'Recharge', field: 'recharge_number', prefix: 'RCG' },
      { type: 'unlock', entity: 'Order', field: 'order_number', prefix: 'UNL' },
      { type: 'customer', entity: 'Customer', field: 'customer_number', prefix: 'CLT' }
    ];

    const results = {};

    for (const config of sequence_types) {
      try {
        // 1️⃣ Buscar número máximo real
        const allRecords = await base44.asServiceRole.entities[config.entity].list(null, 50000);
        let maxNumber = 0;

        if (allRecords && allRecords.length > 0) {
          for (const record of allRecords) {
            const numberStr = record[config.field];
            if (numberStr && numberStr.startsWith(config.prefix + '-')) {
              const numPart = numberStr.replace(config.prefix + '-', '');
              const num = parseInt(numPart, 10);
              if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
              }
            }
          }
        }

        // 2️⃣ Actualizar o crear contador con el máximo real
        const existingCounters = await base44.asServiceRole.entities.SequenceCounter.filter({
          sequence_type: config.type,
          period_key: 'global'
        });

        if (existingCounters.length > 0) {
          await base44.asServiceRole.entities.SequenceCounter.update(
            existingCounters[0].id,
            {
              current_count: maxNumber,
              last_incremented_at: new Date().toISOString()
            }
          );
        } else {
          await base44.asServiceRole.entities.SequenceCounter.create({
            sequence_type: config.type,
            period_type: 'continuous',
            period_key: 'global',
            current_count: maxNumber,
            last_incremented_at: new Date().toISOString()
          });
        }

        results[config.type] = {
          success: true,
          max_found: maxNumber,
          next_will_be: maxNumber + 1,
          message: `✅ ${config.prefix}: ${maxNumber} → próximo será ${config.prefix}-${String(maxNumber + 1).padStart(2, '0')}`
        };
      } catch (error) {
        results[config.type] = {
          success: false,
          error: error.message
        };
      }
    }

    return Response.json({
      success: true,
      message: '🔧 CONTADORES RESINCRONIZADOS',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    console.error('❌ Error en resetSequenceCounters:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
};
