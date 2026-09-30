import { useEffect, useRef, useState } from "react";
import { Search, X, Crown, Clock, UserRound, UserPlus, UserRoundX, Phone, Mail, Loader2, Check, Plus, ShieldAlert, ShieldHalf } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { searchCustomers, recentCustomers, findDuplicateByPhone, insertCustomer, InvalidEmailError } from "@/lib/wizard/api";
import { IOS, MODES, isVIP, customerDisplayName } from "@/lib/wizard/helpers";
import { Avatar, Banner, Caption, Card, Chip, Input, TextArea, W } from "./ui";

const GREEN_GRAD = "linear-gradient(135deg, #1ABF8C, #2EEB66)";

function CustomerRow({ c, selected, onPick }) {
  return (
    <button onClick={() => onPick(c)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "10px 14px" }}>
      <Avatar name={customerDisplayName(c)} color={isVIP(c) ? IOS.yellow : IOS.blue} />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{customerDisplayName(c)}</span>
          {isVIP(c) && <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: IOS.yellow }} />}
          {c.is_b2b && <span style={{ padding: "1px 7px", borderRadius: 999, background: tint(IOS.purple, 0.2), color: IOS.purple, fontSize: 10, fontWeight: 700 }}>Empresa</span>}
        </span>
        <span className="flex flex-wrap items-center" style={{ gap: "2px 10px", fontSize: 12, color: W.sub }}>
          {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
          {c.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {c.email}</span>}
          {Number(c.total_orders) > 0 && <span>{c.total_orders} orden{Number(c.total_orders) === 1 ? "" : "es"} previa{Number(c.total_orders) === 1 ? "" : "s"}</span>}
        </span>
      </span>
      {selected && <Check className="w-5 h-5" style={{ color: IOS.green }} />}
    </button>
  );
}

function RiskBanner({ c }) {
  if (c.risk_flag) {
    return (
      <div className="flex flex-col" style={{ gap: 2, padding: "10px 12px", borderRadius: 12, background: tint(IOS.red, 0.14), color: IOS.red }}>
        <span className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700 }}><ShieldAlert className="w-4 h-4" /> Cliente marcado como riesgoso</span>
        {c.risk_note && <span style={{ fontSize: 13 }}>{c.risk_note}</span>}
        <span style={{ fontSize: 12 }}>Recomendado: exige prepago / depósito antes de empezar.</span>
      </div>
    );
  }
  const label = String(c.computed_risk_label || "");
  if (label && label !== "Bajo") {
    const color = label === "Alto" ? IOS.red : IOS.orange;
    return (
      <div className="flex flex-col" style={{ gap: 2, padding: "10px 12px", borderRadius: 12, background: tint(color, 0.14), color }}>
        <span className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700 }}><ShieldHalf className="w-4 h-4" /> Riesgo {label.toLowerCase()} según historial ({Number(c.computed_risk_score) || 0}/100)</span>
        {c.computed_risk_reason && <span style={{ fontSize: 13 }}>{c.computed_risk_reason}</span>}
      </div>
    );
  }
  return null;
}

