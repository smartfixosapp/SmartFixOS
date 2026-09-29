import { useEffect, useState } from "react";
import { ShoppingCart, Pencil, Tag, MinusCircle, PlusCircle, Plus, Percent, CircleX, Star, StickyNote, AlertTriangle, UserPlus, Crown, Building2, ChevronRight, Trash2, Gift } from "lucide-react";
import { P, tint, PromptDialog, SectionHeader, Toggle } from "./posUi";
import { usd, r2, lineTotalWithTax, lineDiscount, hasSavings, customerDisplayName, initials, isVIP, parseMoney } from "@/lib/posLogic";

export function SaleTotals({ totals, discountAmount, taxLabel, big }) {
  const row = (label, value, color) => (
    <div className="flex items-center justify-between" style={{ fontSize: 15 }}>
      <span style={{ color: P.sub }}>{label}</span>
      <span style={{ color: color || P.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {row("Subtotal", usd(totals.subtotal))}
      {row(`IVU (${taxLabel})`, usd(totals.taxAmount))}
      {totals.memberDiscount > 0 && row("Membresía básica (5%)", `-${usd(totals.memberDiscount)}`, P.success)}
      {discountAmount > 0 && row("Descuento", `-${usd(discountAmount)}`, P.success)}
      <div style={{ height: 0.5, background: P.sep }} />
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 15, fontWeight: 600 }}>Total</span>
        <span style={{ fontSize: big ? 22 : 20, fontWeight: 700, color: P.brand, fontVariantNumeric: "tabular-nums" }}>{usd(totals.total)}</span>
      </div>
    </div>
  );
}

