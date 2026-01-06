import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

/**
 * Generador de números de secuencia únicos para órdenes y ventas
 * 
 * Formatos:
 * - Order: WO-YYYYMMDD-XXXX (ej: WO-20250116-0001)
 * - Sale: POS-YYYYMMDD-XXXX (ej: POS-20250116-0001)
 * 
 * @param {string} sequence_type - Tipo de secuencia: 'order' | 'sale'
 * @param {string} period_type - Tipo de periodo: 'daily' | 'monthly' | 'yearly' (default: daily)
 * 
 * @returns {object} { success: boolean, number: string, count: number }
 */
export async function generateSequenceNumberHandler(req) {
  console.log("🦕 generateSequenceNumber called");
  try {
    // Using pre-configured unified client
    
    // ✅ Parsear parámetros
    const body = await req.json();
    const { sequence_type, period_type = 'daily' } = body;

    // ✅ Validar tipo de secuencia
    if (!['order', 'sale'].includes(sequence_type)) {
      return Response.json({
        success: false,
        error: 'sequence_type debe ser "order" o "sale"'
      }, { status: 400 });
    }

    // ✅ Calcular periodo actual
    const now = new Date();
    let periodKey = '';
    let datePrefix = '';

    if (period_type === 'daily') {
      periodKey = now.toISOString().split('T')[0]; // 2025-01-16
      datePrefix = periodKey.replace(/-/g, ''); // 20250116
    } else if (period_type === 'monthly') {
      periodKey = now.toISOString().substring(0, 7); // 2025-01
      datePrefix = periodKey.replace(/-/g, ''); // 202501
    } else if (period_type === 'yearly') {
      periodKey = now.getFullYear().toString(); // 2025
      datePrefix = periodKey; // 2025
    }

    console.log('🔢 [generateSequence] Generando número para:', sequence_type);
    console.log('📅 [generateSequence] Periodo:', periodKey);

    // ✅ BUSCAR O CREAR CONTADOR (con retry para race conditions)
    let counter = null;
    let retries = 3;
    let newCount = 0;

    while (retries > 0) {
      try {
        // Buscar contador existente
        const existingCounters = await customClient.asServiceRole.entities.SequenceCounter.filter({
          sequence_type,
          period_type,
          period_key: periodKey
        });

        if (existingCounters.length > 0) {
          // Contador existe, incrementar
          counter = existingCounters[0];
          newCount = (counter.current_count || 0) + 1;

          // Actualizar contador atómicamente
          await customClient.asServiceRole.entities.SequenceCounter.update(counter.id, {
            current_count: newCount,
            last_incremented_at: now.toISOString()
          });

          console.log('✅ [generateSequence] Contador actualizado:', newCount);
          break;

        } else {
          // Contador no existe, crear nuevo
          newCount = 1;
          counter = await customClient.asServiceRole.entities.SequenceCounter.create({
            sequence_type,
            period_type,
            period_key: periodKey,
            current_count: newCount,
            last_incremented_at: now.toISOString()
          });

          console.log('✅ [generateSequence] Contador creado:', newCount);
          break;
        }

      } catch (error) {
        console.warn('⚠️ [generateSequence] Race condition detectada, reintentando...', error.message);
        retries--;
        if (retries === 0) throw error;
        // Esperar un poco antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // ✅ GENERAR NÚMERO ÚNICO
    const prefix = sequence_type === 'order' ? 'WO' : 'POS';
    const paddedCount = newCount.toString().padStart(4, '0');
    const generatedNumber = `${prefix}-${datePrefix}-${paddedCount}`;

    // ✅ GUARDAR ÚLTIMO NÚMERO GENERADO
    if (counter?.id) {
      await customClient.asServiceRole.entities.SequenceCounter.update(counter.id, {
        last_number: generatedNumber
      });
    }

    console.log('🎯 [generateSequence] Número generado:', generatedNumber);

    // ✅ VERIFICAR UNICIDAD (double-check)
    const entityName = sequence_type === 'order' ? 'Order' : 'Sale';
    const fieldName = sequence_type === 'order' ? 'order_number' : 'sale_number';

    const existing = await customClient.asServiceRole.entities[entityName].filter({
      [fieldName]: generatedNumber
    });

    if (existing.length > 0) {
      console.error('❌ [generateSequence] COLISIÓN DETECTADA! Número ya existe:', generatedNumber);
      // Intentar de nuevo recursivamente
      return Response.json({
        success: false,
        error: 'Colisión detectada, reintente la operación',
        collision: true
      }, { status: 409 });
    }

    return Response.json({
      success: true,
      number: generatedNumber,
      count: newCount,
      period: periodKey,
      prefix: prefix
    });

  } catch (error) {
    console.error('❌ [generateSequence] Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Error generando secuencia'
    }, { status: 500 });
  }
}
