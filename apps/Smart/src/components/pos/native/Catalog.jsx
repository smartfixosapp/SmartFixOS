import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Layers, BatteryMedium, Zap, Camera, SquareDashed, Cpu, Shield, Wrench, Package, XCircle, AlertTriangle, Tag, Percent, Gift,
  Pin, PinOff, PlusCircle, MinusCircle, Trash2, ShoppingCart, Images, ChevronLeft, ChevronRight, X, Search, ScanBarcode,
  LayoutGrid, Boxes, Smartphone, History, BarChart3, Lock, LockOpen, ChevronRight as Chev, UserPlus, Crown, Building2, CircleX,
} from "lucide-react";
import { P, tint } from "./posUi";
import { anchorInView } from "@/lib/viewport";
import { usd, effectivePrice, hasSavings, productThumb, TIPO_FILTERS, customerDisplayName, initials, isVIP } from "@/lib/posLogic";

function partType(name) {
  const n = String(name || "").toLowerCase();
  const has = (words) => words.some((w) => n.includes(w));
  if (has(["pantalla", "oled", "lcd", "display", "screen", "digitizer"])) return { Icon: Layers, color: P.info };
  if (has(["batería", "bateria", "battery"])) return { Icon: BatteryMedium, color: P.success };
  if (has(["puerto", "carga", "charging", "port", "hdmi", "flex"])) return { Icon: Zap, color: P.warning };
  if (has(["cámara", "camara", "camera", "lente", "lens"])) return { Icon: Camera, color: "#BF5AF2" };
  if (has(["back glass", "tapa", "cristal", "glass", "cover"])) return { Icon: SquareDashed, color: "#AC8E68" };
  if (has(["board", "logic", "microsold", "chip", "ic"])) return { Icon: Cpu, color: "#FF375F" };
  if (has(["protector", "tempered", "film", "shield"])) return { Icon: Shield, color: "#40C8E0" };
  if (has(["diagnós", "diagnos", "servicio", "instalación", "instalacion", "sistema"])) return { Icon: Wrench, color: "#63E6E2" };
  return { Icon: Package, color: P.sub };
}

const OFFER_ICON = { fixed: Tag, percent: Percent, combo: Gift };

