import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowUpDown, Megaphone, UserPlus, Users, Crown, Phone, MessageSquare, Mail, ArrowUpRight, Wrench, ShoppingCart, Pencil, Trash2, Star, Check, AlertTriangle, Loader2, ScanSearch, ChevronDown, Building2, History, DollarSign, TrendingUp } from "lucide-react";
import { AlertDialog, Toggle, tint } from "@/components/pos/native/posUi";
import { ManagerPinDialog } from "@/components/pos/native/Receipt";
import { money } from "@/components/finanzas/ui";
import NewOrderWizard from "@/components/wizard/Wizard";
import { OrderCreatedToast } from "@/components/inicio/Cards";
import { HistoryDialog, CustomerEditDialog, CampaignDialog, OrderRow } from "@/components/clientes/Dialogs";
import { fetchTenant, resolveCurrentEmployee } from "@/lib/orderDetailApi";
import { isAdminOrOwner } from "@/lib/cashRegisterApi";
import {
  fetchCustomers, fetchLastOrderMap, subscribeCustomers, BUCKETS, inBucket, isVip, isRisk, isB2b, displayName, num, tierOf,
  setMembership, deleteCustomerRow, recentOrdersFor, phoneDigits, greeting,
} from "@/lib/customersApi";

const CARD = "#1C1C1E";
const SUB = "#8E8E93";
const BRAND = "#F2662E";
const AVATAR = ["#0A84FF", "#BF5AF2", "#30D158", "#FF9F0A", "#FF375F", "#40C8E0"];

const BUCKET_ICON = { all: Users, vip: Crown, b2b: Building2, new: UserPlus, risk: AlertTriangle, inactive: History };

const initialsOf = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
const colorFor = (name) => { let h = 0; for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length]; };

function useWide() {
  const q = "(min-width: 768px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const on = () => setV(m.matches); m.addEventListener("change", on); return () => m.removeEventListener("change", on); }, []);
  return v;
}

function Avatar({ customer, size = 44 }) {
  const c = colorFor(customer.name);
  return (
    <span className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <span style={{ width: size, height: size, borderRadius: 999, background: tint(c, 0.2), color: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700 }}>{initialsOf(customer.name)}</span>
      {isVip(customer) && (
        <span className="absolute flex items-center justify-center" style={{ top: -4, right: -4, width: size * 0.4, height: size * 0.4, borderRadius: 999, background: "#1C1C1E" }}>
          <Crown style={{ width: size * 0.26, height: size * 0.26, color: "#FFC733" }} />
        </span>
      )}
    </span>
  );
}

function MiniPill({ label, color }) {
  return <span style={{ padding: "1px 7px", borderRadius: 999, background: tint(color, 0.16), color, fontSize: 10, fontWeight: 800 }}>{label}</span>;
}

