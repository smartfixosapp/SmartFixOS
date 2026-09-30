import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Moon, Sun, Globe, Camera, Phone, Clock, Link2, DollarSign, Trash2, Loader2, Store } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { supabase } from "../../../../../lib/supabase-client.js";
import { A, SubPage, Group, Row, Field, PrimaryBtn, ErrorLine, Chips } from "./ui";
import { updateTenant, fetchTenantRow, settingsOf, businessHoursOf, DAYS, taxPercentOf, localGet, localSet } from "@/lib/tenantSettings";
import { safeTZ, fmt } from "@/lib/finance/tz";
import { imageToJpegBlob } from "@/lib/comprasApi";

const SOCIAL = [["facebook", "Facebook", "https://facebook.com/tutienda"], ["instagram", "Instagram", "https://instagram.com/tutienda"], ["google_reviews", "Google Reviews", "https://g.page/r/..."], ["yelp", "Yelp", "https://yelp.com/biz/..."], ["website", "Sitio Web", "tutienda.com"]];
const CURRENCIES = [["USD", "USD — Dólar americano"], ["DOP", "DOP — Peso dominicano"], ["MXN", "MXN — Peso mexicano"], ["EUR", "EUR — Euro"]];
const COUNTRIES = [["PR", "Puerto Rico"], ["DO", "República Dominicana"], ["MX", "México"], ["US", "Estados Unidos"]];
const ZONES = [["America/Puerto_Rico", "Puerto Rico (AST, UTC-4)"], ["America/Santo_Domingo", "República Dominicana (AST, UTC-4)"], ["America/Mexico_City", "Ciudad de México (CST, UTC-6)"], ["America/New_York", "Este (EST/EDT, UTC-5)"], ["America/Chicago", "Centro (CST/CDT, UTC-6)"], ["America/Denver", "Montaña (MST/MDT, UTC-7)"], ["America/Los_Angeles", "Pacífico (PST/PDT, UTC-8)"]];

