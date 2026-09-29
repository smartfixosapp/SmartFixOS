/**
 * RequireAuth — protege una ruta con una sesión real de Supabase Auth.
 *
 * Reemplaza el patrón inseguro de sesiones "de mentira" en localStorage sin
 * verificación (ver TenantLoginSignup.jsx, huérfano, jamás validaba
 * contraseña — no reutilizar). Usa appClient.auth.me(), que resuelve el JWT
 * de la sesión contra Supabase Auth y lee el rol real desde la tabla users
 * (service role, no falsificable desde el cliente).
 *
 * Sin sesión válida → redirige a /Login. Con `roles` y el rol del usuario no
 * calza → pantalla de acceso restringido (no expone nada del contenido).
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import appClient from "@/api/appClient";
import { PageSpinner } from "@/components/ui/spinner";

function pinTenantScope(tenantId) {
  if (!tenantId) return;
  try {
    localStorage.setItem("smartfix_tenant_id", tenantId);
    localStorage.setItem("current_tenant_id", tenantId);
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

export default function RequireAuth({ children, roles }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState("checking"); // checking | ok | denied

  useEffect(() => {
    let active = true;
    appClient.auth.me()
      .then((user) => {
        if (!active) return;
        if (roles && !roles.includes(user?.role)) {
          setState("denied");
          return;
        }
        pinTenantScope(user?.tenant_id);
        setState("ok");
      })
      .catch(() => {
        if (!active) return;
        navigate("/Login", { replace: true, state: { from: location.pathname } });
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (state === "checking") return <PageSpinner />;

  if (state === "denied") {
    return (
      <div className="apple-type min-h-dvh apple-surface flex items-center justify-center p-6 text-center">
        <div>
          <p className="apple-text-title3 apple-label-primary font-semibold mb-1">Acceso restringido</p>
          <p className="apple-text-subheadline apple-label-tertiary">
            Esta sección es solo para administradores del taller.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
