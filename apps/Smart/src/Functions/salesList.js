// ============================================
// 👈 MIGRACIÓN: Neon Sales List Function
// Obtiene lista de ventas desde PostgreSQL (Neon)
// ============================================

import { neon } from 'npm:@neondatabase/serverless@0.9.0';

export async function salesListHandler(req) {
  // 👈 MIGRACIÓN: Configurar conexión a Neon
  const DATABASE_URL = Deno.env.get('NEON_DATABASE_URL');
  
  if (!DATABASE_URL) {
    return Response.json(
      { error: 'NEON_DATABASE_URL no configurado' },
      { status: 500 }
    );
  }

  try {
    // 👈 MIGRACIÓN: Parsear parámetros de la petición
    const { limit = 100, offset = 0, voided = false } = await req.json().catch(() => ({}));
    
    // 👈 MIGRACIÓN: Crear cliente Neon
    const sql = neon(DATABASE_URL);
    
    // 👈 MIGRACIÓN: Query para obtener ventas
    // Filtra ventas no anuladas por defecto
    const query = `
      SELECT 
        id,
        sale_number,
        customer_id,
        customer_name,
        items,
        subtotal,
        tax_rate,
        tax_amount,
        discount_amount,
        deposit_credit,
        total,
        amount_paid,
        amount_due,
        payment_method,
        payment_details,
        employee,
        order_id,
        order_number,
        voided,
        void_reason,
        voided_by,
        voided_at,
        credit_note_id,
        notes,
        created_date,
        updated_date,
        created_by
      FROM sales
      WHERE voided = $1
      ORDER BY created_date DESC
      LIMIT $2
      OFFSET $3
    `;
    
    // 👈 MIGRACIÓN: Ejecutar query
    const result = await sql(query, [voided, limit, offset]);
    
    // 👈 MIGRACIÓN: Log de éxito
    console.log(`✅ [Neon Sales] Obtenidas ${result.length} ventas (voided=${voided})`);
    
    // 👈 MIGRACIÓN: Responder con datos
    return Response.json({
      success: true,
      data: result,
      count: result.length,
      backend: 'neon'
    });
    
  } catch (error) {
    // 👈 MIGRACIÓN: Manejo de errores
    console.error('❌ [Neon Sales] Error:', error);
    
    return Response.json(
      { 
        error: error.message,
        success: false,
        backend: 'neon'
      },
      { status: 500 }
    );
  }
};
