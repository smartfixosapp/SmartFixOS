import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { dataClient } from "@/components/api/dataClient";

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [userMemberships, setUserMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const tenantRef = useRef(null); // track current tenant for refresh comparison

  useEffect(() => {
    loadTenantContext();
  }, []);

  // ── Auto-refresh tenant every 2 min to pick up plan changes from GACC ──
  useEffect(() => {
    const refreshTenant = async () => {
      const tid = tenantRef.current?.id;
      if (!tid) return;
      try {
        const fresh = await dataClient.entities.Tenant.get(tid);
        if (fresh && fresh.plan !== tenantRef.current?.plan) {
          // Plan changed externally (from GACC) — update in place
          console.log(`[TenantContext] Plan changed: ${tenantRef.current?.plan} → ${fresh.plan}`);
          setCurrentTenant(fresh);
          tenantRef.current = fresh;
        } else if (fresh) {
          // Update silently (other fields may have changed too)
          tenantRef.current = fresh;
          setCurrentTenant(fresh);
        }
      } catch {}
    };
    const iv = setInterval(refreshTenant, 2 * 60 * 1000); // every 2 min
    return () => clearInterval(iv);
  }, []);

  const loadTenantContext = async () => {
    try {
      const user = await dataClient.auth.me();
      if (!user?.email) {
        // No auth user — try to load tenant from employee session (PIN login)
        const tenantFromSession = await loadTenantFromSession();
        if (tenantFromSession) {
          setCurrentTenant(tenantFromSession);
          tenantRef.current = tenantFromSession;
        } else {
          setCurrentTenant(null);
          tenantRef.current = null;
        }
        setUserMemberships([]);
        setIsSuperAdmin(false);
        return;
      }

      // Verificar si es super admin
      const superAdmin = user.email === "admin@smartfixos.com" || user.email === "911smartfix@gmail.com" || user.role === "super_admin" || user.position === "superadmin";
      setIsSuperAdmin(superAdmin);

      if (superAdmin) {
        const tenants = await dataClient.entities.Tenant.filter({ status: "active" });
        if (tenants?.length) {
          setCurrentTenant(tenants[0]);
          tenantRef.current = tenants[0];
        }
        setLoading(false);
        return;
      }

      // Cargar membresías del usuario
      let memberships = [];
      try {
        memberships = await dataClient.entities.TenantMembership.filter({
          user_email: user.email,
          status: "active"
        });
      } catch {}

      setUserMemberships(memberships || []);

      if (memberships?.length > 0) {
        const storedTenantId = localStorage.getItem("current_tenant_id");
        const membership = memberships.find(m => m.tenant_id === storedTenantId) || memberships[0];

        const tenant = await dataClient.entities.Tenant.get(membership.tenant_id);
        setCurrentTenant(tenant);
        tenantRef.current = tenant;
        localStorage.setItem("current_tenant_id", tenant.id);
      } else {
        // No memberships found — fallback to employee session tenant_id
        const tenantFromSession = await loadTenantFromSession();
        if (tenantFromSession) {
          setCurrentTenant(tenantFromSession);
          tenantRef.current = tenantFromSession;
        }
      }
    } catch (error) {
      console.warn("Tenant context no disponible en este modo:", error?.message || error);
      // Last resort: try session-based tenant
      try {
        const tenantFromSession = await loadTenantFromSession();
        if (tenantFromSession) { setCurrentTenant(tenantFromSession); tenantRef.current = tenantFromSession; }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resolve tenant from employee_session or localStorage tenant_id.
   * This covers the common case where users login via PIN (no TenantMembership records).
   */
  const loadTenantFromSession = async () => {
    try {
      // Try employee_session first
      const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
      let tenantId = null;
      if (raw) {
        try {
          const session = JSON.parse(raw);
          tenantId = session?.tenant_id || session?.user?.tenant_id || session?.session?.tenant_id;
        } catch {}
      }
      // Fallback to direct tenant_id keys
      if (!tenantId) {
        tenantId = localStorage.getItem("smartfix_tenant_id") || localStorage.getItem("current_tenant_id") || sessionStorage.getItem("current_tenant_id");
      }
      if (!tenantId) return null;

      const tenant = await dataClient.entities.Tenant.get(tenantId);
      if (tenant?.id) {
        localStorage.setItem("current_tenant_id", tenant.id);
        return tenant;
      }
      return null;
    } catch {
      return null;
    }
  };

  const switchTenant = async (tenantId) => {
    try {
      const tenant = await dataClient.entities.Tenant.get(tenantId);
      setCurrentTenant(tenant);
      localStorage.setItem("current_tenant_id", tenantId);
      window.location.reload(); // Recargar para aplicar contexto
    } catch (error) {
      console.error("Error switching tenant:", error);
    }
  };

  const hasPermission = (permission) => {
    if (isSuperAdmin) return true;
    
    const membership = userMemberships.find(m => m.tenant_id === currentTenant?.id);
    if (!membership) return false;

    // Buscar rol y verificar permisos
    // TODO: Implementar verificación completa de permisos
    return true;
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        userMemberships,
        isSuperAdmin,
        loading,
        switchTenant,
        hasPermission,
        reloadContext: loadTenantContext
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return context;
}
