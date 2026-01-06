import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

export async function sendVerificationEmailHandler(req) {
  console.log("🦕 sendVerificationEmail called");
  try {
    // Using pre-configured unified client
    const { email, full_name, token } = await req.json();

    if (!email || !token) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const verificationUrl = `${req.headers.get('origin')}/VerifySetup?token=${token}`;

    const emailBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { background: linear-gradient(135deg, #06b6d4, #10b981); padding: 20px; border-radius: 12px; display: inline-block; margin-bottom: 20px; }
          h1 { color: #111827; margin: 0; }
          .content { color: #374151; line-height: 1.6; }
          .button { display: inline-block; background: linear-gradient(135deg, #06b6d4, #10b981); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; margin: 30px 0; }
          .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">
              <span style="color: white; font-size: 24px; font-weight: bold;">🔧 SmartFixOS</span>
            </div>
            <h1>¡Bienvenido a SmartFixOS!</h1>
          </div>
          
          <div class="content">
            <p>Hola <strong>${full_name}</strong>,</p>
            
            <p>Gracias por registrarte en SmartFixOS. Para completar la configuración de tu cuenta de administrador, por favor verifica tu correo electrónico haciendo clic en el botón de abajo:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verificar Email y Continuar</a>
            </div>
            
            <p>Este enlace es válido por 24 horas. Si no solicitaste esta verificación, puedes ignorar este correo.</p>
            
            <p>Una vez verificado, podrás crear tu PIN de acceso y comenzar a usar el sistema.</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} SmartFixOS. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await customClient.integrations.Core.SendEmail({
      to: email,
      subject: '🔐 Verifica tu email - SmartFixOS',
      body: emailBody
    });

    return Response.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Error sending verification email:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
