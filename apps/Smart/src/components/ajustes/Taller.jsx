import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Wrench, LayoutGrid, Package, Flag, MapPin, Tag, HardDrive, Check, Loader2, Download, Upload } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { supabase } from "../../../../../lib/supabase-client.js";
import { A, SubPage, Group, Row, ToggleRow, PrimaryBtn, ErrorLine } from "./ui";
import { updateTenant, hiddenStatusesOf, localGet, localSet, fetchTenantRow } from "@/lib/tenantSettings";
import { ORDER_STATUS } from "@/lib/orderStatus";
import { cacheBusinessMode } from "@/lib/businessMode";

const MODES = { repair: ["Reparación", "Taller de reparación: órdenes, técnicos, garantías y POS."], retail: ["Tienda", "Solo venta: covers, accesorios y celulares. POS e inventario, sin reparación."], both: ["Ambos", "Reparación y tienda juntas. Todas las funciones disponibles."] };
const modeSummary = (m) => (m === "retail" ? "Tienda — solo venta" : m === "both" ? "Reparación + Tienda" : "Reparación");
const FLOW = ["intake", "diagnosing", "waiting_parts", "por_reparar", "in_progress", "ready_for_pickup", "delivered"];
const SPECIAL = ["waiting_customer", "pending_order", "part_arrived_waiting_device", "reparacion_externa"];
const CLOSE = ["warranty", "cancelled", "not_repairable", "abandoned"];
const TOTAL = FLOW.length + SPECIAL.length + CLOSE.length;

export function TallerList({ tenant, go }) {
  const navigate = useNavigate();
  const [visit, setVisit] = useState(localGet("wizard.showVisitaTecnica", "false") === "true");
  const [labels, setLabels] = useState(localGet("print.labelsEnabled", "false") === "true");
  const hidden = hiddenStatusesOf(tenant);
  const on = TOTAL - [...FLOW, ...SPECIAL, ...CLOSE].filter((s) => hidden.includes(s)).length;
  return (
    <SubPage title="Taller" onBack={() => go(null)}>
      <Group header="Operación" pad={false}>
        <Row first Icon={Store} color={A.brand} title="Tipo de negocio" sub={modeSummary(tenant?.business_mode)} onClick={() => go("taller", "tipo-negocio")} />
        <Row Icon={LayoutGrid} color={A.brand} title="Catálogo de Dispositivos" sub="Categorías y modelos" onClick={() => navigate("/Inventory")} />
        <Row Icon={Package} color={A.warning} title="Inventario" sub="Stock y precios" onClick={() => navigate("/Inventory")} />
        <Row Icon={Flag} color="#63E6BE" title="Estados de la orden" sub={`${on} de ${TOTAL} encendidos`} onClick={() => go("taller", "estados")} />
        <ToggleRow Icon={MapPin} color="#FF9F0A" title="Visita técnica" sub={visit ? "Visible en nueva orden" : "Oculta en nueva orden"} on={visit} onChange={(v) => { setVisit(v); localSet("wizard.showVisitaTecnica", v); }} />
        <ToggleRow Icon={Tag} color="#A2845E" title="Etiquetas de equipo" sub={labels ? "Imprime etiqueta al crear una orden" : "No se imprime etiqueta"} on={labels} onChange={(v) => { setLabels(v); localSet("print.labelsEnabled", v); }} />
        <Row Icon={HardDrive} color={A.info} title="Datos del Taller" sub="Exportar clientes, órdenes, inventario" onClick={() => go("taller", "datos")} />
      </Group>
    </SubPage>
  );
}

