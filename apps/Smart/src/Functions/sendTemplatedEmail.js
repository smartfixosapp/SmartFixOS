import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import { sendTemplatedEmailWithBase44 } from './emailTemplateRuntime.js';

export async function sendTemplatedEmailHandler(req) {
  console.log("🦕 sendTemplatedEmail called");
  try {
    const base44 = createClientFromRequest(req, {
      functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),
      entitiesPath: new URL('../Entities', import.meta.url).pathname
    });

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event_type, order_data } = await req.json();
    if (!event_type) {
      return Response.json({ error: 'event_type es requerido' }, { status: 400 });
    }

    const result = await sendTemplatedEmailWithBase44(base44, { event_type, order_data });
    if (result?.success === false) {
      return Response.json(result);
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
