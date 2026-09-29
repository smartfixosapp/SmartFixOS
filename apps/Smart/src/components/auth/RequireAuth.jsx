import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Store, LogOut, RefreshCw, ChevronRight } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { PageSpinner } from "@/components/ui/spinner";
import { signOut } from "@/components/auth/signOut";

function pinTenantScope(tenant) {
  const tenantId = tenant?.tenant_id;
  if (!tenantId) return;
  try {
    localStorage.setItem("smartfix_tenant_id", tenantId);
    localStorage.setItem("current_tenant_id", tenantId);
    localStorage.setItem("smartfix_tenant_name", tenant.tenant_name || "");
    localStorage.setItem("smartfix_tenant_role", tenant.role || "");
    const sessionTenant = (raw) => {
      try {
        const s = raw ? JSON.parse(raw) : null;
        return s?.tenant_id || s?.user?.tenant_id || s?.session?.tenant_id || null;
      } catch {
        return null;
      }
    };
    const emp = localStorage.getItem("employee_session");
    if (emp && sessionTenant(emp) !== tenantId) localStorage.removeItem("employee_session");
    const legacy = sessionStorage.getItem("911-session");
    if (legacy && sessionTenant(legacy) !== tenantId) sessionStorage.removeItem("911-session");
  } catch {
    return;
  }
}

function roleAllowed(role, roles) {
  if (!roles) return true;
  if (roles.includes(role)) return true;
  return role === "manager" && roles.includes("admin");
}

const ROLE_LABELS = {
  owner: "Dueño",
  admin: "Administrador",
  manager: "Gerente",
  contable: "Contable",
  technician: "Técnico",
  cashier: "Cajero",
};

function Screen({ title, body, children }) {
  return (
    <div className="apple-type min-h-dvh flex items-center justify-center p-6" style={{ background: "#000", color: "#fff" }}>
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="text-center">
          <p style={{ fontSize: 22, fontWeight: 800 }}>{title}</p>
          {body && <p style={{ fontSize: 15, color: "#8E8E93", marginTop: 6 }}>{body}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function SignOutButton() {
  return (
    <button
      onClick={signOut}
      className="apple-press w-full flex items-center justify-center gap-2"
      style={{ background: "#1C1C1E", color: "#FF6961", borderRadius: 14, height: 48, fontSize: 15, fontWeight: 600 }}
    >
      <LogOut className="w-4 h-4" /> Cerrar sesión
    </button>
  );
}

export default function RequireAuth({ children, roles }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({ status: "checking" });
  const rolesKey = (roles || []).join(",");

  const apply = useCallback((tenant) => {
    const allowedRoles = rolesKey ? rolesKey.split(",") : null;
    if (!roleAllowed(tenant.role, allowedRoles)) {
      setState({ status: "denied", tenant });
      return;
    }
    pinTenantScope(tenant);
    setState({ status: "ok", tenant });
  }, [rolesKey]);

  const resolve = useCallback(async () => {
    setState({ status: "checking" });
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      navigate("/Login", { replace: true, state: { from: location.pathname } });
      return;
    }
    const { data: tenants, error } = await supabase.rpc("get_user_tenants");
    if (error) {
      setState({ status: "error" });
      return;
    }
    const list = Array.isArray(tenants) ? tenants : [];
    if (list.length === 0) {
      setState({ status: "none" });
      return;
    }
    let stored = null;
    try {
      stored = localStorage.getItem("smartfix_tenant_id");
    } catch {
      stored = null;
    }
    const pick = list.find((t) => t.tenant_id === stored) || (list.length === 1 ? list[0] : null);
    if (pick) apply(pick);
    else setState({ status: "choose", tenants: list });
  }, [apply, location.pathname, navigate]);

  useEffect(() => {
    resolve().catch(() => setState({ status: "error" }));
  }, [resolve]);

  if (state.status === "checking") return <PageSpinner />;

  if (state.status === "error") {
    return (
      <Screen title="No pudimos cargar tu taller" body="Verifica tu conexión e intenta de nuevo.">
        <button
          onClick={() => resolve().catch(() => setState({ status: "error" }))}
          className="apple-press w-full flex items-center justify-center gap-2"
          style={{ background: "#F2662E", color: "#fff", borderRadius: 14, height: 48, fontSize: 15, fontWeight: 700 }}
        >
          <RefreshCw className="w-4 h-4" /> Reintentar
        </button>
        <SignOutButton />
      </Screen>
    );
  }

  if (state.status === "none") {
    return (
      <Screen
        title="Tu cuenta no tiene taller"
        body="Esta cuenta no pertenece a ningún taller. Si eres empleado, pídele al dueño que te agregue. Si eres dueño, registra tu taller."
      >
        <SignOutButton />
      </Screen>
    );
  }

  if (state.status === "choose") {
    return (
      <Screen title="Elige un taller" body="Tu cuenta tiene acceso a varios talleres.">
        <div className="flex flex-col gap-2">
          {state.tenants.map((t) => (
            <button
              key={t.tenant_id}
              onClick={() => apply(t)}
              className="apple-press w-full flex items-center gap-3 text-left"
              style={{ background: "#1C1C1E", borderRadius: 16, padding: 14 }}
            >
              {t.logo_url ? (
                <img src={t.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} />
              ) : (
                <span style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(242,102,46,0.18)", color: "#F2662E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Store className="w-5 h-5" />
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{t.tenant_name || "Taller"}</span>
                <span className="block" style={{ fontSize: 13, color: "#8E8E93" }}>{ROLE_LABELS[t.role] || t.role}</span>
              </span>
              <ChevronRight className="w-4 h-4" style={{ color: "#8E8E93" }} />
            </button>
          ))}
        </div>
        <SignOutButton />
      </Screen>
    );
  }

  if (state.status === "denied") {
    return (
      <Screen
        title="Acceso restringido"
        body={`Tu rol en ${state.tenant?.tenant_name || "este taller"} (${ROLE_LABELS[state.tenant?.role] || state.tenant?.role || "sin rol"}) no tiene acceso a esta sección desde la web.`}
      >
        <SignOutButton />
      </Screen>
    );
  }

  return children;
}
