import React, { useState, useEffect, useCallback } from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Plus, Minus, Trash2, User, AlertCircle, Loader2, Zap, LayoutGrid, X, PenLine, History } from "lucide-react";
import { toast } from "sonner";
import { calculateDiscountedPrice } from "@/components/inventory/DiscountBadge";
import { motion } from "framer-motion";

// Helper for joining class names
const cn = (...classes) => classes.filter(Boolean).join(" ");
import CustomerSelector from "../components/pos/CustomerSelector";
import CheckoutModalDesktop from "../components/pos/CheckoutModalDesktop";
import RechargeDialog from "../components/pos/RechargeDialog";
import OpenDrawerDialog from "../components/cash/OpenDrawerDialog";
import { recordSaleAndTransactions, resolveActiveTenantId } from "@/components/financial/recordSale";
import { AuditService } from "@/components/utils/auditService";
import { catalogCache } from "@/components/utils/dataCache";
import { createPageUrl } from "@/components/utils/helpers";
import { getLocalOrders, upsertLocalOrder } from "@/components/utils/localOrderCache";
import { upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";
import {
  getCachedStatus,
  subscribeToCashRegister,
  checkCashRegisterStatus
} from "@/components/cash/CashRegisterService";
import UniversalPrintDialog from "../components/printing/UniversalPrintDialog";
import POSSaleActionsModal, { POSSaleHistoryModal } from "../components/pos/POSSaleActionsModal";
import { callJENAI } from "@/lib/jenaiEngine";
import JENAIInsightBanner from "@/components/jenai/JENAIInsightBanner";

const RECENT_CREATED_PRODUCTS_KEY = "smartfix_recent_created_products";

function readRecentCreatedProducts() {
  try {
    const raw = localStorage.getItem(RECENT_CREATED_PRODUCTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry?.item?.id)
      .map((entry) => entry.item);
  } catch {
    return [];
  }
}

function dedupeById(list = []) {
  const normalize = (v) => String(v || "").trim().toLowerCase();
  const toPrice = (v) => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  };
  const kindOf = (item) => {
    if (item?.duration_minutes || item?.part_type === "servicio" || item?.tipo_principal === "servicios") return "service";
    return "product";
  };
  const identityOf = (item) => {
    const kind = kindOf(item);
    const sku = normalize(item?.sku || item?.codigo);
    if (sku) return `${kind}|sku|${sku}`;
    const name = normalize(item?.name);
    const type = normalize(item?.tipo_principal || item?.subcategoria || item?.part_type);
    const price = toPrice(item?.price);
    return `${kind}|name|${name}|${type}|${price}`;
  };
  const scoreOf = (item) => {
    let score = 0;
    if (item?.active !== false) score += 2;
    if (item?.updated_date) score += 1;
    const id = String(item?.id || "");
    if (id && !id.startsWith("local-")) score += 2;
    return score;
  };

  const byIdentity = new Map();
  for (const item of list) {
    if (!item) continue;
    const key = identityOf(item);
    const prev = byIdentity.get(key);
    if (!prev || scoreOf(item) >= scoreOf(prev)) {
      byIdentity.set(key, item);
    }
  }
  return Array.from(byIdentity.values());
}

function isLikelyTransportError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    error instanceof SyntaxError ||
    error instanceof TypeError ||
    msg.includes("unrecognized token '<'") ||
    msg.includes("unexpected token '<'") ||
    msg.includes("json parse error") ||
    msg.includes("<!doctype") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("network")
  );
}

function toCurrencyNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function POSDesktop() {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [showOpenDrawerModal, setShowOpenDrawerModal] = useState(false);
  const [currentDrawer, setCurrentDrawer] = useState(() => getCachedStatus().drawer);
  const [loadingDrawer, setLoadingDrawer] = useState(() => !getCachedStatus().isInitialized);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [cashReceived, setCashReceived] = useState("");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitAthAmount, setSplitAthAmount] = useState("");
  const [athMovilPhone, setAthMovilPhone] = useState("");
  const [athMovilName, setAthMovilName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0.115);
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState({
    cash: true,
    card: true,
    ath_movil: true
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("regular");
  const [totalPaid, setTotalPaid] = useState(0);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [showManualItem, setShowManualItem] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", price: "", qty: "1" });
  const [showSaleActions, setShowSaleActions] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [completedOrderId, setCompletedOrderId] = useState(null);
  const [showSaleHistory, setShowSaleHistory] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const hasShownInventoryOfflineToast = React.useRef(false);
  const [aiPriceSuggestion, setAiPriceSuggestion] = useState("");
  const [aiPriceLoading, setAiPriceLoading] = useState(false);

  // URL params — leído una vez con useMemo, location.search no cambia mientras estamos en POS
  const { workOrderId, urlPaymentMode, urlBalance } = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const wId = params.get("workOrderId");
    const cleanId = (wId === "undefined" || wId === "null" || !wId) ? null : wId;
    return {
      workOrderId: cleanId,
      urlPaymentMode: params.get("mode") || "full",
      urlBalance: parseFloat(params.get("balance") || "0") || 0
    };
  }, [location.search]);

  const hydrateWorkOrder = useCallback(async (order, extraState = null) => {
    if (!order?.id) return;
    const paid = Number(order.total_paid || order.amount_paid || 0);
    setTotalPaid(paid);
    setSelectedOrder(order);
    setPaymentMode(extraState?.paymentMode || urlPaymentMode);

    // PRIORITIZAMOS los items del state si existen, si no order_items, si no reconstruimos de tasks/parts
    let itemsToLoad = [];
    if (Array.isArray(extraState?.items) && extraState.items.length > 0) {
      itemsToLoad = extraState.items;
    } else if (Array.isArray(order.order_items) && order.order_items.length > 0) {
      itemsToLoad = order.order_items;
    } else {
      const tasks = Array.isArray(order.repair_tasks) ? order.repair_tasks : [];
      const parts = Array.isArray(order.parts_needed) ? order.parts_needed : [];
      itemsToLoad = [
        ...tasks.map(t => ({ ...t, name: t.description || t.name, price: t.cost || t.price, type: 'service' })),
        ...parts.map(p => ({ ...p, name: p.name, price: p.price, type: 'product' }))
      ];
    }

    console.log("[POS] 💧 hydrateWorkOrder called with:", { orderId: order?.id, itemsCount: itemsToLoad.length });
    setCart(itemsToLoad.map((item) => ({
      id: item.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: item.name || item.description || "Articulo",
      price: toCurrencyNumber(item.price || item.cost || 0),
      cost: toCurrencyNumber(item.cost_price || item.labor_cost || item.line_cost || item.cost || 0),
      quantity: item.qty || item.quantity || 1,
      type: item.type || (item.duration_minutes ? "service" : "product"),
      taxable: item.taxable !== false && item.tax_exempt !== true
    })));

    // Cliente: Prioridad state, luego campos de la orden
    const stateCustomer = extraState?.customer;
    if (stateCustomer?.name || order.customer_name) {
      setSelectedCustomer({
        id: stateCustomer?.id || order.customer_id || null,
        name: stateCustomer?.name || order.customer_name || "",
        phone: stateCustomer?.phone || order.customer_phone || order.phone || "",
        email: stateCustomer?.email || order.customer_email || order.email || "",
      });
      // Si tenemos ID pero falta info, intentamos traer full desde DB
      const targetCustomerId = stateCustomer?.id || order.customer_id;
      if (targetCustomerId && (!stateCustomer?.email && !order.customer_email)) {
        try {
          const customer = await dataClient.entities.Customer.get(targetCustomerId);
          if (customer?.id) setSelectedCustomer(customer);
        } catch (e) {
          console.error("Error loading customer:", e);
        }
      }
    }
    // Abrir modal DESPUÉS de que la orden está cargada
    setShowPaymentModal(true);
  }, [urlPaymentMode]);

  const fetchPriceSuggestion = async (serviceName) => {
    if (!serviceName || serviceName.trim().length < 3) return;
    setAiPriceLoading(true);
    setAiPriceSuggestion("");
    try {
      const prompt = `Eres un experto en precios de talleres de reparación de dispositivos electrónicos en Puerto Rico / Estados Unidos.
El técnico quiere cobrar por: "${serviceName}"

Sugiere un precio justo en USD basado en el mercado actual. Responde SOLO con:
- Precio sugerido: $XX - $XX
- Justificación: una línea breve

Máximo 30 palabras en total.`;
      const text = await callJENAI(prompt, { maxTokens: 80 });
      setAiPriceSuggestion(text);
    } catch(err) {
      setAiPriceSuggestion("");
    } finally {
      setAiPriceLoading(false);
    }
  };

  // ── Startup: inventario + cajón + config + carga de orden ─────────────────
  // Effect único que corre UNA SOLA VEZ al montar. No hay setTimeout, no hay
  // dependencias reactivas que lo re-disparen mientras estamos en POS.
  useEffect(() => {
    setActiveCategory("all");
    loadInventory();
    loadPaymentMethods();
    loadTaxRate();

    const unsubscribe = subscribeToCashRegister(({ drawer, isInitialized }) => {
      setCurrentDrawer(drawer || null);
      if (isInitialized) setLoadingDrawer(false);
    });

    const status = getCachedStatus();
    let safetyTimer = null;
    if (status.isInitialized) {
      setLoadingDrawer(false);
      setCurrentDrawer(status.drawer || null);
    } else {
      setLoadingDrawer(true);
      checkCashRegisterStatus().finally(() => setLoadingDrawer(false));
      safetyTimer = setTimeout(() => setLoadingDrawer(false), 5000);
    }

    // ── Carga de orden desde URL ──────────────────────────────────────────
    // Leemos workOrderId y location.state del closure al montar — son estables
    if (workOrderId) {
      const navState = location.state || {};
      const stateOrder = navState.workOrder || navState.order || null;
      const navMode = navState.paymentMode || urlPaymentMode;

      (async () => {
        try {
          let order = null;

          // Fast path: usar la orden que viene en el state de navegación
          if (stateOrder?.id && String(stateOrder.id) === String(workOrderId)) {
            order = stateOrder;
          } else {
            // Fetch desde DB — intento primero con dataClient, luego supabase directo
            try {
              order = await dataClient.entities.Order.get(workOrderId);
            } catch {}
            if (!order?.id) {
              try {
                const tenantId = localStorage.getItem("smartfix_tenant_id") || null;
                let q = supabase.from("order").select("*, repair_tasks(*), parts_needed(*), order_items").eq("id", workOrderId).limit(1);
                if (tenantId) q = q.eq("tenant_id", tenantId);
                const { data } = await q.maybeSingle();
                order = data || null;
              } catch {}
            }
          }

          if (!order?.id) {
            toast.error("No se encontró la orden");
            return;
          }

          const paid = Number(order.total_paid || order.amount_paid || 0);
          setTotalPaid(paid);
          setSelectedOrder(order);
          setPaymentMode(navMode);

          // Items — prioridad: state de navegación → order_items → tasks+parts
          const rawItems = navState.items?.length
            ? navState.items
            : order.order_items?.length
              ? order.order_items
              : [
                  ...(order.repair_tasks || []).map(t => ({ id: t.id, name: t.name || t.description || 'Servicio', price: t.cost || 0, cost: t.labor_cost || 0, type: 'service', taxable: t.taxable !== false, quantity: 1 })),
                  ...(order.parts_needed || []).map(p => ({ id: p.id, name: p.name || 'Parte', price: p.price || 0, cost: p.cost_price || 0, type: 'product', taxable: p.taxable !== false, quantity: p.quantity || 1 })),
                ];

          setCart(rawItems.map(item => ({
            id: item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: item.name || item.description || "Artículo",
            price: toCurrencyNumber(item.price || item.cost || 0),
            cost: toCurrencyNumber(item.cost_price || item.labor_cost || item.cost || 0),
            quantity: item.qty || item.quantity || 1,
            type: item.type || (item.duration_minutes ? "service" : "product"),
            taxable: item.taxable !== false && item.tax_exempt !== true,
          })));

          // Cliente — prioridad: state de navegación → campos de la orden
          const cust = navState.customer;
          setSelectedCustomer({
            id: cust?.id || order.customer_id || null,
            name: cust?.name || order.customer_name || "",
            phone: cust?.phone || order.customer_phone || "",
            email: cust?.email || order.customer_email || "",
          });

          // Abrir modal de pago inmediatamente
          setShowPaymentModal(true);
        } catch (err) {
          console.error("[POS] Error cargando orden:", err);
          toast.error("Error al cargar la orden");
        }
      })();
    }

    return () => {
      unsubscribe();
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWorkOrderById = useCallback(async (orderId) => {
    if (!orderId) return null;

    // Bypass local cache to ensure we get the latest items/status
    /*
    try {
      const localOrder = getLocalOrders().find((order) => String(order?.id || "") === String(orderId));
      if (localOrder?.id) return localOrder;
    } catch {}
    */

    try {
      const order = await dataClient.entities.Order.get(orderId);
      if (order?.id) return order;
    } catch (error) {
      console.warn("[POSDesktop] dataClient get failed:", error);
    }

    try {
      const tenantId = localStorage.getItem("smartfix_tenant_id") || null;
      let query = supabase
        .from("order")
        .select("*, repair_tasks(*), parts_needed(*), order_items")
        .eq("id", orderId)
        .limit(1);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (data?.id) return data;
    } catch (error) {
      console.warn("[POSDesktop] supabase fallback failed:", error);
    }

    return null;
  }, []);

  const checkCashDrawerStatus = async () => {
    setLoadingDrawer(true);
    try {
      const status = await checkCashRegisterStatus();
      setCurrentDrawer(status?.drawer || null);
    } catch (error) {
      console.error("Error checking drawer:", error);
    } finally {
      setLoadingDrawer(false);
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      let prods = null;
      let servs = null;

      try {
        [prods, servs] = await Promise.all([
          dataClient.entities.Product.list("-created_date", 200),
          dataClient.entities.Service.list("-created_date", 100)
        ]);
        // Filtrar inactivos en cliente (evita que active=NULL rompa el filtro en DB)
        prods = (prods || []).filter((p) => p?.active !== false);
        servs = (servs || []).filter((s) => s?.active !== false);
      } catch (primaryError) {
        const [prodsList, servsList] = await Promise.all([
          dataClient.entities.Product.list("-created_date", 400).catch(() => null),
          dataClient.entities.Service.list("-created_date", 200).catch(() => null)
        ]);
        if (Array.isArray(prodsList) || Array.isArray(servsList)) {
          prods = Array.isArray(prodsList) ? prodsList.filter((p) => p?.active !== false) : [];
          servs = Array.isArray(servsList) ? servsList.filter((s) => s?.active !== false) : [];
        } else {
          throw primaryError;
        }
      }

      const cachedProducts = catalogCache.get("pos-active-products") || [];
      const cachedServices = catalogCache.get("pos-active-services") || [];
      const recentCreated = readRecentCreatedProducts();
      const recentProducts = recentCreated.filter((i) => i.part_type !== "servicio" && i.tipo_principal !== "servicios");
      const recentServices = recentCreated.filter((i) => i.part_type === "servicio" || i.tipo_principal === "servicios");
      const serverProducts = prods || [];
      const serverServices = servs || [];
      const nextProducts = dedupeById([
        ...recentProducts.filter((p) => p?.id && !serverProducts.some((s) => s.id === p.id)),
        ...cachedProducts.filter((p) => p?.id && !serverProducts.some((s) => s.id === p.id)),
        ...serverProducts
      ]);
      const nextServices = dedupeById([
        ...recentServices.filter((p) => p?.id && !serverServices.some((s) => s.id === p.id)),
        ...cachedServices.filter((p) => p?.id && !serverServices.some((s) => s.id === p.id)),
        ...serverServices
      ]);
      setProducts(nextProducts);
      setServices(nextServices);
      catalogCache.set("pos-active-products", nextProducts);
      catalogCache.set("pos-active-services", nextServices);
    } catch (error) {
      console.error("Error loading inventory:", error);
      const cachedProducts = catalogCache.get("pos-active-products") || [];
      const cachedServices = catalogCache.get("pos-active-services") || [];
      const recentCreated = readRecentCreatedProducts();
      const recentProducts = recentCreated.filter((i) => i.part_type !== "servicio" && i.tipo_principal !== "servicios");
      const recentServices = recentCreated.filter((i) => i.part_type === "servicio" || i.tipo_principal === "servicios");
      setProducts(dedupeById([
        ...recentProducts.filter((p) => p?.id && !cachedProducts.some((c) => c.id === p.id)),
        ...cachedProducts
      ]));
      setServices(dedupeById([
        ...recentServices.filter((p) => p?.id && !cachedServices.some((c) => c.id === p.id)),
        ...cachedServices
      ]));
      if (isLikelyTransportError(error)) {
        if (!hasShownInventoryOfflineToast.current) {
          toast.warning("Sin conexión al inventario. Mostrando datos guardados.");
          hasShownInventoryOfflineToast.current = true;
        }
      } else {
        toast.error("Error cargando inventario");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "payment-methods" });
      if (configs?.length) {
        setEnabledPaymentMethods((prev) => ({ ...prev, ...configs[0].payload }));
      }
    } catch (error) {
      console.error("Error loading payment methods:", error);
    }
  };

  const loadTaxRate = async () => {
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length && configs[0].payload?.tax_rate) {
        setTaxRate(configs[0].payload.tax_rate / 100);
      }
    } catch (error) {
      console.error("Error loading tax rate:", error);
    }
  };

  const loadWorkOrder = async () => {
    if (!workOrderId) return;
    try {
      const order = await fetchWorkOrderById(workOrderId);
      if (order) {
        await hydrateWorkOrder(order);
      } else {
        toast.error("No se encontró la orden para cobrar");
      }
    } catch (error) {
      console.error("Error loading work order:", error);
      toast.error("Error cargando orden");
    }
  };

  const addToCart = useCallback((item, type) => {
    const existingIndex = cart.findIndex((i) => i.id === item.id && i.type === type);
    const finalPrice = toCurrencyNumber(type === "product" ? calculateDiscountedPrice(item) : item.price);

    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
      toast.success(`${item.name} x${updated[existingIndex].quantity}`);
    } else {
      setCart([...cart, {
        id: item.id,
        name: item.name,
        price: finalPrice,
        cost: toCurrencyNumber(item.cost),
        quantity: 1,
        type,
        stock: item.stock,
        taxable: item.taxable !== false
      }]);
      toast.success(`✅ ${item.name}`);
    }
  }, [cart]);

  const updateQuantity = (index, delta) => {
    const updated = [...cart];
    updated[index].quantity = Math.max(1, updated[index].quantity + delta);
    if (updated[index].quantity < 1) removeItem(index);
    else setCart(updated);
  };

  const removeItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setSelectedOrder(null);
    setPaymentMethod(null);
    setCashReceived("");
    setSplitCashAmount("");
    setSplitAthAmount("");
    setAthMovilPhone("");
    setAthMovilName("");
    setDepositAmount("");
    setPaymentMode("regular");
    // Don't clear print data yet if we are about to print
    if (!showPrintDialog) {
      setPrintData(null);
    }
    toast.info("Carrito vaciado");
  };

  const safeCart = (Array.isArray(cart) ? cart : []).filter((item) => item && typeof item === "object");
  const subtotal = safeCart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  const taxableSubtotal = safeCart.reduce((sum, item) => sum + (item.taxable !== false ? Number(item.price || 0) * Number(item.quantity || 0) : 0), 0);
  const tax = taxEnabled ? taxableSubtotal * taxRate : 0;
  const total = subtotal + tax;
  const orderTotal = selectedOrder
    ? toCurrencyNumber(
        selectedOrder.total ??
        selectedOrder.grand_total ??
        selectedOrder.total_amount ??
        selectedOrder.cost_estimate ??
        0
      )
    : 0;
  const orderBalance = selectedOrder
    ? Math.max(
        0,
        parseFloat(
          toCurrencyNumber(
            selectedOrder.balance_due != null && Number(selectedOrder.balance_due) > 0
              ? selectedOrder.balance_due
              : (orderTotal - totalPaid) > 0
                ? (orderTotal - totalPaid)
                : urlBalance > 0
                  ? urlBalance
                  : 0
          ).toFixed(2)
        )
      )
    : 0;
  const effectiveTotal = selectedOrder ? (paymentMode === "deposit" ? Math.min(parseFloat(depositAmount) || 0, orderBalance) : orderBalance) : total;
  const mixedCash = parseFloat(splitCashAmount) || 0;
  const mixedAth = parseFloat(splitAthAmount) || 0;
  const mixedTotal = mixedCash + mixedAth;
  const change = paymentMethod === "cash" && cashReceived ? Math.max(0, parseFloat(cashReceived) - effectiveTotal) : 0;
  const hasAthMeta = !!String(athMovilPhone || "").trim() || !!String(athMovilName || "").trim();
  // We make it optional, so its essentially always valid regarding meta if it's ath movil?
  // User says "obligación que sea algo opcional" -> so it can be empty.
  const athMetaValid = true; 


  const isPaymentValid = selectedOrder ?
    (paymentMode === "deposit" ? (parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= orderBalance && paymentMethod) :
    (paymentMethod === "cash" ? parseFloat(cashReceived) >= effectiveTotal :
    paymentMethod === "ath_movil" ? athMetaValid :
    paymentMethod === "mixed" ? (mixedTotal >= effectiveTotal && (!mixedAth || athMetaValid)) :
    paymentMethod ? true : false)) :
    (paymentMethod === "cash" ? parseFloat(cashReceived) >= total :
    paymentMethod === "ath_movil" ? athMetaValid :
    paymentMethod === "mixed" ? (mixedTotal >= total && (!mixedAth || athMetaValid)) :
    paymentMethod ? true : false);

  // Piezas (subcategoria === "piezas_servicios") NO se venden en POS — son para reparaciones internas
  // Solo accesorios y dispositivos completos — sin piezas de reparación ni servicios
  const sellableProducts = products.filter(p =>
    p.tipo_principal === "accesorios" ||
    (p.tipo_principal === "dispositivos" && p.subcategoria === "dispositivo_completo")
  );

  const getFilteredItems = useCallback(() => {
    let items = [];
    const q = searchQuery.toLowerCase();

    if (activeCategory === "all") {
      items = sellableProducts.map((item) => ({ ...item, _type: "product" }));
    } else if (activeCategory === "accesorios") {
      items = sellableProducts.filter(p => p.tipo_principal === "accesorios").map(item => ({...item, _type: 'product'}));
    } else if (activeCategory === "devices") {
      items = sellableProducts.filter(p => p.tipo_principal === "dispositivos").map(item => ({...item, _type: 'product'}));
    } else if (activeCategory === "offers") {
      items = sellableProducts.filter(p => p.discount_active && p.discount_percentage > 0).map(item => ({...item, _type: 'product'}));
    }

    if (q) {
      items = items.filter(item =>
        (item.name || "").toLowerCase().includes(q) ||
        (item.sku || "").toLowerCase().includes(q)
      );
    }

    return items.slice(0, 200);
  }, [products, activeCategory, searchQuery]);

  const filteredItems = getFilteredItems();

  const handlePayment = async () => {
    if (!isPaymentValid || safeCart.length === 0) {
      toast.error("Valida los datos de pago");
      return;
    }

    if (!currentDrawer) {
      toast.error("⚠️ Abre la caja primero");
      setShowPaymentModal(false);
      return;
    }

    setProcessing(true);
    try {
      let me = null;
      try { me = await dataClient.auth.me(); } catch {}

      const amountPaid = paymentMode === "deposit" ? parseFloat(depositAmount) : 
                         (paymentMethod === "cash" ? parseFloat(cashReceived) :
                         paymentMethod === "mixed" ? mixedTotal : effectiveTotal);
      
      const amountPaidOnOrder = selectedOrder ? Math.min(amountPaid, orderBalance) : 0;
      
      const saleNumber = `S-${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const paymentMethods = paymentMethod === "mixed" ?
        [
          ...(mixedCash > 0 ? [{ method: "cash", amount: mixedCash }] : []),
          ...(mixedAth > 0 ? [{ method: "ath_movil", amount: mixedAth, phone: athMovilPhone, sender_name: athMovilName }] : [])
        ] :
        [{ method: paymentMethod, amount: amountPaid }];

      const saleItems = safeCart.map((item) => ({
        type: item.type,
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: toCurrencyNumber(item.price),
        total: toCurrencyNumber(item.price) * toCurrencyNumber(item.quantity),
        taxable: item.taxable,
        cost: toCurrencyNumber(item.cost),
        line_cost: toCurrencyNumber(item.cost) * toCurrencyNumber(item.quantity),
        line_profit: (toCurrencyNumber(item.price) - toCurrencyNumber(item.cost)) * toCurrencyNumber(item.quantity)
      }));

      const saleData = {
        sale_number: saleNumber,
        customer_id: selectedCustomer?.id || selectedOrder?.customer_id || null,
        customer_name: selectedCustomer?.name || selectedOrder?.customer_name || null,
        order_id: selectedOrder?.id || null,
        order_number: selectedOrder?.order_number || null,
        items: saleItems,
        subtotal,
        tax_amount: tax,
        total: effectiveTotal,
        amount_paid: amountPaid,
        amount_due: Math.max(0, effectiveTotal - amountPaid),
        payment_method: paymentMethod,
        payment_details: {
          methods: paymentMethods,
          change_given: paymentMethod === "cash" ? change : 0,
          ath_movil_phone: paymentMethod === "ath_movil" || paymentMethod === "mixed" ? athMovilPhone : null,
          ath_movil_name: paymentMethod === "ath_movil" || paymentMethod === "mixed" ? athMovilName : null
        },
        employee: me?.full_name || "Sistema",
        deposit_credit: paymentMode === "deposit" ? amountPaid : 0,
        notes: paymentMode === "deposit" ? "Depósito registrado desde POS" : undefined
      };

      const tenantId = resolveActiveTenantId();
      let sale = null;
      let updatedOrder = null;
      let createdTransactions = [];
      const newTotalPaid = selectedOrder ? totalPaid + amountPaidOnOrder : null;
      const oldBalance = selectedOrder ? orderBalance : null;
      const newBalance = selectedOrder ? Math.max(0, oldBalance - amountPaidOnOrder) : null;
      try {
        const result = await recordSaleAndTransactions({
          sale: {
            ...saleData,
            tenant_id: tenantId,
          },
          transactions: paymentMethods.map((methodDetail) => ({
            order_id: selectedOrder?.id || null,
            order_number: selectedOrder?.order_number || null,
            type: "revenue",
            amount: Number(methodDetail.amount || 0),
            description: `Venta ${saleNumber}${paymentMode === "deposit" ? " (depósito)" : ""}`,
            category: selectedOrder || saleItems.some(i => i.type === "service") ? "repair_payment" : "parts",
            payment_method: methodDetail.method,
            recorded_by: me?.full_name || "Sistema",
            tenant_id: tenantId,
          })),
          orderUpdate: selectedOrder ? {
            id: selectedOrder.id,
            changes: {
              amount_paid: newTotalPaid,
              balance_due: newBalance,
              paid: newBalance <= 0.01,
            },
          } : null,
        });
        sale = result.sale;
        updatedOrder = result.order || null;
        createdTransactions = Array.isArray(result.transactions) ? result.transactions : [];
      } catch (saleError) {
        const details = saleError?.details ? ` (${saleError.details})` : "";
        throw new Error(`${saleError?.message || "No se pudo crear la venta"}${details}`);
      }

      try {
        await AuditService.logCreate("Sale", sale.id, saleNumber, saleData);
      } catch (auditError) {
        console.warn("Audit log (sale create) failed:", auditError);
      }

      if (selectedOrder) {
        try {
          await AuditService.logPayment(paymentMode, "Order", selectedOrder.id, selectedOrder.order_number, amountPaid, paymentMethod, { old_balance: oldBalance, new_balance: newBalance });
        } catch (auditPaymentError) {
          console.warn("Audit log (payment) failed:", auditPaymentError);
        }
      }

      for (const item of safeCart) {
        if (item.type === "product") {
          const product = products.find((p) => p.id === item.id);
          if (product) {
            const newStock = Math.max(0, (product.stock || 0) - item.quantity);
            try {
              await dataClient.entities.Product.update(item.id, { stock: newStock });
            } catch (stockUpdateError) {
              console.warn("Stock update failed for product", item.id, stockUpdateError);
              toast.warning(`Venta creada, pero no se pudo actualizar inventario de ${item.name}`);
            }
          }
        }
      }

      if (updatedOrder?.id) {
        upsertLocalOrder(updatedOrder);
      }
      if (sale?.id) upsertLocalSale(sale);
      if (createdTransactions.length) upsertLocalTransactions(createdTransactions);

      toast.success(`✅ Venta procesada - ${saleNumber}`);
      try {
        window.dispatchEvent(new CustomEvent("sale-completed", {
          detail: {
            sale,
            order: updatedOrder,
            transactions: createdTransactions,
            orderId: selectedOrder?.id || null,
            amountPaid,
            paymentMode
          }
        }));
        window.dispatchEvent(new Event("force-refresh"));
      } catch (refreshError) {
        console.warn("Financial refresh events failed:", refreshError);
      }
      setShowPaymentModal(false);

      // Capture order info before clearing (clearCart sets selectedOrder = null)
      const cameFromOrder = !!selectedOrder;
      const orderIdBeforeClear = selectedOrder?.id || null;
      setCompletedOrderId(orderIdBeforeClear);

      // Mostrar modal de acciones post-venta (email / WhatsApp / imprimir)
      setPrintData(sale);
      setCompletedSale(sale);
      setShowSaleActions(true);

      clearCart();

      if (!cameFromOrder) {
        setTimeout(() => {
          try {
            window.dispatchEvent(new Event("force-refresh"));
          } catch (refreshError) {
            console.warn("force-refresh event failed:", refreshError);
          }
        }, 500);
      }

    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error(`Error al procesar el pago: ${error?.message || "desconocido"}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loadingDrawer) return <div className="h-screen flex items-center justify-center bg-black"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;

  if (!currentDrawer) {
    return (
      <div className="h-full min-h-0 bg-black flex items-center justify-center p-4 overflow-hidden">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">🔒 Caja Cerrada</h2>
            <p className="text-gray-400">Abre la caja para procesar pagos</p>
          </div>
          <Button
            onClick={() => setShowOpenDrawerModal(true)}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
          >
            Abrir Caja
          </Button>
        </div>
        {showOpenDrawerModal && <OpenDrawerDialog isOpen={true} onClose={() => setShowOpenDrawerModal(false)} onSuccess={() => { setShowOpenDrawerModal(false); checkCashDrawerStatus(); }} />}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black p-6 gap-3">
      {/* JENAI POS Insights */}
      <JENAIInsightBanner
        context="pos"
        data={{
          salesToday: 0,
          totalToday: 0,
          topProduct: products[0]?.name || "N/A",
          readyToPay: 0,
        }}
        accentColor="cyan"
        autoLoad={false}
      />

      <div className="flex-1 flex gap-6 min-h-0">
      {/* LEFT: Products */}
      <div className="flex-1 flex flex-col">
        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-3">
          <div className="relative group/search flex-1">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-white/50 group-focus-within/search:text-cyan-400 group-focus-within/search:scale-110 transition-all duration-500" />
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar producto o servicio..." 
              className="bg-[#121215]/40 text-white pr-14 pl-14 py-5 text-base rounded-[24px] block w-full border border-white/10 placeholder-white/20 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/40 focus:bg-[#121215]/80 transition-all duration-500 backdrop-blur-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]" 
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-all active:scale-95 border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Botón historial de ventas */}
          <button
            onClick={() => setShowSaleHistory(true)}
            title="Historial de ventas"
            className="w-14 h-14 rounded-[20px] bg-[#121215]/60 border border-white/10 flex items-center justify-center text-white/40 hover:text-cyan-400 hover:border-cyan-500/30 transition-all flex-shrink-0"
          >
            <History className="w-5 h-5" />
          </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: "all", label: "Todo", icon: LayoutGrid },
              { id: "accesorios", label: "Accesorios", icon: Zap },
              { id: "devices", label: "Dispositivos", icon: User },
              { id: "offers", label: "Ofertas", icon: ShoppingCart },
            ].map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black tracking-tight transition-all duration-500 whitespace-nowrap border",
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-[0_8px_20px_rgba(6,182,212,0.3)] scale-105"
                      : "bg-[#121215]/40 text-white/40 border-white/5 hover:bg-[#121215]/60 hover:text-white/80"
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
            <button
              onClick={() => setShowManualItem(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black tracking-tight transition-all duration-500 whitespace-nowrap border bg-[#121215]/40 text-amber-400/80 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/40"
            >
              <PenLine className="w-3.5 h-3.5" />
              Manual
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-600/30 scrollbar-track-white/5">
           {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Search className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No hay productos o servicios en esta categoría</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-4 pr-2">
              {filteredItems.map((item) => {
                const finalPrice = toCurrencyNumber(item._type === "product" ? calculateDiscountedPrice(item) : item.price);
                const cartQty = safeCart.find(c => c.id === item.id)?.quantity || 0;
                const isOutOfStock = item._type === 'product' && item.stock <= 0;
                const isService = item._type === 'service';

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => !isOutOfStock && addToCart(item, item._type)}
                    whileTap={{ scale: 0.96 }}
                    className={cn(
                      "group relative overflow-hidden rounded-[28px] p-4 text-left transition-all duration-500 border",
                      cartQty > 0 
                        ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_15px_40px_rgba(6,182,212,0.15)]" 
                        : "bg-[#0D0D0F]/45 backdrop-blur-xl border-white/[0.08] hover:border-white/20 hover:bg-[#121215]/60",
                      isOutOfStock && "opacity-40 grayscale pointer-events-none"
                    )}
                  >
                    {/* Glossy Edge Reflection */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />

                    <div className="relative z-10 flex flex-col h-full justify-between gap-3">
                      <div>
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-500 group-hover:scale-110",
                          isService ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                        )}>
                           {isService ? <Search className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                        </div>
                        <h3 className="text-[13px] font-black text-white leading-tight line-clamp-2 uppercase tracking-tight opacity-90 group-hover:opacity-100">
                          {item.name}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-black text-white leading-none">
                            ${finalPrice.toFixed(2)}
                          </span>
                          {!isService && (
                             <span className={cn("text-[9px] font-bold mt-1", (item.stock || 0) < 5 ? "text-amber-400" : "text-white/50")}>
                               {item.stock} en stock
                             </span>
                          )}
                        </div>

                        {cartQty > 0 && (
                          <div className="h-7 w-7 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[11px] font-black shadow-lg shadow-cyan-500/30">
                            {cartQty}
                          </div>
                        )}
                      </div>
                    </div>

                    {isOutOfStock && (
                      <div className="absolute inset-0 rounded-[28px] bg-black/40 backdrop-blur-[2px] flex items-center justify-center rotate-[-12deg]">
                        <span className="text-[10px] font-black text-white bg-red-600 px-3 py-1 rounded-full shadow-lg">AGOTADO</span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart & Checkout */}
      <div className="w-full md:w-[340px] lg:w-[380px] xl:w-[420px] flex-shrink-0 bg-[#0D0D0F]/60 backdrop-blur-[32px] rounded-[32px] border border-white/[0.08] flex flex-col overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
        <div className="p-8 border-b border-white/[0.05]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Carrito</h2>
            {selectedOrder && (
              <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
                 <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{selectedOrder.order_number}</span>
              </div>
            )}
          </div>
          
          {(selectedCustomer || selectedOrder?.customer_name) ? (
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 group transition-all hover:bg-white/10">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-0.5">Cliente</p>
                <p className="text-white text-sm font-black truncate">{selectedCustomer?.name || selectedOrder?.customer_name}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 rounded-full bg-white/5 text-white/50 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowCustomerSelector(true)}
              className="w-full h-14 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center gap-2 text-white/30 hover:text-white/60 hover:border-white/20 hover:bg-white/5 transition-all group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
              <span className="text-xs font-black uppercase tracking-widest">Asignar Cliente</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {safeCart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40 py-12">
              <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-6">
                <ShoppingCart className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-sm font-black uppercase tracking-widest">Carrito vacío</p>
            </div>
          ) : (
            safeCart.map((item, idx) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={idx} 
                className="group bg-white/[0.03] rounded-2xl p-4 border border-white/[0.05] hover:border-white/10 hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-white text-[13px] font-black uppercase tracking-tight leading-tight group-hover:text-cyan-400 transition-colors">{item.name}</p>
                    <p className="text-white/30 text-[11px] font-bold mt-1">${toCurrencyNumber(item.price).toFixed(2)} c/u</p>
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    className="w-8 h-8 rounded-full bg-white/5 text-white/50 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 bg-black/40 rounded-xl p-1.5 border border-white/5">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-90"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-white text-[13px] font-black">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-white font-black text-base tracking-tighter">${(toCurrencyNumber(item.price) * toCurrencyNumber(item.quantity)).toFixed(2)}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="p-8 border-t border-white/[0.05] bg-white/[0.02] space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center group/sub">
              <span className="text-[11px] font-black text-white/30 uppercase tracking-widest group-hover/sub:text-white/50 transition-colors">Subtotal</span>
              <span className="text-sm font-black text-white/80 tracking-tight">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center group/tax">
              <span className="text-[11px] font-black text-white/30 uppercase tracking-widest group-hover/tax:text-white/50 transition-colors">IVU (11.5%)</span>
              <span className="text-sm font-black text-white/80 tracking-tight">${tax.toFixed(2)}</span>
            </div>
            <div className="pt-4 mt-2 border-t border-white/[0.05]">
              <div className="flex justify-between items-end">
                <span className="text-[12px] font-black text-cyan-400 uppercase tracking-[0.2em]">Total</span>
                <div className="flex flex-col items-end">
                  <span className="text-4xl font-black text-white tracking-tighter leading-none">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                if (safeCart.length === 0) {
                  toast.error("Agrega items al carrito");
                  return;
                }
                setShowPaymentModal(true);
              }}
              disabled={safeCart.length === 0}
              className="w-full h-16 rounded-[20px] bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 shadow-[0_15px_35px_rgba(6,182,212,0.4)] disabled:opacity-30 disabled:grayscale disabled:hover:scale-100 group"
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-[-12deg] transition-transform duration-500">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <span className="text-base font-black text-white uppercase tracking-widest">
                  Cobrar {selectedOrder ? 'Cualquier Depósito' : 'Total'}
                </span>
              </div>
            </Button>

            {safeCart.length > 0 && (
              <button
                onClick={clearCart}
                className="w-full py-2 text-[10px] font-black text-red-400/50 hover:text-red-400 uppercase tracking-widest transition-all hover:letter-spacing-[0.1em]"
              >
                Vaciar Carrito
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODALS */}
      <CustomerSelector
        open={showCustomerSelector}
        onClose={() => setShowCustomerSelector(false)}
        onSelect={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerSelector(false);
          toast.success(`Cliente: ${customer.name}`);
        }}
      />

      {showPaymentModal && (
        <CheckoutModalDesktop
          open={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentMethod(null);
            setCashReceived("");
            setSplitCashAmount("");
            setSplitAthAmount("");
            setAthMovilPhone("");
            setAthMovilName("");
            setDepositAmount("");
          }}
          total={total}
          effectiveTotal={effectiveTotal}
          subtotal={subtotal}
          tax={tax}
          taxEnabled={taxEnabled}
          setTaxEnabled={setTaxEnabled}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          cashReceived={cashReceived}
          setCashReceived={setCashReceived}
          splitCashAmount={splitCashAmount}
          setSplitCashAmount={setSplitCashAmount}
          splitAthAmount={splitAthAmount}
          setSplitAthAmount={setSplitAthAmount}
          depositAmount={depositAmount}
          setDepositAmount={setDepositAmount}
          athMovilPhone={athMovilPhone}
          setAthMovilPhone={setAthMovilPhone}
          athMovilName={athMovilName}
          setAthMovilName={setAthMovilName}
          cart={safeCart}
          change={change}
          isPaymentValid={isPaymentValid}
          processing={processing}
          onConfirmPayment={handlePayment}
          enabledPaymentMethods={enabledPaymentMethods}
          paymentMode={paymentMode}
          workOrderId={selectedOrder?.id}
          totalPaid={totalPaid}
          orderBalance={orderBalance}
          orderTotal={orderTotal}
        />
      )}

      <RechargeDialog
        open={showRechargeDialog}
        onClose={() => setShowRechargeDialog(false)}
        onRechargeComplete={(rechargeData) => {
          setCart([...cart, {
            id: `recharge-${Date.now()}`,
            name: `Recarga ${rechargeData.carrier_display} - ${rechargeData.phone_number}`,
            price: toCurrencyNumber(parseFloat(rechargeData.amount)),
            quantity: 1,
            type: "recharge",
            taxable: rechargeData.apply_tax,
            rechargeData
          }]);
          toast.success(`📱 Recarga agregada`);
          setShowRechargeDialog(false);
        }}
      />

      {/* Modal ítem manual */}
      {showManualItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-black text-lg mb-5 flex items-center gap-2">
              <PenLine className="w-5 h-5 text-amber-400" />
              Ítem Manual
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    placeholder="Descripción del ítem"
                    value={manualItem.name}
                    onChange={e => { setManualItem(prev => ({ ...prev, name: e.target.value })); setAiPriceSuggestion(""); }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => fetchPriceSuggestion(manualItem.name)}
                    disabled={aiPriceLoading || manualItem.name.trim().length < 3}
                    className="px-3 py-2 rounded-2xl bg-violet-500/15 border border-violet-500/20 text-violet-300 text-xs font-black disabled:opacity-40 hover:bg-violet-500/25 transition-all whitespace-nowrap"
                    title="Sugerir precio con IA"
                  >
                    {aiPriceLoading ? "…" : "✨ IA"}
                  </button>
                </div>
                {aiPriceSuggestion && (
                  <div className="text-xs text-violet-300/80 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2 mt-1">
                    {aiPriceSuggestion}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <input
                  placeholder="Precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualItem.price}
                  onChange={e => setManualItem(prev => ({ ...prev, price: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-500/50"
                />
                <input
                  placeholder="Cant."
                  type="number"
                  min="1"
                  value={manualItem.qty}
                  onChange={e => setManualItem(prev => ({ ...prev, qty: e.target.value }))}
                  className="w-24 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowManualItem(false); setManualItem({ name: "", price: "", qty: "1" }); setAiPriceSuggestion(""); }}
                className="flex-1 py-3 rounded-2xl border border-white/10 text-white/50 text-sm font-bold hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const name = manualItem.name.trim();
                  const price = parseFloat(manualItem.price);
                  const qty = parseInt(manualItem.qty) || 1;
                  if (!name || !price || price <= 0) { toast.error("Ingresa nombre y precio"); return; }
                  const id = `manual-${Date.now()}`;
                  setCart(prev => {
                    const existing = prev.find(c => c.id === id);
                    if (existing) return prev.map(c => c.id === id ? { ...c, quantity: c.quantity + qty } : c);
                    return [...prev, { id, name, price, cost: 0, quantity: qty, type: "product", taxable: true, _manual: true }];
                  });
                  toast.success(`✅ ${name} agregado`);
                  setShowManualItem(false);
                  setManualItem({ name: "", price: "", qty: "1" });
                  setAiPriceSuggestion("");
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-black shadow-lg"
              >
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      <POSSaleActionsModal
        open={showSaleActions}
        onClose={() => {
          setShowSaleActions(false);
          setCompletedSale(null);
          if (completedOrderId) {
            setCompletedOrderId(null);
            navigate(createPageUrl(`Orders?openOrderId=${completedOrderId}`));
          }
        }}
        sale={completedSale}
        customer={selectedCustomer}
        cartItems={printData ? (Array.isArray(printData.items) ? printData.items : safeCart) : safeCart}
        onPrint={() => {
          setShowSaleActions(false);
          setShowPrintDialog(true);
        }}
      />

      <POSSaleHistoryModal
        open={showSaleHistory}
        onClose={() => setShowSaleHistory(false)}
        onReopen={(entry) => {
          setCompletedSale(entry.sale);
          setPrintData(entry.sale);
          setHistoryCustomer(entry.customer);
          setShowSaleActions(true);
        }}
      />

      {showPrintDialog && printData && (
        <UniversalPrintDialog
          open={showPrintDialog}
          onClose={() => {
            setShowPrintDialog(false);
            if (selectedOrder) {
              window.location.assign(createPageUrl(`Orders?openOrderId=${selectedOrder.id}`));
            }
          }}
          type="sale"
          data={printData}
          customer={selectedCustomer}
        />
      )}
    </div>
    </div>
  );
}