export function CustomerPill({ customer, onTap }) {
  const vip = customer && isVIP(customer);
  return (
    <button onClick={onTap} className="apple-press w-full flex items-center gap-3 text-left" aria-label={customer ? `Cliente asignado: ${customerDisplayName(customer)}` : "Sin cliente, toca para asignar"}
      style={{ padding: 12, borderRadius: 16, background: customer ? tint(P.brand, 0.08) : "#2C2C2E", border: `1px solid ${customer ? tint(P.brand, 0.18) : "transparent"}` }}>
      {customer ? (
        <span style={{ width: 38, height: 38, borderRadius: 999, background: tint(vip ? P.vip : P.brand, 0.2), color: vip ? P.vip : P.brand, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(customer.name)}</span>
      ) : (
        <span style={{ width: 38, height: 38, borderRadius: 999, border: `1.5px dashed ${tint("#8E8E93", 0.4)}`, color: P.sub, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><UserPlus className="w-4 h-4" /></span>
      )}
      <span className="flex-1 min-w-0">
        {customer ? (
          <>
            <span className="flex items-center gap-1" style={{ fontSize: 15, fontWeight: 600 }}>
              <span className="truncate">{customerDisplayName(customer)}</span>
              {vip && <Crown className="w-3 h-3" style={{ color: P.vip }} />}
              {customer.is_b2b === true && <Building2 className="w-3 h-3" style={{ color: P.info }} />}
            </span>
            <span className="block truncate" style={{ fontSize: 12, color: P.sub }}>{customer.phone || "Cliente asignado"}</span>
          </>
        ) : (
          <>
            <span className="block" style={{ fontSize: 15, fontWeight: 500 }}>Sin cliente</span>
            <span className="block" style={{ fontSize: 12, color: P.sub }}>Toca para asignar al carrito</span>
          </>
        )}
      </span>
      <ChevronRight className="w-4 h-4" style={{ color: P.ter }} />
    </button>
  );
}

function editable(v) {
  return (Number(v) || 0).toFixed(2);
}

function pctText(v) {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function CartRow({ item, offerRes, onIncrement, onDecrement, onRemove, onPrice, onQty, onDiscount }) {
  const [prompt, setPrompt] = useState(null);
  const [hover, setHover] = useState(false);
  const hasDiscount = (Number(item.discountPercent) || 0) > 0;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {offerRes && (
        <div className="flex items-center gap-1" style={{ color: P.success, fontSize: 10, fontWeight: 700, padding: "8px 0 0" }}>
          <Gift className="w-2.5 h-2.5" /> Oferta aplicada
          <span style={{ color: P.sub, textDecoration: "line-through", fontWeight: 600 }}>{usd(offerRes.originalPrice)}</span>
        </div>
      )}
      <div className="flex items-center gap-3" style={{ padding: "8px 0" }}>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 15, fontWeight: 500 }} className="truncate">{item.productName}</p>
          <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
            <button onClick={() => setPrompt("price")} className="flex items-center gap-1" style={{ fontSize: 12, color: P.sub }}>
              <span style={{ textDecoration: hasDiscount ? "line-through" : "none" }}>{usd(item.unitPrice)}</span>
              <Pencil className="w-2.5 h-2.5" />
            </button>
            <button onClick={() => setPrompt("discount")} className="flex items-center gap-1"
              style={{ fontSize: 11, fontWeight: 600, color: hasDiscount ? P.success : P.sub, background: hasDiscount ? tint(P.success, 0.15) : "transparent", padding: "2px 6px", borderRadius: 999 }}>
              <Tag className="w-2.5 h-2.5" /> {hasDiscount ? `-${pctText(item.discountPercent)}%` : "Descuento"}
            </button>
          </div>
        </div>
        {hover ? (
          <div className="flex items-center gap-1">
            <button onClick={() => setPrompt("discount")} className="apple-press" style={{ padding: "6px 8px", borderRadius: 8, background: tint(P.success, 0.18), color: P.success, fontSize: 12, fontWeight: 600 }}>{hasDiscount ? "Editar descuento" : "Descuento"}</button>
            <button onClick={onRemove} aria-label="Eliminar" className="apple-press" style={{ padding: 6, borderRadius: 8, background: tint(P.danger, 0.18), color: P.danger }}><Trash2 className="w-4 h-4" /></button>
          </div>
        ) : null}
        <div className="flex items-center">
          <button onClick={onDecrement} aria-label="Quitar uno" className="apple-press" style={{ color: P.sub, padding: 4 }}><MinusCircle className="w-6 h-6" /></button>
          <button onClick={() => setPrompt("qty")} style={{ width: 32, textAlign: "center", fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{item.quantity}</button>
          <button onClick={onIncrement} aria-label="Añadir uno" className="apple-press" style={{ color: P.brand, padding: 4 }}><PlusCircle className="w-6 h-6" /></button>
        </div>
        <div className="flex flex-col items-end" style={{ width: 88 }}>
          <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{usd(lineTotalWithTax(item))}</span>
          {hasDiscount && <span style={{ fontSize: 9, fontWeight: 600, color: P.success }}>Ahorra {usd(lineDiscount(item))}</span>}
        </div>
      </div>
      <PromptDialog
        open={prompt === "price"}
        title="Precio unitario"
        message={`Ajusta el precio para ${item.productName}`}
        placeholder="Precio"
        initial={editable(item.unitPrice)}
        onClose={() => setPrompt(null)}
        actions={[
          { label: "Cancelar" },
          { label: "Guardar", primary: true, onPress: (v) => { const n = parseMoney(v); if (n !== null) onPrice(n); } },
        ]}
      />
      <PromptDialog
        open={prompt === "discount"}
        title="¿Cuánto % rebajamos?"
        message={`Pieza: ${item.productName} · ${usd(item.unitPrice)}\n\nEscribe SOLO el porcentaje (no el monto en $).\n50 = mitad · 100 = regalar`}
        placeholder="Ej. 50 o 100"
        inputMode="numeric"
        initial={hasDiscount ? pctText(item.discountPercent) : ""}
        onClose={() => setPrompt(null)}
        actions={[
          { label: "Cancelar" },
          { label: "Quitar", destructive: true, onPress: () => onDiscount(0) },
          { label: "Aplicar", primary: true, onPress: (v) => { const n = parseMoney(v); if (n !== null) onDiscount(n); } },
        ]}
      />
      <PromptDialog
        open={prompt === "qty"}
        title="Cantidad"
        message={`Toca el número para cambiar cuántos ${item.productName}`}
        placeholder="Cantidad"
        inputMode="numeric"
        initial={String(item.quantity)}
        onClose={() => setPrompt(null)}
        actions={[
          { label: "Cancelar" },
          { label: "Aplicar", primary: true, onPress: (v) => { const n = parseInt(v, 10); if (Number.isFinite(n) && n > 0) onQty(n); } },
        ]}
      />
    </div>
  );
}

export function CartAdjustments({ resetKey, taxEnabled, onTaxToggle, taxLabel, discountAmount, onApplyDiscount, onClearDiscount, subtotal, customer, redeemedPoints, onRedeem, onClearRedeem, notes, onNotes }) {
  const [discountText, setDiscountText] = useState(discountAmount > 0 ? discountAmount.toFixed(2) : "");
  useEffect(() => { setDiscountText(discountAmount > 0 ? discountAmount.toFixed(2) : ""); }, [discountAmount, resetKey]);
  const points = Number(customer?.loyalty_points) || 0;
  const chip = (label, color, onClick) => (
    <button key={label} onClick={onClick} className="apple-press whitespace-nowrap" style={{ padding: "5px 10px", borderRadius: 999, background: tint(color, 0.12), color, fontSize: 12, fontWeight: 600 }}>{label}</button>
  );
  const commitDiscount = () => {
    const n = parseMoney(discountText);
    onApplyDiscount(n === null ? 0 : Math.max(0, n));
  };
  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <Toggle on={taxEnabled} onChange={onTaxToggle} icon={<Percent className="w-4 h-4" style={{ color: P.sub }} />} label={`Cobrar IVU (${taxLabel})`} />
      <div>
        <p style={{ fontSize: 12, color: P.sub, marginBottom: 6 }}>Descuento rápido</p>
        <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {[10, 15, 20, 25].map((pct) => chip(`${pct}%`, P.brand, () => onApplyDiscount(r2((subtotal * pct) / 100))))}
          {[5, 10].map((amt) => chip(`$${amt}`, P.info, () => onApplyDiscount(amt)))}
          {discountAmount > 0 && <button onClick={onClearDiscount} aria-label="Quitar descuento" style={{ color: P.danger }}><CircleX className="w-4 h-4" /></button>}
        </div>
      </div>
      {points > 0 && (
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4" style={{ color: P.vip }} />
          {redeemedPoints > 0 ? (
            <>
              <span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: P.vip }}>{redeemedPoints} puntos canjeados</span>
              <button onClick={onClearRedeem} aria-label="Quitar canje" style={{ color: P.danger }}><CircleX className="w-4 h-4" /></button>
            </>
          ) : (
            <>
              <span className="flex-1">
                <span className="block" style={{ fontSize: 12, fontWeight: 600 }}>Canjear puntos</span>
                <span className="block" style={{ fontSize: 11, color: P.sub }}>{points} disponibles</span>
              </span>
              <button onClick={onRedeem} className="apple-press" style={{ padding: "5px 12px", borderRadius: 999, background: tint(P.vip, 0.15), color: P.vip, fontSize: 12, fontWeight: 600 }}>Canjear</button>
            </>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4" style={{ color: P.sub }} />
        <span className="flex-1" style={{ fontSize: 15 }}>Descuento</span>
        <input
          value={discountText}
          onChange={(e) => setDiscountText(e.target.value)}
          onBlur={commitDiscount}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          placeholder="$0.00"
          inputMode="decimal"
          style={{ width: 110, textAlign: "right", background: "transparent", border: "none", outline: "none", color: P.text, fontSize: 15 }}
        />
      </div>
      <div className="flex items-start gap-2">
        <StickyNote className="w-4 h-4" style={{ color: P.sub, marginTop: 3 }} />
        <textarea
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Notas de la venta (opcional)"
          rows={1}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: P.text, fontSize: 14, resize: "none", maxHeight: 66 }}
        />
      </div>
    </div>
  );
}

export function CartPane({ cart, totals, taxLabel, customer, onCustomer, onClear, rowProps, offerFor, onManualItem, adjustments, hasOutOfStock, onCharge, discountAmount }) {
  return (
    <div className="flex flex-col h-full" style={{ background: P.card }}>
      <div className="flex items-center gap-2" style={{ padding: "14px 16px" }}>
        <ShoppingCart className="w-5 h-5" style={{ color: P.brand }} />
        <span style={{ fontSize: 17, fontWeight: 600 }}>Carrito</span>
        {totals.itemCount > 0 && <span style={{ minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, background: P.brand, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{totals.itemCount}</span>}
        <span className="flex-1" />
        {cart.length > 0 && <button onClick={onClear} style={{ fontSize: 12, fontWeight: 600, color: P.danger }}>Limpiar</button>}
      </div>
      <div style={{ height: 0.5, background: P.sep }} />
      <div style={{ padding: "10px 16px" }}><CustomerPill customer={customer} onTap={onCustomer} /></div>
      <div style={{ height: 0.5, background: P.sep }} />
      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ padding: 24, gap: 10 }}>
          <ShoppingCart className="w-11 h-11" style={{ color: P.ter }} />
          <p style={{ fontSize: 15, color: P.sub }}>Carrito vacío</p>
          <p style={{ fontSize: 12, color: P.ter }}>Toca un producto para agregarlo</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div style={{ padding: "0 16px" }}>
            {cart.map((item) => (
              <div key={item.id} style={{ borderBottom: `0.5px solid ${P.sep}` }}>
                <CartRow item={item} offerRes={offerFor(item)} {...rowProps(item)} />
              </div>
            ))}
            <button onClick={onManualItem} className="w-full flex items-center gap-2 text-left" style={{ padding: "14px 0", fontSize: 15, color: P.brand }}>
              <Plus className="w-4 h-4" /> Añadir item manual
            </button>
          </div>
          <div style={{ height: 0.5, background: P.sep }} />
          <div style={{ padding: 16 }}>
            <SectionHeader>Ajustes</SectionHeader>
            {adjustments}
          </div>
          <div style={{ height: 0.5, background: P.sep }} />
          <div style={{ margin: "10px 16px 4px", padding: 14, borderRadius: 16, background: "#2C2C2E" }}>
            <SaleTotals totals={totals} discountAmount={discountAmount} taxLabel={taxLabel} />
          </div>
        </div>
      )}
      {hasOutOfStock && (
        <p className="flex items-center gap-1" style={{ padding: "8px 16px 0", fontSize: 12, fontWeight: 600, color: P.warning }}>
          <AlertTriangle className="w-3.5 h-3.5" /> Hay items sin stock disponible
        </p>
      )}
      <div style={{ padding: 16 }}>
        <button onClick={onCharge} disabled={cart.length === 0} aria-label={`Cobrar, total ${usd(totals.total)}`}
          className="apple-press w-full flex items-center justify-between disabled:opacity-50"
          style={{ padding: "18px 20px", borderRadius: 16, background: P.brand, color: "#fff", fontSize: 17, fontWeight: 700, boxShadow: `0 8px 24px ${tint(P.brand, 0.35)}` }}>
          <span>Cobrar</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{usd(totals.total)}</span>
        </button>
      </div>
    </div>
  );
}

export function cartOfferFor(item, products, offerResolution, offers) {
  if (!item.productId) return null;
  const product = products.find((p) => p.id === item.productId);
  if (!product) return null;
  const res = offerResolution(product, offers);
  if (!hasSavings(res)) return null;
  return Math.abs(Number(item.unitPrice) - res.promoPrice) < 0.01 ? res : null;
}
