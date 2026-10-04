import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal, PauseCircle, Wrench, Search, PlusCircle, RefreshCw, History, ScanBarcode, Loader2, Package, Smartphone, ShoppingCart, X, Lock } from "lucide-react";
import { P, tint, Toast, AlertDialog, Dialog, TextAction } from "@/components/pos/native/posUi";
import { ProductCard, ContextMenu, Showcase, TipoChips, CategoryChips, QuickRow, SearchBar, CashClosedBanner, ContextStrip, SessionStrip } from "@/components/pos/native/Catalog";
import { CartPane, CartAdjustments, cartOfferFor } from "@/components/pos/native/Cart";
import PaymentDialog from "@/components/pos/native/PaymentDialog";
import ReceiptDialog, { ManagerPinDialog } from "@/components/pos/native/Receipt";
import { ManualItemDialog, VariantPickerDialog, CustomerSelectorDialog, HeldCartsDialog } from "@/components/pos/native/Dialogs";
import SalesHistoryDialog from "@/components/pos/native/SalesHistory";
import OrderPayDialog from "@/components/pos/native/OrderPay";
import { OpenCashSheet, CloseCashSheet } from "@/components/cash/CashSheets";
import { fetchTenant, resolveCurrentEmployee } from "@/lib/orderDetailApi";
import { SkeletonCards } from "@/components/ui/Skeleton";
import ScannerDialog from "@/components/pos/native/ScannerDialog";
import PunchGateSheet from "@/components/punch/PunchGateSheet";
import { fetchOpenEntry, matchIdsFor, currentAuthUid, isFromEarlierDay, requiresAutomaticClose } from "@/lib/punchApi";
import { safeTZ } from "@/lib/finance/tz";
import { isPlanTeamOrAbove } from "@/lib/tenantSettings";
import { canCloseCashRegister, isAdminOrOwner, fetchOpenRegister, subscribeToRegisters } from "@/lib/cashRegisterApi";
import {
  loadCatalog, loadProducts, recordPosSale, confirmRegisterStillOpen, RegisterClosedError, addLoyaltyPoints, deductStockForSale,
  restoreStockForSale, voidSaleRow, insertRefundTransaction, fetchCustomer,
} from "@/lib/posApi";
import {
  r2, usd, cartTotals, tenantTaxRate, taxRateLabel, posRecibo, newLineId, filterCatalog, categoriesFor, offerResolution,
  effectiveUnitPrice, isActive,
} from "@/lib/posLogic";
import { methodLabelFor } from "@/components/pos/native/PaymentDialog";

function storedTenantId() {
  try {
    return localStorage.getItem("smartfix_tenant_id") || "";
  } catch {
    return "";
  }
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function validCart(v) {
  return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isFinite(Number(i.quantity)) && Number.isFinite(Number(i.unitPrice))) : [];
}

