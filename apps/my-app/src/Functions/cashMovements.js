// ============================================
// 👈 MIGRACIÓN: Neon Cash Drawer Movements Function
// Obtiene movimientos de caja desde PostgreSQL (Neon)
// ============================================

import { neon } from 'npm:@neondatabase/serverless@0.9.0';

export async function cashMovementsHandler(req) {
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
    const { limit = 100, offset = 0, drawer_id = null, type = null } = await req.json().catch(() => ({}));
    
    // 👈 MIGRACIÓN: Crear cliente Neon
    const sql = neon(DATABASE_URL);
    
    // 👈 MIGRACIÓN: Query para obtener movimientos de caja
    let query = `
      SELECT 
        id,
        drawer_id,
        type,
        amount,
        description,
        reference,
        employee,
        denominations,
        created_date,
        updated_date,
        created_by
      FROM cash_drawer_movements
    `;
    
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    // 👈 MIGRACIÓN: Filtros condicionales
    if (drawer_id) {
      conditions.push(`drawer_id = $${paramIndex}`);
      params.push(drawer_id);
      paramIndex++;
    }
    
    // 👈 MIGRACIÓN: Filtro por tipo de movimiento
    // Tipos: opening, sale, expense, deposit, withdrawal, closing
    if (type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(type);
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
    console.log(`✅ [Neon CashMovements] Obtenidos ${result.length} movimientos${drawer_id ? ` (drawer_id=${drawer_id})` : ''}${type ? ` (type=${type})` : ''}`);
    
    // 👈 MIGRACIÓN: Responder con datos
    return Response.json({
      success: true,
      data: result,
      count: result.length,
      backend: 'neon',
      filter: { drawer_id, type }
    });
    
  } catch (error) {
    // 👈 MIGRACIÓN: Manejo de errores
    console.error('❌ [Neon CashMovements] Error:', error);
    
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
