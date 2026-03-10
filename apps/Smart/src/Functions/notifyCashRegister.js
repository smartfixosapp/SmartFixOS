import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

export async function notifyCashRegisterHandler(req) {
    try {
        const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
        
        // 1. Verificar autenticación
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { type, drawerData, performedBy } = await req.json();

        // 2. Obtener administradores para notificar
        // Usamos service role para asegurar acceso a lista de usuarios
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        
        if (!admins || admins.length === 0) {
            console.log("No admins found to notify");
            return Response.json({ success: true, message: "No admins to notify" });
        }

        // 3. Preparar contenido del email
        const isClosing = type === 'closing';
        const title = isClosing ? '🔒 Caja Cerrada' : '🔓 Caja Abierta';
        const color = isClosing ? '#EF4444' : '#10B981'; // Red or Emerald
        
        let detailsHtml = '';
        
        if (isClosing) {
            const diff = drawerData.final_count?.difference || 0;
            const diffColor = diff === 0 ? '#10B981' : (diff < 0 ? '#EF4444' : '#F59E0B');
            const diffText = diff > 0 ? `+$${diff.toFixed(2)}` : `$${diff.toFixed(2)}`;
            
            detailsHtml = `
                <div style="background: #F3F4F6; padding: 15px; border-radius: 10px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Ventas Totales:</strong> $${(drawerData.total_revenue || 0).toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>Efectivo Esperado:</strong> $${(drawerData.final_count?.expectedCash || 0).toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>Efectivo Contado:</strong> $${(drawerData.closing_balance || 0).toFixed(2)}</p>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #E5E7EB;">
                        <p style="margin: 0; font-size: 1.1em;"><strong>Diferencia:</strong> <span style="color: ${diffColor}; font-weight: bold;">${diffText}</span></p>
                    </div>
                </div>
            `;
        } else {
            detailsHtml = `
                <div style="background: #F3F4F6; padding: 15px; border-radius: 10px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Monto Inicial:</strong> $${(drawerData.opening_balance || 0).toFixed(2)}</p>
                </div>
            `;
        }

        const emailBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="background-color: ${color}; color: white; width: 50px; height: 50px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 10px;">
                        ${isClosing ? '🔒' : '🔓'}
                    </div>
                    <h1 style="margin: 0; color: #111827; font-size: 24px;">${title}</h1>
                    <p style="margin: 5px 0 0; color: #6B7280;">${new Date().toLocaleString()}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="margin: 0; color: #374151;">Hola,</p>
                    <p style="margin: 10px 0; color: #374151;">
                        El usuario <strong>${performedBy?.full_name || performedBy?.email || 'Desconocido'}</strong> acaba de ${isClosing ? 'cerrar' : 'abrir'} la caja registradora.
                    </p>
                </div>

                ${detailsHtml}

                <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #9CA3AF;">
                    Enviado automáticamente por SmartFixOS
                </div>
            </div>
        `;

        // 4. Enviar emails
        const emailPromises = admins.map(admin => {
            if (!admin.email) return Promise.resolve();
            
            return base44.integrations.Core.SendEmail({
                to: admin.email,
                subject: `[SmartFixOS] ${title} - ${new Date().toLocaleDateString()}`,
                body: emailBody
            });
        });

        await Promise.all(emailPromises);

        return Response.json({ success: true, notified: admins.length });

    } catch (error) {
        console.error("Error sending notification:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
};
