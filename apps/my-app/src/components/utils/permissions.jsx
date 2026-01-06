import { base44 } from "@/api/base44Client";

let permissionsCache = null;
let cacheTime = 0;
const CACHE_DURATION = 60000; // 1 minuto

/**
 * Helper no destructivo para verificar permisos
 * Si no puede determinar permisos, devuelve true (no bloquea)
 */
export async function can(permissionCode) {
  try {
    // Verificar feature flag
    const flags = await getFeatureFlags();
    if (!flags.user_roles_management) {
      return true; // Feature deshabilitado, permitir todo (comportamiento actual)
    }

    const user = await base44.auth.me();
    if (!user) return false;

    // Admin siempre puede todo
    if (user.role === "admin") return true;

    // Cachear permisos por 1 minuto
    const now = Date.now();
    if (!permissionsCache || (now - cacheTime) > CACHE_DURATION) {
      await loadUserPermissions(user.id);
    }

    return permissionsCache?.includes(permissionCode) || false;
  } catch (e) {
    console.warn("Permission check failed, allowing by default:", e);
    return true; // En caso de error, no bloquear (fallback seguro)
  }
}

async function loadUserPermissions(userId) {
  try {
    // Obtener roles del usuario
    const userRoles = await base44.entities.UserRole.filter({ user_id: userId });
    if (!userRoles?.length) {
      permissionsCache = [];
      cacheTime = Date.now();
      return;
    }

    // Obtener permisos de cada rol
    const roleIds = userRoles.map(ur => ur.role_id);
    const allPermissions = new Set();

    for (const roleId of roleIds) {
      const rolePerms = await base44.entities.RolePermission.filter({ role_id: roleId });
      rolePerms.forEach(rp => allPermissions.add(rp.permission_code));
    }

    permissionsCache = Array.from(allPermissions);
    cacheTime = Date.now();
  } catch (e) {
    console.error("Error loading permissions:", e);
    permissionsCache = [];
    cacheTime = Date.now();
  }
}

async function getFeatureFlags() {
  try {
    const rows = await base44.entities.SystemConfig.filter({ key: "feature_flags" });
    const raw = rows?.[0]?.value || rows?.[0]?.value_json;
    let flags = { user_roles_management: true, dashboard_note_targeting: true };
    
    if (typeof raw === "string") {
      try { flags = { ...flags, ...JSON.parse(raw) }; } catch {}
    } else if (typeof raw === "object" && raw !== null) {
      flags = { ...flags, ...raw };
    }
    
    return flags;
  } catch {
    return { user_roles_management: true, dashboard_note_targeting: true };
  }
}

export function clearPermissionsCache() {
  permissionsCache = null;
  cacheTime = 0;
}
