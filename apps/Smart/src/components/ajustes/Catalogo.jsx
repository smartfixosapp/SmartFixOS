import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Smartphone, Tablet, Laptop, Monitor, Gamepad2, Watch, Headphones, Speaker, Tv, Camera, Printer, Keyboard, Mouse, Cpu, HardDrive,
  Battery, Wifi, Wrench, Box, LockOpen, Plus, Pencil, Trash2, ChevronRight, Search, Loader2, Tag, Layers,
} from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { Dialog, AlertDialog, TextAction, tint } from "@/components/pos/native/posUi";
import { fitViewport } from "@/lib/viewport";
import { A, SubPage, ErrorLine } from "./ui";

const ICONS = {
  Smartphone, Tablet, Laptop, Monitor, Gamepad2, Watch, Headphones, Speaker, Tv, Camera, Printer, Keyboard, Mouse, Cpu, HardDrive,
  Battery, Wifi, Wrench, Box, LockOpen,
};

const ICON_COLOR = {
  Smartphone: "#0A84FF", Laptop: "#BF5AF2", Tablet: "#40C8E0", Gamepad2: "#FF375F", LockOpen: "#FF9F0A", Monitor: "#5E5CE6",
  Watch: "#30D158", Headphones: "#FF9F0A", Speaker: "#FF9F0A", Tv: "#5E5CE6", Camera: "#64D2FF", Printer: "#8E8E93",
  Keyboard: "#8E8E93", Mouse: "#8E8E93", Cpu: "#FF375F", HardDrive: "#8E8E93", Battery: "#30D158", Wifi: "#0A84FF", Wrench: "#8E8E93", Box: "#A2845E",
};

const SF_ALIAS = {
  iphone: "Smartphone", ipod: "Smartphone", ipad: "Tablet", laptopcomputer: "Laptop", desktopcomputer: "Monitor", applewatch: "Watch",
  "gamecontroller.fill": "Gamepad2", headphones: "Headphones", tv: "Tv", "camera.fill": "Camera", "printer.fill": "Printer", cpu: "Cpu",
  keyboard: "Keyboard", "wrench.and.screwdriver.fill": "Wrench", "shippingbox.fill": "Box",
};

const PALETTE = ["#0A84FF", "#FF375F", "#BF5AF2", "#FF9F0A", "#30D158", "#40C8E0", "#5E5CE6", "#FF453A"];

function iconNameOf(cat) {
  const raw = String(cat?.icon_name || "").trim();
  if (ICONS[raw]) return raw;
  if (SF_ALIAS[raw]) return SF_ALIAS[raw];
  const n = String(cat?.name || "").toLowerCase();
  if (/(celular|phone|movil|móvil)/.test(n)) return "Smartphone";
  if (/(comput|laptop|pc)/.test(n)) return "Laptop";
  if (/(tablet|tableta|ipad)/.test(n)) return "Tablet";
  if (/(consola|console|juego)/.test(n)) return "Gamepad2";
  if (/(desbloqueo|unlock|software)/.test(n)) return "LockOpen";
  return "Box";
}

const LEVELS = [
  { key: "cat", table: "device_category", title: "Categorías", one: "la categoría", newTitle: "Nueva categoría", editTitle: "Editar categoría", hint: "Ej: Celular, Computadora", parentCol: null, parentLabel: "" },
  { key: "brand", table: "brand", title: "Marcas", one: "la marca", newTitle: "Nueva marca", editTitle: "Editar marca", hint: "Ej: Apple, Samsung", parentCol: "category_id", parentLabel: "una categoría" },
  { key: "family", table: "device_family", title: "Líneas", one: "la línea", newTitle: "Nueva línea", editTitle: "Editar línea", hint: "Ej: iPhone 17, Galaxy S25", parentCol: "brand_id", parentLabel: "una marca" },
  { key: "model", table: "device_model", title: "Modelos", one: "el modelo", newTitle: "Nuevo modelo", editTitle: "Editar modelo", hint: "Ej: Pro Max, Pro, Plus, 256GB", parentCol: "family_id", parentLabel: "una línea" },
];