function ContextMenu({ menu, onClose }) {
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [menu, onClose]);
  if (!menu || typeof document === "undefined") return null;
  const { left, top } = anchorInView(menu.x, menu.y, 240, menu.items.length * 44 + 12);
  return createPortal(
    <div className="fixed inset-0 z-[340]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div className="apple-type absolute" style={{ left, top, width: 240, background: "rgba(44,44,46,0.97)", backdropFilter: "blur(20px)", borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        {menu.items.map((it, i) => it.divider ? (
          <div key={`d${i}`} style={{ height: 6, background: "rgba(0,0,0,0.25)" }} />
        ) : (
          <button key={it.label} onClick={() => { onClose(); it.onPress(); }} className="w-full flex items-center justify-between apple-press" style={{ padding: "11px 14px", fontSize: 15, color: it.destructive ? "#FF453A" : P.text, borderTop: i && !menu.items[i - 1].divider ? `0.5px solid ${P.sep}` : "none" }}>
            {it.label}
            {it.Icon && <it.Icon className="w-4 h-4" />}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

function ShowcaseCard({ product, offer, onClick }) {
  const thumb = productThumb(product);
  const savings = hasSavings(offer);
  return (
    <button onClick={onClick} className="apple-press flex flex-col text-left" style={{ gap: 10, padding: 12, borderRadius: 20, background: P.card, border: savings ? `1.5px solid ${tint(P.danger, 0.5)}` : "1.5px solid transparent" }}>
      <div className="relative flex items-center justify-center" style={{ aspectRatio: "1 / 1", borderRadius: 14, background: thumb ? "#fff" : P.card2, overflow: "hidden", padding: thumb ? 10 : 0 }}>
        {thumb ? <img src={thumb} alt={product.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <Images className="w-10 h-10" style={{ color: P.ter }} />}
        {savings && <span className="absolute" style={{ top: 8, left: 8, padding: "3px 9px", borderRadius: 999, background: P.danger, color: "#fff", fontSize: 12, fontWeight: 800 }}>{offer.label || "Oferta"}</span>}
      </div>
      <p style={{ fontSize: 17, fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{product.name}</p>
      {savings ? (
        <div className="flex flex-col">
          <span style={{ fontSize: 24, fontWeight: 800, color: P.danger }}>{usd(offer.promoPrice)}</span>
          <span style={{ fontSize: 14, color: P.sub, textDecoration: "line-through" }}>{usd(effectivePrice(product))}</span>
        </div>
      ) : (
        <span style={{ fontSize: 24, fontWeight: 800, color: P.brand }}>{usd(effectivePrice(product))}</span>
      )}
    </button>
  );
}

function ShowcaseFocus({ product, offer, onBack }) {
  const urls = (Array.isArray(product.photo_urls) && product.photo_urls.length ? product.photo_urls : [product.image_url]).filter(Boolean);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const savings = hasSavings(offer);
  useEffect(() => { setZoom(1); }, [page]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setPage((v) => Math.min(urls.length - 1, v + 1));
      if (e.key === "ArrowLeft") setPage((v) => Math.max(0, v - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [urls.length]);
  const clamp = (v) => Math.max(1, Math.min(4, v));
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center" style={{ padding: "0 18px 8px" }}>
        <button onClick={onBack} aria-label="Volver al catálogo" className="apple-press" style={{ width: 40, height: 40, borderRadius: 999, background: P.card2, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft className="w-6 h-6" /></button>
      </div>
      <div className="flex-1 flex items-center justify-center relative min-h-0" style={{ padding: "0 20px" }}>
        {urls.length > 0 ? (
          <div className="flex items-center justify-center" onWheel={(e) => setZoom((z) => clamp(z - e.deltaY * 0.004))} onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))} style={{ background: "#fff", borderRadius: 24, padding: 20, width: "100%", maxWidth: 820, maxHeight: "100%", overflow: "hidden", touchAction: "pan-y" }}>
            <img src={urls[page]} alt={product.name} draggable={false} style={{ maxHeight: "calc(55dvh / var(--ui-zoom, 1))", maxWidth: "100%", objectFit: "contain", transform: `scale(${zoom})`, transition: "transform 0.15s", cursor: zoom > 1 ? "zoom-out" : "zoom-in" }} />
          </div>
        ) : (
          <div className="flex items-center justify-center" style={{ width: "100%", maxWidth: 820, height: "calc(50dvh / var(--ui-zoom, 1))", borderRadius: 24, background: P.card2 }}><Images className="w-14 h-14" style={{ color: P.ter }} /></div>
        )}
        {page > 0 && <button onClick={() => setPage(page - 1)} aria-label="Foto anterior" className="absolute left-4 apple-press" style={{ width: 44, height: 44, borderRadius: 999, background: P.card2, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft className="w-6 h-6" /></button>}
        {page < urls.length - 1 && <button onClick={() => setPage(page + 1)} aria-label="Foto siguiente" className="absolute right-4 apple-press" style={{ width: 44, height: 44, borderRadius: 999, background: P.card2, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight className="w-6 h-6" /></button>}
      </div>
      {urls.length > 1 && (
        <div className="flex items-center justify-center" style={{ gap: 6, padding: 10 }}>
          {urls.map((u, k) => <span key={u} style={{ width: 8, height: 8, borderRadius: 999, background: k === page ? "#fff" : P.ter }} />)}
        </div>
      )}
      <div className="flex flex-col items-center text-center" style={{ padding: "8px 18px 28px", gap: 4 }}>
        <p style={{ fontSize: 26, fontWeight: 800 }}>{product.name}</p>
        {savings ? (
          <div className="flex items-baseline" style={{ gap: 12 }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: P.danger }}>{usd(offer.promoPrice)}</span>
            <span style={{ fontSize: 20, color: P.sub, textDecoration: "line-through" }}>{usd(effectivePrice(product))}</span>
          </div>
        ) : <span style={{ fontSize: 46, fontWeight: 800, color: P.brand }}>{usd(effectivePrice(product))}</span>}
      </div>
    </div>
  );
}

function Showcase({ products, offersById, onClose }) {
  const [focusId, setFocusId] = useState(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (focusId) setFocusId(null); else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusId, onClose]);
  const focused = focusId ? products.find((p) => p.id === focusId) : null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[360] flex flex-col" style={{ background: "#000", color: P.text }}>
      <div className="flex items-center justify-between" style={{ padding: "16px 18px" }}>
        {focused ? <span /> : (
          <div>
            <p style={{ fontSize: 34, fontWeight: 800 }}>Catálogo</p>
            <p style={{ fontSize: 13, color: P.sub }}>{products.length} productos</p>
          </div>
        )}
        <button onClick={onClose} aria-label="Cerrar" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: P.card2, display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-5 h-5" /></button>
      </div>
      {focused ? <ShowcaseFocus key={focused.id} product={focused} offer={offersById[focused.id]} onBack={() => setFocusId(null)} /> : (
        <div className="flex-1 overflow-y-auto" style={{ padding: "0 18px 28px" }}>
          <div className="grid" style={{ gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {products.map((p) => <ShowcaseCard key={p.id} product={p} offer={offersById[p.id]} onClick={() => setFocusId(p.id)} />)}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export function ProductCard({ product, quantity, isPinned, offer, onAdd, onIncrement, onDecrement, onRemove, onPin, onOutOfStock, onShowcase, openMenu }) {
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(null);
  const holdTimer = useRef(null);
  const suppressClick = useRef(false);
  const liveOffer = !!offer && (hasSavings(offer) || offer.offerType === "combo");
  const price = hasSavings(offer) ? offer.promoPrice : effectivePrice(product);
  const thumb = productThumb(product);
  const stock = product.stock === null || product.stock === undefined || product.stock === "" ? null : Number(product.stock);
  const minStock = product.min_stock === null || product.min_stock === undefined || product.min_stock === "" ? null : Number(product.min_stock);
  const lowStock = stock !== null && minStock !== null && stock <= minStock;
  const inCart = quantity > 0;
  const { Icon, color } = partType(product.name);
  const OfferIcon = OFFER_ICON[offer?.offerType] || Tag;

  useEffect(() => () => { clearTimeout(pulseTimer.current); clearTimeout(holdTimer.current); }, []);

  const addWithPulse = () => {
    onAdd();
    setPulse(true);
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), 400);
  };

  const tap = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if ((stock ?? 1) <= 0) onOutOfStock(addWithPulse);
    else addWithPulse();
  };

  const menuItems = () => {
    const items = [];
    if (thumb) items.push({ label: "Mostrar al cliente", Icon: Images, onPress: onShowcase }, { divider: true });
    if (inCart) {
      items.push({ label: "Añadir uno", Icon: PlusCircle, onPress: onIncrement });
      items.push({ label: "Quitar uno", Icon: MinusCircle, onPress: onDecrement });
      items.push({ divider: true });
      items.push({ label: "Quitar del carrito", Icon: Trash2, onPress: onRemove, destructive: true });
    } else {
      items.push({ label: "Añadir al carrito", Icon: ShoppingCart, onPress: onAdd });
    }
    items.push({ divider: true });
    items.push({ label: isPinned ? "Quitar de favoritos" : "Fijar en favoritos", Icon: isPinned ? PinOff : Pin, onPress: onPin });
    return items;
  };

  return (
    <div className="relative">
      <button
        onClick={tap}
        onContextMenu={(e) => { e.preventDefault(); openMenu({ x: e.clientX, y: e.clientY, items: menuItems() }); }}
        onPointerDown={(e) => {
          suppressClick.current = false;
          if (e.pointerType === "mouse") return;
          const { clientX, clientY } = e;
          holdTimer.current = setTimeout(() => { suppressClick.current = true; openMenu({ x: clientX, y: clientY, items: menuItems() }); }, 500);
        }}
        onPointerUp={() => clearTimeout(holdTimer.current)}
        onPointerLeave={() => clearTimeout(holdTimer.current)}
        onPointerCancel={() => clearTimeout(holdTimer.current)}
        className="apple-press w-full text-left flex flex-col"
        aria-label={inCart ? `${product.name}, ${usd(price)}, ${quantity} en carrito` : `Añadir ${product.name} al carrito, precio ${usd(price)}`}
        style={{ gap: 8, padding: 12, minHeight: 130, height: "100%", borderRadius: 16, background: inCart ? tint(P.brand, 0.11) : P.card, border: `2px solid ${inCart ? tint(P.brand, 0.55) : "transparent"}`, WebkitTouchCallout: "none" }}
      >
        <div className="relative w-full" style={{ height: 96, borderRadius: 12, overflow: "hidden", background: thumb ? "#fff" : tint(color, 0.14), display: "flex", alignItems: "center", justifyContent: "center" }}>
          {thumb ? <img src={thumb} alt="" loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <Icon className="w-7 h-7" style={{ color }} />}
          {stock !== null && stock <= 0 && (
            <span className="absolute flex items-center gap-1" style={{ top: 6, left: 6, padding: "2px 7px", borderRadius: 999, background: tint(P.danger, 0.9), color: "#fff", fontSize: 11, fontWeight: 700 }}>
              <XCircle className="w-3 h-3" /> Sin stock
            </span>
          )}
          {stock !== null && stock > 0 && lowStock && (
            <span className="absolute flex items-center gap-1" style={{ top: 6, left: 6, padding: "2px 7px", borderRadius: 999, background: tint(P.warning, 0.9), color: "#000", fontSize: 11, fontWeight: 700 }}>
              <AlertTriangle className="w-3 h-3" /> {Math.trunc(stock)} stock
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span style={{ fontSize: 20, fontWeight: 700, color: liveOffer ? P.success : P.brand, fontVariantNumeric: "tabular-nums" }}>{usd(price)}</span>
          {hasSavings(offer) && <span className="truncate" style={{ fontSize: 12, color: P.sub, textDecoration: "line-through" }}>{usd(offer.originalPrice)}</span>}
        </div>
        {liveOffer && (
          <span className="self-start flex items-center gap-1 truncate" style={{ maxWidth: "100%", padding: "1px 6px", borderRadius: 999, background: tint(P.success, 0.15), color: P.success, fontSize: 10, fontWeight: 700 }}>
            <OfferIcon className="w-2.5 h-2.5" /> {offer.label}
          </span>
        )}
        <span className="line-clamp-2" style={{ fontSize: 15, fontWeight: 600, color: P.text }}>{product.name}</span>
      </button>
      {inCart && (
        <span className="absolute flex items-center justify-center pointer-events-none" style={{ top: -8, right: -8, minWidth: 26, height: 26, padding: "0 7px", borderRadius: 999, background: P.brand, color: "#fff", fontSize: 12, fontWeight: 700, border: "2px solid #000", transform: pulse ? "scale(1.25)" : "scale(1)", transition: "transform 0.2s" }}>
          {quantity}
        </span>
      )}
    </div>
  );
}

export { ContextMenu, Showcase };

const TIPO_ICON = { all: LayoutGrid, service: Wrench, accessory: Boxes, device: Smartphone };

export function TipoChips({ tipo, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto" style={{ paddingBottom: 2, scrollbarWidth: "none" }}>
      {TIPO_FILTERS.map((f) => {
        const on = tipo === f.id;
        const Icon = TIPO_ICON[f.id];
        return (
          <button key={f.id} onClick={() => onChange(f.id)} className="apple-press flex items-center gap-1.5 whitespace-nowrap" aria-label={`Filtrar por ${f.label}`}
            style={{ padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: on ? P.brand : P.card, color: on ? "#fff" : P.text, border: `1px solid ${on ? "transparent" : "rgba(255,255,255,0.10)"}` }}>
            <Icon className="w-3.5 h-3.5" /> {f.label}
          </button>
        );
      })}
    </div>
  );
}

export function CategoryChips({ categories, selected, onChange }) {
  if (!categories.length) return null;
  const chip = (title, isOn, onClick) => (
    <button key={title} onClick={onClick} className="apple-press whitespace-nowrap" aria-label={`Categoría ${title}`}
      style={{ padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: isOn ? tint(P.brand, 0.16) : "#2C2C2E", color: isOn ? P.brand : P.text, border: `1px solid ${isOn ? tint(P.brand, 0.45) : "rgba(255,255,255,0.08)"}` }}>
      {title}
    </button>
  );
  return (
    <div className="flex gap-2 overflow-x-auto" style={{ paddingBottom: 2, scrollbarWidth: "none" }}>
      {chip("Todas", selected === null, () => onChange(null))}
      {categories.map((c) => chip(c, selected === c, () => onChange(selected === c ? null : c)))}
    </div>
  );
}

export function QuickRow({ kind, products, quantityFor, onAdd }) {
  if (!products.length) return null;
  const fav = kind === "favorites";
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <p className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: fav ? P.vip : P.sub }}>
        {fav ? <Pin className="w-3 h-3" /> : <History className="w-3 h-3" />} {fav ? "FAVORITOS" : "RECIENTES"}
      </p>
      <div className="flex gap-2 overflow-x-auto" style={{ paddingBottom: 2, scrollbarWidth: "none" }} aria-label={fav ? "Productos favoritos fijados" : "Productos recientes"}>
        {products.map((p) => {
          const qty = quantityFor(p);
          return (
            <button key={p.id} onClick={() => onAdd(p)} className="apple-press flex items-center gap-1.5 whitespace-nowrap"
              style={{ padding: "8px 12px", borderRadius: 999, background: P.card, border: `1.5px solid ${qty > 0 ? tint(P.brand, 0.4) : "transparent"}`, fontSize: 13 }}>
              {qty > 0 && <span style={{ padding: "0 5px", borderRadius: 999, background: P.brand, color: "#fff", fontWeight: 700, fontSize: 12 }}>{qty}×</span>}
              <span style={{ fontWeight: 600, maxWidth: 200 }} className="truncate">{p.name}</span>
              <span style={{ fontWeight: 700, color: P.brand }}>{usd(effectivePrice(p))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SearchBar({ value, onChange, onSubmit, onScan, inputRef }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2" style={{ padding: "0 14px", height: 50, borderRadius: 16, background: P.card }}>
        <Search className="w-4 h-4" style={{ color: P.sub }} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSubmit(); } }}
          placeholder="Buscar producto, SKU..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: P.text, fontSize: 16 }}
        />
        {value && (
          <button onClick={() => onChange("")} aria-label="Limpiar búsqueda" style={{ color: P.ter }}><CircleX className="w-5 h-5" /></button>
        )}
      </div>
      <button onClick={onScan} aria-label="Escanear código de barras" title="Escanear código de barras" className="apple-press" style={{ width: 50, height: 50, borderRadius: 16, background: P.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ScanBarcode className="w-5 h-5" />
      </button>
    </div>
  );
}

export function CashClosedBanner({ onOpen }) {
  return (
    <button onClick={onOpen} className="apple-press w-full flex items-center gap-3 text-left" aria-label="Caja cerrada, toca para abrir"
      style={{ padding: 14, borderRadius: 16, background: tint(P.warning, 0.12), border: `1.5px solid ${tint(P.warning, 0.3)}` }}>
      <span style={{ width: 44, height: 44, borderRadius: 999, background: tint(P.warning, 0.2), color: P.warning, display: "flex", alignItems: "center", justifyContent: "center" }}><Lock className="w-5 h-5" /></span>
      <span className="flex-1">
        <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Caja cerrada</span>
        <span className="block" style={{ fontSize: 12, color: P.sub }}>Toca para abrir el turno</span>
      </span>
      <span className="flex items-center gap-1" style={{ color: P.warning, fontSize: 15, fontWeight: 600 }}>Abrir <Chev className="w-5 h-5" /></span>
    </button>
  );
}

export function ContextStrip({ register, customer, onCashPill, onCustomer, onClearCustomer }) {
  const cashPill = register ? (
    <button onClick={onCashPill} className="apple-press flex items-center gap-1.5" aria-label={`Caja abierta, balance ${usd(register.opening_balance)}`}
      style={{ padding: "7px 12px", borderRadius: 999, background: tint(P.success, 0.14), color: P.success, fontSize: 13, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: P.success }} />
      <LockOpen className="w-3 h-3" />
      {usd(register.opening_balance)}
      <Chev className="w-3 h-3" style={{ opacity: 0.6 }} />
    </button>
  ) : null;
  if (!customer) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {cashPill}
        <button onClick={onCustomer} className="apple-press flex items-center gap-1.5" aria-label="Sin cliente, toca para asignar"
          style={{ padding: "7px 12px", borderRadius: 999, background: "#2C2C2E", color: P.sub, fontSize: 13, fontWeight: 600, border: `1px dashed ${tint("#8E8E93", 0.3)}` }}>
          <UserPlus className="w-3.5 h-3.5" /> Sin cliente
        </button>
      </div>
    );
  }
  const vip = isVIP(customer);
  const color = vip ? P.vip : customer.is_b2b === true ? P.info : P.brand;
  return (
    <div className="flex flex-col gap-2">
      {cashPill && <div className="flex">{cashPill}</div>}
      <div className="flex items-center gap-2">
        <button onClick={onCustomer} className="apple-press flex-1 flex items-center gap-2 text-left" aria-label={`Cliente asignado: ${customerDisplayName(customer)}`}
          style={{ padding: "8px 12px", borderRadius: 16, background: tint(color, 0.1), border: `1px solid ${tint(color, 0.2)}` }}>
          <span style={{ width: 32, height: 32, borderRadius: 999, background: tint(color, 0.2), color, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(customer.name)}</span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1" style={{ fontSize: 15, fontWeight: 600 }}>
              <span className="truncate">{customerDisplayName(customer)}</span>
              {vip && <Crown className="w-3 h-3" style={{ color: P.vip }} />}
              {customer.is_b2b === true && <Building2 className="w-3 h-3" style={{ color: P.info }} />}
            </span>
            <span className="block truncate" style={{ fontSize: 12, color: P.sub }}>{customer.phone || "Cliente asignado"}</span>
          </span>
        </button>
        <button onClick={onClearCustomer} aria-label="Quitar cliente del carrito" className="apple-press" style={{ color: P.sub, padding: 4 }}><CircleX className="w-6 h-6" /></button>
      </div>
    </div>
  );
}

export function SessionStrip({ stats }) {
  if (!stats.count) return null;
  const sep = <span style={{ color: P.ter }}>·</span>;
  return (
    <div className="flex items-center gap-2 flex-wrap" style={{ padding: "6px 12px", borderRadius: 10, background: tint(P.success, 0.08), fontSize: 12 }}>
      <BarChart3 className="w-3.5 h-3.5" style={{ color: P.success }} />
      <span style={{ fontWeight: 600, color: P.sub }}>Sesión:</span>
      <span style={{ fontWeight: 700, color: P.success }}>{usd(stats.total)}</span>
      {sep}
      <span style={{ color: P.sub }}>{stats.count} venta{stats.count === 1 ? "" : "s"}</span>
      {stats.cash > 0 && <>{sep}<span style={{ color: P.sub }}>Ef {usd(stats.cash)}</span></>}
      {stats.card > 0 && <>{sep}<span style={{ color: P.sub }}>Tarj {usd(stats.card)}</span></>}
      {stats.ath > 0 && <>{sep}<span style={{ color: P.sub }}>ATH {usd(stats.ath)}</span></>}
    </div>
  );
}
