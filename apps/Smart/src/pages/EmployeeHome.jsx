/**
 * EmployeeHome — landing temporal post-login de empleado. Todavia no existe
 * el shell real de la app en web (se borro en mayo 2026 junto con Ordenes/
 * POS/Inventario, ver auditoria) — esto solo prueba que la identidad real
 * (sesion Supabase + fila de app_employee + roles multiples) funciona de
 * punta a punta antes de construir pantallas encima.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogOut, Wrench } from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";

const ROLE_LABELS = {
  owner: "Dueño",
  admin: "Administrador",
  manager: "Gerente",
  contable: "Contable",
  cashier: "Cajero",
  technician: "Técnico",
};

export default function EmployeeHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [employee, setEmployee] = useState(location.state?.employee || null);
  const [tenant, setTenant] = useState(location.state?.tenant || null);
  const [status, setStatus] = useState(employee ? "ok" : "checking");

  useEffect(() => {
    if (employee) return;
    let active = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        navigate("/EmpleadoLogin", { replace: true });
        return;
      }
      const { data: row, error } = await supabase
        .from("app_employee")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !row) {
        setStatus("error");
        return;
      }
      setEmployee(row);
      setStatus("ok");
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/EmpleadoLogin", { replace: true });
  };

  const roles = employee?.roles?.length ? employee.roles : employee?.role ? [employee.role] : [];

  return (
    <div className="h-dvh overflow-y-auto bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-md mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          Archilla OS
        </Link>
        {status === "ok" && (
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        )}
      </header>

      <main className="flex-1 flex items-start justify-center px-5 pb-16 pt-4">
        <div className="w-full max-w-md">
          {status === "checking" && <p className="text-zinc-400 text-sm">Verificando sesión…</p>}

          {status === "error" && (
            <p className="text-red-400 text-sm">
              No se pudo cargar tu perfil de empleado. Intenta entrar de nuevo.
            </p>
          )}

          {status === "ok" && employee && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Hola, {employee.full_name}</h1>
              {tenant?.name && <p className="mt-2 text-zinc-400 text-[15px]">{tenant.name}</p>}

              <div className="mt-5 flex flex-wrap gap-2">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-300 text-[13px] font-medium"
                  >
                    {ROLE_LABELS[r] || r}
                  </span>
                ))}
              </div>

              <p className="mt-8 text-zinc-500 text-[13px] leading-relaxed">
                Sesión real de empleado funcionando (mismo edge function y mismas reglas de
                acceso que la app nativa). Las pantallas de trabajo diario (Órdenes, POS,
                Inventario) todavía no existen aquí — vienen en el siguiente paso.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
