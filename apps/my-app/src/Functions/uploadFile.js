import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

/**
 * Función RPC para subir archivos con versionado y logging
 * 
 * Features:
 * - Validación de tamaño (máx 10MB)
 * - Versionado automático (?v=timestamp)
 * - URLs públicas de solo lectura
 * - Escritura solo por usuarios autenticados
 * - Logging en FileUpload entity
 * 
 * @param {string} file - Archivo en base64 o FormData
 * @param {string} file_name - Nombre del archivo (opcional)
 * @param {string} related_entity_type - Tipo de entidad relacionada (opcional)
 * @param {string} related_entity_id - ID de entidad relacionada (opcional)
 * @param {object} metadata - Metadata adicional (opcional)
 * 
 * @returns {object} { success: boolean, file_url: string, versioned_url: string, file_id: string }
 */
export async function uploadFileHandler(req) {
  console.log("🦕 uploadFile called");
  try {
    // Using pre-configured unified client
    
    // ✅ VALIDACIÓN DE AUTENTICACIÓN
    let user = null;
    try {
      user = await customClient.auth.me();
    } catch {
      return Response.json({
        success: false,
        error: 'Usuario no autenticado. Solo usuarios con sesión pueden subir archivos.'
      }, { status: 401 });
    }

    // ✅ VALIDACIÓN DE PERMISOS (ejemplo: todos los autenticados pueden subir)
    // Aquí puedes agregar lógica más granular basada en rolePermissions
    if (!user.id) {
      return Response.json({
        success: false,
        error: 'Usuario inválido'
      }, { status: 403 });
    }

    // ✅ PARSEAR REQUEST
    const contentType = req.headers.get('content-type') || '';
    let file, file_name, related_entity_type, related_entity_id, metadata;

    if (contentType.includes('multipart/form-data')) {
      // FormData desde frontend
      const formData = await req.formData();
      file = formData.get('file');
      file_name = formData.get('file_name') || file?.name;
      related_entity_type = formData.get('related_entity_type');
      related_entity_id = formData.get('related_entity_id');
      
      try {
        metadata = JSON.parse(formData.get('metadata') || '{}');
      } catch {
        metadata = {};
      }
    } else {
      // JSON con base64
      const body = await req.json();
      file = body.file;
      file_name = body.file_name;
      related_entity_type = body.related_entity_type;
      related_entity_id = body.related_entity_id;
      metadata = body.metadata || {};
    }

    if (!file) {
      return Response.json({
        success: false,
        error: 'No se proporcionó archivo'
      }, { status: 400 });
    }

    // ✅ VALIDAR TAMAÑO (10MB MAX)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    let fileSize = 0;
    let mimeType = '';

    if (file instanceof File || file instanceof Blob) {
      fileSize = file.size;
      mimeType = file.type;
      
      if (fileSize > MAX_SIZE) {
        return Response.json({
          success: false,
          error: `Archivo demasiado grande. Máximo 10MB (recibido: ${(fileSize / 1024 / 1024).toFixed(2)}MB)`
        }, { status: 413 });
      }
    }

    console.log('📤 [uploadFile] Subiendo archivo:', file_name);
    console.log('👤 [uploadFile] Usuario:', user.full_name || user.email);
    console.log('📊 [uploadFile] Tamaño:', (fileSize / 1024).toFixed(2), 'KB');

    try {
      // ✅ SUBIR ARCHIVO USANDO INTEGRACIÓN CORE
      const uploadResult = await customClient.integrations.Core.UploadFile({
        file: file
      });

      if (!uploadResult.file_url) {
        throw new Error('No se recibió URL del archivo');
      }

      // ✅ GENERAR VERSIÓN CON TIMESTAMP
      const version = Date.now().toString();
      const separator = uploadResult.file_url.includes('?') ? '&' : '?';
      const versionedUrl = `${uploadResult.file_url}${separator}v=${version}`;

      console.log('✅ [uploadFile] Archivo subido:', uploadResult.file_url);
      console.log('🔗 [uploadFile] URL versionada:', versionedUrl);

      // ✅ REGISTRAR EN BASE DE DATOS
      const fileLog = await customClient.asServiceRole.entities.FileUpload.create({
        file_name: file_name || 'unnamed',
        file_url: uploadResult.file_url,
        file_size: fileSize,
        mime_type: mimeType || 'application/octet-stream',
        bucket: 'public/device-photos',
        uploaded_by: user.id,
        uploaded_by_role: user.role || 'user',
        related_entity_type: related_entity_type || 'general',
        related_entity_id: related_entity_id || null,
        version: version,
        metadata: {
          ...metadata,
          user_email: user.email,
          user_name: user.full_name,
          upload_timestamp: new Date().toISOString()
        }
      });

      console.log('📋 [uploadFile] Log creado con ID:', fileLog.id);

      // ✅ RETORNAR RESPUESTA
      return Response.json({
        success: true,
        file_url: uploadResult.file_url,
        versioned_url: versionedUrl,
        file_id: fileLog.id,
        file_size: fileSize,
        mime_type: mimeType,
        version: version,
        message: 'Archivo subido exitosamente'
      });

    } catch (uploadError) {
      console.error('❌ [uploadFile] Error subiendo archivo:', uploadError);
      
      return Response.json({
        success: false,
        error: uploadError.message || 'Error al subir archivo'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [uploadFile] Error general:', error);
    return Response.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