export default function StepCustomer({ w, tenantId, onOpenWarranty, onSwitchMode, onAdvanceNew, dupAlert, setDupAlert, checkFailed, setCheckFailed, newError, setNewError, busy }) {
  const { s, set } = w;
  const [results, setResults] = useState([]);
  const [recents, setRecents] = useState(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => { recentCustomers(tenantId).then(setRecents).catch(() => setRecents([])); }, [tenantId]);
  useEffect(() => {
    const q = s.customerSearch.trim();
    if (!q) { setResults([]); setFailed(false); setSearching(false); return undefined; }
    const id = ++reqRef.current;
    setSearching(true);
    const t = setTimeout(() => {
      searchCustomers(tenantId, q).then((r) => { if (id === reqRef.current) { setResults(r); setFailed(false); setSearching(false); } }, () => { if (id === reqRef.current) { setFailed(true); setSearching(false); } });
    }, 300);
    return () => clearTimeout(t);
  }, [s.customerSearch, tenantId]);

  const pick = (c) => set({ customer: c, anonymous: false });
  const seedNew = () => {
    const q = s.customerSearch.trim();
    const onlyPhone = /^[\d\s\-()]+$/.test(q);
    const nc = { ...s.nc };
    if (onlyPhone) { if (!nc.phone) nc.phone = q; } else {
      const [first, ...rest] = q.split(/\s+/);
      if (!nc.name) nc.name = first || "";
      if (!nc.lastName) nc.lastName = rest.join(" ");
    }
    set({ nc, customerTab: 1 });
  };
  const setNC = (patch) => set((p) => ({ nc: { ...p.nc, ...patch } }));

  const modeChip = (k) => <Chip key={k} label={MODES[k].label} active={s.mode === k} color={MODES[k].color} onClick={() => onSwitchMode(k)} />;
  const tab = (i, label, Icon) => (
    <button key={i} onClick={() => set({ customerTab: i })} className="apple-press flex-1 flex items-center justify-center gap-2" style={{ padding: "10px 0", borderRadius: 999, fontSize: 15, fontWeight: 700, background: s.customerTab === i ? GREEN_GRAD : "#2C2C2E", color: "#fff" }}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
  const q = s.customerSearch.trim();

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div className="flex" style={{ gap: 10 }}>{tab(0, "Existente", UserRound)}{tab(1, "Nuevo", UserPlus)}</div>
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        {["regular", "quick", "recharge", "unlock"].map(modeChip)}
        <span className="flex-1" />
        <button onClick={onOpenWarranty} className="apple-press" style={{ fontSize: 14, fontWeight: 600, color: IOS.green }}>Garantías</button>
      </div>
      {s.customerTab === 0 ? (
        <>
          <label className="flex items-center gap-2" style={{ height: 46, padding: "0 14px", borderRadius: 12, background: W.card }}>
            <Search className="w-4 h-4" style={{ color: W.sub }} />
            <input autoFocus={!s.customer} value={s.customerSearch} onChange={(e) => set({ customerSearch: e.target.value })} placeholder="Nombre, teléfono o email..." aria-label="Buscar cliente" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 16, minWidth: 0 }} />
            {s.customerSearch && <button onClick={() => set({ customerSearch: "" })} aria-label="Limpiar" style={{ color: W.sub }}><X className="w-4 h-4" /></button>}
          </label>
          {s.customer && (
            <div className="flex flex-col" style={{ gap: 10 }}>
              <div className="flex items-start gap-3" style={{ padding: 14, borderRadius: 14, background: tint(IOS.green, 0.08), border: `1px solid ${tint(IOS.green, 0.3)}` }}>
                <Avatar name={customerDisplayName(s.customer)} color={IOS.green} size={44} />
                <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 2 }}>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate" style={{ fontSize: 16, fontWeight: 700 }}>{customerDisplayName(s.customer)}</span>
                    {isVIP(s.customer) && <Crown className="w-4 h-4" style={{ color: IOS.yellow }} />}
                    {s.customer.is_b2b && <span style={{ padding: "1px 7px", borderRadius: 999, background: tint(IOS.purple, 0.2), color: IOS.purple, fontSize: 10, fontWeight: 700 }}>Empresa</span>}
                  </span>
                  <span style={{ fontSize: 11, color: IOS.green, fontWeight: 600 }}>Cliente seleccionado</span>
                  {s.customer.phone && <span className="flex items-center gap-1" style={{ fontSize: 13, color: W.sub }}><Phone className="w-3 h-3" /> {s.customer.phone}</span>}
                  {s.customer.email && <span className="flex items-center gap-1 truncate" style={{ fontSize: 13, color: W.sub }}><Mail className="w-3 h-3" /> {s.customer.email}</span>}
                  {Number(s.customer.total_orders) > 0 && <span style={{ fontSize: 12, color: W.sub }}>{s.customer.total_orders} orden{Number(s.customer.total_orders) === 1 ? "" : "es"} previa{Number(s.customer.total_orders) === 1 ? "" : "s"}</span>}
                </span>
                <button onClick={() => set({ customer: null })} aria-label="Quitar cliente" style={{ color: W.sub }}><X className="w-5 h-5" /></button>
              </div>
              <RiskBanner c={s.customer} />
            </div>
          )}
          {!q ? (
            recents === null ? <div className="flex justify-center" style={{ padding: 24 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div> : recents.length === 0 ? (
              <div className="flex flex-col items-center text-center" style={{ padding: "28px 0", gap: 6 }}>
                <Search className="w-8 h-8" style={{ color: W.ter }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: W.sub }}>Busca un cliente</p>
                <p style={{ fontSize: 13, color: W.ter }}>Escribe el nombre, teléfono o email</p>
              </div>
            ) : (
              <div>
                <Caption style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px 8px" }}><Clock className="w-3.5 h-3.5" /> Recientes</Caption>
                <div style={{ borderRadius: 16, background: W.card, overflow: "hidden" }}>
                  {recents.map((c, i) => <div key={c.id} style={{ borderTop: i ? `0.5px solid ${W.sep}` : "none" }}><CustomerRow c={c} selected={s.customer?.id === c.id} onPick={pick} /></div>)}
                </div>
              </div>
            )
          ) : searching && !results.length ? <div className="flex justify-center" style={{ padding: 24 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div> : failed ? (
            <div className="flex flex-col items-center text-center" style={{ padding: "24px 0", gap: 6 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: W.sub }}>No se pudo buscar</p>
              <p style={{ fontSize: 13, color: W.ter }}>Revisa tu conexión</p>
              <button onClick={() => set({ customerSearch: `${s.customerSearch} ` })} style={{ color: IOS.orange, fontWeight: 600 }}>Reintentar</button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center text-center" style={{ padding: "24px 0", gap: 6 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: W.sub }}>Sin resultados</p>
              <p style={{ fontSize: 13, color: W.ter }}>No hay ningún cliente con ese dato</p>
              <button onClick={seedNew} className="apple-press" style={{ marginTop: 6, padding: "10px 18px", borderRadius: 12, background: IOS.orange, color: "#fff", fontWeight: 700 }}>Crear “{q}”</button>
            </div>
          ) : (
            <div style={{ borderRadius: 16, background: W.card, overflow: "hidden" }}>
              {results.map((c, i) => <div key={c.id} style={{ borderTop: i ? `0.5px solid ${W.sep}` : "none" }}><CustomerRow c={c} selected={s.customer?.id === c.id} onPick={pick} /></div>)}
            </div>
          )}
          <button onClick={() => set({ anonymous: !s.anonymous, customer: s.anonymous ? s.customer : null })} className="apple-press flex items-center gap-3 text-left" style={{ padding: 14, borderRadius: 14, background: s.anonymous ? tint(IOS.green, 0.1) : W.card, border: `1px solid ${s.anonymous ? tint(IOS.green, 0.4) : "transparent"}` }}>
            <UserRoundX className="w-6 h-6" style={{ color: s.anonymous ? IOS.green : W.sub }} />
            <span className="flex-1">
              <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Continuar sin cliente</span>
              <span className="block" style={{ fontSize: 12, color: W.sub }}>La orden se registra como anónima</span>
            </span>
            {s.anonymous && <Check className="w-5 h-5" style={{ color: IOS.green }} />}
          </button>
        </>
      ) : (
        <div className="flex flex-col" style={{ gap: 14 }}>
          <div className="grid grid-cols-2" style={{ gap: 10 }}>
            {[[false, "Individual"], [true, "Empresa"]].map(([v, l]) => (
              <button key={l} onClick={() => setNC({ isB2b: v })} className="apple-press" style={{ padding: "12px 0", borderRadius: 14, fontSize: 15, fontWeight: 700, background: s.nc.isB2b === v ? GREEN_GRAD : W.card2, color: "#fff" }}>{l}</button>
            ))}
          </div>
          {s.nc.isB2b && (
            <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <Input label="Nombre de la empresa *" value={s.nc.companyName} onChange={(v) => setNC({ companyName: v })} placeholder="Tech Solutions PR" />
              <Input label="RUC / Tax ID" value={s.nc.taxId} onChange={(v) => setNC({ taxId: v })} placeholder="00-0000000" />
              <Input label="Email facturación" value={s.nc.billingEmail} onChange={(v) => setNC({ billingEmail: v })} placeholder="billing@empresa.com" type="email" />
            </div>
          )}
          <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <Input label="Nombre *" value={s.nc.name} onChange={(v) => setNC({ name: v })} placeholder="Juan" />
            <Input label="Apellidos" value={s.nc.lastName} onChange={(v) => setNC({ lastName: v })} placeholder="Pérez" />
            <Input label="Teléfono" value={s.nc.phone} onChange={(v) => setNC({ phone: v })} placeholder="787-555-0123" inputMode="tel" />
            <Input label="Email" value={s.nc.email} onChange={(v) => setNC({ email: v })} placeholder="cliente@email.com" type="email" />
          </div>
          <p style={{ fontSize: 12, color: W.sub }}>Se requiere al menos teléfono o email.</p>
          <div>
            <Caption style={{ paddingBottom: 6 }}>Idioma de sus correos</Caption>
            <div className="grid grid-cols-2" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)", maxWidth: 260 }}>
              {[["es", "Español"], ["en", "English"]].map(([k, l]) => <button key={k} onClick={() => setNC({ language: k })} style={{ padding: "6px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, background: s.nc.language === k ? "#636366" : "transparent" }}>{l}</button>)}
            </div>
          </div>
          {s.nc.hasSecondary ? (
            <Card style={{ padding: 14 }}>
              <div className="flex items-center" style={{ marginBottom: 8 }}>
                <Caption className="flex-1" style={{ flex: 1 }}>Contacto adicional</Caption>
                <button onClick={() => setNC({ hasSecondary: false, secondaryPhone: "", secondaryEmail: "" })} aria-label="Quitar contacto adicional" style={{ color: W.sub }}><X className="w-4 h-4" /></button>
              </div>
              <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <Input label="Teléfono" value={s.nc.secondaryPhone} onChange={(v) => setNC({ secondaryPhone: v })} placeholder="787-555-9999" inputMode="tel" />
                <Input label="Email" value={s.nc.secondaryEmail} onChange={(v) => setNC({ secondaryEmail: v })} placeholder="alterno@email.com" type="email" />
              </div>
            </Card>
          ) : <button onClick={() => setNC({ hasSecondary: true })} className="flex items-center gap-1.5 self-start" style={{ fontSize: 14, fontWeight: 600, color: IOS.orange }}><Plus className="w-4 h-4" /> Añadir contacto adicional</button>}
          <TextArea label="Notas" value={s.nc.notes} onChange={(v) => setNC({ notes: v })} placeholder="Información adicional..." rows={3} />
          {newError && <Banner color={IOS.red} onDismiss={() => setNewError(null)}>{newError}</Banner>}
          {busy && <p className="flex items-center gap-2" style={{ fontSize: 13, color: W.sub }}><Loader2 className="w-4 h-4 animate-spin" /> Verificando cliente…</p>}
        </div>
      )}
      <AlertDialog open={!!dupAlert} title="Cliente duplicado" message={dupAlert ? `Ya existe un cliente con ese teléfono: ${dupAlert.name}. ¿Qué deseas hacer?` : ""} onClose={() => setDupAlert(null)}
        actions={[
          { label: "Usar cliente existente", bold: true, onPress: () => { const d = dupAlert; set({ customer: d, anonymous: false }); onAdvanceNew("useExisting"); } },
          { label: "Crear de todas formas", onPress: () => onAdvanceNew("createAnyway") },
          { label: "Cancelar" },
        ]} />
      <AlertDialog open={checkFailed} title="No se pudo verificar" message="No se pudo comprobar si este cliente ya existe. Revisa tu conexión." onClose={() => setCheckFailed(false)}
        actions={[{ label: "Reintentar", bold: true, onPress: () => onAdvanceNew("retry") }, { label: "Crear igual", onPress: () => onAdvanceNew("createAnyway") }, { label: "Cancelar" }]} />
    </div>
  );
}

export async function runNewCustomerAdvance({ mode, tenantId, s, set, jumpForward, setBusy, setDup, setCheckFailed, setNewError }) {
  const create = async () => {
    setBusy(true);
    try {
      const c = await insertCustomer(tenantId, s.nc);
      set({ customer: c, anonymous: false });
      jumpForward();
    } catch (e) {
      setNewError(e instanceof InvalidEmailError ? e.message : e?.message || String(e));
    }
    setBusy(false);
  };
  if (mode === "useExisting") { jumpForward(); return; }
  if (mode === "createAnyway") { await create(); return; }
  setBusy(true);
  try {
    const dup = await findDuplicateByPhone(tenantId, s.nc.phone);
    setBusy(false);
    if (dup) setDup(dup);
    else await create();
  } catch {
    setBusy(false);
    setCheckFailed(true);
  }
}
