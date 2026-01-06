import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

export async function verifyAndCreateAdminHandler(req) {
  console.log("🦕 verifyAndCreateAdmin called");
  try {
    // Using pre-configured unified client
    const { token, pin, business_name, business_phone } = await req.json();

    if (!token || !pin) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Buscar el token de verificación
    const tokenRecords = await customClient.asServiceRole.entities.SystemConfig.filter({
      key: `verification_token_${token}`,
      category: 'setup'
    });

    if (!tokenRecords || tokenRecords.length === 0) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const tokenData = JSON.parse(tokenRecords[0].value);
    
    // Verificar que no haya expirado (24 horas)
    const tokenDate = new Date(tokenData.created_at);
    const now = new Date();
    const hoursDiff = (now - tokenDate) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      return Response.json({ error: 'Token expired' }, { status: 400 });
    }

    // Crear el usuario administrador
    const adminUser = await customClient.asServiceRole.entities.User.create({
      full_name: tokenData.full_name,
      email: tokenData.email,
      pin: pin,
      role: 'admin',
      active: true,
      hourly_rate: 0
    });

    // Guardar configuración del negocio si se proporcionó
    if (business_name) {
      const existingSettings = await customClient.asServiceRole.entities.AppSettings.filter({
        slug: 'app-main-settings'
      });

      if (existingSettings?.length > 0) {
        await customClient.asServiceRole.entities.AppSettings.update(existingSettings[0].id, {
          payload: {
            ...existingSettings[0].payload,
            businessName: business_name,
            businessPhone: business_phone || '',
            setupCompleted: true,
            setupDate: new Date().toISOString()
          }
        });
      } else {
        await customClient.asServiceRole.entities.AppSettings.create({
          slug: 'app-main-settings',
          payload: {
            businessName: business_name,
            businessPhone: business_phone || '',
            setupCompleted: true,
            setupDate: new Date().toISOString()
          }
        });
      }
    }

    // Eliminar el token usado
    await customClient.asServiceRole.entities.SystemConfig.delete(tokenRecords[0].id);

    return Response.json({ 
      success: true, 
      message: 'Admin user created successfully',
      user: {
        id: adminUser.id,
        full_name: adminUser.full_name,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
