import { useEffect, useState } from "react";
import { dataClient } from "@/components/api/dataClient";

/**
 * Hook para validar el estado de trial de un tenant
 * Retorna: { isTrialActive, isTrialExpired, tenant, loading }
 */
export const useTenantTrialStatus = (tenantId) => {
  const [status, setStatus] = useState({
    isTrialActive: null,
    isTrialExpired: false,
    tenant: null,
    loading: true
  });

  useEffect(() => {
    if (!tenantId) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    const checkTrialStatus = async () => {
      try {
        const tenant = await dataClient.entities.Tenant.get(tenantId);

        if (!tenant) {
          setStatus(prev => ({ ...prev, loading: false }));
          return;
        }

        const now = new Date();
        const trialEndDate = new Date(tenant.trial_end_date);

        const isTrialExpired = trialEndDate < now && tenant.trial_status !== "completed";
        const isTrialActive = !isTrialExpired && tenant.trial_status === "active";

        setStatus({
          isTrialActive,
          isTrialExpired,
          tenant,
          loading: false
        });
      } catch (error) {
        console.error("Error checking trial status:", error);
        setStatus(prev => ({ ...prev, loading: false }));
      }
    };

    checkTrialStatus();
  }, [tenantId]);

  return status;
};

/**
 * Helper para validar si un tenant tiene acceso permitido
 */
export const canAccessCore = (tenant) => {
  if (!tenant) return false;

  // Si hay una suscripción activa, permitir
  if (tenant.subscription_status === "active") return true;

  // Si el trial todavía está activo, permitir
  if (tenant.trial_status === "active") {
    const now = new Date();
    const trialEndDate = new Date(tenant.trial_end_date);
    return trialEndDate > now;
  }

  // En todos los otros casos, denegar
  return false;
};