const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es", { numeric: true, sensitivity: "base" });
const firstNumber = (s) => {
  const m = String(s || "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const byNewest = (a, b) => {
  const na = firstNumber(a.name);
  const nb = firstNumber(b.name);
  if (na !== null && nb !== null && na !== nb) return nb - na;
  if (na !== null && nb === null) return -1;
  if (na === null && nb !== null) return 1;
  return String(b.name || "").localeCompare(String(a.name || ""), "es", { numeric: true, sensitivity: "base" });
};
const SORTERS = [byName, byName, byNewest, byNewest];

const DENIED = "No tienes permiso para modificar este elemento del catálogo.";

function friendly(e) {
  if (e?.code === "23503") return "Esto todavía tiene elementos adentro. Bórralos primero.";
  if (e?.code === "23505") return "Ya existe uno con ese nombre.";
  return e?.message || String(e);
}

async function mutate(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  if (Array.isArray(data) && data.length === 0) throw new Error(DENIED);
  return data;
}

function useLevel(table, parentCol, parentId, sorter) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (parentCol && !parentId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    let q = supabase.from(table).select("*").limit(2000);
    if (parentCol) q = q.eq(parentCol, parentId);
    const { data, error: err } = await q;
    if (mine !== seq.current) return;
    if (err) setError(friendly(err));
    else { setError(null); setItems([...(data || [])].sort(sorter)); }
    setLoading(false);
  }, [table, parentCol, parentId, sorter]);
  useEffect(() => { load(); }, [load]);
  return { items, loading, error, reload: load };
}

async function idsOf(table, col, parents) {
  if (!parents.length) return [];
  const { data } = await supabase.from(table).select("id").in(col, parents).limit(5000);
  return (data || []).map((r) => r.id);
}