export function TipoNegocio({ tenant, tenantId, reload, back }) {
  const navigate = useNavigate();
  const orig = tenant?.business_mode || "repair";
  const [mode, setMode] = useState(orig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { await updateTenant({ tenantId, columns: { business_mode: mode } }); cacheBusinessMode(mode); await reload(); if (mode === "retail") navigate("/POS"); else back(); } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };
  return (
    <SubPage title="Tipo de negocio" onBack={back} right={<button onClick={save} disabled={busy || mode === orig} className="apple-press disabled:opacity-40" style={{ padding: "8px 16px", borderRadius: 999, background: A.brand, color: "#fff", fontWeight: 700 }}>Guardar</button>}>
      <Group header="Tipo de negocio" footer="En modo Tienda se ocultan las funciones de reparación (órdenes, técnicos, garantías) y el POS pasa a ser la pantalla principal." pad={false}>
        {Object.entries(MODES).map(([k, [t, sub]], i) => (
          <button key={k} onClick={() => setMode(k)} className="apple-press flex items-center gap-3 text-left w-full" style={{ padding: "14px 16px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(mode === k ? A.brand : A.sub, 0.14), color: mode === k ? A.brand : A.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>{k === "repair" ? <Wrench className="w-4 h-4" /> : <Store className="w-4 h-4" />}</span>
            <span className="flex-1"><span className="block" style={{ fontSize: 16 }}>{t}</span><span className="block" style={{ fontSize: 12, color: A.sub }}>{sub}</span></span>
            {mode === k && <Check className="w-5 h-5" style={{ color: A.brand }} strokeWidth={3} />}
          </button>
        ))}
      </Group>
      <ErrorLine message={error} />
    </SubPage>
  );
}

export function EstadosOrden({ tenant, tenantId, reload, back }) {
  const [hidden, setHidden] = useState(hiddenStatusesOf(tenant));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const queue = useRef(Promise.resolve());
  const latest = useRef(hidden);
  const committed = useRef(hidden);
  const toggle = (id) => {
    const next = latest.current.includes(id) ? latest.current.filter((x) => x !== id) : [...latest.current, id];
    latest.current = next;
    setHidden(next);
    setBusy(true);
    queue.current = queue.current.then(async () => {
      const sending = latest.current;
      try {
        await updateTenant({ tenantId, settingsEdits: { hidden_order_statuses: sending }, baseSettings: { hidden_order_statuses: null } });
        committed.current = sending;
        setError(null);
        await reload();
      } catch (e) {
        latest.current = committed.current;
        setHidden(committed.current);
        setError(`No se pudo guardar: ${e?.message || e}`);
      }
    }).finally(() => setBusy(false));
  };
  const section = (title, ids, footer) => (
    <Group header={title} footer={footer} pad={false}>
      {ids.map((id, i) => { const s = ORDER_STATUS[id]; const Icon = s.Icon; const on = !hidden.includes(id); return (
        <div key={id} className="flex items-center gap-3" style={{ padding: "11px 16px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(s.color, 0.18), color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
          <span className="flex-1" style={{ fontSize: 16 }}>{s.label}</span>
          <button onClick={() => toggle(id)} role="switch" aria-checked={on} aria-label={s.label} style={{ width: 51, height: 31, borderRadius: 999, background: on ? A.brand : "#3A3A3C", position: "relative" }}><span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button>
        </div>); })}
    </Group>
  );
  return (
    <SubPage title="Estados de la orden" onBack={back} right={busy ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: A.sub }} /> : null}>
      <ErrorLine message={error} />
      {section("Flujo principal", FLOW, "Apaga los estados que no usas — dejan de mostrarse como pastilla en Órdenes aunque tengan trabajos activos. Aplica para todo el taller.")}
      {section("Casos especiales", SPECIAL)}
      {section("Cerrar orden", CLOSE)}
    </SubPage>
  );
}

const pad2 = (n) => String(n).padStart(2, "0");
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`; };

async function fetchAll(table, tenantId, extra) {
  const out = [];
  for (let off = 0; off < 10000; off += 1000) {
    let q = supabase.from(table).select("*").eq("tenant_id", tenantId);
    if (extra) q = extra(q);
    const { data, error } = await q.order("id", { ascending: true }).range(off, off + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function DatosTaller({ tenant, tenantId, reload, back }) {
  const [sel, setSel] = useState({ customers: true, orders: true, products: true, transactions: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const fileRef = useRef(null);
  const any = Object.values(sel).some(Boolean);
  const set = (k, v) => setSel((p) => ({ ...p, [k]: v }));

  const exportData = async () => {
    setBusy(true); setError(null);
    try {
      const [customers, orders, products, transactions, t] = await Promise.all([
        sel.customers ? fetchAll("customer", tenantId) : [], sel.orders ? fetchAll("order", tenantId) : [], sel.products ? fetchAll("product", tenantId, (q) => q.eq("active", true)) : [], sel.transactions ? fetchAll("transaction", tenantId) : [], fetchTenantRow(tenantId),
      ]);
      const payload = { manifest: { formatVersion: 1, exportedAt: new Date().toISOString(), tenantId, tenantName: tenant?.name || "", counts: { customers: customers.length, orders: orders.length, products: products.length, transactions: transactions.length } }, tenant: t, customers, orders, products, transactions };
      const sortKeys = (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v);
      const blob = new Blob([JSON.stringify(payload, sortKeys, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `smartfixos-backup-${tenantId.slice(0, 8)}-${stamp()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };

  const readFile = async (file) => {
    setMsg(null); setError(null);
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || !data.tenant) throw new Error("El archivo no parece un backup válido de Archilla OS.");
      if (!data.manifest) throw new Error("El backup no incluye un manifest — versión incompatible.");
      const mid = String(data.manifest.tenantId || "");
      const tt = String(data.tenant.id || "");
      if (!mid || !tt) throw new Error("El backup no incluye el identificador del taller — no se puede restaurar.");
      if (mid !== tenantId || tt !== tenantId) throw new Error(`Este backup es de otro taller (id ${(mid !== tenantId ? mid : tt).slice(0, 8)}…) y no se puede restaurar al actual (${tenantId.slice(0, 8)}…).`);
      setConfirm(data);
    } catch (e) { setError(e?.message || String(e)); }
  };

  const restore = async () => {
    const data = confirm;
    setBusy(true); setError(null);
    try {
      const keys = ["name", "email", "country", "currency", "address", "timezone", "admin_name", "admin_phone", "logo_url", "settings"];
      const patch = {};
      const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
      const required = ["name", "currency", "country", "timezone"];
      const optional = ["email", "address", "admin_name", "admin_phone", "logo_url"];
      keys.forEach((k) => {
        if (!(k in data.tenant)) return;
        const v = data.tenant[k];
        if (k === "settings") {
          if (!isObj(v)) throw new Error("Backup inválido: la configuración no es un objeto.");
          patch[k] = v;
        } else if (required.includes(k)) {
          if (typeof v !== "string" || !v.trim()) throw new Error(`Backup inválido: ${k} vacío o con formato incorrecto.`);
          patch[k] = v;
        } else if (optional.includes(k)) {
          if (v !== null && typeof v !== "string") throw new Error(`Backup inválido: ${k} con formato incorrecto.`);
          patch[k] = v;
        }
      });
      if (!Object.keys(patch).length) { setMsg("Restauración completada sin cambios"); return; }
      const { data: rows, error: e } = await supabase.from("tenant").update(patch).eq("id", tenantId).select("id");
      if (e) throw e;
      if (!rows?.length) throw new Error("Sin permiso para restaurar.");
      const n = Object.keys(data.tenant.settings?.email_templates || {}).length;
      setMsg(`Listo — Configuración restaurada${n ? ` · ${n} plantillas` : ""}`);
      await reload();
    } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };

  const tog = (k, title, sub, first) => <ToggleRow first={first} Icon={Check} color={A.info} title={title} sub={sub} on={sel[k]} onChange={(v) => set(k, v)} />;
  return (
    <SubPage title="Datos del Taller" onBack={back}>
      <Group header="Exportar datos" footer="Descarga los datos seleccionados para respaldarlos o migrarlos a otro sistema." pad={false}>
        {tog("customers", "Clientes", "Nombre, contacto, dirección, historial", true)}{tog("orders", "Órdenes", "Órdenes de trabajo con fotos y detalles")}{tog("products", "Productos e inventario", "Piezas, accesorios, servicios y stock")}{tog("transactions", "Transacciones financieras", "Pagos, gastos, depósitos, nómina")}
        <div className="flex gap-3" style={{ padding: "12px 16px", borderTop: `0.5px solid ${A.sep}` }}>
          <button onClick={() => setSel({ customers: true, orders: true, products: true, transactions: true })} style={{ color: A.brand, fontWeight: 600 }}>Seleccionar todo</button>
          <button onClick={() => setSel({ customers: false, orders: false, products: false, transactions: false })} style={{ color: A.danger, fontWeight: 600 }}>Limpiar</button>
        </div>
      </Group>
      <ErrorLine message={error} />
      <PrimaryBtn onClick={exportData} busy={busy} disabled={!any} color="#0A84FF" busyLabel="Exportando..."><Download className="w-5 h-5" /> Exportar</PrimaryBtn>
      <p style={{ fontSize: 12, color: A.sub, marginTop: -8 }}>Se descarga un archivo con los datos seleccionados. Puedes guardarlo en Archivos, enviarlo por AirDrop o adjuntarlo a un email.</p>
      <Group header="Importar" footer="Restaura la configuración del taller desde un backup. Para importar clientes u órdenes de otro taller, usa el mismo archivo de exportación." pad={false}>
        {msg && <p style={{ padding: "12px 16px", color: A.success, fontSize: 14 }}>{msg}</p>}
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readFile(f); }} />
        <Row first Icon={Upload} color={A.warning} title="Importar backup" sub="Clientes, órdenes, inventario, configuración" onClick={() => fileRef.current?.click()} />
      </Group>
      <Group header="Qué incluye el backup">
        {["Clientes y órdenes del taller", "Inventario y catálogo de productos", "Configuración del negocio", "Compatible con el importador de Archilla OS"].map((t) => <p key={t} className="flex items-center gap-2" style={{ fontSize: 14, padding: "3px 0" }}><Check className="w-4 h-4" style={{ color: A.success }} /> {t}</p>)}
      </Group>
      <AlertDialog open={!!confirm} title="¿Restaurar configuración?" message="Vamos a sobrescribir la configuración actual del taller con el backup. Esta acción no se puede deshacer fácilmente — confirma que es el archivo correcto." onClose={() => setConfirm(null)} actions={[{ label: "Cancelar" }, { label: "Restaurar", destructive: true, onPress: restore }]} />
    </SubPage>
  );
}

