import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flag, ChevronRight, ChevronDown, X, CheckCircle2, Circle, Hand, Wrench, ShoppingCart, Package, Check } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { primerosPasosFlags, primerosPasosCounts } from "@/lib/inicioApi";

const DONE_KEY = "primeros_pasos_done";
const WELCOME_KEY = "onboarding.welcomeSeen";

const readFlag = (k) => {
  try {
    return localStorage.getItem(k) === "true";
  } catch {
    return false;
  }
};
const writeFlag = (k) => {
  try {
    localStorage.setItem(k, "true");
  } catch {
    return;
  }
};

export function welcomeSeen() {
  return readFlag(WELCOME_KEY);
}

export function PrimerosPasosCard({ tenant, tenantId, actions }) {
  const [dismissed, setDismissed] = useState(() => readFlag(DONE_KEY));
  const [expanded, setExpanded] = useState(false);
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    if (dismissed || !tenantId) return;
    primerosPasosCounts(tenantId).then(setCounts).catch(() => setCounts({ products: false, orders: false, sales: false, pin: false }));
  }, [dismissed, tenantId]);
  const f = primerosPasosFlags(tenant);
  const sections = counts ? [
    ["CONFIGURA", [
      ["Info de la tienda", "Nombre, logo y dirección", f.info, () => actions.settings("infoNegocio")],
      ["IVU / impuesto", "Configura tu tasa de impuesto", f.tax, () => actions.settings("impuesto")],
      ["Métodos de pago", "Efectivo, tarjeta, ATH Móvil", f.payments, () => actions.settings("metodosPago")],
      ["Recibo personalizado", "Mensajes y políticas del recibo", f.recibo, () => actions.settings("recibo")],
      ["PIN del dueño", "Protege Ajustes y reportes", counts.pin, () => actions.settings("seguridad")],
    ]],
    ["CARGA", [["Productos en inventario", "Agrega tu primer producto", counts.products, actions.inventory]]],
    ["PRIMERAS ACCIONES", [
      ["Primera orden", "Crea una orden de reparación", counts.orders, actions.newOrder],
      ["Venta en POS", "Registra una venta al mostrador", counts.sales, actions.pos],
    ]],
  ] : [];
  const all = sections.flatMap(([, s]) => s);
  const done = all.filter((s) => s[2]).length;
  const total = all.length;
  useEffect(() => {
    if (counts && total > 0 && done === total) { writeFlag(DONE_KEY); setDismissed(true); }
  }, [counts, done, total]);
  if (dismissed || !counts) return null;
  const dismiss = () => { writeFlag(DONE_KEY); setDismissed(true); };
  const bar = (
    <span className="block" style={{ height: 6, borderRadius: 999, background: tint(FP.brand, 0.15), overflow: "hidden" }}>
      <span className="block" style={{ width: `${(done / total) * 100}%`, height: "100%", background: FP.brand, transition: "width 0.3s" }} />
    </span>
  );
  if (!expanded) {
    return (
      <div className="flex items-center gap-3" style={{ padding: "12px 14px", borderRadius: 16, background: "#1C1C1E" }}>
        <button onClick={() => setExpanded(true)} className="flex-1 flex items-center gap-3 text-left" aria-expanded="false">
          <span className="flex-1 flex flex-col" style={{ gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Primeros pasos · {done} de {total}</span>
            {bar}
          </span>
          <ChevronDown className="w-4 h-4" style={{ color: "#8E8E93" }} />
        </button>
        <button onClick={dismiss} aria-label="Descartar" style={{ color: "#8E8E93" }}><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="flex flex-col" style={{ gap: 12, padding: 16, borderRadius: 20, background: "#1C1C1E" }}>
      <div className="flex items-center gap-3">
        <span style={{ width: 44, height: 44, borderRadius: 999, background: tint(FP.brand, 0.15), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Flag className="w-5 h-5" /></span>
        <button onClick={() => setExpanded(false)} className="flex-1 text-left" aria-expanded="true">
          <span className="block" style={{ fontSize: 17, fontWeight: 700 }}>Primeros pasos</span>
          <span className="block" style={{ fontSize: 12, color: "#8E8E93" }}>{done} de {total} completados</span>
        </button>
        <button onClick={dismiss} aria-label="Descartar" style={{ color: "#8E8E93" }}><X className="w-4 h-4" /></button>
      </div>
      {bar}
      {sections.map(([title, steps]) => (
        <div key={title} className="flex flex-col" style={{ gap: 2 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#8E8E93", padding: "6px 0" }}>{title}</p>
          {steps.map(([t, sub, ok, act]) => (
            <button key={t} onClick={ok ? undefined : act} disabled={ok} className="flex items-center gap-3 text-left" style={{ padding: "8px 0" }}>
              {ok ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: FP.success }} /> : <Circle className="w-5 h-5 flex-shrink-0" style={{ color: "#48484A" }} />}
              <span className="flex-1 min-w-0">
                <span className="block" style={{ fontSize: 15, fontWeight: 600, textDecoration: ok ? "line-through" : "none", color: ok ? "#8E8E93" : "#fff" }}>{t}</span>
                <span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{sub}</span>
              </span>
              {!ok && <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function WelcomeOnboarding({ open, tenant, onAction }) {
  if (!open || typeof document === "undefined") return null;
  const go = (fn) => { writeFlag(WELCOME_KEY); onAction(fn); };
  const card = (Icon, color, title, sub, key) => (
    <button key={key} onClick={() => go(key)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 16, borderRadius: 16, background: "#1C1C1E" }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: tint(color, 0.15), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-5 h-5" /></span>
      <span className="flex-1">
        <span className="block" style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <span className="block" style={{ fontSize: 13, color: "#8E8E93" }}>{sub}</span>
      </span>
      <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
    </button>
  );
  return createPortal(
    <div className="apple-type fixed inset-0 flex items-center justify-center" style={{ zIndex: 380, background: "#000", color: "#fff", padding: 16 }} role="dialog" aria-modal="true">
      <div className="w-full flex flex-col items-center" style={{ maxWidth: 440, gap: 14 }}>
        <Hand className="w-12 h-12" style={{ color: FP.brand }} />
        <p style={{ fontSize: 26, fontWeight: 800, textAlign: "center" }}>¡Bienvenido a Archilla OS!</p>
        <p style={{ fontSize: 15, color: "#8E8E93", textAlign: "center" }}>Empecemos rápido. ¿Qué quieres hacer primero?</p>
        <div className="w-full flex flex-col" style={{ gap: 10, marginTop: 8 }}>
          {tenant?.business_mode !== "retail" && card(Wrench, FP.info, "Crear mi primera orden", "Recibe un equipo para reparar", "newOrder")}
          {card(ShoppingCart, FP.success, "Hacer una venta", "Cobra en el punto de venta", "pos")}
          {card(Package, FP.brand, "Agregar un producto", "Empieza tu inventario", "inventory")}
        </div>
        <button onClick={() => go(null)} style={{ marginTop: 10, fontSize: 15, color: "#8E8E93" }}>Explorar por mi cuenta</button>
      </div>
    </div>,
    document.body
  );
}

const PLAN_FEATURES = ["Boletos, POS y Finanzas", "Inventario e IVU", "Portal del cliente", "Hasta 5 usuarios", "Chat interno del equipo", "Nómina y comisiones", "Multi-device en tiempo real"];

export function PaywallDialog({ open, onClose, onSubscribe }) {
  return (
    <Dialog open={open} onClose={onClose} title="Tu plan" width={460} leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      <div className="flex flex-col items-center" style={{ gap: 14, padding: "8px 0 4px" }}>
        <span style={{ width: 76, height: 76, borderRadius: 20, background: FP.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Wrench className="w-9 h-9" /></span>
        <p style={{ fontSize: 14, color: "#8E8E93", textAlign: "center" }}>14 días gratis. Cancela cuando quieras.</p>
        <div className="w-full flex flex-col" style={{ gap: 10, padding: 18, borderRadius: 18, background: "#2C2C2E", border: `1px solid ${tint(FP.brand, 0.4)}` }}>
          <div className="flex items-baseline justify-between">
            <span style={{ fontSize: 20, fontWeight: 800 }}>Completo</span>
            <span><span style={{ fontSize: 22, fontWeight: 800 }}>$49</span> <span style={{ fontSize: 13, color: "#8E8E93" }}>/mes</span></span>
          </div>
          <p style={{ fontSize: 13, color: "#8E8E93" }}>Todo tu taller, todo incluido. Solo boletos desde $20/mes (+$5 por técnico extra).</p>
          {PLAN_FEATURES.map((f) => <p key={f} className="flex items-center gap-2" style={{ fontSize: 14 }}><Check className="w-4 h-4" style={{ color: FP.success }} /> {f}</p>)}
        </div>
        <button onClick={onSubscribe} className="apple-press w-full" style={{ height: 52, borderRadius: 16, background: FP.brand, color: "#fff", fontSize: 17, fontWeight: 700 }}>Empezar 14 días gratis</button>
        <p className="flex gap-4" style={{ fontSize: 12 }}>
          <a href="https://archillaos.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#8E8E93" }}>Términos</a>
          <a href="https://archillaos.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#8E8E93" }}>Privacidad</a>
        </p>
      </div>
    </Dialog>
  );
}
