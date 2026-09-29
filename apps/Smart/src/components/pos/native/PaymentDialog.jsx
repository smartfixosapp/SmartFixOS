import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Banknote, CreditCard, Phone, CheckCircle2, Columns2, Loader2, QrCode, ChevronRightCircle, Undo2, PlusCircle, MinusCircle, ChevronDown, User, CircleDollarSign, Building2, FileText, Bitcoin, MessageCircle, Square, Apple } from "lucide-react";
import { P, tint, Dialog, ErrorBanner, SectionHeader, TextAction, AlertDialog } from "./posUi";
import { SaleTotals } from "./Cart";
import { usd, r2, lineTotal, parseMoney, changeBreakdown, quickCashAmounts, effectivePrice, isAccessoryItem, isActive, isFullDevice, searchTokens, productMatches, customerDisplayName, initials, isVIP } from "@/lib/posLogic";
import { tenantPaymentMethods } from "@/lib/orderMoneyApi";

const BUILTIN = {
  cash: { label: "Efectivo", Icon: Banknote, color: P.cash },
  card: { label: "Tarjeta", Icon: CreditCard, color: P.card_ },
  ath_movil: { label: "ATH Móvil", Icon: Phone, color: P.ath },
};

const BRAND_TABLE = [
  [["applepay"], Apple, "#FFFFFF"],
  [["googlepay", "gpay"], CircleDollarSign, "#4285F5"],
  [["samsungpay"], CircleDollarSign, "#144FF2"],
  [["cashapp", "cash app", "$cashtag"], CircleDollarSign, "#00D633"],
  [["paypal", "paypalme"], CircleDollarSign, "#003087"],
  [["venmo"], CircleDollarSign, "#3D94CE"],
  [["zelle"], CircleDollarSign, "#6D1ED4"],
  [["athempresarial", "athbusiness", "athbiz"], Phone, "#F56B0F"],
  [["athmovil", "ath"], Phone, "#F58C1A"],
  [["yappy"], CircleDollarSign, "#1A4DA6"],
  [["nequi"], CircleDollarSign, "#F20080"],
  [["daviplata"], CircleDollarSign, "#D91A33"],
  [["bizum"], CircleDollarSign, "#0FB575"],
  [["wise", "transferwise"], CircleDollarSign, "#9EE045"],
  [["mercadopago", "mpago"], CircleDollarSign, "#F5C72E"],
  [["stripe"], Square, "#7357F0"],
  [["squarecash", "square"], Square, "#FFFFFF"],
  [["banktech"], Building2, "#F56B0F"],
  [["evertec"], Building2, "#0D59A6"],
  [["revolut"], CircleDollarSign, "#FFFFFF"],
  [["wechatpay", "wechat"], MessageCircle, "#0DC963"],
  [["alipay"], CircleDollarSign, "#009EE8"],
  [["bitcoin", "btc", "cripto", "crypto"], Bitcoin, "#F5941A"],
  [["transferencia", "wire", "ach"], Building2, "#4D73B3"],
  [["cheque", "check"], FileText, "#8C8C8C"],
];

export function customMethodStyle(label) {
  const key = String(label || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s\-_.]/g, "");
  if (!key) return { Icon: CreditCard, color: P.vip };
  for (const [needles, Icon, color] of BRAND_TABLE) {
    if (needles.includes(key) || needles.some((n) => key.includes(n))) return { Icon, color };
  }
  return { Icon: CreditCard, color: P.vip };
}

export function methodLabelFor(method) {
  return BUILTIN[method]?.label || method;
}

function scorePart(p, ctx) {
  const n = (s) => String(s || "").trim().toLowerCase();
  const pModel = n(p.device_model_tag);
  const pFamily = n(p.device_family);
  const pCat = n(p.device_category);
  const pBrand = n(p.device_brand);
  let familyOk = false;
  if (pFamily) familyOk = !!ctx.family && pFamily === ctx.family;
  else if (pCat) familyOk = !!ctx.category && pCat === ctx.category && (!ctx.brand || !pBrand || pBrand === ctx.brand);
  if (!familyOk) return 0;
  if (pModel) {
    if (!ctx.model) return 60;
    return pModel === ctx.model ? 100 : 0;
  }
  return 60;
}

