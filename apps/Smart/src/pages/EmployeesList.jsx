/**
 * EmployeesList — gestion de empleados (listar/crear/editar) contra
 * app_employee, paridad con Features/Employees en nativo (EmployeesListView
 * + AddEmployeeSheetView). Roles multiples que suman, igual que
 * Models/EmployeeRole.swift — mismo repairLevel (solo technician asigna
 * boletos) y mismo adminLevel (owner/admin/manager/contable) para gatear
 * esta pantalla. No incluye Horario/Ponches/Pagos todavia (fase aparte).
 */
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Wrench, ArrowLeft, X, RefreshCw } from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";

const ALL_ROLES = ["owner", "admin", "manager", "contable", "cashier", "technician"];
const ASSIGNABLE_ON_CREATE = ["admin", "manager", "contable", "cashier", "technician"];
const ADMIN_LEVEL = ["owner", "admin", "manager", "contable"];
const ROLE_LABELS = {
  owner: "Dueño",
  admin: "Administrador",
  manager: "Gerente",
  contable: "Contable",
  cashier: "Cajero",
  technician: "Técnico",
};

function rolesOf(emp) {
  if (emp?.roles?.length) return emp.roles;
  if (emp?.role) return [emp.role];
  return [];
}

function primaryOf(roles) {
  return ALL_ROLES.find((r) => roles.includes(r)) || "technician";
}