function idList(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function writeJSON(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function useMedia(q) {
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setV(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return v;
}

export default function POS() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMedia("(min-width: 768px)");
  const isWideDesktop = useMedia("(min-width: 1024px)");
  const tenantId = storedTenantId();

  const [tenant, setTenant] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState({});
  const [offers, setOffers] = useState([]);
  const [register, setRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [cart, setCart] = useState(() => (tenantId ? validCart(readJSON(`pos_cart_${tenantId}`, [])) : []));
  const [recents, setRecents] = useState(() => (tenantId ? idList(readJSON(`pos_recents_${tenantId}`, [])) : []));
  const [pinned, setPinned] = useState(() => (tenantId ? idList(readJSON(`pos_pinned_${tenantId}`, [])) : []));
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [redeemedPoints, setRedeemedPoints] = useState(0);
  const [customer, setCustomer] = useState(null);
  const [notes, setNotes] = useState("");
  const [heldCarts, setHeldCarts] = useState([]);
  const [session, setSession] = useState({ count: 0, total: 0, cash: 0, card: 0, ath: 0 });

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState("accessory");
  const [category, setCategory] = useState(null);

  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(null);
  const [showcase, setShowcase] = useState(null);
  const [outOfStock, setOutOfStock] = useState(null);
  const [variantProduct, setVariantProduct] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [punchGate, setPunchGate] = useState(false);
  const [authUid, setAuthUid] = useState(null);
  const punchChecked = useRef(false);
  const [pendingDiscount, setPendingDiscount] = useState(null);
  const [discountNonce, setDiscountNonce] = useState(0);
  const [lastSale, setLastSale] = useState(null);
  const lastDeltasRef = useRef({});
  const toastTimer = useRef(null);
  const searchRef = useRef(null);

  const isAdmin = isAdminOrOwner(employee);
  const taxRate = tenantTaxRate(tenant);
  const taxLabel = taxRateLabel(tenant);
  const totals = useMemo(() => cartTotals({ cart, taxEnabled, discountAmount, customer }), [cart, taxEnabled, discountAmount, customer]);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => { if (tenantId) writeJSON(`pos_cart_${tenantId}`, cart.length ? cart : null); }, [cart, tenantId]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchText), searchText ? 250 : 0);
    return () => clearTimeout(t);
  }, [searchText]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const c = await loadCatalog(tenantId);
      setProducts(c.products);
      setVariants(c.variants);
      setOffers(c.offers);
      setRegister(c.register);
    } catch (e) {
      setLoadError(e?.message || String(e));
    }
    setLoading(false);
  }, [tenantId]);

  const silentReload = useCallback(async () => {
    const rows = await loadProducts(tenantId).catch(() => null);
    if (rows) setProducts(rows);
  }, [tenantId]);

  const lastProductsAt = useRef(Date.now());
  useEffect(() => {
    if (!tenantId) return undefined;
    const refreshIfStale = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastProductsAt.current < 5000) return;
      lastProductsAt.current = Date.now();
      silentReload();
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    return () => { document.removeEventListener("visibilitychange", refreshIfStale); window.removeEventListener("focus", refreshIfStale); };
  }, [tenantId, silentReload]);

  const refreshRegister = useCallback(async () => {
    const r = await fetchOpenRegister(tenantId).catch(() => undefined);
    if (r !== undefined) setRegister(r);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    load();
    fetchTenant(tenantId).then(setTenant).catch(() => {});
    resolveCurrentEmployee(tenantId).then(setEmployee).catch(() => {});
  }, [tenantId, load]);

  useEffect(() => {
    if (!tenantId) return undefined;
    const off = subscribeToRegisters(tenantId, refreshRegister);
    const onChanged = () => refreshRegister();
    window.addEventListener("cash-register-changed", onChanged);
    return () => { off(); window.removeEventListener("cash-register-changed", onChanged); };
  }, [tenantId, refreshRegister]);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("customer");
    if (!id || !tenantId) return;
    fetchCustomer(tenantId, id).then((c) => { if (c) setCustomer(c); }).catch(() => {});
  }, [location.search, tenantId]);

  const filtered = useMemo(() => filterCatalog({ products, tipo, category, query }), [products, tipo, category, query]);
  const categories = useMemo(() => categoriesFor(products, tipo), [products, tipo]);
  const offersById = useMemo(() => {
    const map = {};
    filtered.forEach((p) => { const r = offerResolution(p, offers); if (r) map[p.id] = r; });
    return map;
  }, [filtered, offers]);
  const cartIndex = useMemo(() => {
    const m = {};
    cart.forEach((i) => { if (i.productId) m[i.productId] = (m[i.productId] || 0) + i.quantity; });
    return m;
  }, [cart]);
  const quantityFor = (p) => cartIndex[p.id] || 0;
  const activeById = useMemo(() => {
    const m = {};
    products.forEach((p) => { if (isActive(p)) m[p.id] = p; });
    return m;
  }, [products]);
  const recentProducts = recents.map((id) => activeById[id]).filter(Boolean);
  const pinnedProducts = pinned.map((id) => activeById[id]).filter(Boolean);
  const hasOutOfStock = cart.some((i) => i.productId && products.find((p) => p.id === i.productId && Number(p.stock) === 0 && p.stock !== null && p.stock !== ""));

  const bumpRecent = (id) => {
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 5);
      writeJSON(`pos_recents_${tenantId}`, next);
      return next;
    });
  };

  const togglePin = (product) => {
    setPinned((prev) => {
      const next = prev.includes(product.id) ? prev.filter((x) => x !== product.id) : [product.id, ...prev];
      writeJSON(`pos_pinned_${tenantId}`, next);
      return next;
    });
  };

  const addToCart = (product) => {
    const vars = variants[product.id];
    if (vars && vars.length) { setVariantProduct(product); return; }
    const rate = product.taxable !== false ? taxRate : 0;
    const unit = effectiveUnitPrice(product, offers);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === product.id && !i.variantId);
      if (idx >= 0) return prev.map((i, k) => (k === idx ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { id: newLineId(), productId: product.id, productName: product.name, quantity: 1, unitPrice: unit, taxRate: rate, discountPercent: 0, variantId: null }];
    });
    bumpRecent(product.id);
  };

  const addVariant = (product, variant) => {
    const rate = product.taxable !== false ? taxRate : 0;
    const unit = variant.price !== null && variant.price !== undefined && variant.price !== "" ? Number(variant.price) : effectiveUnitPrice(product, offers);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.variantId === variant.id);
      if (idx >= 0) return prev.map((i, k) => (k === idx ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { id: newLineId(), productId: product.id, productName: `${product.name} — ${variant.label}`, quantity: 1, unitPrice: unit, taxRate: rate, discountPercent: 0, variantId: variant.id }];
    });
    bumpRecent(product.id);
  };

  const addManual = ({ name, price, quantity, taxable }) => {
    setCart((prev) => [...prev, { id: newLineId(), productId: null, productName: name, quantity, unitPrice: price, taxRate: taxable ? taxRate : 0, discountPercent: 0, variantId: null }]);
  };

  const updateLine = (id, fn) => setCart((prev) => prev.map((i) => (i.id === id ? fn(i) : i)));
  const decrement = (id) => setCart((prev) => {
    const it = prev.find((i) => i.id === id);
    if (!it) return prev;
    return it.quantity <= 1 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
  });
  const removeLine = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const lineFor = (product) => cart.find((i) => i.productId === product.id);

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setRedeemedPoints(0);
    setNotes("");
    setCustomer(null);
  };

  const applyDiscount = (amount) => {
    if (!(amount > 0) || !(totals.subtotal > 0)) {
      setDiscountAmount(Math.max(0, amount || 0));
      return;
    }
    const withinLimit = Math.round((amount + totals.memberDiscount) * 100) * 100 <= Math.round(totals.subtotal * 100) * 20;
    if (isAdmin || withinLimit) setDiscountAmount(amount);
    else { setPendingDiscount(amount); setDialog("discountPin"); }
  };

  const redeem = () => {
    const points = Number(customer?.loyalty_points) || 0;
    const base = Math.max(0, totals.subtotal + totals.taxAmount - totals.memberDiscount);
    const maxDollars = Math.min(points / 100, base);
    if (!(maxDollars > 0)) return;
    const dollars = Math.floor(maxDollars * 100) / 100;
    setDiscountAmount(dollars);
    setRedeemedPoints(Math.round(dollars * 100));
  };

  const holdCart = () => {
    if (!cart.length) return;
    setHeldCarts((prev) => [{ id: newLineId(), savedAt: new Date(), items: cart, discount: discountAmount, taxEnabled, notes, customer }, ...prev].slice(0, 3));
    clearCart();
    showToast("Carrito en pausa");
  };

  const resumeCart = (held) => {
    setHeldCarts((prev) => {
      let next = prev.filter((h) => h.id !== held.id);
      if (cart.length) next = [{ id: newLineId(), savedAt: new Date(), items: cart, discount: discountAmount, taxEnabled, notes, customer }, ...next];
      return next.slice(0, 3);
    });
    setCart(held.items);
    setDiscountAmount(held.discount);
    setTaxEnabled(held.taxEnabled);
    setNotes(held.notes);
    setCustomer(held.customer);
    setDialog(null);
  };

  const handleScannedCode = (code, fromSearch = false) => {
    const trimmed = String(code || "").trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const product = products.find((p) => String(p.sku || "").toLowerCase() === lower || String(p.barcode || "").toLowerCase() === lower);
    if (product) {
      addToCart(product);
      showToast(`✓ ${product.name} añadido`);
      setSearchText("");
    } else if (!fromSearch || !/\s/.test(trimmed)) {
      if (fromSearch && filtered.length > 0) return;
      showToast(`Código "${trimmed}" no está en el catálogo`, true);
    }
  };

  const onSearchChange = (v) => {
    setSearchText(v);
    const trimmed = v.trim();
    if (trimmed.length < 4) return;
    const lower = trimmed.toLowerCase();
    const product = products.find((p) => isActive(p) && String(p.sku || "").toLowerCase() === lower);
    if (product) {
      addToCart(product);
      showToast(`✓ ${product.name} añadido`);
      setSearchText("");
    }
  };

  const processSale = async ({ payments, customLabel, split }) => {
    if (!register) throw new Error("No hay caja registradora abierta. Abre una caja antes de procesar ventas.");
    if (!tenantId) throw new Error("Sesion expirada");
    if (!cart.length) throw new Error("El carrito está vacío");
    if (!payments.length) throw new Error("Sin métodos de pago");
    const total = totals.total;
    const totalReceived = r2(payments.reduce((s, p) => s + p.amount, 0));
    let changeDue = 0;
    if (split) {
      const hasCash = payments.some((p) => p.method === "cash");
      const nonCash = r2(payments.filter((p) => p.method !== "cash").reduce((s, p) => s + p.amount, 0));
      if (!hasCash && totalReceived < total) throw new Error("El monto recibido no cubre el total");
      if (Math.round(nonCash * 100) > Math.round(total * 100)) throw new Error("Card/ATH no pueden exceder el total");
      changeDue = Math.max(0, r2(totalReceived - total));
    } else {
      changeDue = payments[0].method === "cash" && !customLabel ? Math.max(0, r2(payments[0].amount - total)) : 0;
    }
    const primary = payments.reduce((a, b) => (b.amount > a.amount ? b : a), payments[0]);
    const snapshot = {
      items: cart,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discount: totals.totalDiscount,
      total,
      method: primary.method,
      customLabel: split ? null : customLabel,
      methodLabel: !split && customLabel ? customLabel : methodLabelFor(primary.method),
      amountReceived: split ? totalReceived : primary.method === "cash" && !customLabel ? payments[0].amount : total,
      changeDue,
      customer,
      occurredAt: new Date(),
      saleId: null,
    };
    try {
      await confirmRegisterStillOpen(register);
    } catch (e) {
      if (e instanceof RegisterClosedError) refreshRegister();
      throw e;
    }
    const employeeName = employee?.full_name || "";
    const cartSnapshot = cart;
    const { saleId } = await recordPosSale({
      tenantId, register, cart, totals, payments, customLabel: split ? null : customLabel, changeDue, employeeName,
      customerId: customer?.id || null, notes: notes.trim() ? notes : null,
    });
    snapshot.saleId = saleId;
    if (customer?.id) {
      await addLoyaltyPoints(customer.id, tenantId, Math.round(total));
      if (redeemedPoints > 0) await addLoyaltyPoints(customer.id, tenantId, -redeemedPoints);
    }
    lastDeltasRef.current = {};
    deductStockForSale({ items: cartSnapshot, products, tenantId, employeeName }).then((d) => { lastDeltasRef.current = d; silentReload(); }, () => silentReload());
    setSession((s) => {
      const next = { ...s, count: s.count + 1, total: r2(s.total + total) };
      if (split) payments.forEach((p) => {
        if (p.method === "cash") next.cash = r2(next.cash + p.amount);
        else if (p.method === "card") next.card = r2(next.card + p.amount);
        else next.ath = r2(next.ath + p.amount);
      });
      else if (primary.method === "cash") next.cash = r2(next.cash + total);
      else if (primary.method === "card") next.card = r2(next.card + total);
      else next.ath = r2(next.ath + total);
      return next;
    });
    clearCart();
    const pr = posRecibo(tenant);
    if (pr.sendEmail || pr.sendWhatsApp || pr.sendPrint) {
      setLastSale(snapshot);
      setDialog("receipt");
      return { showReceipt: true };
    }
    showToast("Venta completada");
    return { showReceipt: false };
  };

  const voidLastSale = async (reason) => {
    const sale = lastSale;
    if (!sale || !register) { setDialog(null); return; }
    const employeeName = employee?.full_name || "";
    const reasonText = `Venta anulada — ${reason || "sin motivo especificado"}`;
    try {
      if (sale.saleId) await voidSaleRow({ saleId: sale.saleId, reason: reasonText, byName: employeeName, byId: employee?.id || null });
      await insertRefundTransaction({ tenantId, amount: sale.total, paymentMethod: sale.customLabel ? sale.customLabel.toLowerCase() : sale.method, description: reasonText, recordedBy: employeeName });
      restoreStockForSale({ items: sale.items, products, tenantId, employeeName, deltas: lastDeltasRef.current }).then(silentReload, silentReload);
      setSession((s) => {
        const next = { ...s, count: Math.max(0, s.count - 1), total: Math.max(0, r2(s.total - sale.total)) };
        if (sale.method === "cash") next.cash = Math.max(0, r2(next.cash - sale.total));
        else if (sale.method === "card") next.card = Math.max(0, r2(next.card - sale.total));
        else next.ath = Math.max(0, r2(next.ath - sale.total));
        return next;
      });
      setLastSale(null);
      showToast("Venta anulada");
    } catch (e) {
      showToast(`No se pudo anular: ${e?.message || e}`, true);
    }
    setDialog((d) => (d === "receipt" ? null : d));
  };

  const [punchTick, setPunchTick] = useState(0);
  useEffect(() => {
    const retry = () => { if (!punchChecked.current) setPunchTick((n) => n + 1); };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => { window.removeEventListener("online", retry); window.removeEventListener("focus", retry); };
  }, []);

  useEffect(() => {
    if (punchChecked.current || !tenantId || !tenant || !employee) return;
    if (!isPlanTeamOrAbove(tenant)) { punchChecked.current = true; return; }
    (async () => {
      try {
        const uid = await currentAuthUid();
        const ids = matchIdsFor(employee, uid);
        if (!ids.length) { punchChecked.current = true; return; }
        const open = await fetchOpenEntry(tenantId, ids);
        punchChecked.current = true;
        setAuthUid(uid);
        const tz = safeTZ(tenant.timezone);
        const stale = !!open && isFromEarlierDay(open, tz) && requiresAutomaticClose(open, tenant.settings?.business_hours, tz);
        if (!open || stale) setPunchGate(true);
      } catch {
        return;
      }
    })();
  }, [tenantId, tenant, employee, punchTick]);

  const onCashPill = () => {
    if (!canCloseCashRegister({ register, employee, tenant })) {
      showToast("Solo el dueño, un administrador o quien abrió la caja puede cerrarla.", true);
      return;
    }
    setDialog("closeCash");
  };

  const cardFor = (product) => {
    const line = lineFor(product);
    return (
      <ProductCard
        key={product.id}
        product={product}
        quantity={quantityFor(product)}
        isPinned={pinned.includes(product.id)}
        offer={offersById[product.id]}
        onAdd={() => addToCart(product)}
        onIncrement={() => line && updateLine(line.id, (i) => ({ ...i, quantity: i.quantity + 1 }))}
        onDecrement={() => line && decrement(line.id)}
        onRemove={() => line && removeLine(line.id)}
        onPin={() => togglePin(product)}
        onOutOfStock={(proceed) => setOutOfStock({ proceed })}
        onShowcase={() => setShowcase(product.id)}
        openMenu={setMenu}
      />
    );
  };

  const emptyState = (() => {
    const device = tipo === "device";
    const title = query ? "Sin resultados" : device ? "Sin dispositivos" : "Sin productos";
    const sub = query
      ? `Sin coincidencias para "${query}". Para servicios sueltos usa el menú "…" → Añadir item manual.`
      : device ? "Añade dispositivos desde Inventario y clasifícalos como 'Dispositivo'." : "Añade accesorios o dispositivos desde Ajustes → Inventario.";
    const Icon = device ? Smartphone : Package;
    return (
      <div className="flex flex-col items-center text-center" style={{ padding: "60px 20px", gap: 8 }}>
        <Icon className="w-10 h-10" style={{ color: P.ter }} />
        <p style={{ fontSize: 17, fontWeight: 600 }}>{title}</p>
        <p style={{ fontSize: 14, color: P.sub, maxWidth: 420 }}>{sub}</p>
      </div>
    );
  })();

  const openMoreMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const items = [];
    if (cart.length) items.push({ label: "Poner carrito en pausa", Icon: PauseCircle, onPress: holdCart }, { divider: true });
    items.push({ label: "Cobrar a orden existente", Icon: Wrench, onPress: () => setDialog("orderPay") });
    items.push({ label: "Buscar orden", Icon: Search, onPress: () => navigate("/Orders", { state: { focusSearch: true } }) });
    items.push({ label: "Añadir item manual", Icon: PlusCircle, onPress: () => setDialog("manual") });
    items.push({ label: "Recargar catálogo", Icon: RefreshCw, onPress: load });
    items.push({ divider: true });
    items.push({ label: "Historial de transacciones", Icon: History, onPress: () => setDialog("history") });
    if (register) items.push({ label: "Cerrar caja", Icon: Lock, onPress: onCashPill });
    setMenu({ x: r.right - 240, y: r.bottom + 6, items });
  };

  const adjustments = (
    <CartAdjustments
      resetKey={discountNonce}
      taxEnabled={taxEnabled}
      onTaxToggle={setTaxEnabled}
      taxLabel={taxLabel}
      discountAmount={discountAmount}
      onApplyDiscount={applyDiscount}
      onClearDiscount={() => setDiscountAmount(0)}
      subtotal={totals.subtotal}
      customer={customer}
      redeemedPoints={redeemedPoints}
      onRedeem={redeem}
      onClearRedeem={() => { setDiscountAmount(0); setRedeemedPoints(0); }}
      notes={notes}
      onNotes={setNotes}
    />
  );

  const cartPane = (
    <CartPane
      cart={cart}
      totals={totals}
      taxLabel={taxLabel}
      customer={customer}
      discountAmount={discountAmount}
      onCustomer={() => setDialog("customer")}
      onClear={clearCart}
      offerFor={(item) => cartOfferFor(item, products, offerResolution, offers)}
      rowProps={(item) => ({
        onIncrement: () => updateLine(item.id, (i) => ({ ...i, quantity: i.quantity + 1 })),
        onDecrement: () => decrement(item.id),
        onRemove: () => removeLine(item.id),
        onPrice: (v) => updateLine(item.id, (i) => ({ ...i, unitPrice: Math.max(0, v) })),
        onQty: (n) => updateLine(item.id, (i) => ({ ...i, quantity: Math.max(1, n) })),
        onDiscount: (v) => updateLine(item.id, (i) => ({ ...i, discountPercent: Math.max(0, Math.min(100, v)) })),
      })}
      onManualItem={() => setDialog("manual")}
      adjustments={adjustments}
      hasOutOfStock={hasOutOfStock}
      onCharge={() => setDialog("payment")}
    />
  );

  const catalog = (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {!register && !loading && <CashClosedBanner onOpen={() => setDialog("openCash")} />}
      {!isDesktop && <ContextStrip register={register} customer={customer} onCashPill={onCashPill} onCustomer={() => setDialog("customer")} onClearCustomer={() => setCustomer(null)} />}
      {!isDesktop && <SessionStrip stats={session} />}
      <SearchBar value={searchText} onChange={onSearchChange} onSubmit={() => handleScannedCode(searchText, true)} onScan={() => setDialog("scanner")} inputRef={searchRef} />
      <TipoChips tipo={tipo} onChange={(t) => { setTipo(t); setCategory(null); }} />
      <CategoryChips categories={categories} selected={category} onChange={setCategory} />
      {!isDesktop && !searchText && <QuickRow kind="favorites" products={pinnedProducts} quantityFor={quantityFor} onAdd={addToCart} />}
      {!isDesktop && !searchText && <QuickRow kind="recents" products={recentProducts} quantityFor={quantityFor} onAdd={addToCart} />}
      {loadError && <p style={{ fontSize: 13, color: P.danger }}>{loadError}</p>}
      {loading ? (
        <SkeletonCards count={8} height={170} min={150} />
      ) : filtered.length === 0 ? emptyState : (
        <div className="grid" style={{ gap: 10, gridTemplateColumns: `repeat(auto-fill, minmax(${isWideDesktop ? 180 : 150}px, 1fr))`, paddingTop: 8 }}>
          {filtered.map(cardFor)}
        </div>
      )}
    </div>
  );

  const header = (
    <div className="flex items-center justify-between" style={{ padding: "10px 0" }}>
      <button onClick={() => setDialog("scanner")} aria-label="Escanear código de barras" className="apple-press" style={{ width: 40, height: 40, borderRadius: 999, color: P.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ScanBarcode className="w-6 h-6" />
      </button>
      <p style={{ fontSize: 17, fontWeight: 600 }}>Punto de Venta</p>
      <div className="flex items-center gap-1">
        {heldCarts.length > 0 && (
          <button onClick={() => setDialog("held")} aria-label={`${heldCarts.length} carritos en pausa`} className="apple-press relative" style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: P.warning }}>
            <PauseCircle className="w-6 h-6" />
            <span className="absolute" style={{ top: 4, right: 2, minWidth: 16, height: 16, padding: "0 3px", borderRadius: 999, background: P.danger, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{heldCarts.length}</span>
          </button>
        )}
        <button onClick={openMoreMenu} aria-label="Más opciones" title="Cobrar a orden, item manual, recargar catálogo, historial" className="apple-press" style={{ width: 40, height: 40, borderRadius: 999, color: P.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="apple-type" style={{ background: P.bg, color: P.text, minHeight: "calc(100dvh - var(--app-nav-h, 0px))" }}>
      {isDesktop ? (
        <div className="flex" style={{ height: "calc(100dvh - var(--app-nav-h, 0px))" }}>
          <div className="flex-1 min-w-0 overflow-y-auto" style={{ padding: "0 20px 24px" }}>
            {header}
            {catalog}
          </div>
          <div style={{ width: "clamp(320px, 38vw, 380px)", borderLeft: `0.5px solid ${P.sep}`, flexShrink: 0 }}>{cartPane}</div>
        </div>
      ) : (
        <div style={{ padding: "0 16px 190px" }}>
          {header}
          {catalog}
          {cart.length > 0 && (
            <button onClick={() => setDialog("cart")} aria-label={`Ver carrito, ${totals.itemCount} items, total ${usd(totals.total)}`}
              className="apple-press fixed left-4 right-4 flex items-center justify-between"
              style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 0px))", zIndex: 95, padding: "16px 20px", borderRadius: 18, background: P.brand, color: "#fff", fontSize: 16, fontWeight: 700, boxShadow: `0 10px 30px ${tint(P.brand, 0.4)}` }}>
              <span className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> {totals.itemCount} items</span>
              <span>{usd(totals.total)}</span>
            </button>
          )}
        </div>
      )}

      <Dialog open={!isDesktop && dialog === "cart"} onClose={() => setDialog(null)} title={`Carrito (${totals.itemCount})`} width={560} height="90dvh" bodyPadding="0"
        leading={<TextAction onClick={() => setDialog(null)}><X className="w-5 h-5" /></TextAction>}
        trailing={cart.length ? <TextAction color="#FF453A" onClick={() => { clearCart(); setDialog(null); }}>Vaciar</TextAction> : null}>
        <div style={{ height: "100%" }}>{cartPane}</div>
      </Dialog>

      <PunchGateSheet open={punchGate} context="el Punto de Venta" tenantId={tenantId} tenant={tenant} sessionEmployee={employee} authUid={authUid} onClose={() => setPunchGate(false)} />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      {showcase && <Showcase products={filtered} offersById={offersById} startId={showcase} onClose={() => setShowcase(null)} />}
      <AlertDialog
        open={!!outOfStock}
        title="Sin stock disponible"
        message="No hay unidades en inventario para este producto."
        onClose={() => setOutOfStock(null)}
        actions={[{ label: "Continuar de todas formas", destructive: true, onPress: () => outOfStock?.proceed() }, { label: "Cancelar", bold: true }]}
      />
      <VariantPickerDialog product={variantProduct} variants={variantProduct ? variants[variantProduct.id] : []} onClose={() => setVariantProduct(null)} onPick={(v) => addVariant(variantProduct, v)} />
      <ManualItemDialog open={dialog === "manual"} onClose={() => setDialog(null)} onAdd={addManual} />
      <CustomerSelectorDialog open={dialog === "customer"} tenantId={tenantId} selected={customer} onClose={() => setDialog(null)} onSelect={setCustomer} />
      <HeldCartsDialog open={dialog === "held"} heldCarts={heldCarts} onClose={() => setDialog(null)} onResume={resumeCart} onDiscard={(h) => setHeldCarts((prev) => prev.filter((x) => x.id !== h.id))} />
      <ManagerPinDialog open={dialog === "discountPin"} reason="Autorizar descuento mayor al 20%" tenantId={tenantId} onClose={() => { setDialog(null); setPendingDiscount(null); setDiscountNonce((n) => n + 1); }}
        onAuthorized={() => { if (pendingDiscount !== null) setDiscountAmount(pendingDiscount); setPendingDiscount(null); }} />
      <PaymentDialog
        open={dialog === "payment"}
        onClose={() => setDialog((d) => (d === "payment" ? null : d))}
        cart={cart}
        totals={totals}
        discountAmount={discountAmount}
        taxLabel={taxLabel}
        customer={customer}
        tenant={tenant}
        products={products}
        onAddUpsell={addToCart}
        processSale={processSale}
      />
      <ReceiptDialog
        open={dialog === "receipt"}
        sale={lastSale}
        tenant={tenant}
        tenantId={tenantId}
        isAdmin={isAdmin}
        onDone={() => { setLastSale(null); showToast("Venta completada"); setDialog(null); }}
        onVoid={voidLastSale}
      />
      <SalesHistoryDialog open={dialog === "history"} tenantId={tenantId} tenant={tenant} isAdmin={isAdmin} employee={employee} onClose={() => setDialog(null)} />
      <OrderPayDialog open={dialog === "orderPay"} onClose={() => setDialog(null)} tenantId={tenantId} tenant={tenant} employee={employee} onPaid={(msg) => showToast(msg)} />
      <ScannerDialog open={dialog === "scanner"} onClose={() => setDialog(null)} onCode={handleScannedCode} />
      <OpenCashSheet open={dialog === "openCash"} onClose={() => setDialog(null)} tenantId={tenantId} tenant={tenant} employee={employee} onOpened={(r) => setRegister(r)} />
      <CloseCashSheet open={dialog === "closeCash"} onClose={() => setDialog(null)} register={register} tenantId={tenantId} tenant={tenant} employee={employee}
        onClosed={() => setRegister(null)} onAlreadyClosed={refreshRegister} />
      <Toast toast={toast} />
    </div>
  );
}
