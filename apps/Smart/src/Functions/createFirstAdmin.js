import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

// Supabase Auth Admin — REST directo (sin npm:@supabase/supabase-js)
async function authAdminCreateUser(email, password, fullName) {
  const url = Deno.env.get('VITE_SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName, role: 'admin' } }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data };
  return { data };
}

export async function createFirstAdminHandler(req) {
  console.log("🦕 createFirstAdmin called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});

    let body = {};
    try {
        body = await req.json();
    } catch (e) {
        // Ignore JSON parse error
    }

    const { full_name, email, pin, password, mode } = body;

    // Check if any users exist
    const existingUsers = await base44.asServiceRole.entities.User.filter({}, undefined, 1);
    const hasUsers = existingUsers && existingUsers.length > 0;

    // ---------------------------------------------------------
    // MODE: DEFAULT (Bypass / Emergency Reset)
    // ---------------------------------------------------------
    if (mode === 'default') {
        if (hasUsers) {
            // If users exist, find an admin to reset
            // Try to find the specific default admin first
            let targetUser = null;
            
            // 1. Try finding by default email
            const defaultAdmins = await base44.asServiceRole.entities.User.filter({ email: "admin@smartfix.com" });
            if (defaultAdmins.length > 0) {
                targetUser = defaultAdmins[0];
            } else {
                // 2. If not, just take the first user found (assumed to be the main admin in single-tenant setup)
                targetUser = existingUsers[0];
            }

            // Reset PIN to 0000 and ensure active/admin
            if (targetUser) {
                await base44.asServiceRole.entities.User.update(targetUser.id, {
                    pin: "0000",
                    active: true,
                    role: "admin" // Force admin role to ensure access
                });
                
                // Fetch updated user to return
                const updatedUser = await base44.asServiceRole.entities.User.filter({ id: targetUser.id });
                return Response.json({ success: true, user: updatedUser[0], message: "Admin PIN reset to 0000" });
            }
        }

        // If no users exist, create the default one
        const defaultAdmin = await base44.asServiceRole.entities.User.create({
            full_name: "Administrador",
            email: "admin@smartfix.com",
            pin: "0000",
            role: "admin",
            active: true,
            hourly_rate: 0
        });

        // Ensure settings exist
        await ensureSettings(base44);

        return Response.json({ success: true, user: defaultAdmin, message: "Default admin created" });
    }

    // ---------------------------------------------------------
    // MODE: MANUAL (Standard Setup Form)
    // ---------------------------------------------------------

    // Allow setup if the ONLY existing user is the default bypass admin (admin@smartfix.com).
    // Block only if a real user already exists.
    if (hasUsers) {
        const allUsers = await base44.asServiceRole.entities.User.filter({});
        const hasRealUsers = allUsers.some(u => u.email !== "admin@smartfix.com");
        if (hasRealUsers) {
            return Response.json({ error: 'Ya existen usuarios en el sistema. Usa el Bypass para entrar.' }, { status: 403 });
        }
    }

    if (!full_name || !email || !pin) {
        return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (!password || password.length < 8) {
        return Response.json({ error: 'La contraseña debe tener mínimo 8 caracteres' }, { status: 400 });
    }

    // Crear usuario en Supabase Auth (para login con email+password)
    const { data: authData, error: authError } = await authAdminCreateUser(email, password, full_name);

    if (authError && !authError.message?.includes('already registered') && !authError.msg?.includes('already')) {
        console.error('Error creating auth user:', authError);
        return Response.json({ error: `Error en Supabase Auth: ${authError.message || JSON.stringify(authError)}` }, { status: 500 });
    }

    const authUserId = authData?.user?.id || authData?.id || null;
    console.log("✅ Supabase Auth user created:", authUserId || "already existed");

    // ---------------------------------------------------------
    // Crear registro Tenant (la "tienda/negocio" SaaS)
    // ---------------------------------------------------------
    let tenantId = null;
    try {
        const newTenant = await base44.asServiceRole.entities.Tenant.create({
            name: full_name,
            email,
            country: "US",
            password_hash: "managed_by_supabase_auth",
            status: "active",
            plan: "smartfixos",
            subscription_status: "active",
            activated_date: new Date().toISOString()
        });
        tenantId = newTenant.id;
        console.log("🏪 Tenant created:", tenantId);
    } catch (tenantErr) {
        // Non-fatal for backward compat, but log clearly
        console.error("❌ Error creating Tenant:", tenantErr.message);
    }

    // Crear usuario en la base de datos de la app (tabla public.users)
    const newAdmin = await base44.asServiceRole.entities.User.create({
        full_name,
        email,
        pin,
        role: "admin",
        active: true,
        hourly_rate: 0,
        auth_id: authUserId || null,
        tenant_id: tenantId || null
    });

    // Auto-cleanup: eliminar el admin bypass (admin@smartfix.com) si existe,
    // ya que el usuario real acaba de ser creado y es el dueño del sistema.
    try {
        const bypassAdmins = await base44.asServiceRole.entities.User.filter({ email: "admin@smartfix.com" });
        for (const bu of bypassAdmins) {
            await base44.asServiceRole.entities.User.delete(bu.id);
            console.log("🧹 Bypass admin deleted:", bu.id);
        }
    } catch (cleanupErr) {
        // Non-fatal: log and continue even if cleanup fails
        console.warn("⚠️ Could not delete bypass admin:", cleanupErr.message);
    }

    await ensureSettings(base44, tenantId);

    return Response.json({ success: true, user: newAdmin, tenant_id: tenantId });

  } catch (error) {
    console.error('Error in createFirstAdmin:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

async function ensureSettings(base44, tenantId = null) {
    const settings = await base44.asServiceRole.entities.AppSettings.filter({ slug: 'app-main-settings' }, undefined, 1);
    if (!settings || settings.length === 0) {
        await base44.asServiceRole.entities.AppSettings.create({
            slug: 'app-main-settings',
            tenant_id: tenantId,
            payload: {
                businessName: 'SmartFixOS Store',
                setupCompleted: true,
                setupDate: new Date().toISOString()
            }
        });
    }
}
