
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  // Hub icons
  Settings as SettingsIconHub, Save as SaveIconHub, RotateCcw, Download as DownloadIconHub, Upload as UploadIconHub, Search as SearchIconHub,
  Palette, LayoutDashboard, ClipboardList, FileText, Package, ShoppingCart, Users, BarChart3, Printer, Plug, Bell, Shield,
  Image as ImageIcon, Zap, Building2, Check, Loader2, // Added Loader2 for saving animation

  // SettingsPage icons (unión completa para evitar faltantes)
  Save, ShoppingCart as ShoppingCart2, ClipboardList as ClipboardList2, Package as Package2, Users as Users2, Bell as Bell2, FileText as FileText2, DollarSign,
  KeyRound, Globe, Database, Upload, Download, RefreshCcw, FlaskConical, Webhook, Mail,
  ShieldCheck, Hash, Building2 as Building2b, Settings as SettingsIcon, Plus, Edit, Trash2, Lock, Unlock, KeySquare, Eye, EyeOff, Search, Shield as Shield2,
  ShieldAlert, Printer as Printer2, ServerCog, Activity, UserPlus, UserMinus, X, Link2, Play, MessageCircleMore
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { loadMasterSettings, saveMasterSettings, exportSettings, importSettings, DEFAULT_MASTER_SETTINGS } from "@/components/services/masterSettings";

// Assume base44 is globally available or provided by a context.
// For a standalone file, a mock or actual import/declaration might be needed.
// Example: declare var base44: any;
// Or: import { base44 } from 'some-base44-library'; // if it's a module
// For this exercise, we'll assume `window.base44` or `base44` is available.
const base44 = window.base44 || {
  entities: {
    AppSettings: {
      filter: async ({ slug }) => {
        // Mock implementation for demonstration
        if (localStorage.getItem(`base44_master_settings`)) {
          return [{ id: 'mock-id', slug, payload: JSON.parse(localStorage.getItem(`base44_master_settings`)) }];
        }
        return [];
      },
      create: async (data) => {
        // Mock implementation
        localStorage.setItem(`base44_master_settings`, JSON.stringify(data.payload));
        return { id: 'mock-id', ...data };
      },
      update: async (id, data) => {
        // Mock implementation
        localStorage.setItem(`base44_master_settings`, JSON.stringify(data.payload));
        return { id, ...data };
      },
    },
  },
};


// -----------------------------------------------
// SettingsPage (página completa de Configuración)
// -----------------------------------------------
/* ============================================================
   Helpers SystemConfig (API + localStorage fallback, mismo patrón)
   ============================================================ */