function suggestedAccessories(cart, products) {
  const inCart = new Set(cart.map((i) => i.productId).filter(Boolean));
  const accessories = products.filter((p) => isAccessoryItem(p) && isActive(p) && !inCart.has(p.id));
  if (!accessories.length) return [];
  const n = (s) => String(s || "").trim().toLowerCase();
  const contexts = cart.map((i) => products.find((p) => p.id === i.productId)).filter(Boolean)
    .map((p) => ({ category: n(p.device_category), brand: n(p.device_brand), family: n(p.device_family), model: n(p.device_model_tag) }))
    .filter((c) => c.category || c.brand || c.family || c.model);
  if (contexts.length) {
    const matched = accessories.filter((a) => contexts.some((c) => scorePart(a, c) > 0));
    if (matched.length) return matched.slice(0, 4);
    const first = contexts[0];
    const query = [first.brand, first.family, first.model].filter(Boolean).join(" ");
    if (query) {
      const tokens = searchTokens(query);
      const untagged = accessories.filter((p) => !p.device_model_tag && !p.device_family && !p.device_category && !isFullDevice(p));
      const fuzzy = untagged.filter((p) => productMatches(p, tokens));
      if (fuzzy.length) return fuzzy.slice(0, 4);
    }
  }
  return accessories.slice(0, 4);
}

function ChangeBreakdownCard({ change }) {
  const parts = changeBreakdown(change);
  return (
    <div style={{ padding: 12, borderRadius: 12, background: tint(P.success, 0.07) }}>
      <p className="flex items-center gap-1.5" style={{ fontSize: 15, fontWeight: 700, color: P.success }}><Undo2 className="w-4 h-4" /> Cambio: {usd(change)}</p>
      {parts.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
          {parts.map((b) => (
            <span key={b.label} style={{ padding: "4px 9px", borderRadius: 999, background: tint(P.success, 0.13), color: P.success, fontSize: 12 }}>
              <span style={{ opacity: 0.7 }}>{b.count}×</span> <b>{b.label}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function QRScreen({ config, methodLabel, amount, customerName, shopName, onPaid, onCancel }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (config?.imageBase64) {
      const b = String(config.imageBase64);
      setSrc(b.startsWith("data:") ? b : `data:image/png;base64,${b}`);
    } else if (config?.paymentURL) {
      QRCode.toDataURL(config.paymentURL, { margin: 1, width: 560 }).then(setSrc, () => setSrc(null));
    } else setSrc(null);
  }, [config]);
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: 14, paddingTop: 4 }}>
      <p style={{ fontSize: 17, fontWeight: 600 }}>{methodLabel}</p>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: P.sub, textTransform: "uppercase" }}>Monto a cobrar</p>
        <p style={{ fontSize: 44, fontWeight: 700, color: P.success }}>{usd(amount)}</p>
        {customerName && <p style={{ fontSize: 15, color: P.sub }}>De {customerName}</p>}
      </div>
      <div style={{ background: "#fff", borderRadius: 20, padding: 20 }}>
        {src ? <img src={src} alt="QR de cobro" style={{ width: 280, maxWidth: "100%" }} /> : (
          <div className="flex flex-col items-center" style={{ width: 240, padding: 24, color: "#666", gap: 8 }}>
            <QrCode className="w-14 h-14" />
            <span style={{ fontSize: 13 }}>No hay QR configurado para este método</span>
          </div>
        )}
      </div>
      <div>
        <p style={{ fontSize: 12, color: P.sub }}>Cliente escanea con su cámara o app de pago</p>
        {shopName && <p style={{ fontSize: 11, fontWeight: 600, color: P.ter }}>Paga a {shopName}</p>}
      </div>
      <div className="w-full flex flex-col" style={{ gap: 8 }}>
        <button onClick={onPaid} className="apple-press flex items-center justify-center gap-2" style={{ padding: "16px 0", borderRadius: 14, background: P.success, color: "#fff", fontSize: 16, fontWeight: 600 }}>
          <CheckCircle2 className="w-5 h-5" /> Marcar como pagado
        </button>
        <button onClick={onCancel} className="apple-press" style={{ padding: "12px 0", color: P.sub, fontSize: 16, fontWeight: 500 }}>Cancelar cobro</button>
      </div>
    </div>
  );
}

