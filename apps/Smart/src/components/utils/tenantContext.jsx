import React, { createContext, useContext, useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [userMemberships, setUserMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    loadTenantContext();
  }, []);

  const loadTenantContext = async () => {
    try {
      const user = await dataClient.auth.me();
      if (!user?.email) {
        setCurrentTenant(null);
        setUserMemberships([]);
        setIsSuperAdmin(false);
        return;
      }
      
      // Verificar si es super admin
      const superAdmin = user.email === "admin@smartfixos.com" || user.email === "911smartfix@gmail.com" || user.role === "super_admin" || user.position === "superadmin";
      setIsSuperAdmin(superAdmin);

      if (superAdmin) {
        // Super admin puede ver todos los tenants
        const tenants = await dataClient.entities.Tenant.filter({ status: "active" });
        if (tenants?.length) {
          setCurrentTenant(tenants[0]);
        }
        setLoading(false);
        return;
      }

      // Cargar membresías del usuario
      const memberships = await dataClient.entities.TenantMembership.filter({
        user_email: user.email,
        status: "active"
      });

      setUserMemberships(memberships || []);

      if (memberships?.length > 0) {
        // Cargar tenant por defecto (primero en la lista)
        const storedTenantId = localStorage.getItem("current_tenant_id");
        const membership = memberships.find(m => m.tenant_id === storedTenantId) || memberships[0];
        
        const tenant = await dataClient.entities.Tenant.get(membership.tenant_id);
        setCurrentTenant(tenant);
        localStorage.setItem("current_tenant_id", tenant.id);
      }
    } catch (error) {
      console.warn("Tenant context no disponible en este modo:", error?.message || error);
    } finally {
      setLoading(false);
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
