import { useEffect, useRef, useState } from "react";
import { Minus, Check, Circle, Eraser, FileText, AlertTriangle, Wallet, X, Camera } from "lucide-react";
import { tint } from "@/components/pos/native/posUi";
import { predictPromisedDays } from "@/lib/wizard/api";
import { IOS, keywordDays, contextualWaivers, abandonmentText } from "@/lib/wizard/helpers";
import { Caption, Card, Chip, Input, Switch, TextArea, W, money } from "./ui";

const dateInput = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");
const fromInput = (v) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
const dtInput = (d) => `${dateInput(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function StepEstimate({ w, tenantId, goToProblem }) {
  const { s, set } = w;
  const cartTotal = w.totals.total;

  useEffect(() => {
    const cur = Number(String(s.estimateText).replace(",", ".")) || 0;
    const synced = s.estimateSynced;
    if (s.cart.length && (!s.estimateText || cur === 0 || (synced !== null && Math.abs(cur - synced) < 0.005))) {
      set({ estimateText: cartTotal.toFixed(2), estimateSynced: cartTotal });
    }
  }, [cartTotal]);

  useEffect(() => {
    if (s.promisedInit) return undefined;
    let alive = true;
    const fallback = keywordDays(s.problem);
    set({ promisedInit: true, promisedDate: new Date(Date.now() + fallback * 86400000) });
    predictPromisedDays(tenantId, s.family?.name, fallback).then(({ days, samples }) => { if (alive) set({ promisedDate: new Date(Date.now() + days * 86400000), promisedSamples: samples }); });
    return () => { alive = false; };
  }, []);

  const est = Number(String(s.estimateText).replace(",", ".")) || 0;
  return (
    <div className="grid" style={{ gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
      <Card style={{ padding: 14 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <span className="flex-1" style={{ fontSize: 16, fontWeight: 700 }}>Piezas y servicios <span style={{ fontSize: 12, color: W.sub, fontWeight: 500 }}>{s.cart.length} línea{s.cart.length === 1 ? "" : "s"}</span></span>
          <button onClick={goToProblem} style={{ fontSize: 13, color: IOS.orange, fontWeight: 600 }}>Editar piezas</button>
        </div>
        {!s.cart.length ? <div className="text-center" style={{ padding: 16 }}><p style={{ fontSize: 15, fontWeight: 600, color: W.sub }}>Sin piezas agregadas</p><p style={{ fontSize: 13, color: W.ter }}>Puedes cotizar manualmente con el monto a la derecha.</p></div>
          : s.cart.map((l) => (
            <div key={l.key} className="flex items-center gap-2" style={{ padding: "8px 0", borderTop: `0.5px solid ${W.sep}` }}>
              <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{l.product.name}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{l.quantity} × {money(l.unitPrice)}</span></span>
              {l.product.taxable !== false && <span style={{ padding: "1px 7px", borderRadius: 999, background: tint(IOS.orange, 0.18), color: IOS.orange, fontSize: 10, fontWeight: 700 }}>IVU</span>}
              <span style={{ fontSize: 14, fontWeight: 700 }}>{money(l.unitPrice * l.quantity)}</span>
              <button onClick={() => w.setQuantity(l.key, 0)} aria-label="Quitar" style={{ color: IOS.red }}><Minus className="w-4 h-4" /></button>
            </div>
          ))}
      </Card>
      <div className="flex flex-col" style={{ gap: 14 }}>
        <Card style={{ padding: 14 }}>
          <div className="flex justify-between" style={{ fontSize: 14 }}><span style={{ color: W.sub }}>Subtotal</span><span>{money(w.totals.subtotal)}</span></div>
          <div className="flex justify-between" style={{ fontSize: 14, marginTop: 4 }}><span style={{ color: W.sub }}>IVU</span><span>{money(w.totals.tax)}</span></div>
          <div style={{ height: 0.5, background: W.sep, margin: "8px 0" }} />
          <div className="flex justify-between" style={{ fontSize: 17, fontWeight: 800 }}><span>Total piezas</span><span style={{ color: IOS.orange }}>{money(cartTotal)}</span></div>
        </Card>
        <Card style={{ padding: 14 }}>
          <Caption style={{ paddingBottom: 6 }}>Cotización estimada</Caption>
          <div className="flex items-center gap-2"><span style={{ fontSize: 30, fontWeight: 800, color: W.sub }}>$</span><input value={s.estimateText} onChange={(e) => set({ estimateText: e.target.value })} inputMode="decimal" placeholder="0.00" aria-label="Cotización estimada" className="flex-1 bg-transparent outline-none" style={{ fontSize: 34, fontWeight: 800, color: "#fff", minWidth: 0 }} /></div>
          <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>{[25, 50, 75, 100, 150].map((v) => <Chip key={v} label={money(v)} active={Math.abs(est - v) < 0.005} onClick={() => set({ estimateText: v.toFixed(2) })} />)}</div>
          <p style={{ fontSize: 12, color: W.sub, marginTop: 8 }}>Incluye mano de obra y piezas. El cliente verá este estimado.</p>
          <p style={{ fontSize: 11, color: W.ter, marginTop: 2 }}>{s.cart.length ? "Pre-calculado del checkout · puedes ajustarlo" : "Puede quedar en $0 si se cotiza después"}</p>
        </Card>
        <Card style={{ padding: 14 }}>
          <div className="flex items-center gap-3"><span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Prioridad</span><span className="block" style={{ fontSize: 12, color: W.sub }}>Marcar como prioridad alta · aparecerá destacado en la lista de órdenes</span></span><Switch on={s.highPriority} onChange={(v) => set({ highPriority: v })} label="Prioridad alta" /></div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div className="flex items-center gap-3"><span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Listo para</span><span className="block" style={{ fontSize: 12, color: W.sub }}>Fecha prometida al cliente · se marca atrasada si no se entrega a tiempo</span></span>
            <Switch on={!!s.promisedDate} onChange={(v) => set({ promisedDate: v ? new Date(Date.now() + keywordDays(s.problem) * 86400000) : null })} label="Fecha prometida" /></div>
          {s.promisedDate && <div style={{ marginTop: 10 }}><Input label="Fecha" type="date" value={dateInput(s.promisedDate)} onChange={(v) => v && set({ promisedDate: fromInput(v) })} /></div>}
          {s.promisedDate && s.promisedSamples >= 3 && <p style={{ fontSize: 12, color: W.sub, marginTop: 6 }}>Basado en {s.promisedSamples} reparaciones similares entregadas</p>}
        </Card>
      </div>
    </div>
  );
}

function SignaturePreview({ blob }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? <img src={url} alt="Firma" style={{ height: 70, background: "#fff", borderRadius: 8 }} /> : null;
}

function SignaturePad({ onChange, initialBlob }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const moved = useRef(false);
  const [has, setHas] = useState(false);
  useEffect(() => {
    const c = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    let alive = true;
    if (initialBlob && typeof createImageBitmap === "function") {
      createImageBitmap(initialBlob).then((bmp) => {
        if (!alive) return;
        ctx.drawImage(bmp, 0, 0, rect.width, rect.height);
        moved.current = true;
        setHas(true);
      }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  const pt = (e) => { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e) => { e.preventDefault(); canvasRef.current.setPointerCapture(e.pointerId); drawing.current = true; last.current = pt(e); };
  const move = (e) => {
    if (!drawing.current) return;
    const p = pt(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    moved.current = true;
    if (!has) setHas(true);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (moved.current) canvasRef.current.toBlob((b) => onChange(b), "image/png");
  };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    moved.current = false;
    setHas(false);
    onChange(null);
  };
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex items-center">
        <span className="flex-1" style={{ fontSize: 16, fontWeight: 700 }}>Firma del cliente</span>
        {has && <span style={{ fontSize: 12, color: IOS.green, fontWeight: 600, marginRight: 12 }}>Firma capturada</span>}
        <button onClick={clear} className="flex items-center gap-1" style={{ fontSize: 13, color: IOS.orange }}><Eraser className="w-3.5 h-3.5" /> Limpiar</button>
      </div>
      <div className="relative" style={{ background: "#fff", borderRadius: 16, height: 260, touchAction: "none" }}>
        <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Firma del cliente" style={{ width: "100%", height: "100%", borderRadius: 16 }} />
        <div className="absolute pointer-events-none" style={{ left: 24, right: 24, bottom: 56, height: 1, background: "#C7C7CC" }} />
        {!has && <span className="absolute pointer-events-none" style={{ left: 0, right: 0, bottom: 28, textAlign: "center", fontSize: 13, color: "#8E8E93" }}>Firme aquí</span>}
      </div>
    </div>
  );
}

export function StepSignature({ w, tenant }) {
  const { s, set } = w;
  const pol = tenant?.settings?.policies || {};
  const waivers = contextualWaivers(s.problem);
  const empty = "Tu taller no tiene este texto configurado en Ajustes → Políticas del Negocio.";
  const section = (title, text) => (
    <Card key={title} style={{ padding: 14 }}>
      <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}><FileText className="w-4 h-4" style={{ color: IOS.purple }} /> {title}</p>
      <p style={{ fontSize: 13, color: String(text || "").trim() ? "#fff" : W.sub, whiteSpace: "pre-wrap" }}>{String(text || "").trim() || empty}</p>
    </Card>
  );
  return (
    <div className="grid" style={{ gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "start" }}>
      <div className="flex flex-col" style={{ gap: 12 }}>
        <p className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700 }}><FileText className="w-5 h-5" style={{ color: IOS.purple }} /> Términos y autorización</p>
        {s.security.photo_exception_reason && section("Sin fotos de entrada", `No se tomaron fotos del equipo al recibirlo. Motivo: ${s.security.photo_exception_reason}.`)}
        {waivers.map((t) => section("Aviso importante para este equipo", t))}
        {section("Garantía de Reparaciones", pol.repair_warranty)}
        {section("Garantía de Ventas", pol.sales_warranty)}
        {section("Condiciones de Venta", pol.sales_terms)}
        {section("Política de Abandono y Almacenaje", `${abandonmentText(tenant)} Al firmar, el cliente acepta esta política.`)}
        <button onClick={() => set({ termsAccepted: !s.termsAccepted })} className="apple-press flex items-center gap-3 text-left" style={{ padding: 14, borderRadius: 14, background: s.termsAccepted ? tint(IOS.purple, 0.12) : W.card, border: `1px solid ${s.termsAccepted ? IOS.purple : "transparent"}` }} aria-pressed={s.termsAccepted}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: s.termsAccepted ? IOS.purple : "transparent", border: `2px solid ${s.termsAccepted ? IOS.purple : W.sub}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{s.termsAccepted && <Check className="w-4 h-4" strokeWidth={3} />}</span>
          <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Acepto los términos del taller</span>{!s.termsAccepted && <span className="block" style={{ fontSize: 12, color: IOS.red }}>Obligatorio para continuar</span>}</span>
        </button>
      </div>
      <div className="flex flex-col" style={{ gap: 10 }}>
        <SignaturePad initialBlob={s.signatureBlob} onChange={(b) => set({ signatureBlob: b })} />
        <p style={{ fontSize: 12, color: W.sub }}>Firma y términos son opcionales — la orden se puede crear sin ellos. Recomendado para evitar disputas.</p>
      </div>
    </div>
  );
}