export default function PaymentDialog({ open, onClose, cart, totals, discountAmount, taxLabel, customer, tenant, products, onAddUpsell, processSale }) {
  const { builtIns, custom, qrFor } = useMemo(() => tenantPaymentMethods(tenant), [tenant]);
  const enabled = builtIns.length ? builtIns : ["cash", "card", "ath_movil"];
  const [method, setMethod] = useState("cash");
  const [customLabel, setCustomLabel] = useState(null);
  const [cashText, setCashText] = useState("");
  const [split, setSplit] = useState(false);
  const [splits, setSplits] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [screen, setScreen] = useState("pay");
  const [changeDue, setChangeDue] = useState(0);
  const [largeConfirm, setLargeConfirm] = useState(false);
  const total = totals.total;

  useEffect(() => {
    if (!open) return;
    setMethod(enabled.includes("cash") ? "cash" : enabled[0]);
    setCustomLabel(null);
    setCashText("");
    setSplit(false);
    setSplits([]);
    setProcessing(false);
    setSuccess(false);
    setError(null);
    setScreen("pay");
    setChangeDue(0);
  }, [open]);

  const received = parseMoney(cashText) ?? 0;
  const splitTotal = r2(splits.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  const splitRemaining = Math.max(0, r2(total - splitTotal));
  const requiresAmount = method === "cash" && !customLabel;
  const canConfirm = split ? splitTotal >= total : customLabel ? true : method === "cash" ? received >= total : true;
  const customCfg = customLabel ? custom.find((c) => c.label === customLabel) : null;
  const qr = customLabel ? (customCfg?.qr && (customCfg.qr.imageBase64 || customCfg.qr.paymentURL) ? customCfg.qr : null) : qrFor(method);
  const methodLabel = customLabel || methodLabelFor(method);
  const upsell = useMemo(() => (open ? suggestedAccessories(cart, products) : []), [open, cart, products]);

  const toggleSplit = () => {
    if (!split) { setSplit(true); setSplits([{ id: Date.now(), method, amount: 0 }]); }
    else { setSplit(false); setSplits([]); }
  };

  const doProcess = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    try {
      if (split) {
        const nonZero = splits.filter((x) => (Number(x.amount) || 0) > 0).map((x) => ({ method: x.method, amount: Number(x.amount) }));
        if (!nonZero.length) throw new Error("Sin montos válidos");
        const res = await processSale({ payments: nonZero, customLabel: null, split: true });
        if (res?.showReceipt) { onClose(); return; }
        setSuccess(true);
        setTimeout(() => onClose(), 320);
      } else {
        const baseMethod = customLabel ? "ath_movil" : method;
        const recv = baseMethod === "cash" ? received : total;
        const change = baseMethod === "cash" ? Math.max(0, r2(recv - total)) : 0;
        const res = await processSale({ payments: [{ method: baseMethod, amount: recv }], customLabel, split: false });
        if (change > 0 && !res?.showReceipt) {
          setChangeDue(change);
          setScreen("change");
        } else if (res?.showReceipt) {
          onClose();
        } else {
          setSuccess(true);
          setTimeout(() => onClose(), 320);
        }
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setProcessing(false);
    }
  };

  const onFinalize = () => {
    if (total >= 500) setLargeConfirm(true);
    else doProcess();
  };

  const tile = (key, label, Icon, accent, on, onClick) => (
    <button key={key} onClick={onClick} className="apple-press flex flex-col items-center justify-center relative"
      style={{ gap: 6, padding: "12px 6px", borderRadius: 14, background: on ? P.brand : "#2C2C2E", border: `1px solid ${on ? "transparent" : "rgba(84,84,88,0.4)"}`, boxShadow: on ? `0 3px 12px ${tint(P.brand, 0.3)}` : "none" }}>
      <span className="relative">
        <Icon className="w-5 h-5" style={{ color: on ? "#fff" : accent }} />
        {on && <CheckCircle2 className="w-3 h-3 absolute" style={{ color: "#fff", top: -6, right: -14 }} />}
      </span>
      <span className="truncate" style={{ maxWidth: "100%", fontSize: 12, fontWeight: 600, color: on ? "#fff" : P.text }}>{label}</span>
    </button>
  );

  if (screen === "qr") {
    return (
      <Dialog open={open} onClose={() => setScreen("pay")} width={480}>
        <QRScreen config={qr} methodLabel={methodLabel} amount={total} customerName={customer ? customerDisplayName(customer) : null} shopName={tenant?.name}
          onPaid={() => { setScreen("pay"); doProcess(); }} onCancel={() => setScreen("pay")} />
      </Dialog>
    );
  }

  if (screen === "change") {
    return (
      <Dialog open={open} onClose={() => {}} dismissable={false} title="Cambio" width={480}>
        <div className="flex flex-col" style={{ gap: 24, paddingTop: 30 }}>
          <div className="text-center">
            <p style={{ fontSize: 15, color: P.sub }}>Cambio a entregar</p>
            <p style={{ fontSize: 48, fontWeight: 700, color: P.success }}>{usd(changeDue)}</p>
          </div>
          <ChangeBreakdownCard change={changeDue} />
          <button onClick={onClose} className="apple-press" style={{ padding: "16px 0", borderRadius: 14, background: P.success, color: "#fff", fontSize: 16, fontWeight: 600 }}>Ya le di el cambio</button>
        </div>
      </Dialog>
    );
  }

  const cashChange = received - total;

  return (
    <>
      <Dialog
        open={open}
        onClose={() => !processing && onClose()}
        dismissable={!processing}
        title="Cobrar"
        width={1040}
        height="90dvh"
        leading={<TextAction onClick={() => !processing && onClose()} disabled={processing}>Cancelar</TextAction>}
        trailing={null}
        bodyPadding="0"
      >
        <div className="flex flex-col lg:flex-row h-full">
          <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 24, gap: 18 }}>
            <div className="flex flex-col items-center" style={{ padding: "30px 24px", borderRadius: 16, background: tint(P.brand, 0.1), border: `1px solid ${tint(P.brand, 0.22)}` }}>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: P.sub }}>TOTAL A COBRAR</p>
              <p style={{ fontSize: 60, fontWeight: 700, color: P.brand, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{usd(total)}</p>
              <p style={{ fontSize: 13, color: P.sub }}>{totals.itemCount} artículos</p>
            </div>
            {upsell.length > 0 && cart.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: P.sub, marginBottom: 8 }}>¿Algo más?</p>
                <div className="flex gap-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {upsell.map((p) => (
                    <button key={p.id} onClick={() => onAddUpsell(p)} className="apple-press text-left" style={{ padding: "9px 12px", borderRadius: 10, background: tint(P.brand, 0.08), border: `1px solid ${tint(P.brand, 0.2)}`, flexShrink: 0 }}>
                      <span className="block truncate" style={{ fontSize: 12, fontWeight: 600, maxWidth: 180 }}>{p.name}</span>
                      <span className="block" style={{ fontSize: 12, fontWeight: 700, color: P.brand }}>{usd(effectivePrice(p))}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ padding: 16, borderRadius: 16, background: "#2C2C2E" }}>
              <SectionHeader>Detalle</SectionHeader>
              <div className="flex flex-col" style={{ gap: 12 }}>
                {cart.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <span style={{ minWidth: 36, fontSize: 15, fontWeight: 700, color: P.brand }}>{item.quantity}×</span>
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-2" style={{ fontSize: 15, fontWeight: 500 }}>{item.productName}</p>
                      <p style={{ fontSize: 12, color: P.sub }}>{usd(item.unitPrice)} c/u</p>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{usd(lineTotal(item))}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 0.5, background: P.sep, margin: "14px 0" }} />
              <SaleTotals totals={totals} discountAmount={discountAmount} taxLabel={taxLabel} big />
            </div>
            <div className="flex items-center gap-3" style={{ padding: 16, borderRadius: 16, background: "#2C2C2E" }}>
              <span style={{ width: 46, height: 46, borderRadius: 999, background: tint(P.brand, 0.15), color: P.brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>
                {customer ? initials(customer.name) : <User className="w-5 h-5" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{customer ? customerDisplayName(customer) : "Cliente general"}</p>
                <p style={{ fontSize: 12, color: P.sub }}>{customer ? customer.phone || "Cliente asignado" : "Venta sin cliente asignado"}</p>
              </div>
              {customer && isVIP(customer) && <span style={{ padding: "4px 8px", borderRadius: 999, background: tint(P.vip, 0.16), color: P.vip, fontSize: 11, fontWeight: 700 }}>VIP</span>}
            </div>
            <div className="hidden lg:block"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>
          </div>
          <div className="flex flex-col" style={{ width: "100%", maxWidth: 420, borderLeft: `0.5px solid ${P.sep}` }}>
            <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 20, gap: 20 }}>
              <div>
                <SectionHeader>Método de pago</SectionHeader>
                <div className="grid grid-cols-2" style={{ gap: 8 }}>
                  {enabled.map((m) => tile(m, BUILTIN[m].label, BUILTIN[m].Icon, BUILTIN[m].color, !split && !customLabel && method === m, () => {
                    setMethod(m); setCustomLabel(null); setSplit(false); setSplits([]);
                    if (m !== "cash") setCashText("");
                  }))}
                  {custom.map((c) => {
                    const st = customMethodStyle(c.label);
                    return tile(`c-${c.id || c.label}`, c.label, st.Icon, st.color, !split && customLabel === c.label, () => { setCustomLabel(c.label); setSplit(false); setSplits([]); setCashText(""); });
                  })}
                  {tile("mixto", "Mixto", Columns2, P.brand, split, toggleSplit)}
                </div>
              </div>
              {split ? (
                <div className="flex flex-col" style={{ gap: 12 }}>
                  <div className="flex flex-col" style={{ gap: 6 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: P.sub }}>PAGOS</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: splitTotal >= total ? P.success : P.warning }}>{usd(splitTotal)} / {usd(total)}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "#3A3A3C", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${total > 0 ? Math.min(100, (splitTotal / total) * 100) : 0}%`, background: splitTotal >= total ? P.success : P.brand, borderRadius: 999 }} />
                    </div>
                    {splitRemaining > 0 ? <p style={{ fontSize: 12, color: P.warning }}>Falta: {usd(splitRemaining)}</p> : splitTotal > total ? <p style={{ fontSize: 12, color: P.success }}>Cambio: {usd(r2(splitTotal - total))}</p> : null}
                  </div>
                  {splits.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <label className="relative flex items-center gap-1.5" style={{ padding: "8px 12px", borderRadius: 999, background: "#2C2C2E" }}>
                        {(() => { const B = BUILTIN[row.method]; return B ? <B.Icon className="w-4 h-4" style={{ color: B.color }} /> : null; })()}
                        <span style={{ fontSize: 15, fontWeight: 500 }}>{BUILTIN[row.method]?.label}</span>
                        <ChevronDown className="w-3 h-3" style={{ color: P.sub }} />
                        <select value={row.method} onChange={(e) => setSplits((s) => s.map((x) => (x.id === row.id ? { ...x, method: e.target.value } : x)))}
                          className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Método de pago">
                          {enabled.map((m) => <option key={m} value={m}>{BUILTIN[m].label}</option>)}
                        </select>
                      </label>
                      <span className="flex-1" />
                      <div className="flex items-center gap-1" style={{ padding: "8px 12px", borderRadius: 8, background: "#2C2C2E" }}>
                        <span style={{ color: P.sub }}>$</span>
                        <input
                          value={row.text ?? (row.amount ? Number(row.amount).toFixed(2) : "")}
                          onChange={(e) => { const t = e.target.value; setSplits((s) => s.map((x) => (x.id === row.id ? { ...x, text: t, amount: parseMoney(t) ?? 0 } : x))); }}
                          placeholder="0.00"
                          inputMode="decimal"
                          style={{ width: 100, textAlign: "right", background: "transparent", border: "none", outline: "none", color: P.text, fontSize: 16, fontWeight: 600 }}
                        />
                      </div>
                      {splits.length > 1 && (
                        <button onClick={() => setSplits((s) => s.filter((x) => x.id !== row.id))} aria-label="Quitar este método de pago" style={{ color: P.danger }}><MinusCircle className="w-6 h-6" /></button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const used = new Set(splits.map((x) => x.method));
                      const next = enabled.find((m) => !used.has(m)) || method;
                      setSplits((s) => [...s, { id: Date.now(), method: next, amount: splitRemaining }]);
                    }}
                    aria-label="Añadir otro método de pago al split"
                    className="apple-press flex items-center justify-center gap-2"
                    style={{ padding: "10px 0", borderRadius: 12, background: tint(P.brand, 0.1), color: P.brand, fontSize: 15, fontWeight: 500 }}
                  >
                    <PlusCircle className="w-4 h-4" /> Añadir método de pago
                  </button>
                </div>
              ) : requiresAmount ? (
                <div className="flex flex-col" style={{ gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 12, color: P.sub, marginBottom: 6 }}>Cantidad recibida</p>
                    <div className="flex items-center gap-2" style={{ padding: 16, borderRadius: 12, background: "#2C2C2E" }}>
                      <span style={{ fontSize: 22, fontWeight: 600, color: P.sub }}>$</span>
                      <input autoFocus value={cashText} onChange={(e) => setCashText(e.target.value)} placeholder="0.00" inputMode="decimal"
                        onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) onFinalize(); }}
                        style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: P.text, fontSize: 28, fontWeight: 700 }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setCashText(total.toFixed(2))} className="apple-press" style={{ padding: "6px 10px", borderRadius: 999, background: P.success, color: "#fff", fontSize: 12, fontWeight: 600 }}>Exacto {usd(total)}</button>
                    {quickCashAmounts(total).map((a) => (
                      <button key={a} onClick={() => setCashText(a.toFixed(2))} className="apple-press" style={{ padding: "6px 10px", borderRadius: 999, background: "#3A3A3C", color: P.text, fontSize: 12, fontWeight: 500 }}>{usd(a)}</button>
                    ))}
                  </div>
                  {received > 0 && (
                    <div className="flex items-center justify-between" style={{ padding: 16, borderRadius: 12, background: "#2C2C2E" }}>
                      <span style={{ fontSize: 15, color: P.sub }}>{received >= total ? "Cambio:" : "Falta:"}</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: received >= total ? P.success : P.danger }}>{usd(received >= total ? r2(Math.max(0, cashChange)) : r2(total - received))}</span>
                    </div>
                  )}
                  {cashChange > 0 && <ChangeBreakdownCard change={r2(cashChange)} />}
                </div>
              ) : (
                <div className="flex items-center gap-3" style={{ padding: 16, borderRadius: 14, background: "#2C2C2E" }}>
                  {(() => {
                    const st = customLabel ? { Icon: CreditCard, color: P.vip } : BUILTIN[method];
                    return <span style={{ width: 40, height: 40, borderRadius: 10, background: tint(st.color, 0.18), color: st.color, display: "flex", alignItems: "center", justifyContent: "center" }}><st.Icon className="w-5 h-5" /></span>;
                  })()}
                  <div className="flex-1">
                    <p style={{ fontSize: 12, color: P.sub }}>Se cobrará por {methodLabel}</p>
                    <p style={{ fontSize: 22, fontWeight: 700 }}>{usd(total)}</p>
                  </div>
                  <ChevronRightCircle className="w-6 h-6" style={{ color: P.ter }} />
                </div>
              )}
              <div className="lg:hidden"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>
            </div>
            <div className="flex flex-col" style={{ gap: 10, padding: 16, background: "rgba(28,28,30,0.95)", borderTop: `0.5px solid ${P.sep}` }}>
              {qr && !split && (
                <button onClick={() => setScreen("qr")} className="apple-press flex items-center justify-center gap-2" style={{ padding: "12px 0", borderRadius: 12, background: tint(P.brand, 0.12), color: P.brand, fontSize: 16, fontWeight: 600 }}>
                  <QrCode className="w-5 h-5" /> Mostrar QR al cliente
                </button>
              )}
              <button
                onClick={onFinalize}
                disabled={!canConfirm || processing}
                className="apple-press flex items-center justify-center gap-2"
                style={{ padding: "14px 0", borderRadius: 14, background: success ? P.success : tint(P.brand, canConfirm ? 1 : 0.35), color: "#fff", fontSize: 16, fontWeight: 600 }}
              >
                {processing && !success ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {success ? "¡Cobrado!" : processing ? "Procesando..." : `Finalizar Cobro ${usd(total)}`}
              </button>
            </div>
          </div>
        </div>
      </Dialog>
      <AlertDialog
        open={largeConfirm}
        title="Transacción grande"
        message={`Esta venta supera ${usd(500)}. ¿Confirmas que es correcto?`}
        onClose={() => setLargeConfirm(false)}
        actions={[{ label: "Cancelar" }, { label: `Confirmar ${usd(total)}`, bold: true, onPress: doProcess }]}
      />
    </>
  );
}
