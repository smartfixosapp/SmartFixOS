// ============================================
// 👈 MIGRACIÓN: Neon Cash Registers Function
// Obtiene registros de caja desde PostgreSQL (Neon)
// ============================================

import { neon } from 'npm:@neondatabase/serverless@0.9.0';

export async function cashRegistersHandler(req) {
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
    const { limit = 100, offset = 0, date = null, status = null } = await req.json().catch(() => ({}));
    
    // 👈 MIGRACIÓN: Crear cliente Neon
    const sql = neon(DATABASE_URL);
    
    // 👈 MIGRACIÓN: Query para obtener registros de caja
    let query = `
      SELECT 
        id,
        date,
        opening_balance,
        closing_balance,
        total_revenue,
        total_expenses,
        net_profit,
        estimated_tax,
        status,
        needs_recount,
        recount_reason,
        count_snapshot,
        final_count,
        opened_by,
        closed_by,
        last_movement_at,
        created_date,
        updated_date,
        created_by
      FROM cash_registers
    `;
    
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    // 👈 MIGRACIÓN: Filtros condicionales
    if (date) {
      conditions.push(`date = $${paramIndex}`);
      params.push(date);
      paramIndex++;
    }
    
    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY created_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    // 👈 MIGRACIÓN: Ejecutar query
    const result = await sql(query, params);
    
    // 👈 MIGRACIÓN: Log de éxito
    console.log(`✅ [Neon CashRegisters] Obtenidos ${result.length} registros${date ? ` (date=${date})` : ''}${status ? ` (status=${status})` : ''}`);
    
    // 👈 MIGRACIÓN: Responder con datos
    return Response.json({
      success: true,
      data: result,
      count: result.length,
      backend: 'neon',
      filter: { date, status }
    });
    
  } catch (error) {
    // 👈 MIGRACIÓN: Manejo de errores
    console.error('❌ [Neon CashRegisters] Error:', error);
    
    return Response.json(
      { 
        error: error.message,
        success: false,
        backend: 'neon'
      },
      { status: 500 }
    );
  }
}
