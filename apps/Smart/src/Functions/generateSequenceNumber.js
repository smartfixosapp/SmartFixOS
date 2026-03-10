import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

/**
 * ✨ SISTEMA SIMPLIFICADO DE NUMERACIÓN SECUENCIAL
 * NO USA CONTADORES - CUENTA DIRECTAMENTE LOS REGISTROS REALES
 * Formatos: WO-00001, POS-00001, RCG-00001, etc.
 */
export async function generateSequenceNumberHandler(req) {
  console.log("🦕 generateSequenceNumber called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const body = await req.json();
    const { sequence_type } = body;

    // Validar tipo de secuencia
    const validTypes = ['order', 'sale', 'recharge', 'unlock', 'customer'];
    if (!validTypes.includes(sequence_type)) {
      return Response.json({
        success: false,
        error: `sequence_type debe ser uno de: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    console.log('🔢 Generando número para:', sequence_type);

    // Configuración por tipo
    const config = {
      order: { entity: 'Order', field: 'order_number', prefix: 'WO' },
      sale: { entity: 'Sale', field: 'sale_number', prefix: 'POS' },
      recharge: { entity: 'Recharge', field: 'recharge_number', prefix: 'RCG' },
      unlock: { entity: 'Order', field: 'order_number', prefix: 'UNL' },
      customer: { entity: 'Customer', field: 'customer_number', prefix: 'CLT' }
    }[sequence_type];

    const { entity, field, prefix } = config;

    // ========== BUSCAR MÁXIMO NÚMERO VÁLIDO ==========
    let maxNumber = 0;
    let retries = 3;

    while (retries > 0) {
      try {
        const allRecords = await base44.asServiceRole.entities[entity].list(null, 10000);
        
        if (allRecords?.length) {
          for (const record of allRecords) {
            const numStr = record[field];
            if (numStr && numStr.startsWith(prefix + '-')) {
              const numPart = numStr.replace(prefix + '-', '');
              const num = parseInt(numPart, 10);
              // Solo números válidos (1 a 99999)
              if (!isNaN(num) && num >= 1 && num < 100000 && num > maxNumber) {
                maxNumber = num;
              }
            }
          }
        }

        console.log(`📊 Máximo número válido: ${maxNumber}`);
        break;
      } catch (error) {
        console.warn('⚠️ Retry buscando máximo...', error.message);
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    // ========== GENERAR SIGUIENTE NÚMERO ==========
    const nextNumber = maxNumber + 1;
    const paddedNumber = nextNumber.toString().padStart(5, '0');
    const generatedNumber = `${prefix}-${paddedNumber}`;

    console.log(`✅ Número generado: ${generatedNumber}`);

    // Verificar colisiones (doble check)
    const existing = await base44.asServiceRole.entities[entity].filter({
      [field]: generatedNumber
    });

    if (existing.length > 0) {
      console.error('❌ COLISIÓN DETECTADA:', generatedNumber);
      return Response.json({
        success: false,
        error: `Número ${generatedNumber} ya existe`,
        collision: true
      }, { status: 409 });
    }

    return Response.json({
      success: true,
      number: generatedNumber,
      count: nextNumber,
      prefix
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Error generando secuencia'
    }, { status: 500 });
  }
};