function randomPin() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export default function EmployeesList() {
  const navigate = useNavigate();
  const [gate, setGate] = useState("checking"); // checking | denied | ok
  const [self, setSelf] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        navigate("/EmpleadoLogin", { replace: true });
        return;
      }
      const { data: row } = await supabase
        .from("app_employee")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (!row) {
        setGate("denied");
        return;
      }
      setSelf(row);
      const hasAdmin = rolesOf(row).some((r) => ADMIN_LEVEL.includes(r));
      if (!hasAdmin) {
        setGate("denied");
        return;
      }
      setGate("ok");
      loadEmployees(row.tenant_id);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEmployees = async (tenantId) => {
    setLoadingList(true);
    const { data } = await supabase
      .from("app_employee")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("full_name", { ascending: true });
    setEmployees(
      (data || []).slice().sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return (a.full_name || "").localeCompare(b.full_name || "");
      })
    );
    setLoadingList(false);
  };

  const refresh = () => self && loadEmployees(self.tenant_id);

  if (gate === "checking") {
    return (
      <div className="h-dvh bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Verificando sesión…</p>
      </div>
    );
  }

  if (gate === "denied") {
    return (
      <div className="h-dvh bg-zinc-950 text-white flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold mb-1">Acceso restringido</p>
          <p className="text-zinc-400 text-sm">Esta sección es solo para administradores del taller.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-y-auto bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-2xl mx-auto w-full">
        <Link to="/EmpleadoHome" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          Archilla OS
        </Link>
        <Link
          to="/EmpleadoHome"
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Inicio
        </Link>
      </header>

      <main className="flex-1 px-5 pb-16 pt-2">
        <div className="max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Empleados</h1>
              <p className="mt-1 text-zinc-400 text-[14px]">{employees.length} en tu taller</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="h-11 w-11 rounded-full bg-orange-500 hover:bg-orange-400 flex items-center justify-center transition-colors"
              aria-label="Nuevo empleado"
            >
              <Plus className="h-5 w-5 text-white" strokeWidth={2.4} />
            </button>
          </div>

          {loadingList ? (
            <p className="text-zinc-500 text-sm">Cargando…</p>
          ) : (
            <div className="space-y-2">
              {employees.map((emp) => (
                <EmployeeRow key={emp.id} employee={emp} onClick={() => setEditing(emp)} />
              ))}
              {employees.length === 0 && (
                <p className="text-zinc-500 text-sm">Todavía no hay empleados.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateEmployeeModal
          tenantId={self.tenant_id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      {editing && (
        <EditEmployeeModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function EmployeeRow({ employee, onClick }) {
  const roles = rolesOf(employee);
  const initials = (employee.full_name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-left hover:bg-white/[0.08] transition-colors ${
        employee.active === false ? "opacity-50" : ""
      }`}
    >
      <span className="h-10 w-10 rounded-full bg-orange-500/15 text-orange-300 flex items-center justify-center text-[13px] font-semibold flex-shrink-0">
        {initials}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{employee.full_name}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {roles.map((r) => (
            <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
              {ROLE_LABELS[r] || r}
            </span>
          ))}
          {employee.active === false && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">
              Desactivado
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="w-full sm:max-w-md bg-zinc-900 border border-white/10 rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-zinc-900">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function RoleToggleGroup({ roles, selected, onToggle }) {
  return (
    <div className="space-y-2">
      {roles.map((r) => {
        const isOn = selected.includes(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() => onToggle(r)}
            className={`w-full flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
              isOn
                ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                : "border-white/10 bg-white/5 text-zinc-300"
            }`}
          >
            <span className="text-[14px] font-medium">{ROLE_LABELS[r]}</span>
            <span
              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                isOn ? "border-orange-400 bg-orange-400" : "border-zinc-600"
              }`}
            >
              {isOn && <span className="h-2 w-2 rounded-full bg-zinc-900" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const inputCls =
  "w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3.5 text-[14px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.07] transition-colors";
const labelCls = "block text-[12.5px] font-medium text-zinc-400 mb-1.5";

function CreateEmployeeModal({ tenantId, onClose, onCreated }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [selectedRoles, setSelectedRoles] = useState(["technician"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [createdPin, setCreatedPin] = useState(null);

  const toggle = (r) => {
    setSelectedRoles((prev) => {
      if (prev.includes(r)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== r);
      }
      return [...prev, r];
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const name = fullName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    const pin = randomPin();
    const rate = hourlyRate ? parseFloat(hourlyRate.replace(",", ".")) : null;
    const trimmedPhone = phone.trim();
    const { error: insertError } = await supabase.from("app_employee").insert({
      tenant_id: tenantId,
      full_name: name,
      role: primaryOf(selectedRoles),
      roles: selectedRoles,
      pin,
      pin_is_temp: true,
      active: true,
      // app_employee.email es NOT NULL sin default en la DB real (aunque el
      // campo es opcional en la UI, igual que en nativo) - "" en vez de
      // omitir la llave, confirmado sin colision de unicidad en vivo.
      email: email.trim(),
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      ...(rate && rate > 0 ? { hourly_rate: rate } : {}),
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message || "No se pudo crear el empleado.");
      return;
    }
    setCreatedPin(pin);
  };

  if (createdPin) {
    return (
      <ModalShell title="Empleado creado" onClose={onCreated}>
        <div className="text-center space-y-4">
          <p className="text-zinc-300 text-sm">
            PIN temporal para <span className="font-semibold text-white">{fullName}</span>:
          </p>
          <p className="text-4xl font-bold tracking-[0.3em] text-orange-400">{createdPin}</p>
          <p className="text-zinc-500 text-[13px]">
            Comparte este PIN con el empleado. Lo puede usar para entrar en{" "}
            <span className="text-zinc-300">/EmpleadoLogin</span> junto con el código del taller.
          </p>
          <button
            onClick={onCreated}
            className="w-full h-11 rounded-full bg-white text-black font-semibold hover:bg-gray-100 transition-colors"
          >
            Listo
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Nuevo empleado" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls}>Nombre completo</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className={labelCls}>Email (opcional)</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Teléfono (opcional)</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Pago por hora (opcional)</label>
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="0.00"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Roles — puedes marcar varios</label>
          <RoleToggleGroup roles={ASSIGNABLE_ON_CREATE} selected={selectedRoles} onToggle={toggle} />
        </div>

        {error && <p className="text-[13px] text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!fullName.trim() || saving}
          className="w-full h-12 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-semibold disabled:opacity-60 transition-colors"
        >
          {saving ? "Creando…" : "Crear empleado"}
        </button>
      </form>
    </ModalShell>
  );
}

function EditEmployeeModal({ employee, onClose, onSaved }) {
  const [fullName, setFullName] = useState(employee.full_name || "");
  const [email, setEmail] = useState(employee.email || "");
  const [phone, setPhone] = useState(employee.phone || "");
  const [hourlyRate, setHourlyRate] = useState(employee.hourly_rate ? String(employee.hourly_rate) : "");
  const [selectedRoles, setSelectedRoles] = useState(rolesOf(employee));
  const [active, setActive] = useState(employee.active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resetPin, setResetPin] = useState(null);

  const toggle = (r) => {
    setSelectedRoles((prev) => {
      if (prev.includes(r)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== r);
      }
      return [...prev, r];
    });
  };

  const save = async (e) => {
    e.preventDefault();
    const name = fullName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    const rate = hourlyRate ? parseFloat(hourlyRate.replace(",", ".")) : null;
    const trimmedPhone = phone.trim();
    const { error: updateError } = await supabase
      .from("app_employee")
      .update({
        full_name: name,
        role: primaryOf(selectedRoles),
        roles: selectedRoles,
        active,
        hourly_rate: rate && rate > 0 ? rate : null,
        email: email.trim(),
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      })
      .eq("id", employee.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message || "No se pudo guardar.");
      return;
    }
    onSaved();
  };

  const generateNewPin = async () => {
    const pin = randomPin();
    const { error: pinError } = await supabase
      .from("app_employee")
      .update({ pin, pin_is_temp: true })
      .eq("id", employee.id);
    if (!pinError) setResetPin(pin);
  };

  return (
    <ModalShell title={employee.full_name} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className={labelCls}>Nombre completo</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Pago por hora</label>
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="0.00"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Roles — puedes marcar varios</label>
          <RoleToggleGroup roles={ALL_ROLES} selected={selectedRoles} onToggle={toggle} />
        </div>

        <label className="flex items-center justify-between rounded-xl px-4 py-3 border border-white/10 bg-white/5">
          <span className="text-[14px] font-medium">Activo</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-orange-500" />
        </label>

        <button
          type="button"
          onClick={generateNewPin}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] text-[14px] font-medium transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Generar nuevo PIN temporal
        </button>
        {resetPin && (
          <p className="text-center text-[13px] text-zinc-400">
            Nuevo PIN: <span className="text-orange-400 font-bold text-lg tracking-widest">{resetPin}</span>
          </p>
        )}

        {error && <p className="text-[13px] text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!fullName.trim() || saving}
          className="w-full h-12 rounded-full bg-white text-black font-semibold disabled:opacity-60 hover:bg-gray-100 transition-colors"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </ModalShell>
  );
}