async function upsertConfig(cfg) {
  try {
    const res = await fetch("/api/system-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    if (!res.ok) throw new Error("API upsert failed");
  } catch {
    localStorage.setItem(`syscfg:${cfg.key}`, JSON.stringify(cfg));
  }
}
async function getConfig(key) {
  try {
    const res = await fetch(`/api/system-config?key=${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.key) return data;
    }
  } catch {}
  const raw = localStorage.getItem(`syscfg:${key}`);
  return raw ? JSON.parse(raw) : null;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SettingsCard = ({ title, description, children, right }) => (
  <Card className="bg-gray-900 border-gray-800">
    <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div>
        <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
        {description && <CardDescription className="text-gray-400">{description}</CardDescription>}
      </div>
      {right ? <div className="flex-shrink-0">{right}</div> : null}
    </CardHeader>
    <CardContent className="space-y-6">{children}</CardContent>
  </Card>
);
const Row = ({ label, description, control }) => (
  <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-gray-800 py-3 md:py-4 last:border-b-0">
    <div className="flex-1 mb-2 md:mb-0 md:pr-4">
      <Label className="text-base md:text-lg font-medium text-white">{label}</Label>
      {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
    </div>
    <div className="w-full md:w-auto md:min-w-[300px]">{control}</div>
  </div>
);
const Toast = React.forwardRef((props, ref) => {
  const [msg, setMsg] = useState(null);
  const [ok, setOk] = useState(true);
  React.useImperativeHandle(ref, () => ({
    show: (m, isOk = true) => { setMsg(m); setOk(isOk); setTimeout(() => setMsg(null), 2600); }
  }));
  if (!msg) return null;
  return (
    <div className="fixed top-[env(safe-area-inset-top,1rem)] right-4 z-[9999]">
      <div className={`min-w-[260px] max-w-sm rounded-lg border px-4 py-3 shadow-lg backdrop-blur-md
        ${ok ? "bg-emerald-600/90 border-emerald-400 text-white" : "bg-red-600/90 border-red-400 text-white"}`}>
        <div className="font-semibold">{msg}</div>
      </div>
    </div>
  );
});
Toast.displayName = "Toast";

function AccessDenied() {
  return (
    <div className="min-h-screen grid place-items-center bg-[#0D0D0D] text-white p-6">
      <div className="max-w-md text-center space-y-3">
        <h2 className="text-2xl font-bold">Acceso denegado</h2>
        <p className="text-gray-400">Solo administradores o managers pueden ver Configuración.</p>
      </div>
    </div>
  );
}

function UsersSettingsTab({ toastRef }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [onlyActive, setOnlyActive] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const j = await res.json();
        setRows(Array.isArray(j) ? j : []);
      } else {
        const demo = JSON.parse(localStorage.getItem("demo-users") || "[]");
        setRows(demo);
      }
    } catch {
      const demo = JSON.parse(localStorage.getItem("demo-users") || "[]");
      setRows(demo);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(u => `${u.full_name||""} ${u.email||""}`.toLowerCase().includes(t));
    }
    if (role !== "all") list = list.filter(u => u.role === role);
    if (onlyActive) list = list.filter(u => u.active !== false);
    return list.sort((a,b)=>String(a.full_name||"").localeCompare(b.full_name||""));
  }, [rows, q, role, onlyActive]);

  function openCreate() {
    setEditing({ full_name:"", email:"", role:"technician", active:true, phone:"", mfa:false, branch_code:"" });
    setShowForm(true);
  }
  function openEdit(u) {
    setEditing({ ...u });
    setShowForm(true);
  }
  async function saveUser() {
    setSaving(true);
    try {
      const u = { ...editing };
      if (u.id) {
        const res = await fetch(`/api/users/${u.id}`, { method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(u) });
        if (!res.ok) throw new Error("No se pudo actualizar");
      } else {
        const res = await fetch(`/api/users`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(u) });
        if (!res.ok) throw new Error("No se pudo crear");
      }
      if (toastRef?.current) toastRef.current.show("Usuario guardado");
      setShowForm(false);
      await load();
    } catch (e) {
      const demo = JSON.parse(localStorage.getItem("demo-users") || "[]");
      if (editing.id) {
        const i = demo.findIndex(x => x.id === editing.id);
        if (i>=0) demo[i] = editing;
      } else {
        editing.id = Date.now();
        demo.push(editing);
      }
      localStorage.setItem("demo-users", JSON.stringify(demo));
      setShowForm(false);
      toastRef?.current?.show("Usuario guardado (demo local)", true);
      await load();
    } finally { setSaving(false); }
  }
  async function toggleActive(u) {
    try {
      const res = await fetch(`/api/users/${u.id}/active`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ active: !(u.active!==false) }) });
      if (!res.ok) throw 0;
      await load();
    } catch {
      const demo = JSON.parse(localStorage.getItem("demo-users") || "[]");
      const i = demo.findIndex(x => x.id === u.id);
      if (i>=0) demo[i].active = !(u.active!==false);
      localStorage.setItem("demo-users", JSON.stringify(demo));
      await load();
    }
  }
  async function resetPassword(u) {
    try {
      const res = await fetch(`/api/users/${u.id}/reset-password`, { method:"POST" });
      if (!res.ok) throw 0;
      toastRef?.current?.show("Se envió enlace de restablecimiento");
    } catch {
      toastRef?.current?.show("No se pudo enviar el enlace (simulado)", false);
    }
  }
  async function forceMFA(u, flag) {
    try {
      const res = await fetch(`/api/users/${u.id}/mfa`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ mfa: flag }) });
      if (!res.ok) throw 0;
      await load();
    } catch {
      const demo = JSON.parse(localStorage.getItem("demo-users") || "[]");
      const i = demo.findIndex(x => x.id === u.id);
      if (i>=0) demo[i].mfa = flag;
      localStorage.setItem("demo-users", JSON.stringify(demo));
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Usuarios y Roles"
        description="Crea usuarios, asigna roles, activa 2FA y administra estado."
        right={<Button className="bg-red-600 hover:bg-red-700" onClick={openCreate}><UserPlus className="w-4 h-4 mr-2" />Crear usuario</Button>}
      >
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input className="pl-8 bg-black/40 border-white/10" placeholder="Buscar por nombre o email…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <select value={role} onChange={e=>setRole(e.target.value)} className="bg-black/40 border-white/10 rounded-md h-10 px-3">
            <option value="all">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="technician">Technician</option>
            <option value="cashier">Cashier</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-300">
            <Switch checked={onlyActive} onCheckedChange={setOnlyActive} /> Solo activos
          </label>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-gray-300">
              <tr>
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Rol</th>
                <th className="text-left p-2">Sucursal</th>
                <th className="text-center p-2">MFA</th>
                <th className="text-center p-2">Estado</th>
                <th className="text-right p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-4 text-center text-gray-400">Cargando…</td></tr>
              ) : filtered.length ? filtered.map(u => (
                <tr key={u.id} className="border-t border-white/10">
                  <td className="p-2">{u.full_name || "—"}</td>
                  <td className="p-2">{u.email || "—"}</td>
                  <td className="p-2 capitalize">{u.role || "—"}</td>
                  <td className="p-2">{u.branch_code || "—"}</td>
                  <td className="p-2 text-center">{u.mfa ? <Shield2 className="w-4 h-4 text-emerald-400 inline" /> : <ShieldAlert className="w-4 h-4 text-gray-500 inline" />}</td>
                  <td className="p-2 text-center">{(u.active!==false) ? <span className="text-emerald-400">Activo</span> : <span className="text-red-400">Inactivo</span>}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="outline" className="h-8 border-white/15" onClick={()=>openEdit(u)}><Edit className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline" className="h-8 border-white/15" onClick={()=>resetPassword(u)} title="Reset password"><KeySquare className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline" className="h-8 border-white/15" onClick={()=>forceMFA(u, !u.mfa)} title={u.mfa?"Desactivar MFA":"Forzar MFA"}>{u.mfa ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</Button>
                      <Button size="sm" className={`h-8 ${u.active!==false?"bg-zinc-700 hover:bg-zinc-800":"bg-emerald-600 hover:bg-emerald-700"}`} onClick={()=>toggleActive(u)}>
                        {u.active!==false ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">Sin usuarios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      {showForm && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setShowForm(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <Card className="w-full max-w-lg bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>{editing?.id ? "Editar usuario" : "Crear usuario"}</CardTitle>
                <CardDescription>Define datos básicos, rol y sucursal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Nombre completo" value={editing.full_name||""} onChange={e=>setEditing({...editing, full_name:e.target.value})} className="bg-black/40 border-white/10" />
                  <Input placeholder="Email" value={editing.email||""} onChange={e=>setEditing({...editing, email:e.target.value})} className="bg-black/40 border-white/10" />
                  <Input placeholder="Teléfono (opcional)" value={editing.phone||""} onChange={e=>setEditing({...editing, phone:e.target.value})} className="bg-black/40 border-white/10" />
                  <select value={editing.role||"technician"} onChange={e=>setEditing({...editing, role:e.target.value})} className="bg-black/40 border-white/10 rounded-md px-3 h-10">
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="technician">Technician</option>
                    <option value="cashier">Cashier</option>
                  </select>
                  <Input placeholder="Sucursal (ej. SJ01)" value={editing.branch_code||""} onChange={e=>setEditing({...editing, branch_code:e.target.value})} className="bg-black/40 border-white/10 md:col-span-2" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                    <Switch checked={editing.active!==false} onCheckedChange={(v)=>setEditing({...editing, active: v})} /> Activo
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                    <Switch checked={!!editing.mfa} onCheckedChange={(v)=>setEditing({...editing, mfa: v})} /> MFA
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" className="border-white/15" onClick={()=>setShowForm(false)}>Cancelar</Button>
                  <Button className="bg-red-600 hover:bg-red-700" onClick={saveUser} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" /> {saving ? "Guardando…" : "Guardar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function BranchesSettingsTab({ toastRef }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async ()=>{
    setLoading(true);
    try {
      const res = await fetch("/api/branches");
      if (res.ok) {
        const j = await res.json();
        setRows(Array.isArray(j)?j:[]);
      } else throw 0;
    } catch {
      const demo = JSON.parse(localStorage.getItem("demo-branches") || "[]");
      setRows(demo);
    } finally { setLoading(false); }
  }, []);
  useEffect(()=>{ load(); }, [load]);

  const filtered = useMemo(()=>{
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter(b => `${b.code||""} ${b.name||""}`.toLowerCase().includes(t));
  }, [rows, q]);

  function openCreate() {
    setEditing({ code:"", name:"", address:"", phone:"", manager_email:"", active:true });
    setShowForm(true);
  }
  function openEdit(b) { setEditing({ ...b }); setShowForm(true); }

  async function saveBranch() {
    try {
      if (editing.id) {
        const res = await fetch(`/api/branches/${editing.id}`, { method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(editing) });
        if (!res.ok) throw 0;
      } else {
        const res = await fetch(`/api/branches`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(editing) });
        if (!res.ok) throw 0;
      }
      setShowForm(false);
      toastRef?.current?.show("Sucursal guardada");
      await load();
    } catch {
      const demo = JSON.parse(localStorage.getItem("demo-branches") || "[]");
      if (editing.id) {
        const i = demo.findIndex(x=>x.id===editing.id);
        if (i>=0) demo[i]=editing;
      } else {
        editing.id = Date.now();
        demo.push(editing);
      }
      localStorage.setItem("demo-branches", JSON.stringify(demo));
      setShowForm(false);
      toastRef?.current?.show("Sucursal guardada (demo local)");
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Sucursales"
        description="Configura localidades, datos de contacto y estado."
        right={<Button className="bg-red-600 hover:bg-red-700" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva sucursal</Button>}
      >
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input className="pl-8 bg-black/40 border-white/10" placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div className="rounded-lg border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-gray-300">
              <tr>
                <th className="text-left p-2">Código</th>
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">Teléfono</th>
                <th className="text-left p-2">Manager email</th>
                <th className="text-center p-2">Estado</th>
                <th className="text-right p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="p-4 text-center text-gray-400">Cargando…</td></tr> :
                (filtered.length ? filtered.map(b=>(
                  <tr key={b.id||b.code} className="border-t border-white/10">
                    <td className="p-2">{b.code||"—"}</td>
                    <td className="p-2">{b.name||"—"}</td>
                    <td className="p-2">{b.phone||"—"}</td>
                    <td className="p-2">{b.manager_email||"—"}</td>
                    <td className="p-2 text-center">{b.active!==false ? <span className="text-emerald-400">Activa</span> : <span className="text-red-400">Inactiva</span>}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="outline" className="h-8 border-white/15" onClick={()=>openEdit(b)}><Edit className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                )) : <tr><td colSpan={6} className="p-6 text-center text-gray-400">Sin sucursales</td></tr>)
              }
            </tbody>
          </table>
        </div>
      </SettingsCard>

      {showForm && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setShowForm(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <Card className="w-full max-w-lg bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>{editing?.id ? "Editar sucursal" : "Nueva sucursal"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Código (ej. SJ01)" value={editing.code||""} onChange={e=>setEditing({...editing, code:e.target.value})} className="bg-black/40 border-white/10" />
                  <Input placeholder="Nombre" value={editing.name||""} onChange={e=>setEditing({...editing, name:e.target.value})} className="bg-black/40 border-white/10" />
                  <Input placeholder="Teléfono" value={editing.phone||""} onChange={e=>setEditing({...editing, phone:e.target.value})} className="bg-black/40 border-white/10" />
                  <Input placeholder="Manager email" value={editing.manager_email||""} onChange={e=>setEditing({...editing, manager_email:e.target.value})} className="bg-black/40 border-white/10" />
                  <Textarea placeholder="Dirección" value={editing.address||""} onChange={e=>setEditing({...editing, address:e.target.value})} className="bg-black/40 border-white/10 md:col-span-2 h-20" />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <Switch checked={editing.active!==false} onCheckedChange={(v)=>setEditing({...editing, active:v})} /> Activa
                </label>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" className="border-white/15" onClick={()=>setShowForm(false)}>Cancelar</Button>
                  <Button className="bg-red-600 hover:bg-red-700" onClick={saveBranch}><Save className="w-4 h-4 mr-2" />Guardar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function TestsCard({ smtpHost, smtpUser, smtpFrom, webhookUrl, smsSender, toastRef }) {
  const [emailTo, setEmailTo] = useState("");
  const [testing, setTesting] = useState(false);

  const testEmail = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/test/email", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ to: emailTo }) });
      if (!res.ok) throw 0;
      toastRef?.current?.show("Email de prueba enviado");
    } catch {
      toastRef?.current?.show("No se pudo enviar (simulado). Verifica SMTP.", false);
    } finally { setTesting(false); }
  };
  const testWebhook = async () => {
    setTesting(true);
    try {
      const res = await fetch(webhookUrl || "/api/test/webhook", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ ping:"pong", at: Date.now() }) });
      if (!res.ok) throw 0;
      toastRef?.current?.show("Webhook OK");
    } catch {
      toastRef?.current?.show("Webhook falló (simulado).", false);
    } finally { setTesting(false); }
  };
  const testSMS = async () => {
    setTesting(true);
    await sleep(600);
    toastRef?.current?.show("SMS de prueba encolado (simulación)");
    setTesting(false);
  };

  return (
    <SettingsCard title="Pruebas rápidas" description="Verifica canales de salida.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-md border border-white/10 p-3">
          <div className="text-sm text-gray-300 mb-2 flex items-center gap-2"><Mail className="w-4 h-4" /> Email</div>
          <Input placeholder="Enviar a…" value={emailTo} onChange={e=>setEmailTo(e.target.value)} className="bg-black/40 border-white/10 mb-2" />
          <Button className="w-full bg-red-600 hover:bg-red-700" onClick={testEmail} disabled={testing || !emailTo.trim()}>
            <Play className="w-4 h-4 mr-2" /> Probar Email
          </Button>
          <div className="text-xs text-gray-500 mt-2">Host: {smtpHost||"—"} · User: {smtpUser||"—"} · From: {smtpFrom||"—"}</div>
        </div>
        <div className="rounded-md border border-white/10 p-3">
          <div className="text-sm text-gray-300 mb-2 flex items-center gap-2"><Webhook className="w-4 h-4" /> Webhook</div>
          <Input value={webhookUrl||""} disabled className="bg-black/40 border-white/10 mb-2" />
          <Button className="w-full bg-red-600 hover:bg-red-700" onClick={testWebhook} disabled={testing || !webhookUrl}>
            <Play className="w-4 h-4 mr-2" /> Probar Webhook
          </Button>
        </div>
        <div className="rounded-md border border-white/10 p-3">
          <div className="text-sm text-gray-300 mb-2 flex items-center gap-2"><MessageCircleMore className="w-4 h-4" /> SMS</div>
          <Input value={smsSender||""} disabled className="bg-black/40 border-white/10 mb-2" />
          <Button className="w-full bg-red-600 hover:bg-red-700" onClick={testSMS} disabled={testing}><Play className="w-4 h-4 mr-2" /> Probar SMS</Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function SettingsPage() {
  const toastRef = useRef(null);

  const [authChecked, setAuthChecked] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  useEffect(() => {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem("911-session") || "null"); } catch {}
    const role = s?.userRole ?? s?.role ?? s?.user?.role ?? null;
    const ok = role === "admin" || role === "manager";
    setIsAllowed(!!ok);
    setAuthChecked(true);
  }, []);

  const [activeTab, setActiveTab] = useState("branding");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [branchCode, setBranchCode] = useState("");
  const keyPrefix = branchCode ? `branch.${branchCode}.` : "";

  const [storeName, setStoreName] = useState("911 SmartFix");
  const [primaryColor, setPrimaryColor] = useState("#FF0000");
  const [accentColor, setAccentColor] = useState("#ffffff");
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [timezone, setTimezone] = useState("America/Puerto_Rico");
  const [language, setLanguage] = useState("es");
  const [dateFormat, setDateFormat] = useState("dd/MM/yyyy");
  const [timeFormat, setTimeFormat] = useState("HH:mm");

  const [orderPrefix, setOrderPrefix] = useState("WO-");
  const [salePrefix, setSalePrefix] = useState("SALE-");
  const [customerPrefix, setCustomerPrefix] = useState("CUS-");
  const [startNumbersAt, setStartNumbersAt] = useState("1");

  const [posRequireCustomer, setPosRequireCustomer] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState("Cash, Card, ATH Móvil");
  const [cashTolerance, setCashTolerance] = useState("0.50");
  const [enableDiscounts, setEnableDiscounts] = useState(true);
  const [maxDiscountPct, setMaxDiscountPct] = useState("15");
  const [openDrawerRequireCashCount, setOpenDrawerRequireCashCount] = useState(true);
  const [closeDrawerRequireRecount, setCloseDrawerRequireRecount] = useState(true);
  const [tipEnabled, setTipEnabled] = useState(false);

  const [inventoryView, setInventoryView] = useState("Cuadros");
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [perBranchStock, setPerBranchStock] = useState(false);
  const [skuAuto, setSkuAuto] = useState(true);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [incomingThresholdDays, setIncomingThresholdDays] = useState("7");

  const [statusFlow, setStatusFlow] = useState("Recepción,Diagnóstico,En Reparación,Listo,Entregado");
  const [allowBackStatus, setAllowBackStatus] = useState(true);
  const [blockDeliveryWithoutPay, setBlockDeliveryWithoutPay] = useState(true);
  const [requirePhotosIntake, setRequirePhotosIntake] = useState(true);
  const [allowCamera, setAllowCamera] = useState(true);
  const [autoAssignToCreator, setAutoAssignToCreator] = useState(false);
  const [allowPartialPayments, setAllowPartialPayments] = useState(true);

  const [ivuRate, setIvuRate] = useState("11.5");
  const [receiptHeader, setReceiptHeader] = useState("Gracias por su preferencia");
  const [receiptFooter, setReceiptFooter] = useState("No somos responsables por pérdida de datos.");
  const [invoiceNotes, setInvoiceNotes] = useState("IVU 11.5% incluido cuando aplique.");
  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(true);
  const [receiptPaperWidth, setReceiptPaperWidth] = useState("80mm");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("notificaciones@smartfix.com");
  const [notifCreateWO, setNotifCreateWO] = useState(true);
  const [notifReadyWO, setNotifReadyWO] = useState(true);
  const [notifCashClose, setNotifCashClose] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [notifInApp, setNotifInApp] = useState(true);

  const [requirePinDelete, setRequirePinDelete] = useState(true);
  const [forceMFAAdmins, setForceMFAAdmins] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState("5");
  const [roleMatrix, setRoleMatrix] = useState({
    admin: { settings:true, financial:true, orders:true, inventory:true, reports:true, exports:true },
    manager: { settings:false, financial:true, orders:true, inventory:true, reports:true, exports:true },
    technician: { settings:false, financial:false, orders:true, inventory:false, reports:false, exports:false },
    cashier: { settings:false, financial:true, orders:false, inventory:false, reports:false, exports:false },
  });

  const [socialInboxEnabled, setSocialInboxEnabled] = useState(true);
  const [facebookPageToken, setFacebookPageToken] = useState("");
  const [instagramToken, setInstagramToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKeyPublic, setApiKeyPublic] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [smsProviderApiKey, setSmsProviderApiKey] = useState("");
  const [smsSender, setSmsSender] = useState("");

  const [ffBetaWorkOrderV2, setFfBetaWorkOrderV2] = useState(false);
  const [ffFastCameraUpload, setFfFastCameraUpload] = useState(false);
  const [ffMultiBranch, setFfMultiBranch] = useState(false);

  useEffect(() => {
    (async () => {
      const get = async (k, setter) => {
        const c = await getConfig(`${keyPrefix}${k}`);
        if (c?.value !== undefined) try { setter(JSON.parse(c.value)); } catch {}
      };
      await Promise.all([
        get("branding.store_name", setStoreName),
        get("branding.primary_color", setPrimaryColor),
        get("branding.accent_color", setAccentColor),
        get("branding.logo_data_url", setLogoDataUrl),
        get("general.currency_symbol", setCurrencySymbol),
        get("general.timezone", setTimezone),
        get("general.language", setLanguage),
        get("general.date_format", setDateFormat),
        get("general.time_format", setTimeFormat),

        get("numbering.work_order_prefix", setOrderPrefix),
        get("numbering.sale_prefix", setSalePrefix),
        get("numbering.customer_prefix", setCustomerPrefix),
        get("numbering.start_at", setStartNumbersAt),

        get("general.pos.require_customer", setPosRequireCustomer),
        get("general.pos.payment_methods", setPaymentMethods),
        get("receipt.cash_tolerance", setCashTolerance),
        get("general.pos.enable_discounts", setEnableDiscounts),
        get("general.pos.max_discount_pct", setMaxDiscountPct),
        get("pos.open.require_cash_count", setOpenDrawerRequireCashCount),
        get("pos.close.require_recount", setCloseDrawerRequireRecount),
        get("pos.tip.enabled", setTipEnabled),

        get("inventory.view_mode", setInventoryView),
        get("inventory.low_stock_alerts", setLowStockAlerts),
        get("inventory.per_branch_stock", setPerBranchStock),
        get("inventory.sku_auto", setSkuAuto),
        get("inventory.allow_negative_stock", setAllowNegativeStock),
        get("inventory.incoming_threshold_days", setIncomingThresholdDays),

        get("repair_status.flow_csv", setStatusFlow),
        get("repair_status.allow_backwards", setAllowBackStatus),
        get("general.orders.block_delivery_without_payment", setBlockDeliveryWithoutPay),
        get("general.orders.require_photos_intake", setRequirePhotosIntake),
        get("general.orders.allow_camera", setAllowCamera),
        get("general.orders.auto_assign_to_creator", setAutoAssignToCreator),
        get("general.orders.allow_partial_payments", setAllowPartialPayments),

        get("tax.ivu_rate_percent", setIvuRate),
        get("receipt.header_text", setReceiptHeader),
        get("receipt.footer_text", setReceiptFooter),
        get("receipt.invoice_notes", setInvoiceNotes),
        get("receipt.show_logo", setShowLogoOnReceipt),
        get("receipt.paper_width", setReceiptPaperWidth),

        get("email.smtp.host", setSmtpHost),
        get("email.smtp.port", setSmtpPort),
        get("email.smtp.user", setSmtpUser),
        get("email.smtp.pass", setSmtpPass),
        get("email.smtp.from", setSmtpFrom),
        get("notifications.email.on_create_order", setNotifCreateWO),
        get("notifications.email.on_ready", setNotifReadyWO),
        get("notifications.email.on_cash_close", setNotifCashClose),
        get("notifications.sound", setNotifSound),
        get("notifications.in_app", setNotifInApp),

        get("permissions.require_pin_delete", setRequirePinDelete),
        get("permissions.force_mfa_admins", setForceMFAAdmins),
        get("permissions.autolock_minutes", setAutoLockMinutes),
        get("permissions.role_matrix", setRoleMatrix),

        get("social.enabled", setSocialInboxEnabled),
        get("social.facebook.page_token", setFacebookPageToken),
        get("social.instagram.token", setInstagramToken),
        get("integrations.webhook_url", setWebhookUrl),
        get("integrations.api_key_public", setApiKeyPublic),
        get("integrations.api_key_secret", setApiKeySecret),
        get("integrations.sms.api_key", setSmsProviderApiKey),
        get("integrations.sms.sender", setSmsSender),

        get("flags.workorder_v2", setFfBetaWorkOrderV2),
        get("flags.fast_camera_upload", setFfFastCameraUpload),
        get("flags.multi_branch", setFfMultiBranch),
      ]);
    })();
  }, [branchCode]);

  async function handleSaveAll() {
    setSaving(true);
    try {
      const rec = (key, val, category, description) =>
        ({ key: `${keyPrefix}${key}`, value: JSON.stringify(val), category, description });

      const recs = [
        rec("branding.store_name", storeName, "branding"),
        rec("branding.primary_color", primaryColor, "branding"),
        rec("branding.accent_color", accentColor, "branding"),
        ...(logoDataUrl ? [rec("branding.logo_data_url", logoDataUrl, "branding")] : []),
        rec("general.currency_symbol", currencySymbol, "general"),
        rec("general.timezone", timezone, "general"),
        rec("general.language", language, "general"),
        rec("general.date_format", dateFormat, "general"),
        rec("general.time_format", timeFormat, "general"),

        rec("numbering.work_order_prefix", orderPrefix, "numbering"),
        rec("numbering.sale_prefix", salePrefix, "numbering"),
        rec("numbering.customer_prefix", customerPrefix, "numbering"),
        rec("numbering.start_at", startNumbersAt, "numbering"),

        rec("general.pos.require_customer", posRequireCustomer, "pos"),
        rec("general.pos.payment_methods", paymentMethods, "pos"),
        rec("receipt.cash_tolerance", cashTolerance, "receipt"),
        rec("general.pos.enable_discounts", enableDiscounts, "pos"),
        rec("general.pos.max_discount_pct", maxDiscountPct, "pos"),
        rec("pos.open.require_cash_count", openDrawerRequireCashCount, "pos"),
        rec("pos.close.require_recount", closeDrawerRequireRecount, "pos"),
        rec("pos.tip.enabled", tipEnabled, "pos"),

        rec("inventory.view_mode", inventoryView, "inventory"),
        rec("inventory.low_stock_alerts", lowStockAlerts, "inventory"),
        rec("inventory.per_branch_stock", perBranchStock, "inventory"),
        rec("inventory.sku_auto", skuAuto, "inventory"),
        rec("inventory.allow_negative_stock", allowNegativeStock, "inventory"),
        rec("inventory.incoming_threshold_days", incomingThresholdDays, "inventory"),

        rec("repair_status.flow_csv", statusFlow, "orders"),
        rec("repair_status.allow_backwards", allowBackStatus, "orders"),
        rec("general.orders.block_delivery_without_payment", blockDeliveryWithoutPay, "orders"),
        rec("general.orders.require_photos_intake", requirePhotosIntake, "orders"),
        rec("general.orders.allow_camera", allowCamera, "orders"),
        rec("general.orders.auto_assign_to_creator", autoAssignToCreator, "orders"),
        rec("general.orders.allow_partial_payments", allowPartialPayments, "orders"),

        rec("tax.ivu_rate_percent", ivuRate, "tax"),
        rec("receipt.header_text", receiptHeader, "receipt"),
        rec("receipt.footer_text", receiptFooter, "receipt"),
        rec("receipt.invoice_notes", invoiceNotes, "receipt"),
        rec("receipt.show_logo", showLogoOnReceipt, "receipt"),
        rec("receipt.paper_width", receiptPaperWidth, "receipt"),

        rec("email.smtp.host", smtpHost, "email"),
        rec("email.smtp.port", smtpPort, "email"),
        rec("email.smtp.user", smtpUser, "email"),
        rec("email.smtp.pass", smtpPass, "email"),
        rec("email.smtp.from", smtpFrom, "email"),
        rec("notifications.email.on_create_order", notifCreateWO, "notifications"),
        rec("notifications.email.on_ready", notifReadyWO, "notifications"),
        rec("notifications.email.on_cash_close", notifCashClose, "notifications"),
        rec("notifications.sound", notifSound, "notifications"),
        rec("notifications.in_app", notifInApp, "notifications"),

        rec("permissions.require_pin_delete", requirePinDelete, "permissions"),
        rec("permissions.force_mfa_admins", forceMFAAdmins, "permissions"),
        rec("permissions.autolock_minutes", autoLockMinutes, "permissions"),
        rec("permissions.role_matrix", roleMatrix, "permissions"),

        rec("social.enabled", socialInboxEnabled, "integrations"),
        rec("social.facebook.page_token", facebookPageToken, "integrations"),
        rec("social.instagram.token", instagramToken, "integrations"),
        rec("integrations.webhook_url", webhookUrl, "integrations"),
        rec("integrations.api_key_public", apiKeyPublic, "integrations"),
        rec("integrations.api_key_secret", apiKeySecret, "integrations"),
        rec("integrations.sms.api_key", smsProviderApiKey, "integrations"),
        rec("integrations.sms.sender", smsSender, "integrations"),

        rec("flags.workorder_v2", ffBetaWorkOrderV2, "flags"),
        rec("flags.fast_camera_upload", ffFastCameraUpload, "flags"),
        rec("flags.multi_branch", ffMultiBranch, "flags"),
      ];
      for (const r of recs) await upsertConfig(r);
      const t = new Date().toLocaleTimeString();
      setSavedAt(t);
      toastRef.current?.show("Configuraciones guardadas", true);
    } finally { setSaving(false); }
  }

  function onLogoFileChange(file) {
    if (!file) { setLogoDataUrl(null); return; }
    const r = new FileReader();
    r.onload = () => setLogoDataUrl(r.result);
    r.readAsDataURL(file);
  }
  const exportAll = () => {
    const all = {
      branchCode,
      branding:{ storeName, primaryColor, accentColor, logoDataUrl },
      general:{ currencySymbol, timezone, language, dateFormat, timeFormat },
      numbering:{ orderPrefix, salePrefix, customerPrefix, startNumbersAt },
      pos:{ posRequireCustomer, paymentMethods, cashTolerance, enableDiscounts, maxDiscountPct, openDrawerRequireCashCount, closeDrawerRequireRecount, tipEnabled },
      inventory:{ inventoryView, lowStockAlerts, perBranchStock, skuAuto, allowNegativeStock, incomingThresholdDays },
      orders:{ statusFlow, allowBackStatus, blockDeliveryWithoutPay, requirePhotosIntake, allowCamera, autoAssignToCreator, allowPartialPayments },
      receipt:{ header:receiptHeader, footer:receiptFooter, notes:invoiceNotes, showLogoOnReceipt, paperWidth:receiptPaperWidth },
      tax:{ ivuRate },
      email:{ smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom },
      notifications:{ notifCreateWO, notifReadyWO, notifCashClose, notifSound, notifInApp },
      security:{ requirePinDelete, forceMFAAdmins, autoLockMinutes, roleMatrix },
      integrations:{ socialInboxEnabled, facebookPageToken, instagramToken, webhookUrl, apiKeyPublic, apiKeySecret, smsProviderApiKey, smsSender },
      flags:{ ffBetaWorkOrderV2, ffFastCameraUpload, ffMultiBranch }
    };
    const blob = new Blob([JSON.stringify(all,null,2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `settings_export_${branchCode || "global"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importAll = async (file) => {
    const text = await file.text();
    const d = JSON.parse(text || "{}");
    const set = (v, setter) => (v !== undefined ? setter(v) : null);

    set(d.branding?.storeName, setStoreName);
    set(d.branding?.primaryColor, setPrimaryColor);
    set(d.branding?.accentColor, setAccentColor);
    set(d.branding?.logoDataUrl, setLogoDataUrl);
    set(d.general?.currencySymbol, setCurrencySymbol);
    set(d.general?.timezone, setTimezone);
    set(d.general?.language, setLanguage);
    set(d.general?.dateFormat, setDateFormat);
    set(d.general?.timeFormat, setTimeFormat);

    set(d.numbering?.orderPrefix, setOrderPrefix);
    set(d.numbering?.salePrefix, setSalePrefix);
    set(d.numbering?.customerPrefix, setCustomerPrefix);
    set(d.numbering?.startNumbersAt, setStartNumbersAt);

    set(d.pos?.posRequireCustomer, setPosRequireCustomer);
    set(d.pos?.paymentMethods, setPaymentMethods);
    set(d.pos?.cashTolerance, setCashTolerance);
    set(d.pos?.enableDiscounts, setEnableDiscounts);
    set(d.pos?.maxDiscountPct, setMaxDiscountPct);
    set(d.pos?.openDrawerRequireCashCount, setOpenDrawerRequireCashCount);
    set(d.pos?.closeDrawerRequireRecount, setCloseDrawerRequireRecount);
    set(d.pos?.tipEnabled, setTipEnabled);

    set(d.inventory?.inventoryView, setInventoryView);
    set(d.inventory?.lowStockAlerts, setLowStockAlerts);
    set(d.inventory?.perBranchStock, setPerBranchStock);
    set(d.inventory?.skuAuto, setSkuAuto);
    set(d.inventory?.allowNegativeStock, setAllowNegativeStock);
    set(d.inventory?.incomingThresholdDays, setIncomingThresholdDays);

    set(d.orders?.statusFlow, setStatusFlow);
    set(d.orders?.allowBackStatus, setAllowBackStatus);
    set(d.orders?.blockDeliveryWithoutPay, setBlockDeliveryWithoutPay);
    set(d.orders?.requirePhotosIntake, setRequirePhotosIntake);
    set(d.orders?.allowCamera, setAllowCamera);
    set(d.orders?.autoAssignToCreator, setAutoAssignToCreator);
    set(d.orders?.allowPartialPayments, setAllowPartialPayments);

    set(d.receipt?.header, setReceiptHeader);
    set(d.receipt?.footer, setReceiptFooter);
    set(d.receipt?.notes, setInvoiceNotes);
    set(d.receipt?.showLogoOnReceipt, setShowLogoOnReceipt);
    set(d.receipt?.paperWidth, setReceiptPaperWidth);
    set(d.tax?.ivuRate, setIvuRate);

    set(d.email?.smtpHost, setSmtpHost);
    set(d.email?.smtpPort, setSmtpPort);
    set(d.email?.smtpUser, setSmtpUser);
    set(d.email?.smtpPass, setSmtpPass);
    set(d.email?.smtpFrom, setSmtpFrom);
    set(d.notifications?.notifCreateWO, setNotifCreateWO);
    set(d.notifications?.notifReadyWO, setNotifReadyWO);
    set(d.notifications?.notifCashClose, setNotifCashClose);
    set(d.notifications?.notifSound, setNotifSound);
    set(d.notifications?.notifInApp, setNotifInApp);

    set(d.security?.requirePinDelete, setRequirePinDelete);
    set(d.security?.forceMFAAdmins, setForceMFAAdmins);
    set(d.security?.autoLockMinutes, setAutoLockMinutes);
    set(d.security?.roleMatrix, setRoleMatrix);

    set(d.integrations?.socialInboxEnabled, setSocialInboxEnabled);
    set(d.integrations?.facebookPageToken, setFacebookPageToken);
    set(d.integrations?.instagramToken, setInstagramToken);
    set(d.integrations?.webhookUrl, setWebhookUrl);
    set(d.integrations?.apiKeyPublic, setApiKeyPublic);
    set(d.integrations?.apiKeySecret, setApiKeySecret);
    set(d.integrations?.smsProviderApiKey, setSmsProviderApiKey);
    set(d.integrations?.smsSender, setSmsSender);

    set(d.flags?.ffBetaWorkOrderV2, setFfBetaWorkOrderV2);
    set(d.flags?.ffFastCameraUpload, setFfFastCameraUpload);
    set(d.flags?.ffMultiBranch, setFfMultiBranch);

    toastRef.current?.show("Importación cargada (sin guardar). Revisa y presiona Guardar.");
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] text-white p-6 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Cargando configuración…</div>
      </div>
    );
  }
  if (!isAllowed) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] text-white"
         style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 72px)" }}>
      <Toast ref={toastRef} />

      <div className="md:hidden sticky top-0 z-50 bg-[#0D0D0D]/95 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-red-500" />
            <span className="font-semibold">Configuración</span>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Sucursal" value={branchCode} onChange={e=>setBranchCode(e.target.value.trim())}
                   className="w-28 h-10 bg-black/40 border-white/15" />
            <Button className="bg-red-600 hover:bg-red-700 h-10 px-4 rounded-lg" onClick={handleSaveAll} disabled={saving}>
              <Save className="w-4 h-4 mr-1.5" /> {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-4 md:py-8 max-w-7xl mx-auto space-y-6">
        <div className="hidden md:flex items-start justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#FF0000] to-red-700 bg-clip-text text-transparent flex items-center gap-2">
              <SettingsIcon className="w-7 h-7" /> Configuración del Sistema
            </h1>
            <p className="text-gray-400 mt-1">Todo lo que puedes configurar, en un solo lugar.</p>
          </div>
          <div className="flex items-center gap-3">
            {savedAt && <span className="text-xs text-gray-400">Guardado {savedAt}</span>}
            <Input placeholder="Sucursal (ej. SJ01)" value={branchCode} onChange={e=>setBranchCode(e.target.value.trim())}
                   className="w-36 h-11 bg-black/40 border-white/10" />
            <Button className="bg-red-600 hover:bg-red-700 h-11 px-5 rounded-lg" onClick={handleSaveAll} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> {saving ? "Guardando…" : "Guardar todo"}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" orientation="vertical">
          <TabsList className="md:w-64 bg-gray-900 p-2 rounded-lg border border-gray-800
                               w-full overflow-x-auto no-scrollbar flex md:block whitespace-nowrap md:whitespace-normal gap-2 md:gap-0 sticky md:static top-[56px] z-40">
            <TabsTrigger value="branding" className="justify-start gap-2"><Palette/> General & Branding</TabsTrigger>
            <TabsTrigger value="pos" className="justify-start gap-2"><ShoppingCart2/> POS y Ventas</TabsTrigger>
            <TabsTrigger value="orders" className="justify-start gap-2"><ClipboardList2/> Órdenes</TabsTrigger>
            <TabsTrigger value="inventory" className="justify-start gap-2"><Package2/> Inventario</TabsTrigger>
            <TabsTrigger value="numbering" className="justify-start gap-2"><Hash/> Numeración</TabsTrigger>
            <TabsTrigger value="tax" className="justify-start gap-2"><DollarSign/> Impuestos & Recibos</TabsTrigger>
            <TabsTrigger value="email" className="justify-start gap-2"><Mail/> Email & Notifs</TabsTrigger>
            <TabsTrigger value="security" className="justify-start gap-2"><KeyRound/> Seguridad & Roles</TabsTrigger>
            <TabsTrigger value="users" className="justify-start gap-2"><Users2/> Usuarios</TabsTrigger>
            <TabsTrigger value="branches" className="justify-start gap-2"><Building2b/> Sucursales</TabsTrigger>
            <TabsTrigger value="integrations" className="justify-start gap-2"><Globe/> Integraciones</TabsTrigger>
            <TabsTrigger value="flags" className="justify-start gap-2"><FlaskConical/> Feature Flags</TabsTrigger>
            <TabsTrigger value="tools" className="justify-start gap-2"><Database/> Herramientas</TabsTrigger>
          </TabsList>

          <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>

          <div className="flex-1 md:pl-6 space-y-6">
            <TabsContent value="branding">
              <SettingsCard title="General & Branding" description="Identidad visual y regionales.">
                <Row label="Nombre de la tienda" control={<Input value={storeName} onChange={e=>setStoreName(e.target.value)} className="h-11" />} />
                <Row label="Logo (base64)" description="Se usa en la UI/recibo"
                     control={<Input type="file" accept="image/*" onChange={e=>onLogoFileChange(e.target.files?.[0]||null)} className="h-11" />} />
                <Row label="Color primario" control={<Input type="color" value={primaryColor} onChange={e=>setPrimaryColor(e.target.value)} className="h-11" />} />
                <Row label="Color acento" control={<Input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)} className="h-11" />} />
                <Row label="Símbolo de moneda" control={<Input value={currencySymbol} onChange={e=>setCurrencySymbol(e.target.value)} className="h-11" />} />
                <Row label="Zona horaria" control={<Input value={timezone} onChange={e=>setTimezone(e.target.value)} className="h-11" />} />
                <Row label="Idioma por defecto" control={
                  <select className="w-full md:w-[300px] bg-black/40 border border-white/15 rounded-md px-3 h-11"
                          value={language} onChange={e=>setLanguage(e.target.value)}>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="bi">Bilingüe</option>
                  </select>
                } />
                <Row label="Formato de fecha" control={<Input value={dateFormat} onChange={e=>setDateFormat(e.target.value)} className="h-11" />} />
                <Row label="Formato de hora" control={<Input value={timeFormat} onChange={e=>setTimeFormat(e.target.value)} className="h-11" />} />
                <div className="flex justify-end">
                  <Button variant="outline" className="border-white/15 bg-zinc-900/60 h-11"
                          onClick={()=>{
                            setStoreName("911 SmartFix"); setPrimaryColor("#FF0000"); setAccentColor("#ffffff");
                            setLogoDataUrl(null); setCurrencySymbol("$"); setTimezone("America/Puerto_Rico"); setLanguage("es");
                            setDateFormat("dd/MM/yyyy"); setTimeFormat("HH:mm");
                          }}>
                    <RefreshCcw className="w-4 h-4 mr-2"/> Reset sección
                  </Button>
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="pos">
              <SettingsCard title="POS y Ventas" description="Pagos, caja, descuentos y propinas.">
                <Row label="Requerir cliente para vender" control={<Switch checked={posRequireCustomer} onCheckedChange={setPosRequireCustomer} />} />
                <Row label="Métodos de pago" control={<Input value={paymentMethods} onChange={e=>setPaymentMethods(e.target.value)} className="h-11" />} />
                <Row label="Tolerancia de caja" description="Diferencia máxima al cierre"
                     control={<Input type="number" value={cashTolerance} onChange={e=>setCashTolerance(e.target.value)} className="h-11" />} />
                <Row label="Permitir descuentos" control={<Switch checked={enableDiscounts} onCheckedChange={setEnableDiscounts} />} />
                <Row label="Descuento máximo (%)" control={<Input type="number" value={maxDiscountPct} onChange={e=>setMaxDiscountPct(e.target.value)} className="h-11" />} />
                <Row label="Abrir caja: requerir conteo inicial" control={<Switch checked={openDrawerRequireCashCount} onCheckedChange={setOpenDrawerRequireCashCount} />} />
                <Row label="Cerrar caja: requerir reconteo" control={<Switch checked={closeDrawerRequireRecount} onCheckedChange={setCloseDrawerRequireRecount} />} />
                <Row label="Propinas habilitadas" control={<Switch checked={tipEnabled} onCheckedChange={setTipEnabled} />} />
                <div className="flex justify-end">
                  <Button variant="outline" className="border-white/15 bg-zinc-900/60 h-11"
                          onClick={()=>{
                            setPosRequireCustomer(false); setPaymentMethods("Cash, Card, ATH Móvil");
                            setCashTolerance("0.50"); setEnableDiscounts(true); setMaxDiscountPct("15");
                            setOpenDrawerRequireCashCount(true); setCloseDrawerRequireRecount(true); setTipEnabled(false);
                          }}>
                    <RefreshCcw className="w-4 h-4 mr-2"/> Reset sección
                  </Button>
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="orders">
              <SettingsCard title="Órdenes de Trabajo" description="Flujo, pagos y captura de evidencia.">
                <Row label="Flujo de estados (CSV)" description="Ej: Recepción,Diagnóstico,En Reparación,Listo,Entregado"
                     control={<Input value={statusFlow} onChange={e=>setStatusFlow(e.target.value)} className="h-11" />} />
                <Row label="Permitir retroceder estado" control={<Switch checked={allowBackStatus} onCheckedChange={setAllowBackStatus} />} />
                <Row label="Bloquear entrega si existe saldo" control={<Switch checked={blockDeliveryWithoutPay} onCheckedChange={setBlockDeliveryWithoutPay} />} />
                <Row label="Permitir pagos parciales" control={<Switch checked={allowPartialPayments} onCheckedChange={setAllowPartialPayments} />} />
                <Row label="Auto-asignar al creador" control={<Switch checked={autoAssignToCreator} onCheckedChange={setAutoAssignToCreator} />} />
                <Row label="Requerir fotos al recibir" control={<Switch checked={requirePhotosIntake} onCheckedChange={setRequirePhotosIntake} />} />
                <Row label="Permitir usar cámara del dispositivo" control={<Switch checked={allowCamera} onCheckedChange={setAllowCamera} />} />
                <div className="flex justify-end">
                  <Button variant="outline" className="border-white/15 bg-zinc-900/60 h-11"
                          onClick={()=>{
                            setStatusFlow("Recepción,Diagnóstico,En Reparación,Listo,Entregado");
                            setAllowBackStatus(true); setBlockDeliveryWithoutPay(true);
                            setAllowPartialPayments(true); setAutoAssignToCreator(false);
                            setRequirePhotosIntake(true); setAllowCamera(true);
                          }}>
                    <RefreshCcw className="w-4 h-4 mr-2"/> Reset sección
                  </Button>
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="inventory">
              <SettingsCard title="Inventario" description="Vista, stock y abastecimiento.">
                <Row label="Vista de inventario" description="'Cuadros' o 'Lista'"
                     control={<Input value={inventoryView} onChange={e=>setInventoryView(e.target.value)} className="h-11" />} />
                <Row label="Alertas de bajo stock" control={<Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />} />
                <Row label="Stock por sucursal" description="Requiere Multi-Sucursal"
                     control={<Switch checked={perBranchStock} onCheckedChange={setPerBranchStock} />} />
                <Row label="SKU automático" control={<Switch checked={skuAuto} onCheckedChange={setSkuAuto} />} />
                <Row label="Permitir stock negativo" control={<Switch checked={allowNegativeStock} onCheckedChange={setAllowNegativeStock} />} />
                <Row label="Días para 'entradas en camino'" control={<Input type="number" value={incomingThresholdDays} onChange={e=>setIncomingThresholdDays(e.target.value)} className="h-11" />} />
                <div className="flex justify-end">
                  <Button variant="outline" className="border-white/15 bg-zinc-900/60 h-11"
                          onClick={()=>{
                            setInventoryView("Cuadros"); setLowStockAlerts(true); setPerBranchStock(false);
                            setSkuAuto(true); setAllowNegativeStock(false); setIncomingThresholdDays("7");
                          }}>
                    <RefreshCcw className="w-4 h-4 mr-2"/> Reset sección
                  </Button>
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="numbering">
              <SettingsCard title="Numeración" description="Prefijos y secuencias.">
                <Row label="Prefijo de Órdenes" control={<Input value={orderPrefix} onChange={e=>setOrderPrefix(e.target.value)} className="h-11" />} />
                <Row label="Prefijo de Ventas" control={<Input value={salePrefix} onChange={e=>setSalePrefix(e.target.value)} className="h-11" />} />
                <Row label="Prefijo de Clientes" control={<Input value={customerPrefix} onChange={e=>setCustomerPrefix(e.target.value)} className="h-11" />} />
                <Row label="Comenzar desde #" control={<Input type="number" value={startNumbersAt} onChange={e=>setStartNumbersAt(e.target.value)} className="h-11" />} />
                <div className="flex justify-end">
                  <Button variant="outline" className="border-white/15 bg-zinc-900/60 h-11"
                          onClick={()=>{ setOrderPrefix("WO-"); setSalePrefix("SALE-"); setCustomerPrefix("CUS-"); setStartNumbersAt("1"); }}>
                    <RefreshCcw className="w-4 h-4 mr-2"/> Reset sección
                  </Button>
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="tax">
              <SettingsCard title="Impuestos & Recibos" description="IVU y plantilla de recibo.">
                <Row label="Tasa de IVU (%)" control={<Input type="number" value={ivuRate} onChange={e=>setIvuRate(e.target.value)} className="h-11" />} />
                <Row label="Mostrar logo en recibo" control={<Switch checked={showLogoOnReceipt} onCheckedChange={setShowLogoOnReceipt} />} />
                <Row label="Ancho de papel" description="E.g. 58mm / 80mm"
                     control={<Input value={receiptPaperWidth} onChange={e=>setReceiptPaperWidth(e.target.value)} className="h-11" />} />
                <Row label="Encabezado" control={<Input value={receiptHeader} onChange={e=>setReceiptHeader(e.target.value)} className="h-11" />} />
                <Row label="Pie de página" control={<Input value={receiptFooter} onChange={e=>setReceiptFooter(e.target.value)} className="h-11" />} />
                <Row label="Notas en factura" control={<Input value={invoiceNotes} onChange={e=>setInvoiceNotes(e.target.value)} className="h-11" />} />
                <div className="rounded-md border border-white/10 p-3">
                  <p className="text-sm text-gray-400 mb-2">Preview</p>
                  <div className="p-4 bg-white text-black rounded-md max-w-md">
                    <div className="flex items-center justify-between">
                      <div className="font-bold">{storeName}</div>
                      <div style={{ color: primaryColor }}>{currencySymbol}</div>
                    </div>
                    <hr className="my-2" />
                    <div className="text-xs text-gray-700">{receiptHeader}</div>
                    <div className="text-xs mt-2">Subtotal: 100.00</div>
                    <div className="text-xs">IVU ({ivuRate}%): {(100 * Number(ivuRate || 0) / 100).toFixed(2)}</div>
                    <div className="text-sm font-semibold mt-1">Total: {(100 + 100 * Number(ivuRate || 0) / 100).toFixed(2)} {currencySymbol}</div>
                    <div className="text-[11px] text-gray-600 mt-2">{invoiceNotes}</div>
                    <div className="text-[11px] text-gray-600 mt-1">{receiptFooter}</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" className="border-white/15 bg-zinc-900/60 h-11"
                          onClick={()=>{ setIvuRate("11.5"); setReceiptHeader("Gracias por su preferencia");
                                         setReceiptFooter("No somos responsables por pérdida de datos."); setInvoiceNotes("IVU 11.5% incluido cuando aplique."); }}>
                    <RefreshCcw className="w-4 h-4 mr-2"/> Reset sección
                  </Button>
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="email">
              <SettingsCard title="Email & Notificaciones" description="SMTP y canales de alerta.">
                <Row label="SMTP Host" control={<Input value={smtpHost} onChange={e=>setSmtpHost(e.target.value)} className="h-11" />} />
                <Row label="SMTP Port" control={<Input type="number" value={smtpPort} onChange={e=>setSmtpPort(e.target.value)} className="h-11" />} />
                <Row label="SMTP Usuario" control={<Input value={smtpUser} onChange={e=>setSmtpUser(e.target.value)} className="h-11" />} />
                <Row label="SMTP Password" control={<Input type="password" value={smtpPass} onChange={e=>setSmtpPass(e.target.value)} className="h-11" />} />
                <Row label="Remitente (From)" control={<Input value={smtpFrom} onChange={e=>setSmtpFrom(e.target.value)} className="h-11" />} />
                <Row label="Email al crear orden" control={<Switch checked={notifCreateWO} onCheckedChange={setNotifCreateWO} />} />
                <Row label="Email cuando está 'Listo'" control={<Switch checked={notifReadyWO} onCheckedChange={setNotifReadyWO} />} />
                <Row label="Email en cierre de caja" control={<Switch checked={notifCashClose} onCheckedChange={setNotifCashClose} />} />
                <Row label="Sonido de notificaciones" control={<Switch checked={notifSound} onCheckedChange={setNotifSound} />} />
                <Row label="Notificaciones in-app" control={<Switch checked={notifInApp} onCheckedChange={setNotifInApp} />} />
              </SettingsCard>
              <TestsCard
                smtpHost={smtpHost} smtpUser={smtpUser} smtpFrom={smtpFrom}
                webhookUrl={webhookUrl} smsSender={smsSender} toastRef={toastRef}
              />
            </TabsContent>

            <TabsContent value="security">
              <SettingsCard title="Seguridad & Roles" description="Controles de acceso y RBAC.">
                <Row label="Requerir PIN para eliminar" control={<Switch checked={requirePinDelete} onCheckedChange={setRequirePinDelete} />} />
                <Row label="Forzar MFA a Admins" control={<Switch checked={forceMFAAdmins} onCheckedChange={setForceMFAAdmins} />} />
                <Row label="Autobloqueo (min)" control={<Input type="number" value={autoLockMinutes} onChange={e=>setAutoLockMinutes(e.target.value)} className="h-11" />} />
                <div className="rounded-md border border-white/10 p-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="text-left py-2">Rol</th>
                        {["settings","financial","orders","inventory","reports","exports"].map(h=>(
                          <th key={h} className="text-center py-2 capitalize">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(roleMatrix).map(([role, perms])=>(
                        <tr key={role} className="border-t border-white/10">
                          <td className="py-2 capitalize">{role}</td>
                          {Object.keys(perms).map((k)=>(
                            <td key={k} className="text-center py-2">
                              <Switch checked={perms[k]} onCheckedChange={(v)=>{
                                setRoleMatrix(prev=>({ ...prev, [role]: { ...prev[role], [k]: v }}));
                              }}/>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="users">
              <UsersSettingsTab toastRef={toastRef} />
            </TabsContent>

            <TabsContent value="branches">
              <BranchesSettingsTab toastRef={toastRef} />
            </TabsContent>

            <TabsContent value="integrations">
              <SettingsCard title="Integraciones" description="Social, webhooks, SMS y API keys.">
                <Row label="Activar Social Inbox" control={<Switch checked={socialInboxEnabled} onCheckedChange={setSocialInboxEnabled} />} />
                <Row label="Facebook Page Token" control={<Input value={facebookPageToken} onChange={e=>setFacebookPageToken(e.target.value)} className="h-11" />} />
                <Row label="Instagram Token" control={<Input value={instagramToken} onChange={e=>setInstagramToken(e.target.value)} className="h-11" />} />
                <Row label="Webhook URL" control={<Input value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} className="h-11" />} />
                <Row label="API Key (public)" control={<Input value={apiKeyPublic} onChange={e=>setApiKeyPublic(e.target.value)} className="h-11" />} />
                <Row label="API Key (secret)" control={<Input type="password" value={apiKeySecret} onChange={e=>setApiKeySecret(e.target.value)} className="h-11" />} />
                <Row label="SMS Provider API Key" control={<Input value={smsProviderApiKey} onChange={e=>setSmsProviderApiKey(e.target.value)} className="h-11" />} />
                <Row label="SMS Sender" control={<Input value={smsSender} onChange={e=>setSmsSender(e.target.value)} className="h-11" />} />
              </SettingsCard>
            </TabsContent>

            <TabsContent value="flags">
              <SettingsCard title="Feature Flags" description="Activa características beta/condicionales.">
                <Row label="Work Order v2 (beta)" control={<Switch checked={ffBetaWorkOrderV2} onCheckedChange={setFfBetaWorkOrderV2} />} />
                <Row label="Subida rápida (cámara)" control={<Switch checked={ffFastCameraUpload} onCheckedChange={setFfFastCameraUpload} />} />
                <Row label="Multi-Sucursal" control={<Switch checked={ffMultiBranch} onCheckedChange={setFfMultiBranch} />} />
              </SettingsCard>
            </TabsContent>

            <TabsContent value="tools">
              <SettingsCard title="Herramientas" description="Exportar, importar y ámbito por sucursal.">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="border-white/15 bg-zinc-900/60 h-11" onClick={exportAll}>
                    <Download className="w-4 h-4 mr-2" /> Exportar JSON
                  </Button>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-900/60 border border-white/15 cursor-pointer h-11">
                    <Upload className="w-4 h-4" />
                    <span>Importar JSON</span>
                    <input type="file" accept="application/json" className="hidden" onChange={e=>e.target.files?.[0] && importAll(e.target.files[0])}/>
                  </label>
                  <div className="flex items-center gap-2">
                    <Building2b className="w-4 h-4 text-gray-400" />
                    <Input placeholder="Sucursal (ej. SJ01)" value={branchCode} onChange={e=>setBranchCode(e.target.value.trim())} className="w-36 h-11 bg-black/40 border-white/10" />
                  </div>
                </div>
              </SettingsCard>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="bg-[#0D0D0D]/95 backdrop-blur border-t border-white/10 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">{savedAt ? `Guardado ${savedAt}` : "—"}</span>
          <Button className="bg-red-600 hover:bg-red-700 h-10 px-4 rounded-lg" onClick={async ()=>{ await handleSaveAll(); setSavedAt(new Date().toLocaleTimeString()); }} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" /> {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------
// Master Settings Hub (incluye la pestaña "System")
// -----------------------------------------------
const TABS = [
  { id: "ui", label: "UI/Theme", icon: Palette },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "workorder", label: "Work Order", icon: FileText },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "purchasing", label: "Purchasing", icon: ShoppingCart },
  { id: "users", label: "Users/Roles", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "printing", label: "Printing", icon: Printer },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "performance", label: "Performance", icon: Zap },
  { id: "tenancy", label: "Multi-tenancy", icon: Building2 },
  // NUEVA: pestaña System (SettingsPage completo)
  { id: "system", label: "System", icon: SettingsIconHub }
];

// Si mantienes tabs individuales externos, impórtalos aquí.
// Para simplificar este archivo “todo en uno”, puedes comentar los imports
// y TabsContent de esos tabs, y usar solo la pestaña “System”.
// Aquí los dejo tal cual estabas usando:
import UiTab from "./tabs/UiTab";
import DashboardTab from "./tabs/DashboardTab";
import OrdersTab from "./tabs/OrdersTab";
import WorkOrderTab from "./tabs/WorkOrderTab";
import InventoryTab from "./tabs/InventoryTab";
import PurchasingTab from "./tabs/PurchasingTab";
import UsersTab from "./tabs/UsersTab";
import ReportsTab from "./tabs/ReportsTab";
import PrintingTab from "./tabs/PrintingTab";
import IntegrationsTab from "./tabs/IntegrationsTab";
import NotificationsTab from "./tabs/NotificationsTab";
import SecurityTab from "./tabs/SecurityTab";
import MediaTab from "./tabs/MediaTab";
import PerformanceTab from "./tabs/PerformanceTab";
import TenancyTab from "./tabs/TenancyTab";

export default function MasterSettingsHub() {
  const [activeTab, setActiveTab] = useState("workorder");
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const originalConfigRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Helper to provide default config, using the imported DEFAULT_MASTER_SETTINGS
  const getDefaultConfig = useCallback(() => {
    return DEFAULT_MASTER_SETTINGS;
  }, []);

  useEffect(() => {
    loadSettings();
    
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = ''; // Standard for most browsers
        return 'You have unsaved changes. Are you sure you want to leave?'; // For some older browsers
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, getDefaultConfig]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const appSettingsEntity = window.base44?.entities?.AppSettings || base44?.entities?.AppSettings;
      const rows = await appSettingsEntity.filter({ slug: "master-settings" });
      let loadedConfig = null;
      
      if (rows && rows.length > 0) {
        loadedConfig = rows[0].payload || getDefaultConfig();
      } else {
        loadedConfig = getDefaultConfig();
        await appSettingsEntity.create({
          slug: "master-settings",
          payload: loadedConfig,
          description: "Master settings for 911 SmartFix App"
        });
      }
      
      setConfig(loadedConfig);
      originalConfigRef.current = JSON.parse(JSON.stringify(loadedConfig));
      setHasChanges(false);
    } catch (error) {
      console.error("Error loading settings:", error);
      const defaultCfg = getDefaultConfig();
      setConfig(defaultCfg);
      originalConfigRef.current = JSON.parse(JSON.stringify(defaultCfg));
    } finally {
      setLoading(false);
    }
  };

  // This helper is for individual tabs to update their specific category of settings
  const handleCategoryConfigChange = useCallback((categoryKey, newCategoryConfig) => {
    setConfig(prevConfig => {
        const updatedConfig = {
            ...prevConfig,
            [categoryKey]: newCategoryConfig
        };
        setHasChanges(JSON.stringify(updatedConfig) !== JSON.stringify(originalConfigRef.current));
        return updatedConfig;
    });
  }, []);

  // The handleConfigChange as specified in the outline.
  // This version implies an update to the *entire* config object.
  // We'll use handleCategoryConfigChange for individual tabs to keep existing functionality.
  const handleConfigChange = useCallback((newConfig) => {
    setConfig(newConfig);
    setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(originalConfigRef.current));
  }, []);


  const handleSave = async () => {
    if (!hasChanges) {
      alert("No hay cambios para guardar");
      return;
    }

    setSaving(true);
    try {
      const appSettingsEntity = window.base44?.entities?.AppSettings || base44?.entities?.AppSettings;
      const rows = await appSettingsEntity.filter({ slug: "master-settings" });
      
      if (rows && rows.length > 0) {
        await appSettingsEntity.update(rows[0].id, {
          payload: config,
          description: "Master settings for 911 SmartFix App"
        });
      } else {
        await appSettingsEntity.create({
          slug: "master-settings",
          payload: config,
          description: "Master settings for 911 SmartFix App"
        });
      }

      originalConfigRef.current = JSON.parse(JSON.stringify(config));
      setHasChanges(false);
      setLastSaved(new Date());
      
      // ✅ Broadcast cambios a otros componentes
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: config }));
      
      alert("✅ Configuración guardada exitosamente");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("❌ Error al guardar la configuración. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!hasChanges) {
      alert("No hay cambios para descartar");
      return;
    }

    if (confirm("¿Descartar todos los cambios no guardados?")) {
      setConfig(JSON.parse(JSON.stringify(originalConfigRef.current)));
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] text-white">
      {/* Sticky Header con indicador de cambios */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Configuración Maestra</h1>
              <p className="text-sm text-gray-400 mt-1">
                Sistema de configuración centralizado
                {lastSaved && (
                  <span className="ml-2 text-emerald-400">
                    • Último guardado: {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <>
                  <Badge className="bg-amber-600/20 text-amber-300 border-amber-600/30 animate-pulse">
                    Cambios sin guardar
                  </Badge>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    disabled={saving}
                    className="border-white/15"
                  >
                    Descartar cambios
                  </Button>
                </>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`min-w-[140px] ${
                  hasChanges 
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900" 
                    : "bg-gray-600 cursor-not-allowed"
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : hasChanges ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar cambios
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Todo guardado
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-2 bg-zinc-900/50 p-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex items-center gap-2 data-[state=active]:bg-red-600"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-6">
            {/* Tabs existentes */}
            <TabsContent value="ui">
              <UiTab settings={config?.ui} onChange={(newUi) => handleCategoryConfigChange("ui", newUi)} />
            </TabsContent>
            <TabsContent value="dashboard">
              <DashboardTab settings={config?.dashboard} onChange={(newDashboard) => handleCategoryConfigChange("dashboard", newDashboard)} />
            </TabsContent>
            <TabsContent value="orders">
              <OrdersTab settings={config?.orders} onChange={(newOrders) => handleCategoryConfigChange("orders", newOrders)} />
            </TabsContent>
            <TabsContent value="workorder">
              <WorkOrderTab settings={config?.workorder} onChange={(newWorkorder) => handleCategoryConfigChange("workorder", newWorkorder)} />
            </TabsContent>
            <TabsContent value="inventory">
              <InventoryTab settings={config?.inventory} onChange={(newInventory) => handleCategoryConfigChange("inventory", newInventory)} />
            </TabsContent>
            <TabsContent value="purchasing">
              <PurchasingTab settings={config?.purchasing} onChange={(newPurchasing) => handleCategoryConfigChange("purchasing", newPurchasing)} />
            </TabsContent>
            <TabsContent value="users">
              <UsersTab settings={config?.users} onChange={(newUsers) => handleCategoryConfigChange("users", newUsers)} />
            </TabsContent>
            <TabsContent value="reports">
              <ReportsTab settings={config?.reports} onChange={(newReports) => handleCategoryConfigChange("reports", newReports)} />
            </TabsContent>
            <TabsContent value="printing">
              <PrintingTab settings={config?.printing} onChange={(newPrinting) => handleCategoryConfigChange("printing", newPrinting)} />
            </TabsContent>
            <TabsContent value="integrations">
              <IntegrationsTab settings={config?.integrations} onChange={(newIntegrations) => handleCategoryConfigChange("integrations", newIntegrations)} />
            </TabsContent>
            <TabsContent value="notifications">
              <NotificationsTab settings={config?.notifications} onChange={(newNotifications) => handleCategoryConfigChange("notifications", newNotifications)} />
            </TabsContent>
            <TabsContent value="security">
              <SecurityTab settings={config?.security} onChange={(newSecurity) => handleCategoryConfigChange("security", newSecurity)} />
            </TabsContent>
            <TabsContent value="media">
              <MediaTab settings={config?.media} onChange={(newMedia) => handleCategoryConfigChange("media", newMedia)} />
            </TabsContent>
            <TabsContent value="performance">
              <PerformanceTab settings={config?.performance} onChange={(newPerformance) => handleCategoryConfigChange("performance", newPerformance)} />
            </TabsContent>
            <TabsContent value="tenancy">
              {/* Note: Original code used 'settings.multi_tenancy', assuming the prop name should align with the actual state key 'multi_tenancy'. */}
              <TenancyTab settings={config?.multi_tenancy} onChange={(newTenancy) => handleCategoryConfigChange("multi_tenancy", newTenancy)} />
            </TabsContent>

            {/* NUEVA pestaña: System (Settings completos) */}
            <TabsContent value="system">
              <div className="rounded-lg border border-white/10 bg-gray-900">
                {/* SettingsPage manages its own state and persistence through getConfig/upsertConfig,
                    it does not receive props from MasterSettingsHub's 'config' state. */}
                <SettingsPage />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
