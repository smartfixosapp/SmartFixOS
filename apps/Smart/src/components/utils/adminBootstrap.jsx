const DASHBOARD_DEFAULTS = [
  { id: "orders", label: "Órdenes", icon: "ClipboardList", gradient: "from-purple-500 to-pink-600", action: "Orders", type: "navigate", enabled: true },
  { id: "pos", label: "POS", icon: "Wallet", gradient: "from-green-600 to-emerald-700", action: "POS", type: "navigate", enabled: true },
  { id: "customers", label: "Clientes", icon: "Users", gradient: "from-blue-600 to-indigo-700", action: "Customers", type: "navigate", enabled: true },
  { id: "inventory", label: "Inventario", icon: "Package", gradient: "from-teal-500 to-cyan-600", action: "Inventory", type: "navigate", enabled: true },
  { id: "financial", label: "Finanzas", icon: "Wallet", gradient: "from-emerald-600 to-green-700", action: "Financial", type: "navigate", enabled: true },
  { id: "reports", label: "Reportes", icon: "BarChart3", gradient: "from-blue-600 to-indigo-700", action: "Reports", type: "navigate", enabled: true },
  { id: "recharges", label: "Recargas", icon: "Zap", gradient: "from-amber-500 to-yellow-600", action: "Recharges", type: "navigate", enabled: true },
  { id: "technicians", label: "Técnicos", icon: "Wrench", gradient: "from-cyan-500 to-blue-600", action: "Technicians", type: "navigate", enabled: true },
  { id: "notifications", label: "Notificaciones", icon: "Bell", gradient: "from-orange-500 to-red-600", action: "Notifications", type: "navigate", enabled: true },
  { id: "users", label: "Panel Administrativo", icon: "Users", gradient: "from-pink-500 to-rose-600", action: "UsersManagement", type: "navigate", enabled: true },
  { id: "database", label: "Base de Datos", icon: "SettingsIcon", gradient: "from-cyan-600 to-blue-600", action: "Settings", type: "navigate", enabled: true }
];

const ADMIN_PANEL_DEFAULTS = [
  { id: "users", label: "Gestión de Usuarios", icon: "Users", gradient: "from-cyan-600 to-blue-600", view: "users", type: "view", enabled: true },
  { id: "time", label: "Control de Tiempo", icon: "Clock", gradient: "from-emerald-600 to-green-600", view: "time", type: "view", enabled: true },
  { id: "business_info", label: "Info del Negocio", icon: "Building2", gradient: "from-orange-600 to-amber-600", view: "business_info", type: "view", enabled: true },
  { id: "payment_methods", label: "Métodos de Pago", icon: "CreditCard", gradient: "from-green-600 to-emerald-600", view: "payment_methods", type: "view", enabled: true },
  { id: "inventory", label: "Inventario", icon: "Package", gradient: "from-teal-500 to-cyan-600", action: "Inventory", type: "navigate", enabled: true },
  { id: "suppliers", label: "Suplidores", icon: "Package", gradient: "from-indigo-600 to-blue-600", action: "Inventory", type: "navigate", enabled: true },
  { id: "financial", label: "Finanzas", icon: "Wallet", gradient: "from-purple-600 to-violet-600", action: "Financial", type: "navigate", enabled: true },
  { id: "reports", label: "Reportes", icon: "BarChart3", gradient: "from-indigo-600 to-blue-600", action: "Reports", type: "navigate", enabled: true },
  { id: "database", label: "Base de Datos", icon: "FileText", gradient: "from-slate-600 to-slate-800", action: "Settings", type: "navigate", enabled: true }
];

function mergeDefaults(savedButtons = [], defaults = []) {
  const savedMap = new Map((savedButtons || []).map((b) => [b.id, b]));
  const custom = (savedButtons || []).filter(
    (b) => !defaults.some((d) => d.id === b.id)
  );

  const mergedDefaults = defaults.map((d, idx) => {
    const saved = savedMap.get(d.id) || {};
    return {
      ...saved,
      ...d,
      enabled: true,
      order: Number.isFinite(saved.order) ? saved.order : idx
    };
  });

  return [...mergedDefaults, ...custom]
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
    .map((b, idx) => ({ ...b, order: idx }));
}

async function upsertAppSetting(base44, slug, payload, description) {
  const rows = await base44.entities.AppSettings.filter({ slug });
  if (rows?.length) {
    await base44.entities.AppSettings.update(rows[0].id, { payload });
  } else {
    await base44.entities.AppSettings.create({ slug, payload, description });
  }
}