function CustomerDetail({ customer, tenantId, tenant, employee, onChanged, onDeleted, onNewOrder, onOpenOrder, wide }) {
  const navigate = useNavigate();
  const [isMember, setIsMember] = useState(customer.is_member === true);
  const [memberError, setMemberError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [orders, setOrders] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  useEffect(() => { setIsMember(customer.is_member === true); setMemberError(null); }, [customer.id, customer.is_member]);
  useEffect(() => {
    if (!wide) return;
    setOrders(null);
    recentOrdersFor(tenantId, customer, 5).then(setOrders, () => setOrders([]));
  }, [customer.id, wide, tenantId]);

  const name = displayName(customer);
  const vip = isVip(customer);
  const shop = String(tenant?.name || "").trim() || "Archilla OS";
  const msg = encodeURIComponent(greeting(customer, shop));
  const digits = phoneDigits(customer.phone);
  const spent = num(customer.total_spent);
  const count = num(customer.total_orders);
  const admin = isAdminOrOwner(employee);

  const applyMember = async (value) => {
    if (updating || !customer.id) return;
    const prev = isMember;
    setIsMember(value);
    setUpdating(true);
    setMemberError(null);
    try { await setMembership(customer.id, tenantId, value); onChanged?.(); } catch { setIsMember(prev); setMemberError("No se pudo actualizar la membresía. Intenta de nuevo."); }
    setUpdating(false);
  };
  const requestMember = (value) => { if (value && !admin) setPinOpen(true); else applyMember(value); };

  const doDelete = async () => {
    if (!customer.id) return;
    setDeleting(true);
    setDeleteError(null);
    try { await deleteCustomerRow(customer.id); onDeleted?.(); } catch (e) { setDeleteError(e?.message || String(e)); }
    setDeleting(false);
  };

  const card = (children, style) => <div style={{ background: CARD, borderRadius: 16, overflow: "hidden", ...style }}>{children}</div>;
  const head = (t) => <p style={{ fontSize: 12, fontWeight: 600, color: SUB, textTransform: "uppercase", padding: "0 4px 6px" }}>{t}</p>;
  const contactRow = (Icon, color, label, href, top) => (
    <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-3" style={{ padding: "11px 14px", borderTop: top ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
      <span style={{ width: 26, height: 26, borderRadius: 7, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
      <span className="flex-1 truncate" style={{ fontSize: 15 }}>{label}</span>
      <ArrowUpRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
    </a>
  );
  const contacts = [
    customer.phone && [Phone, "#4DC780", customer.phone, `tel:${digits}`],
    customer.phone && [MessageSquare, "#66B3FF", "Enviar SMS", `sms:${digits}?&body=${msg}`],
    customer.phone && [MessageSquare, "#1ABA66", "WhatsApp", `https://wa.me/${digits}?text=${msg}`],
    customer.email && [Mail, "#FFC733", customer.email, `mailto:${customer.email}`],
  ].filter(Boolean);
  const tile = (Icon, label, value, color) => <div className="flex-1 flex flex-col" style={{ gap: 2, padding: 12, borderRadius: 12, background: "#2C2C2E" }}><span className="flex items-center" style={{ gap: 4, fontSize: 10, fontWeight: 700, color: SUB }}><Icon style={{ width: 11, height: 11, color }} />{label}</span><span className="truncate" style={{ fontSize: 17, fontWeight: 800, color }}>{value}</span></div>;
  const tier = tierOf(customer);

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div className="flex flex-col items-center text-center" style={{ gap: 6 }}>
        <span style={{ width: 72, height: 72, borderRadius: 999, background: tint(vip ? "#FFC733" : "#66B3FF", 0.2), color: vip ? "#FFC733" : "#66B3FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>{initialsOf(customer.name)}</span>
        <p className="flex items-center gap-1.5" style={{ fontSize: 20, fontWeight: 800 }}>{name}{vip && <Crown className="w-4 h-4" style={{ color: "#FFC733" }} />}</p>
        {customer.customer_number && <p style={{ fontSize: 12, color: SUB }}>{customer.customer_number}</p>}
        {isB2b(customer) && <span style={{ padding: "3px 10px", borderRadius: 999, background: tint("#66B3FF", 0.15), color: "#66B3FF", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em" }}>CLIENTE EMPRESARIAL</span>}
      </div>
      {isRisk(customer) && (
        <div className="flex items-start gap-2" style={{ padding: 12, borderRadius: 12, background: tint("#FF7373", 0.12) }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#FF7373" }} />
          <span><span className="block" style={{ fontSize: 14, fontWeight: 700, color: "#FF7373" }}>Cliente en lista negra</span>{customer.risk_note && <span className="block" style={{ fontSize: 12, color: SUB }}>{customer.risk_note}</span>}</span>
        </div>
      )}
      <div className="flex" style={{ gap: 10 }}>
        {[[Wrench, BRAND, "Nueva orden", onNewOrder], [ShoppingCart, "#4DC780", "Vender en POS", () => navigate(`/POS?customer=${customer.id}`)]].map(([Icon, color, label, fn]) => (
          <button key={label} onClick={fn} className="apple-press flex-1 flex flex-col items-center" style={{ gap: 6, padding: "14px 8px", borderRadius: 14, background: tint(color, 0.14), color }}><Icon className="w-5 h-5" /><span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span></button>
        ))}
      </div>
      <div>
        {head("Membresía")}
        {card(<div className="flex items-center gap-3" style={{ padding: "12px 14px" }}>
          <span className="flex-1"><span className="block" style={{ fontSize: 16 }}>Membresía activa</span><span className="block" style={{ fontSize: 12, color: SUB }}>Recibe 5% de descuento automático en el POS.</span></span>
          <Toggle on={isMember} onChange={requestMember} disabled={!customer.id || updating} label="Membresía activa" compact />
        </div>)}
        {memberError && <p style={{ fontSize: 12, color: "#FF453A", padding: "6px 4px 0" }}>{memberError}</p>}
      </div>
      {contacts.length > 0 && <div>{head("Contactar")}{card(contacts.map(([I, c, l, h], i) => contactRow(I, c, l, h, i > 0)))}</div>}
      <div>
        {head("Resumen financiero")}
        {card(<div style={{ padding: 12 }}>
          <div className="flex" style={{ gap: 8 }}>{tile(DollarSign, "GASTADO", spent > 0 ? money(spent) : "—", "#4DC780")}{tile(Wrench, "ÓRDENES", count > 0 ? String(count) : "—", BRAND)}{tile(TrendingUp, "PROMEDIO", spent > 0 && count > 0 ? money(spent / count) : "—", "#66B3FF")}</div>
          <div className="flex items-center" style={{ padding: "12px 2px 0" }}><Star className="w-4 h-4" style={{ color: "#FFA640", marginRight: 8 }} /><span className="flex-1" style={{ fontSize: 15 }}>Puntos</span><span style={{ fontSize: 15, fontWeight: 700 }}>{num(customer.loyalty_points)}</span></div>
          {tier.toLowerCase() !== "regular" && <div className="flex items-center" style={{ padding: "10px 2px 0" }}><span className="flex-1" style={{ fontSize: 15 }}>Nivel</span><span style={{ fontSize: 15, fontWeight: 700, color: "#FFC733" }}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span></div>}
          {!wide && <button onClick={() => setHistoryOpen(true)} className="w-full flex items-center" style={{ padding: "12px 2px 0", color: BRAND, fontSize: 14, fontWeight: 600 }}>Ver historial completo</button>}
        </div>)}
      </div>
      {wide && (
        <div>
          {head("Últimas órdenes")}
          {card(orders === null ? <p className="flex justify-center" style={{ padding: 20 }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: SUB }} /></p> : orders.length === 0 ? <p style={{ padding: 16, fontSize: 14, color: SUB }}>Este cliente no tiene órdenes registradas.</p> : orders.map((o, i) => <div key={o.id} style={{ borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}><OrderRow order={o} onClick={() => onOpenOrder(o.id)} /></div>))}
        </div>
      )}
      {customer.notes && <div>{head("Notas")}{card(<p style={{ padding: 14, fontSize: 14, whiteSpace: "pre-wrap" }}>{customer.notes}</p>)}</div>}
      <div className="flex flex-col" style={{ gap: 8 }}>
        <button onClick={() => setEditOpen(true)} className="apple-press flex items-center justify-center gap-2" style={{ padding: "13px 0", borderRadius: 14, background: CARD, fontSize: 15, fontWeight: 600, color: BRAND }}><Pencil className="w-4 h-4" /> Editar cliente</button>
        <button onClick={() => setConfirmDelete(true)} disabled={deleting} className="apple-press flex items-center justify-center gap-2" style={{ padding: "13px 0", borderRadius: 14, background: CARD, fontSize: 15, fontWeight: 600, color: "#FF453A" }}><Trash2 className="w-4 h-4" /> {deleting ? "Borrando…" : "Borrar cliente"}</button>
        <p style={{ fontSize: 12, color: SUB, textAlign: "center" }}>Borrar el cliente NO borra sus órdenes pasadas — solo lo quita del directorio.</p>
        {deleteError && <p style={{ fontSize: 12, color: "#FF453A", textAlign: "center" }}>No se pudo borrar: {deleteError}</p>}
      </div>
      <CustomerEditDialog open={editOpen} onClose={() => setEditOpen(false)} tenantId={tenantId} customer={customer} onSaved={() => onChanged?.()} />
      <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} tenantId={tenantId} customer={customer} onOpenOrder={onOpenOrder} />
      <ManagerPinDialog open={pinOpen} reason="Autorizar membresía de cliente" tenantId={tenantId} onClose={() => setPinOpen(false)} onAuthorized={() => { setPinOpen(false); applyMember(true); }} />
      <AlertDialog open={confirmDelete} title={`¿Borrar a ${name}?`} message="Esta acción no se puede deshacer. El historial de órdenes no se borra." onClose={() => setConfirmDelete(false)}
        actions={[{ label: "Borrar permanentemente", destructive: true, onPress: doDelete }, { label: "Cancelar", bold: true }]} />
    </div>
  );
}

const EMPTY = {
  all: ["Sin clientes", "Aún no hay clientes registrados. Toca + para agregar el primero."],
  vip: ["Sin clientes VIP", "Cuando un cliente alcance tier VIP o gaste +$500 aparecerá aquí."],
  b2b: ["Sin clientes B2B", "Marca un cliente como empresarial al crearlo."],
  new: ["Sin clientes nuevos este mes", null],
  risk: ["Sin clientes en riesgo", "Los clientes marcados como riesgosos (lista negra) aparecen aquí."],
  inactive: ["Todos tus clientes han vuelto", "Clientes con al menos una orden que no visitan hace 90+ días."],
};

export default function Clientes() {
  const navigate = useNavigate();
  const wide = useWide();
  let tenantId = "";
  try { tenantId = localStorage.getItem("smartfix_tenant_id") || ""; } catch { tenantId = ""; }
  const [tenant, setTenant] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [lastMap, setLastMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [bucket, setBucket] = useState("all");
  const [byValue, setByValue] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [campaign, setCampaign] = useState(false);
  const [wizard, setWizard] = useState(null);
  const [created, setCreated] = useState(null);
  const loadedOnce = useRef(false);

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 250); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    if (!tenantId) return;
    fetchTenant(tenantId).then(setTenant).catch(() => {});
    resolveCurrentEmployee(tenantId).then(setEmployee).catch(() => {});
  }, [tenantId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const rows = await fetchCustomers(tenantId);
      setCustomers(rows);
      setError(null);
      loadedOnce.current = true;
      fetchLastOrderMap(tenantId).then(setLastMap).catch(() => {});
    } catch (e) {
      if (!loadedOnce.current) setError(e?.message || String(e));
    }
    setLoading(false);
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => (tenantId ? subscribeCustomers(tenantId, load) : undefined), [tenantId, load]);

  const counts = useMemo(() => Object.fromEntries(BUCKETS.map(([k]) => [k, customers.filter((c) => inBucket(c, k, lastMap)).length])), [customers, lastMap]);
  const filtered = useMemo(() => {
    let rows = customers.filter((c) => inBucket(c, bucket, lastMap));
    if (debounced) rows = rows.filter((c) => [c.name, c.phone, c.email, c.company_name].some((v) => String(v || "").toLowerCase().includes(debounced)));
    if (byValue) rows = [...rows].sort((a, b) => num(b.total_spent) - num(a.total_spent));
    return rows;
  }, [customers, bucket, debounced, byValue, lastMap]);

  useEffect(() => {
    if (!wide) return;
    if (!filtered.some((c) => c.id === selectedId)) setSelectedId(filtered[0]?.id || null);
  }, [filtered, wide]);

  const selected = wide ? filtered.find((c) => c.id === selectedId) : customers.find((c) => c.id === detailId);
  const activeBucket = BUCKETS.find(([k]) => k === bucket);
  const isB2BMode = bucket === "b2b";
  const monthName = new Intl.DateTimeFormat("es-PR", { month: "long" }).format(new Date());
  const empty = (() => {
    if (debounced) return ["Sin coincidencias", `Ningún cliente coincide con “${search.trim()}”`];
    const e = EMPTY[bucket];
    return [e[0], e[1] || `Los clientes registrados en ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} aparecen aquí.`];
  })();

  const stat = (Icon, label, value, color) => <div className="flex-1 flex flex-col" style={{ gap: 2, padding: 12, borderRadius: 12, background: CARD }}><span className="flex items-center" style={{ gap: 4, fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: "0.04em" }}><Icon style={{ width: 11, height: 11, color }} />{label}</span><span style={{ fontSize: 26, fontWeight: 800, color }}>{value}</span></div>;
  const afterCreate = (order) => { setCreated(order); setTimeout(() => setCreated((c) => (c && c.id === order?.id ? null : c)), 4000); };

  const searchBox = (
    <label className="flex items-center gap-2" style={{ height: 44, padding: "0 14px", borderRadius: 999, background: "rgba(255,255,255,0.06)", width: wide ? 300 : undefined }}>
      <Search className="w-4 h-4" style={{ color: SUB }} />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." aria-label="Buscar cliente" className="flex-1 min-w-0 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15 }} />
      {search && <button onClick={() => setSearch("")} aria-label="Limpiar" style={{ color: SUB }}><X className="w-4 h-4" /></button>}
    </label>
  );

  const BucketIcon = BUCKET_ICON[bucket] || Users;
  const filterHeader = !debounced && (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <div className="flex" style={{ gap: 8 }}>{stat(Users, "TOTAL", customers.length, "#66B3FF")}{stat(Crown, "VIP", counts.vip || 0, "#FFC733")}{stat(UserPlus, "NUEVOS MES", counts.new || 0, "#4DC780")}</div>
      <div className="grid grid-cols-2" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
        {[["Clientes", !isB2BMode, "all"], ["Empresas", isB2BMode, "b2b"]].map(([l, on, k]) => <button key={l} onClick={() => setBucket(k)} style={{ padding: "7px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: on ? BRAND : "transparent", color: "#fff" }}>{l}</button>)}
      </div>
      <div className="relative">
        <button onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen} className="apple-press inline-flex items-center gap-2" style={{ padding: "7px 14px", borderRadius: 999, background: tint(activeBucket[2], 0.14), color: activeBucket[2], fontSize: 14, fontWeight: 700 }}>
          <BucketIcon className="w-4 h-4" />{activeBucket[1]}<ChevronDown className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={() => setMenuOpen(false)} />
            <div role="menu" className="absolute" style={{ top: 40, left: 0, zIndex: 61, width: 230, borderRadius: 14, background: "#3A3A3C", overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
              {BUCKETS.map(([k, l, c]) => {
                const I = BUCKET_ICON[k] || Users;
                return <button key={k} role="menuitem" onClick={() => { setBucket(k); setMenuOpen(false); }} className="w-full flex items-center gap-2 text-left" style={{ padding: "11px 14px", fontSize: 15, color: c }}><I className="w-4 h-4" />{l} ({counts[k] || 0}){bucket === k && <Check className="w-4 h-4 ml-auto" />}</button>;
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const list = (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {!wide && searchBox}
      {!wide && filterHeader}
      {loading ? <SkeletonRows count={8} height={64} /> : filtered.length === 0 ? (
        <div className="flex flex-col items-center text-center" style={{ padding: "40px 12px", gap: 6 }}><Users className="w-9 h-9" style={{ color: "rgba(235,235,245,0.3)" }} /><p style={{ fontSize: 16, fontWeight: 600 }}>{empty[0]}</p><p style={{ fontSize: 13, color: SUB }}>{empty[1]}</p></div>
      ) : (
        <div style={{ borderRadius: 16, background: CARD, overflow: "hidden" }}>
          {filtered.map((c, i) => {
            const sel = wide && c.id === selectedId;
            return (
              <div key={c.id} className="group flex items-center" style={{ borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none", background: sel ? tint(BRAND, 0.12) : "transparent" }}>
                <button onClick={() => (wide ? setSelectedId(c.id) : setDetailId(c.id))} className="flex-1 min-w-0 flex items-center gap-3 text-left" style={{ padding: "10px 14px" }}>
                  <Avatar customer={c} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 flex-wrap"><span className="truncate" style={{ fontSize: 16, fontWeight: 600 }}>{displayName(c)}</span>{isB2b(c) && <MiniPill label="B2B" color="#66B3FF" />}{isVip(c) && <MiniPill label="VIP" color="#FFC733" />}{isRisk(c) && <MiniPill label="RIESGO" color="#FF7373" />}</span>
                    <span className="block truncate" style={{ fontSize: 13, color: SUB }}>{c.phone || c.email || ""}</span>
                  </span>
                  {num(c.total_orders) > 0 && <span className="flex flex-col items-end"><span style={{ fontSize: 17, fontWeight: 800 }}>{num(c.total_orders)}</span><span style={{ fontSize: 10, color: SUB }}>órdenes</span></span>}
                </button>
                {c.phone && <a href={`tel:${phoneDigits(c.phone)}`} aria-label={`Llamar a ${displayName(c)}`} className="opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ padding: 12, color: "#4DC780" }}><Phone className="w-4 h-4" /></a>}
              </div>
            );
          })}
        </div>
      )}
      {error && <p style={{ fontSize: 13, color: "#FF453A" }}>{error}</p>}
    </div>
  );

  const detail = selected ? (
    <CustomerDetail key={selected.id} customer={selected} tenantId={tenantId} tenant={tenant} employee={employee} wide={wide} onChanged={load}
      onDeleted={() => { setDetailId(null); setSelectedId(null); load(); }}
      onNewOrder={() => setWizard({ customer: selected })} onOpenOrder={(id) => navigate(`/Orders/${id}`)} />
  ) : (
    <div className="flex flex-col items-center text-center" style={{ padding: "80px 16px", gap: 6 }}><Users className="w-10 h-10" style={{ color: "rgba(235,235,245,0.3)" }} /><p style={{ fontSize: 17, fontWeight: 600 }}>Selecciona un cliente</p><p style={{ fontSize: 13, color: SUB }}>Toca un cliente de la lista para ver su ficha.</p></div>
  );

  const iconBtn = { width: 38, height: 38, borderRadius: 999, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const titleRow = (
    <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
      <h1 className="flex-1" style={{ fontSize: 34, fontWeight: 800 }}>Clientes</h1>
      {wide && searchBox}
      <div className="relative">
        <button onClick={() => setSortOpen((v) => !v)} aria-label="Ordenar" aria-haspopup="menu" className="apple-press" style={iconBtn}><ArrowUpDown className="w-4 h-4" /></button>
        {sortOpen && (
          <>
            <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={() => setSortOpen(false)} />
            <div role="menu" className="absolute" style={{ top: 44, right: 0, zIndex: 61, width: 240, borderRadius: 14, background: "#3A3A3C", overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
              {[[false, "Nombre"], [true, "Gasto total (Top clientes)"]].map(([v, l]) => <button key={l} role="menuitem" onClick={() => { setByValue(v); setSortOpen(false); }} className="w-full flex items-center text-left" style={{ padding: "11px 14px", fontSize: 15 }}>{l}{byValue === v && <Check className="w-4 h-4 ml-auto" />}</button>)}
            </div>
          </>
        )}
      </div>
      <button onClick={() => navigate("/Orders", { state: { focusSearch: true } })} aria-label="Buscar orden" className="apple-press" style={iconBtn}><ScanSearch className="w-4 h-4" /></button>
      <button onClick={() => setCampaign(true)} aria-label="Campaña de email" className="apple-press" style={iconBtn}><Megaphone className="w-4 h-4" /></button>
      <button onClick={() => setNewOpen(true)} aria-label="Nuevo cliente" className="apple-press" style={{ ...iconBtn, background: BRAND, color: "#fff" }}><UserPlus className="w-4 h-4" /></button>
    </div>
  );

  const overlays = (
    <>
      <CustomerEditDialog open={newOpen} onClose={() => setNewOpen(false)} tenantId={tenantId} customer={null} onSaved={(row) => { load(); if (row?.id) { if (wide) setSelectedId(row.id); } }} />
      <CampaignDialog open={campaign} onClose={() => setCampaign(false)} tenantId={tenantId} tenant={tenant} customers={customers} />
      {wizard && <NewOrderWizard open prefill={wizard} tenant={tenant} employee={employee} onClose={() => setWizard(null)} onCreated={(o) => { afterCreate(o); load(); }} />}
      <OrderCreatedToast order={created} onView={() => { const id = created?.id; setCreated(null); if (id) navigate(`/Orders/${id}`); }} />
    </>
  );

  if (wide) {
    return (
      <div className="apple-type flex flex-col" style={{ background: "#000", color: "#fff", height: "calc(100dvh / var(--ui-zoom, 1) - var(--app-nav-h, 0px))" }}>
        <div className="mx-auto w-full" style={{ maxWidth: 1400, padding: "24px 16px 0" }}>
          {titleRow}
          {filterHeader && <div style={{ paddingBottom: 14, borderBottom: "0.5px solid rgba(84,84,88,0.6)" }}>{filterHeader}</div>}
        </div>
        <div className="mx-auto w-full grid" style={{ maxWidth: 1400, flex: 1, minHeight: 0, padding: "16px 16px 0", gridTemplateColumns: "380px 1fr", gap: 24 }}>
          <div style={{ overflowY: "auto", minHeight: 0, paddingBottom: 24 }}>{list}</div>
          <div style={{ overflowY: "auto", minHeight: 0, paddingBottom: 24 }}>{detail}</div>
        </div>
        {overlays}
      </div>
    );
  }

  return (
    <div className="apple-type min-h-dvh" style={{ background: "#000", color: "#fff", paddingBottom: 100 }}>
      <div className="mx-auto" style={{ maxWidth: 1400, padding: "24px 16px 0" }}>
        {titleRow}
        {detailId && selected ? (
          <div>
            <button onClick={() => setDetailId(null)} style={{ color: BRAND, fontWeight: 600, marginBottom: 10 }}>‹ Clientes</button>
            {detail}
          </div>
        ) : list}
      </div>
      {overlays}
    </div>
  );
}
