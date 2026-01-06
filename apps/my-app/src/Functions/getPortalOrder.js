import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

/**
 * RPC para acceso público a órdenes mediante token de portal
 * 
 * Valida tokens base64 y permite a clientes ver el estado de sus órdenes
 * sin necesidad de autenticación completa.
 * 
 * Seguridad:
 * - Token debe existir en CustomerPortalToken
 * - Token debe estar activo (no revocado)
 * - Token no debe estar expirado
 * - Token debe coincidir con order_id decodificado
 * 
 * @param {string} token - Token base64 único
 * 
 * @returns {object} { success: boolean, order: Order, message: string }
 */
export async function getPortalOrderHandler(req) {
  console.log("🦕 getPortalOrder called");
  try {
    // Using pre-configured unified client
    
    // ✅ PARSEAR TOKEN
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return Response.json({
        success: false,
        error: 'Token requerido',
        code: 'MISSING_TOKEN'
      }, { status: 400 });
    }

    console.log('🔐 [getPortalOrder] Validando token...');

    // ✅ BUSCAR TOKEN EN BASE DE DATOS (usando service role)
    let tokenRecord;
    try {
      const tokens = await customClient.asServiceRole.entities.CustomerPortalToken.filter({
        token: token
      });

      if (tokens.length === 0) {
        console.warn('⚠️ [getPortalOrder] Token no encontrado');
        return Response.json({
          success: false,
          error: 'Token inválido o expirado',
          code: 'INVALID_TOKEN'
        }, { status: 401 });
      }

      tokenRecord = tokens[0];
    } catch (error) {
      console.error('❌ [getPortalOrder] Error buscando token:', error);
      return Response.json({
        success: false,
        error: 'Error validando token',
        code: 'TOKEN_VALIDATION_ERROR'
      }, { status: 500 });
    }

    // ✅ VALIDAR QUE NO ESTÉ REVOCADO
    if (tokenRecord.revoked) {
      console.warn('⚠️ [getPortalOrder] Token revocado');
      return Response.json({
        success: false,
        error: 'Este enlace ha sido revocado',
        code: 'TOKEN_REVOKED',
        revoked_at: tokenRecord.revoked_at
      }, { status: 403 });
    }

    // ✅ VALIDAR EXPIRACIÓN
    if (tokenRecord.expires_at) {
      const expiresAt = new Date(tokenRecord.expires_at);
      const now = new Date();

      if (now > expiresAt) {
        console.warn('⚠️ [getPortalOrder] Token expirado');
        return Response.json({
          success: false,
          error: 'Este enlace ha expirado',
          code: 'TOKEN_EXPIRED',
          expires_at: tokenRecord.expires_at
        }, { status: 403 });
      }
    }

    // ✅ DECODIFICAR TOKEN PARA EXTRAER ORDER_ID
    let decodedOrderId;
    try {
      // El token puede ser base64 con formato: "order_id:timestamp" o similar
      const decoded = atob(token);
      
      // Intentar extraer order_id del token decodificado
      // Formato esperado: "ORDER_ID:TIMESTAMP" o solo "ORDER_ID"
      const parts = decoded.split(':');
      decodedOrderId = parts[0];

      console.log('🔓 [getPortalOrder] Token decodificado, order_id:', decodedOrderId);
    } catch (decodeError) {
      console.warn('⚠️ [getPortalOrder] No se pudo decodificar token (puede ser formato simple)');
      // Si no se puede decodificar, usar el order_id del registro
      decodedOrderId = tokenRecord.order_id;
    }

    // ✅ VALIDAR QUE EL ORDER_ID COINCIDA
    if (decodedOrderId !== tokenRecord.order_id) {
      console.error('❌ [getPortalOrder] Order ID no coincide! Decodificado:', decodedOrderId, 'En DB:', tokenRecord.order_id);
      return Response.json({
        success: false,
        error: 'Token inválido',
        code: 'ORDER_MISMATCH'
      }, { status: 401 });
    }

    // ✅ OBTENER LA ORDEN (usando service role para acceso sin auth)
    let order;
    try {
      const orders = await customClient.asServiceRole.entities.Order.filter({
        id: tokenRecord.order_id
      });

      if (orders.length === 0) {
        console.error('❌ [getPortalOrder] Orden no encontrada:', tokenRecord.order_id);
        return Response.json({
          success: false,
          error: 'Orden no encontrada',
          code: 'ORDER_NOT_FOUND'
        }, { status: 404 });
      }

      order = orders[0];
    } catch (error) {
      console.error('❌ [getPortalOrder] Error obteniendo orden:', error);
      return Response.json({
        success: false,
        error: 'Error al obtener orden',
        code: 'ORDER_FETCH_ERROR'
      }, { status: 500 });
    }

    // ✅ ACTUALIZAR ESTADÍSTICAS DE USO DEL TOKEN
    try {
      const clientIp = req.headers.get('x-forwarded-for') || 
                       req.headers.get('x-real-ip') || 
                       'unknown';

      await customClient.asServiceRole.entities.CustomerPortalToken.update(tokenRecord.id, {
        last_accessed_at: new Date().toISOString(),
        access_count: (tokenRecord.access_count || 0) + 1,
        metadata: {
          ...tokenRecord.metadata,
          last_access_ip: clientIp,
          last_access_user_agent: req.headers.get('user-agent') || 'unknown'
        }
      });
    } catch (updateError) {
      // No fallar si no se puede actualizar stats
      console.warn('⚠️ [getPortalOrder] No se pudieron actualizar stats:', updateError.message);
    }

    // ✅ FILTRAR DATOS SENSIBLES DE LA ORDEN
    // Remover información que no debería ser pública
    const safeOrder = {
      ...order,
      // Mantener solo info relevante para el cliente
      device_security: undefined, // No exponer PINs/passwords
      comments: order.comments?.filter(c => !c.internal), // Solo comentarios públicos
      status_history: order.status_history?.filter(h => h.visible_to_customer !== false),
    };

    console.log('✅ [getPortalOrder] Orden retornada exitosamente:', order.order_number);

    // ✅ RETORNAR ORDEN CON INFORMACIÓN DEL TOKEN
    return Response.json({
      success: true,
      order: safeOrder,
      token_info: {
        access_count: tokenRecord.access_count + 1,
        expires_at: tokenRecord.expires_at,
        created_date: tokenRecord.created_date
      },
      message: 'Orden obtenida exitosamente'
    });

  } catch (error) {
    console.error('❌ [getPortalOrder] Error general:', error);
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR',
      details: error.message
    }, { status: 500 });
  }
}