async function countBelow(level, id) {
  if (level === 3) return {};
  if (level === 2) return { models: (await idsOf("device_model", "family_id", [id])).length };
  if (level === 1) {
    const fam = await idsOf("device_family", "brand_id", [id]);
    return { families: fam.length, models: (await idsOf("device_model", "family_id", fam)).length };
  }
  const brands = await idsOf("brand", "category_id", [id]);
  const fam = await idsOf("device_family", "brand_id", brands);
  return { brands: brands.length, families: fam.length, models: (await idsOf("device_model", "family_id", fam)).length };
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function deleteMessage(level, counts) {
  const parts = [];
  if (counts.brands) parts.push(plural(counts.brands, "marca", "marcas"));
  if (counts.families) parts.push(plural(counts.families, "línea", "líneas"));
  if (counts.models) parts.push(plural(counts.models, "modelo", "modelos"));
  if (level === 3) return "Se quita este modelo del catálogo. Las órdenes que ya existen mantienen el nombre.";
  if (!parts.length) return "No tiene nada adentro.";
  return `Se borran también ${parts.join(", ")}. Las órdenes que ya existen mantienen el nombre.`;
}

function useWide() {
  const q = "(min-width: 1000px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setV(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}

function ItemDialog({ state, existing, busy, error, onSave, onClose }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Smartphone");
  const open = !!state;
  const level = state?.level ?? 0;
  const lv = LEVELS[level];
  useEffect(() => {
    if (!state) return;
    setName(state.item?.name || "");
    setIcon(state.item ? iconNameOf(state.item) : "Smartphone");
  }, [state]);
  const trimmed = name.trim();
  const duplicate = !!trimmed && existing.some((x) => x.id !== state?.item?.id && String(x.name || "").trim().toLowerCase() === trimmed.toLowerCase());
  const submit = () => { if (trimmed && !busy && !duplicate) onSave({ name: trimmed, icon }); };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      dismissable={!busy}
      title={state?.item ? lv.editTitle : lv.newTitle}
      width={460}
      leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>}
      trailing={busy ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: A.sub }} /> : <TextAction bold onClick={submit} disabled={!trimmed || duplicate}>Guardar</TextAction>}
    >
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={lv.hint}
          maxLength={80}
          className="outline-none"
          style={{ background: A.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, width: "100%", colorScheme: "dark" }}
        />
        {duplicate && <p style={{ fontSize: 13, color: A.warning }}>Ya existe {lv.one} con ese nombre en esta lista.</p>}
        {level === 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: A.sub, textTransform: "uppercase", marginBottom: 8 }}>Ícono</p>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))", gap: 8 }}>
              {Object.keys(ICONS).map((k) => {
                const Ic = ICONS[k];
                const on = icon === k;
                const color = ICON_COLOR[k] || A.brand;
                return (
                  <button key={k} type="button" onClick={() => setIcon(k)} aria-label={k} aria-pressed={on} className="apple-press flex items-center justify-center"
                    style={{ height: 46, borderRadius: 12, background: on ? tint(color, 0.22) : A.card2, color: on ? color : A.sub, border: `1.5px solid ${on ? color : "transparent"}` }}>
                    <Ic className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <ErrorLine message={error} />
      </div>
    </Dialog>
  );
}

function Column({ level, items, loading, error, selectedId, parentReady, canAdd, touch, onSelect, onAdd, onEdit, onDelete, wide }) {
  const lv = LEVELS[level];
  const [query, setQuery] = useState("");
  const showSearch = items.length > 10;
  useEffect(() => { setQuery(""); }, [level, parentReady]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((x) => String(x.name || "").toLowerCase().includes(q)) : items;
  }, [items, query]);
  const isLeaf = level === 3;
  return (
    <div className="flex flex-col" style={{ background: A.card, borderRadius: 16, overflow: "hidden", minWidth: 0, height: wide ? fitViewport("calc(100dvh - 230px)") : "auto", minHeight: wide ? 420 : 240 }}>
      <div className="flex items-center justify-between" style={{ padding: "12px 14px 8px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: A.sub, textTransform: "uppercase" }}>
          {lv.title}{parentReady ? ` · ${items.length}` : ""}
        </p>
        <button onClick={onAdd} disabled={!canAdd} aria-label={lv.newTitle} className="apple-press flex items-center justify-center disabled:opacity-30" style={{ width: 30, height: 30, borderRadius: 999, background: tint(A.brand, 0.16), color: A.brand }}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {showSearch && (
        <div style={{ padding: "0 12px 8px" }}>
          <div className="flex items-center gap-2" style={{ background: A.card2, borderRadius: 10, padding: "8px 10px" }}>
            <Search className="w-4 h-4" style={{ color: A.sub }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" className="outline-none flex-1" style={{ background: "transparent", color: "#fff", fontSize: 14, minWidth: 0 }} />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
        {!parentReady ? (
          <p style={{ fontSize: 13, color: A.sub, padding: "18px 16px" }}>Elige {lv.parentLabel} para ver {lv.title.toLowerCase()}.</p>
        ) : loading && !items.length ? (
          <div className="flex justify-center" style={{ padding: 28 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: A.sub }} /></div>
        ) : error ? (
          <div style={{ padding: "12px 14px" }}><ErrorLine message={error} /></div>
        ) : !shown.length ? (
          <p style={{ fontSize: 13, color: A.sub, padding: "18px 16px" }}>{items.length ? "Sin resultados." : `Sin ${lv.title.toLowerCase()}. Toca + para agregar.`}</p>
        ) : shown.map((item, i) => {
          const sel = item.id === selectedId;
          const Ic = level === 0 ? ICONS[iconNameOf(item)] : null;
          const color = level === 0 ? (ICON_COLOR[iconNameOf(item)] || PALETTE[i % PALETTE.length]) : A.sub;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => !isLeaf && onSelect(item)}
              onKeyDown={(e) => { if (!isLeaf && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(item); } }}
              className={`cat-row flex items-center gap-3${touch ? " cat-touch" : ""}`}
              style={{ padding: "10px 12px 10px 14px", borderTop: `0.5px solid ${A.sep}`, background: sel ? tint(A.brand, 0.16) : "transparent", cursor: isLeaf ? "default" : "pointer", transition: "background 0.15s" }}
            >
              {Ic && (
                <span style={{ width: 30, height: 30, borderRadius: 9, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic className="w-4 h-4" /></span>
              )}
              <span className="flex-1 min-w-0 truncate" style={{ fontSize: 15, fontWeight: sel ? 700 : 500, color: sel ? A.brand : "#fff" }}>{item.name}</span>
              <span className="cat-actions flex items-center" style={{ gap: 2 }}>
                <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} aria-label="Renombrar" className="apple-press flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 999, color: A.sub }}><Pencil className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} aria-label="Eliminar" className="apple-press flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 999, color: A.danger }}><Trash2 className="w-4 h-4" /></button>
              </span>
              {!isLeaf && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: sel ? A.brand : A.ter }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Catalogo({ tenantId, back }) {
  const wide = useWide();
  const tid = tenantId || (() => { try { return localStorage.getItem("smartfix_tenant_id") || ""; } catch { return ""; } })();
  const [catId, setCatId] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [famId, setFamId] = useState(null);
  const cats = useLevel(LEVELS[0].table, null, null, SORTERS[0]);
  const brands = useLevel(LEVELS[1].table, "category_id", catId, SORTERS[1]);
  const fams = useLevel(LEVELS[2].table, "brand_id", brandId, SORTERS[2]);
  const models = useLevel(LEVELS[3].table, "family_id", famId, SORTERS[3]);
  const data = [cats, brands, fams, models];
  const sel = [catId, brandId, famId, null];
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const catName = cats.items.find((x) => x.id === catId)?.name;
  const brandName = brands.items.find((x) => x.id === brandId)?.name;
  const famName = fams.items.find((x) => x.id === famId)?.name;
  const depth = !catId ? 0 : !brandId ? 1 : !famId ? 2 : 3;

  const pick = (level, item) => {
    if (level === 0) { setCatId(item.id); setBrandId(null); setFamId(null); }
    if (level === 1) { setBrandId(item.id); setFamId(null); }
    if (level === 2) setFamId(item.id);
  };

  const goTo = (level) => {
    if (level <= 0) { setCatId(null); setBrandId(null); setFamId(null); }
    else if (level === 1) { setBrandId(null); setFamId(null); }
    else if (level === 2) setFamId(null);
  };

  const parentReady = (level) => level === 0 || !!sel[level - 1];

  const save = async ({ name, icon }) => {
    const lv = LEVELS[form.level];
    setBusy(true);
    setFormError(null);
    try {
      if (form.item) {
        const fields = { name };
        if (form.level === 0 && icon) fields.icon_name = icon;
        await mutate(supabase.from(lv.table).update(fields).eq("id", form.item.id).select("id"));
      } else {
        const body = { name };
        if (lv.parentCol) body[lv.parentCol] = sel[form.level - 1];
        if (form.level === 0 && icon) body.icon_name = icon;
        if (form.level > 0 && tid) body.tenant_id = tid;
        await mutate(supabase.from(lv.table).insert(body).select("id"));
      }
      const level = form.level;
      setForm(null);
      data[level].reload();
    } catch (e) {
      setFormError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const askDelete = async (level, item) => {
    setNotice(null);
    setConfirm({ level, item, message: "Revisando lo que tiene adentro…", ready: false });
    const counts = await countBelow(level, item.id).catch(() => null);
    setConfirm({ level, item, message: counts ? deleteMessage(level, counts) : "No se pudo revisar lo que tiene adentro. Si borras, se pierde todo lo que cuelga de aquí.", ready: true });
  };

  const doDelete = async () => {
    const { level, item } = confirm;
    const lv = LEVELS[level];
    setConfirm(null);
    try {
      await mutate(supabase.from(lv.table).delete().eq("id", item.id).select("id"));
      if (level === 0 && item.id === catId) goTo(0);
      if (level === 1 && item.id === brandId) goTo(1);
      if (level === 2 && item.id === famId) goTo(2);
      data[level].reload();
    } catch (e) {
      setNotice(friendly(e));
    }
  };

  const columns = (visible) => visible.map((level) => (
    <Column
      key={level}
      level={level}
      wide={wide}
      touch={!wide}
      items={data[level].items}
      loading={data[level].loading}
      error={data[level].error}
      selectedId={sel[level]}
      parentReady={parentReady(level)}
      canAdd={parentReady(level)}
      onSelect={(item) => pick(level, item)}
      onAdd={() => { setFormError(null); setForm({ level, item: null }); }}
      onEdit={(item) => { setFormError(null); setForm({ level, item }); }}
      onDelete={(item) => askDelete(level, item)}
    />
  ));

  const crumbs = [
    { level: 0, label: "Catálogo", icon: Layers },
    ...(catId ? [{ level: 1, label: catName || "…", icon: null }] : []),
    ...(brandId ? [{ level: 2, label: brandName || "…", icon: null }] : []),
    ...(famId ? [{ level: 3, label: famName || "…", icon: null }] : []),
  ];

  return (
    <SubPage title="Catálogo de Dispositivos" onBack={back}>
      <div className="flex flex-col" style={{ gap: 12 }}>
        <ErrorLine message={notice} />
        {!wide && (
          <div className="flex items-center gap-1 overflow-x-auto" style={{ paddingBottom: 2 }}>
            {crumbs.map((c, i) => {
              const active = c.level === depth;
              return (
                <span key={c.level} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5" style={{ color: A.ter }} />}
                  <button onClick={() => goTo(c.level)} disabled={active} className="apple-press flex items-center gap-1.5" style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: active ? tint(A.brand, 0.16) : A.card, color: active ? A.brand : A.sub }}>
                    {c.icon && <c.icon className="w-3.5 h-3.5" />}{c.label}
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {wide ? (
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, alignItems: "start" }}>{columns([0, 1, 2, 3])}</div>
        ) : columns([depth])}
        {!wide && depth < 3 && (
          <p className="flex items-center gap-2" style={{ fontSize: 12, color: A.sub }}><Tag className="w-3.5 h-3.5" /> Toca una fila para entrar. Usa el lápiz para renombrar.</p>
        )}
      </div>

      <ItemDialog
        state={form}
        existing={form ? data[form.level].items : []}
        busy={busy}
        error={formError}
        onSave={save}
        onClose={() => setForm(null)}
      />

      <AlertDialog
        open={!!confirm}
        title={confirm ? `¿Eliminar "${confirm.item.name}"?` : ""}
        message={confirm?.message}
        onClose={() => setConfirm(null)}
        actions={confirm?.ready
          ? [{ label: "Cancelar" }, { label: "Eliminar", bold: true, destructive: true, onPress: doDelete }]
          : [{ label: "Cancelar" }]}
      />
    </SubPage>
  );
}