const uuid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`).toUpperCase();

export function MiNegocioList({ tenant, go }) {
  const mode = localGet("appearance.preferredMode", "dark");
  return (
    <SubPage title="Mi Negocio" onBack={() => go(null)}>
      <Group header="General" pad={false}>
        <Row first Icon={Building2} color={A.warning} title="Info del Negocio" sub={tenant?.name || "Sin configurar"} onClick={() => go("mi-negocio", "info")} />
        <Row Icon={mode === "light" ? Sun : Moon} color={A.brand} title="Apariencia" sub={mode === "light" ? "Claro" : "Oscuro"} onClick={() => go("mi-negocio", "apariencia")} />
        <Row Icon={Globe} color={A.vip} title="Región" sub={`Español · ${tenant?.country || "PR"}`} onClick={() => go("mi-negocio", "region")} />
      </Group>
    </SubPage>
  );
}

const buildOrig = (tenant) => {
  const s = settingsOf(tenant);
  return {
    name: tenant?.name || "", slogan: s.slogan || "", logo: tenant?.logo_url || "", phone: tenant?.admin_phone || "", email: tenant?.email || "", address: tenant?.address || "",
    hours: businessHoursOf(tenant).hours, social: { facebook: "", instagram: "", google_reviews: "", yelp: "", website: "", ...(s.social && typeof s.social === "object" ? s.social : {}) },
    currency: tenant?.currency || "USD", tax: String(taxPercentOf(tenant)),
  };
};

export function InfoNegocio({ tenant, tenantId, reload, back }) {
  const [base, setBase] = useState(tenant);
  const touchedRef = useRef(false);
  const s = settingsOf(base);
  const { stored } = businessHoursOf(base);
  const orig = useMemo(() => buildOrig(base), [base]);
  const [d, setD] = useState(orig);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [upErr, setUpErr] = useState(null);
  const [discard, setDiscard] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { fetchTenantRow(tenantId).then((t) => { if (!t || touchedRef.current) return; setBase(t); setD(buildOrig(t)); }).catch(() => {}); }, [tenantId]);
  const set = (patch) => { touchedRef.current = true; setD((p) => ({ ...p, ...patch })); };
  const dirty = JSON.stringify(d) !== JSON.stringify(orig);
  const taxNum = Math.min(100, Math.max(0, Number(String(d.tax).replace(",", ".")) || 0));
  const DAY_LABEL = Object.fromEntries(DAYS);

  const pickLogo = async (file) => {
    if (!file) return;
    setUploading(true); setUpErr(null);
    try {
      const blob = await imageToJpegBlob(file, 1200);
      const path = `tenants/${tenantId}/branding/logo_${uuid()}.jpg`;
      const bucket = supabase.storage.from("uploads");
      const { error: e } = await bucket.upload(path, blob, { contentType: "image/jpeg" });
      if (e) throw e;
      set({ logo: bucket.getPublicUrl(path).data.publicUrl });
    } catch (e) { setUpErr(`No se pudo subir el logo: ${e?.message || e}`); } finally { setUploading(false); }
  };

  const save = async () => {
    if (busy || !d.name.trim()) return;
    if (taxNum > 0 && taxNum < 1) { setError("El IVU debe ser 0 o al menos 1%."); return; }
    const badDay = Object.keys(d.hours).find((k) => !d.hours[k]?.closed && (!d.hours[k]?.open || !d.hours[k]?.close));
    if (badDay) { setError(`Completa la hora de apertura y cierre de ${DAY_LABEL[badDay] || badDay}.`); return; }
    setBusy(true); setError(null);
    try {
      const columns = {};
      if (d.name.trim() !== orig.name) columns.name = d.name.trim();
      if (d.email.trim() !== orig.email) columns.email = d.email.trim();
      if (d.address.trim() !== orig.address) columns.address = d.address.trim();
      if (d.phone.trim() !== orig.phone) columns.admin_phone = d.phone.trim() || null;
      if (d.logo !== orig.logo) columns.logo_url = d.logo || null;
      if (d.currency !== orig.currency) columns.currency = d.currency;
      const edits = {};
      if (d.slogan.trim() !== orig.slogan) edits.slogan = d.slogan.trim() || null;
      if (JSON.stringify(d.hours) !== JSON.stringify(orig.hours) || !stored) edits.business_hours = d.hours;
      const social = {};
      Object.keys(d.social).forEach((k) => { if (String(d.social[k] || "").trim()) social[k] = String(d.social[k]).trim(); });
      const origSocial = {};
      Object.keys(orig.social).forEach((k) => { if (String(orig.social[k] || "").trim()) origSocial[k] = String(orig.social[k]).trim(); });
      if (JSON.stringify(social) !== JSON.stringify(origSocial)) edits.social = Object.keys(social).length ? social : null;
      if (taxNum !== Number(orig.tax)) edits.tax_rate = taxNum;
      await updateTenant({ tenantId, columns, settingsEdits: edits, baseSettings: { slogan: s.slogan, business_hours: s.business_hours, social: s.social, tax_rate: s.tax_rate } });
      await reload();
      back();
    } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };

  const tryBack = () => { if (dirty) setDiscard(true); else back(); };
  const setDay = (k, patch) => set({ hours: { ...d.hours, [k]: { ...d.hours[k], ...patch } } });
  const timeInput = (v, onChange, label) => <input type="time" value={v} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ background: A.card2, color: "#fff", borderRadius: 10, padding: "8px 10px", fontSize: 15, colorScheme: "dark" }} />;

  return (
    <SubPage title="Info del Negocio" onBack={tryBack} right={<button onClick={save} disabled={busy || !dirty || !d.name.trim()} className="apple-press disabled:opacity-40" style={{ padding: "8px 16px", borderRadius: 999, background: A.brand, color: "#fff", fontWeight: 700 }}>Guardar</button>}>
      <Group header="Identidad Visual" icon={Camera} footer="Logo recomendado: PNG/JPG, 500×200 px aprox. Se recorta automáticamente si es más grande.">
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <span style={{ width: 88, height: 64, borderRadius: 8, background: A.card2, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>{d.logo ? <img src={d.logo} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <Store className="w-6 h-6" style={{ color: A.sub }} />}</span>
          <span className="flex-1"><span className="block" style={{ fontWeight: 600 }}>Logo de la Tienda</span>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="apple-press inline-flex items-center gap-1" style={{ marginTop: 4, padding: "5px 14px", borderRadius: 999, background: tint(A.brand, 0.16), color: A.brand, fontWeight: 700, fontSize: 13 }}>{uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo...</> : "Cambiar"}</button></span>
          {d.logo && <button onClick={() => set({ logo: "" })} aria-label="Quitar logo" style={{ width: 34, height: 34, borderRadius: 999, background: tint(A.danger, 0.16), color: A.danger, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 className="w-4 h-4" /></button>}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pickLogo(f); }} />
        </div>
        {upErr && <ErrorLine message={upErr} />}
        <div className="flex flex-col" style={{ gap: 12 }}>
          <Field label="Nombre de la Tienda *" value={d.name} onChange={(v) => set({ name: v })} placeholder="911 SmartFix" />
          <Field label="Slogan / Tagline" value={d.slogan} onChange={(v) => set({ slogan: v })} placeholder="Tu taller de confianza" />
          <p style={{ fontSize: 12, color: A.sub }}>Aparece en recibos, emails y el dashboard</p>
        </div>
      </Group>
      <Group header="Contacto" icon={Phone}>
        <div className="flex flex-col" style={{ gap: 12 }}>
          <Field label="Teléfono Principal" value={d.phone} onChange={(v) => set({ phone: v })} placeholder="(787) 344-4995" inputMode="tel" />
          <Field label="Email del Negocio" value={d.email} onChange={(v) => set({ email: v })} placeholder="contacto@taller.com" type="email" />
          <Field label="Dirección Física" value={d.address} onChange={(v) => set({ address: v })} placeholder="Calle Principal #123, San Juan, PR" />
        </div>
      </Group>
      <Group header="Horario de la tienda" icon={Clock} footer="Horas de apertura del taller (se muestran en recibos). El horario de cada empleado se maneja aparte en Empleados y Horarios." pad={false}>
        <div className="grid" style={{ gap: 10, padding: 12, gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
          {DAYS.map(([k, label]) => { const h = d.hours[k]; return (
            <div key={k} style={{ padding: 12, borderRadius: 12, background: h.closed ? A.card2 : tint(A.brand, 0.06), border: `1px solid ${h.closed ? "transparent" : tint(A.brand, 0.22)}` }}>
              <div className="flex items-center"><b className="flex-1">{label}</b>
                <button onClick={() => setDay(k, h.closed ? { closed: false, ...(h.open === h.close ? { open: "09:00", close: "17:00" } : {}) } : { closed: true })} role="switch" aria-checked={!h.closed} aria-label={`${label} abierto`} style={{ width: 46, height: 28, borderRadius: 999, background: !h.closed ? A.success : "#3A3A3C", position: "relative" }}><span style={{ position: "absolute", top: 2, left: !h.closed ? 20 : 2, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button></div>
              {h.closed ? <p style={{ color: A.danger, marginTop: 6, fontSize: 14 }}>Cerrado</p> : <div className="flex items-center gap-2" style={{ marginTop: 8 }}>{timeInput(h.open, (v) => setDay(k, { open: v }), `${label} abre`)}<span style={{ color: A.sub }}>—</span>{timeInput(h.close, (v) => setDay(k, { close: v }), `${label} cierra`)}</div>}
            </div>); })}
        </div>
      </Group>
      <Group header="Redes Sociales" icon={Link2} footer="Se usan como botones en plantillas de email y recibos">
        <div className="flex flex-col" style={{ gap: 12 }}>{SOCIAL.map(([k, l, ph]) => <Field key={k} label={l} value={d.social[k] || ""} onChange={(v) => set({ social: { ...d.social, [k]: v } })} placeholder={ph} />)}</div>
      </Group>
      <Group header="Dinero del local" icon={DollarSign} footer="La moneda se usa en recibos y POS. El IVU se aplica automáticamente a cada venta — pon 0 si tu taller no cobra impuesto.">
        <div className="flex flex-col" style={{ gap: 12 }}>
          <label className="flex flex-col" style={{ gap: 6 }}><span style={{ fontSize: 14, fontWeight: 600 }}>Moneda</span><select value={d.currency} onChange={(e) => set({ currency: e.target.value })} style={{ background: A.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, colorScheme: "dark" }}>{CURRENCIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <div className="flex items-center gap-2"><span className="flex-1" style={{ fontSize: 16 }}>IVU / Impuesto</span><input value={d.tax} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) set({ tax: r }); }} inputMode="decimal" placeholder="11.5" aria-label="IVU" className="outline-none text-right" style={{ width: 90, background: A.card2, color: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 16 }} /><span style={{ color: A.sub }}>%</span></div>
        </div>
      </Group>
      <ErrorLine message={error} />
      <PrimaryBtn onClick={save} busy={busy} disabled={!d.name.trim()}>Guardar Info del Negocio</PrimaryBtn>
      <AlertDialog open={discard} title="¿Descartar los cambios?" message="" onClose={() => setDiscard(false)} actions={[{ label: "Guardar", bold: true, onPress: save }, { label: "Descartar", destructive: true, onPress: back }, { label: "Cancelar" }]} />
    </SubPage>
  );
}

export function Apariencia({ back }) {
  const [mode, setMode] = useState(localGet("appearance.preferredMode", "dark"));
  const toggle = () => { const n = mode === "dark" ? "light" : "dark"; setMode(n); localSet("appearance.preferredMode", n); };
  return (
    <SubPage title="Apariencia" onBack={back}>
      <div className="flex flex-col items-center" style={{ gap: 18, padding: "50px 0" }}>
        <p style={{ color: A.sub }}>Toca para cambiar</p>
        <button onClick={toggle} className="apple-press relative" aria-label="Cambiar modo" style={{ width: 240, height: 92, borderRadius: 999, background: mode === "dark" ? "#1C1C1E" : "#E5E5EA", border: `1px solid ${A.sep}` }}>
          <span className="absolute flex items-center justify-center" style={{ top: 10, left: mode === "dark" ? 10 : 122, width: 108, height: 72, borderRadius: 999, background: "rgba(255,255,255,0.14)", transition: "left 0.3s" }}>{mode === "dark" ? <Moon className="w-8 h-8" /> : <Sun className="w-8 h-8" style={{ color: "#F5A623" }} />}</span>
          <span className="absolute" style={{ top: 34, left: mode === "dark" ? 140 : 40, fontWeight: 800, color: mode === "dark" ? A.sub : "#8E8E93" }}>{mode === "dark" ? "Dark" : "Light"}</span>
        </button>
        <b style={{ fontSize: 20 }}>{mode === "dark" ? "Modo Oscuro" : "Modo Claro"}</b>
        <p style={{ fontSize: 12, color: A.sub, maxWidth: 320, textAlign: "center" }}>La web aún usa el tema oscuro en todas las pantallas; esta preferencia se guarda en este navegador.</p>
      </div>
    </SubPage>
  );
}

export function Region({ tenant, tenantId, reload, back }) {
  const [country, setCountry] = useState(tenant?.country || "PR");
  const [zone, setZone] = useState(tenant?.timezone || "America/Puerto_Rico");
  const [lang, setLang] = useState(localGet("app.preferredLanguage", "es"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const current = localGet("app.preferredLanguage", "es");
  const save = async () => {
    setBusy(true); setError(null);
    try { await updateTenant({ tenantId, columns: { country, timezone: zone } }); await reload(); back(); } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };
  const sel = (v, set, opts) => <select value={v} onChange={(e) => set(e.target.value)} style={{ background: A.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, width: "100%", colorScheme: "dark" }}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
  return (
    <SubPage title="Región" onBack={back}>
      <Group header="Idioma" icon={Globe} footer="La app se reinicia para aplicar el idioma en todas las pantallas.">
        <Chips value={lang} onChange={setLang} options={[["es", "Español"], ["en", "English"]]} />
        {lang !== current && <button onClick={() => { localSet("app.preferredLanguage", lang); window.location.reload(); }} className="apple-press" style={{ marginTop: 12, padding: "12px 0", borderRadius: 12, background: A.brand, color: "#fff", fontWeight: 700 }}>{lang === "es" ? "Aplicar Español y reiniciar" : "Apply English and restart"}</button>}
      </Group>
      <Group header="País" footer="Determina el formato de números de teléfono y direcciones en los recibos.">{sel(country, setCountry, COUNTRIES)}</Group>
      <Group header="Zona Horaria" icon={Clock} footer="Afecta fechas, horas y reportes. Usa la zona horaria física del taller (no la del dueño si vive en otro lugar).">
        {sel(zone, setZone, ZONES)}
        <p style={{ marginTop: 10, fontSize: 14 }}><span style={{ color: A.sub }}>Hora actual del taller: </span><b>{fmt(now, safeTZ(zone), { dateStyle: "medium", timeStyle: "medium" })}</b></p>
      </Group>
      <ErrorLine message={error} />
      <PrimaryBtn onClick={save} busy={busy}>Guardar Idioma y Región</PrimaryBtn>
    </SubPage>
  );
}