const CHIPS = [20, 40, 50, 100];

export function StepConfirm({ w, cashOpen }) {
  const { s, set } = w;
  const [depositText, setDepositText] = useState(() => (s.deposit > 0 ? String(s.deposit) : ""));
  const [depositOpen, setDepositOpen] = useState(() => s.deposit > 0);
  const cust = s.customer;
  const est = Number(String(s.estimateText).replace(",", ".")) || 0;
  const sec = s.security;
  const damaged = s.checklist.filter((c) => c.status === "damaged");
  const okItems = s.checklist.filter((c) => c.status === "ok");
  const tested = s.checklist.some((c) => c.status !== "not_tested");
  const secSet = !!(sec.device_pin || sec.device_password || sec.pattern_vector?.length || sec.device_imei || sec.device_serial);
  const quick = s.mode === "quick";
  const items = [
    ["Cliente", cust?.name || (s.anonymous ? "Anónimo" : null), !!cust || s.anonymous],
    ["Equipo", s.model?.name || s.customModelText || s.category?.name, !!s.category],
    ["Problema", null, !!s.problem.trim()],
    ...(quick ? [] : [["Fotos", s.photos.length ? `${s.photos.length}` : null, s.photos.length > 0 || !!sec.photo_exception_reason]]),
    ["Seguridad", null, secSet],
    ["Inspección", null, tested],
    ...(quick ? [] : [["Cotización", est > 0 ? money(est) : null, est > 0], ["Firma y términos", null, s.termsAccepted || !!s.signatureBlob]]),
  ];
  const done = items.filter((x) => x[2]).length;
  const workshop = s.serviceType === "workshop";
  const review = (title, children) => <Card style={{ padding: 14 }}><Caption style={{ paddingBottom: 8 }}>{title}</Caption><div className="flex flex-col" style={{ gap: 4, fontSize: 14 }}>{children}</div></Card>;
  const row = (l, v) => v ? <div className="flex justify-between gap-3"><span style={{ color: W.sub }}>{l}</span><span className="text-right" style={{ fontWeight: 600 }}>{v}</span></div> : null;
  return (
    <div className="grid" style={{ gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
      <div className="flex flex-col" style={{ gap: 14 }}>
        <Card style={{ padding: 14 }}>
          <div className="flex items-center" style={{ marginBottom: 8 }}><span className="flex-1" style={{ fontSize: 15, fontWeight: 700 }}>Pasos de la orden</span><span style={{ fontSize: 13, color: W.sub }}>{done}/{items.length}</span></div>
          {items.map(([l, v, ok]) => (
            <div key={l} className="flex items-center gap-2" style={{ padding: "5px 0" }}>
              {ok ? <Check className="w-4 h-4" style={{ color: IOS.green }} /> : <Circle className="w-4 h-4" style={{ color: W.ter }} />}
              <span style={{ fontSize: 14 }}>{l}</span><span className="flex-1 text-right truncate" style={{ fontSize: 13, color: W.sub }}>{v}</span>
            </div>
          ))}
        </Card>
        {workshop && (est >= 0) && (s.deposit <= 0 || !(sec.device_pin || sec.device_password || sec.pattern_vector?.length)) && (
          <div className="flex flex-col" style={{ gap: 6, padding: 14, borderRadius: 14, background: tint(IOS.orange, 0.12), border: `1px solid ${tint(IOS.orange, 0.3)}` }}>
            <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 700, color: IOS.orange }}><AlertTriangle className="w-4 h-4" /> Antes de crear, protégete</p>
            {s.deposit <= 0 && <p style={{ fontSize: 13 }}>Sin depósito — si el cliente no recoge, pierdes lo invertido en piezas.</p>}
            {!(sec.device_pin || sec.device_password || sec.pattern_vector?.length) && <p style={{ fontSize: 13 }}>Sin código del equipo — no podrás probarlo si queda bloqueado.</p>}
          </div>
        )}
        <Card style={{ padding: 14 }}>
          <Caption style={{ paddingBottom: 8 }}>Tipo de servicio</Caption>
          <p style={{ fontSize: 15, fontWeight: 600 }}>{{ workshop: "En Taller", visit: "Visita técnica", remote: "Remoto" }[s.serviceType]}</p>
        </Card>
        {!workshop && (
          <Card style={{ padding: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700 }}>Cita</p>
            <p style={{ fontSize: 12, color: W.sub, marginBottom: 8 }}>Fecha y hora de la {s.serviceType === "visit" ? "visita" : "sesión remota"}.</p>
            <Input type="datetime-local" value={dtInput(s.appointmentDate)} onChange={(v) => v && set({ appointmentDate: new Date(v) })} />
            <div style={{ marginTop: 10 }}>
              {s.serviceType === "visit"
                ? <><TextArea label="Dirección de la visita" value={s.appointmentLocation} onChange={(v) => set({ appointmentLocation: v })} placeholder="Ej. 123 Calle Principal, San Juan, PR 00901" rows={3} /><p style={{ fontSize: 12, color: W.sub, marginTop: 4 }}>Usaremos esta dirección para abrir Mapas desde la orden.</p></>
                : <Input label="Link de sesión (Zoom, Meet…)" value={s.appointmentLocation} onChange={(v) => set({ appointmentLocation: v })} placeholder="https://meet.google.com/..." />}
            </div>
          </Card>
        )}
        <Card style={{ padding: 14 }}>
          <p className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700 }}><Wallet className="w-4 h-4" style={{ color: IOS.orange }} /> {workshop ? "Depósito al recibir" : "Reserva de cita"}{s.deposit > 0 && <span style={{ marginLeft: "auto", color: IOS.green }}>{money(s.deposit)}</span>}</p>
          <p style={{ fontSize: 12, color: W.sub, margin: "4px 0 10px" }}>{workshop ? "Opcional — cobrar parcialmente al cliente al momento de recibir el equipo." : "Opcional — cobrar una reserva para asegurar la cita y evitar ausencias."}</p>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {CHIPS.map((v) => <Chip key={v} label={money(v)} active={s.deposit === v} onClick={() => { const nv = s.deposit === v ? 0 : v; set({ deposit: nv }); setDepositText(nv > 0 ? String(nv) : ""); setDepositOpen(nv > 0); }} />)}
            <Chip label="Otro" active={depositOpen && !CHIPS.includes(s.deposit)} onClick={() => setDepositOpen(true)} />
          </div>
          {(depositOpen || s.deposit > 0) && (
            <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
              <span style={{ color: W.sub }}>$</span>
              <input value={depositText} onChange={(e) => { const raw = e.target.value.replace(",", "."); if (!/^\d*\.?\d{0,2}$/.test(raw)) return; setDepositText(raw); set({ deposit: Number(raw) || 0 }); }} inputMode="decimal" placeholder="0.00" aria-label="Monto del depósito" className="bg-transparent outline-none" style={{ width: 100, fontSize: 18, fontWeight: 700, color: "#fff" }} />
              <button onClick={() => { set({ deposit: 0 }); setDepositText(""); setDepositOpen(false); }} aria-label="Quitar depósito" style={{ color: W.sub }}><X className="w-4 h-4" /></button>
            </div>
          )}
          {s.deposit > 0 && <p style={{ fontSize: 12, color: W.sub, marginTop: 6 }}>El método de pago (efectivo / ATH / QR) se escoge al crear la orden.</p>}
          {s.deposit > 0 && !cashOpen && <p className="flex items-center gap-1.5" style={{ fontSize: 12, color: IOS.orange, marginTop: 6 }}><AlertTriangle className="w-3.5 h-3.5" /> La caja está cerrada — el cobro quedará pendiente hasta que la abras.</p>}
        </Card>
      </div>
      <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
        {cust && review("Cliente", <>{row("Nombre", cust.name)}{row("Teléfono", cust.phone)}{row("Email", cust.email)}</>)}
        {review("Dispositivo", <>{row("Tipo", s.category?.name)}{row("Marca", s.brand?.name)}{row("Familia", s.family?.name)}{row("Modelo", s.model?.name || s.customModelText)}</>)}
        {review("Problema", <p style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.problem.trim() || "—"}</p>)}
        {!quick && review("Checklist de inspección", <>{damaged.length > 0 && <p style={{ color: IOS.red }}>Dañados: {damaged.map((d) => d.label).join(", ")}</p>}<p style={{ color: W.sub }}>Funcionan: {okItems.length} de {s.checklist.length}</p></>)}
        {review("Asignación", s.employee ? row("Técnico", s.employee.full_name) : <p style={{ color: W.sub }}>Sin asignar — se asigna después en el detalle</p>)}
        {!quick && review("Términos", <p>{s.termsAccepted ? "Cliente aceptó" : "Sin aceptar"}{s.signatureBlob ? " · Firmado" : ""}</p>)}
        {!quick && review("Fotos", s.photos.length ? <div className="flex" style={{ gap: 6 }}>{s.photos.slice(0, 4).map((p) => <img key={p.id} src={p.preview} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover" }} />)}{s.photos.length > 4 && <span style={{ alignSelf: "center", fontWeight: 700 }}>+{s.photos.length - 4}</span>}</div> : <p style={{ color: W.sub }}><Camera className="w-3.5 h-3.5 inline" /> Sin fotos</p>)}
        {review("Seguridad", secSet || sec.photo_exception_reason ? <>{sec.device_pin && row("PIN", "•".repeat(String(sec.device_pin).length))}{sec.device_password && row("Contraseña", "***")}{sec.pattern_vector?.length > 0 && row("Patrón", `${sec.pattern_vector.length} puntos`)}{row("IMEI", sec.device_imei)}{row("Serial", sec.device_serial)}{row("Sin fotos", sec.photo_exception_reason)}</> : <p style={{ color: W.sub }}>Sin datos de seguridad</p>)}
        {!quick && review("Cotización", <>{row("Estimado", est > 0 ? money(est) : "A cotizar")}{row("Prioridad", s.highPriority ? "Alta" : "Normal")}{s.promisedDate && row("Listo para", new Intl.DateTimeFormat("es-PR", { dateStyle: "medium" }).format(s.promisedDate))}{s.employee && row("Técnico", s.employee.full_name)}</>)}
        {!quick && review("Firma", s.signatureBlob ? <SignaturePreview blob={s.signatureBlob} /> : <p style={{ color: W.sub }}>Sin firma</p>)}
      </div>
    </div>
  );
}
