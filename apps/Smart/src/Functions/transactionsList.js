// ============================================
// 👈 MIGRACIÓN: Neon Transactions List Function
// Obtiene lista de transacciones desde PostgreSQL (Neon)
// ============================================

import { neon } from 'npm:@neondatabase/serverless@0.9.0';

export async function transactionsListHandler(req) {
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
    const { limit = 100, offset = 0, type = null } = await req.json().catch(() => ({}));
    
    // 👈 MIGRACIÓN: Crear cliente Neon
    const sql = neon(DATABASE_URL);
    
    // 👈 MIGRACIÓN: Query para obtener transacciones
    // Filtra por tipo si se especifica (revenue, expense, refund)
    let query = `
      SELECT 
        id,
        order_id,
        order_number,
        type,
        amount,
        description,
        category,
        payment_method,
        recorded_by,
        created_date,
        updated_date,
        created_by
      FROM transactions
    `;
    
    const params = [];
    
    // 👈 MIGRACIÓN: Filtro condicional por tipo
    if (type) {
      query += ` WHERE type = $1`;
      params.push(type);
      query += ` ORDER BY created_date DESC LIMIT $2 OFFSET $3`;
      params.push(limit, offset);
    } else {
      query += ` ORDER BY created_date DESC LIMIT $1 OFFSET $2`;
      params.push(limit, offset);
    }
    
    // 👈 MIGRACIÓN: Ejecutar query
    const result = await sql(query, params);
    
    // 👈 MIGRACIÓN: Log de éxito
    console.log(`✅ [Neon Transactions] Obtenidas ${result.length} transacciones${type ? ` (type=${type})` : ''}`);
    
    // 👈 MIGRACIÓN: Responder con datos
    return Response.json({
      success: true,
      data: result,
      count: result.length,
      backend: 'neon',
      filter: type ? { type } : null
    });
    
  } catch (error) {
    // 👈 MIGRACIÓN: Manejo de errores
    console.error('❌ [Neon Transactions] Error:', error);
    
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