export async function ensureAdminBootstrap(base44) {
  try {
    const [dashRows, adminRows] = await Promise.all([
      base44.entities.AppSettings.filter({ slug: "dashboard-buttons" }),
      base44.entities.AppSettings.filter({ slug: "admin-panel-buttons" })
    ]);

    const currentDash = dashRows?.[0]?.payload?.buttons || [];
    const currentAdmin = adminRows?.[0]?.payload?.buttons || [];

    const mergedDash = mergeDefaults(currentDash, DASHBOARD_DEFAULTS);
    const mergedAdmin = mergeDefaults(currentAdmin, ADMIN_PANEL_DEFAULTS);

    await Promise.all([
      upsertAppSetting(
        base44,
        "dashboard-buttons",
        { buttons: mergedDash },
        "Botones del dashboard (bootstrap admin)"
      ),
      upsertAppSetting(
        base44,
        "admin-panel-buttons",
        { buttons: mergedAdmin },
        "Botones del panel administrativo (bootstrap admin)"
      )
    ]);
  } catch (error) {
    console.warn("Admin bootstrap: no se pudo persistir configuración.", error);
  }
}

export async function ensureTenantAdminUser(supabase, tenantId, fallbackSession = null) {
  if (!supabase || !tenantId) return null;

  let authUser = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    authUser = data?.user || null;
  } catch (error) {
    console.warn("Admin bootstrap: no se pudo leer auth user.", error);
  }

  const fallbackEmail = String(
    authUser?.email ||
    fallbackSession?.email ||
    fallbackSession?.userEmail ||
    ""
  ).trim().toLowerCase();

  if (!fallbackEmail) return null;

  const fallbackName = String(
    authUser?.user_metadata?.full_name ||
    fallbackSession?.full_name ||
    fallbackSession?.userName ||
    fallbackEmail
  ).trim();

  const fallbackAuthId = authUser?.id || fallbackSession?.auth_id || fallbackSession?.id || null;

  const basePayload = {
    tenant_id: tenantId,
    email: fallbackEmail,
    full_name: fallbackName,
    role: "admin",
    position: "admin",
    active: true,
    auth_id: fallbackAuthId,
  };

  try {
    const { data: existingByAuth, error: authLookupError } = fallbackAuthId
      ? await supabase
          .from("users")
          .select("id, tenant_id, email, full_name, role, position, active, auth_id")
          .eq("auth_id", fallbackAuthId)
          .eq("tenant_id", tenantId)
          .limit(1)
      : { data: [], error: null };

    if (authLookupError) throw authLookupError;

    const existingAuthUser = existingByAuth?.[0] || null;
    if (existingAuthUser) {
      const patch = {};
      if (!existingAuthUser.email) patch.email = fallbackEmail;
      if (!existingAuthUser.full_name) patch.full_name = fallbackName;
      if (existingAuthUser.role !== "admin") patch.role = "admin";
      if (existingAuthUser.position !== "admin") patch.position = "admin";
      if (existingAuthUser.active === false) patch.active = true;
      if (!existingAuthUser.auth_id && fallbackAuthId) patch.auth_id = fallbackAuthId;

      if (Object.keys(patch).length) {
        const { error: updateError } = await supabase.from("users").update(patch).eq("id", existingAuthUser.id);
        if (updateError) throw updateError;
      }
      return { ...existingAuthUser, ...patch };
    }

    const { data: existingByEmail, error: emailLookupError } = await supabase
      .from("users")
      .select("id, tenant_id, email, full_name, role, position, active, auth_id")
      .eq("tenant_id", tenantId)
      .eq("email", fallbackEmail)
      .limit(1);

    if (emailLookupError) throw emailLookupError;

    const existingEmailUser = existingByEmail?.[0] || null;
    if (existingEmailUser) {
      const patch = {
        role: "admin",
        position: "admin",
        active: true,
      };
      if (!existingEmailUser.full_name) patch.full_name = fallbackName;
      if (!existingEmailUser.auth_id && fallbackAuthId) patch.auth_id = fallbackAuthId;

      const { error: updateError } = await supabase.from("users").update(patch).eq("id", existingEmailUser.id);
      if (updateError) throw updateError;
      return { ...existingEmailUser, ...patch };
    }

    const insertPayload = fallbackAuthId ? { ...basePayload, id: fallbackAuthId } : basePayload;
    const { data: createdRows, error: createError } = await supabase
      .from("users")
      .insert(insertPayload)
      .select("id, tenant_id, email, full_name, role, position, active, auth_id")
      .limit(1);

    if (createError) throw createError;
    return createdRows?.[0] || insertPayload;
  } catch (error) {
    console.warn("Admin bootstrap: no se pudo asegurar admin del tenant.", error);
    return null;
  }
}
