import React, { useState, useEffect, useCallback, useRef } from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Plus, Minus, Trash2, User, AlertCircle, X, Loader2, Zap, LayoutGrid, PenLine, History } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/components/utils/helpers";
import { calculateDiscountedPrice } from "@/components/inventory/DiscountBadge";
import { motion } from "framer-motion";

// Helper for joining class names
const cn = (...classes) => classes.filter(Boolean).join(" ");
import CustomerSelector from "../components/pos/CustomerSelector";
import CheckoutModal from "../components/pos/CheckoutModalDesktop";
import RechargeDialog from "../components/pos/RechargeDialog";
import OpenDrawerDialog from "../components/cash/OpenDrawerDialog";
import { recordSaleAndTransactions, resolveActiveTenantId } from "@/components/financial/recordSale";
import { AuditService } from "@/components/utils/auditService";
import { catalogCache } from "@/components/utils/dataCache";
import { getLocalOrders, upsertLocalOrder } from "@/components/utils/localOrderCache";
import { upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";
import {
  getCachedStatus,
  subscribeToCashRegister,
  checkCashRegisterStatus
} from "@/components/cash/CashRegisterService";
import UniversalPrintDialog from "../components/printing/UniversalPrintDialog";
import POSSaleActionsModal, { POSSaleHistoryModal, saveSaleToHistory } from "../components/pos/POSSaleActionsModal";
import { sendTemplatedEmail } from "@/api/functions";

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

export default function POSMobile() {
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
  // ✅ Si el caché ya está inicializado (navegación entre páginas), arranca en false directamente
  const [loadingDrawer, setLoadingDrawer] = useState(() => !getCachedStatus().isInitialized);
  const [activeTab, setActiveTab] = useState("all");
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
  const hasShownInventoryOfflineToast = React.useRef(false);
  const [showManualItem, setShowManualItem] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", price: "", qty: "1" });
  const [showSaleActions, setShowSaleActions] = useState(false);
  // Price editing in cart
  const [editingPriceIdx, setEditingPriceIdx] = useState(null);
  const [editingPriceVal, setEditingPriceVal] = useState("");
  const [completedSale, setCompletedSale] = useState(null);
  const [completedOrderId, setCompletedOrderId] = useState(null);
  const [showSaleHistory, setShowSaleHistory] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printData, setPrintData] = useState(null);

  const { workOrderId, urlPaymentMode, urlBalance } = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const wId = params.get("workOrderId");
    // Evitar strings "undefined" o "null" literales
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

    console.log("[POS Mobile] 💧 hydrateWorkOrder called with:", { orderId: order?.id, itemsCount: itemsToLoad.length });
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

  // ── Startup: inventario + cajón + config + carga de orden ─────────────────
  useEffect(() => {
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
    if (workOrderId) {
      const navState = location.state || {};
      const stateOrder = navState.workOrder || navState.order || null;
      const navMode = navState.paymentMode || urlPaymentMode;

      (async () => {
        try {
          let order = null;

          if (stateOrder?.id && String(stateOrder.id) === String(workOrderId)) {
            order = stateOrder;
          } else {
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

          const cust = navState.customer;
          setSelectedCustomer({
            id: cust?.id || order.customer_id || null,
            name: cust?.name || order.customer_name || "",
            phone: cust?.phone || order.customer_phone || "",
            email: cust?.email || order.customer_email || "",
          });

          setShowPaymentModal(true);
        } catch (err) {
          console.error("[POS Mobile] Error cargando orden:", err);
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

    // Bypass local cache
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
      console.warn("[POSMobile] dataClient get failed:", error);
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
      console.warn("[POSMobile] supabase fallback failed:", error);
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
          dataClient.entities.Product.filter({ active: true }, undefined, 200),
          dataClient.entities.Service.filter({ active: true }, undefined, 100)
        ]);
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

  const removeItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const startEditPrice = (idx) => {
    setEditingPriceIdx(idx);
    setEditingPriceVal(toCurrencyNumber(cart[idx].price).toFixed(2));
  };

  const commitEditPrice = (idx) => {
    const parsed = parseFloat(String(editingPriceVal).replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed >= 0) {
      const updated = [...cart];
      updated[idx] = { ...updated[idx], price: parsed };
      setCart(updated);
    }
    setEditingPriceIdx(null);
    setEditingPriceVal("");
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
    toast.info("Carrito vaciado");
  };

  // 📞 Auto-rellenar Teléfono y Nombre del pagador con datos del cliente cuando se abre el modal de cobro
  useEffect(() => {
    if (!showPaymentModal) return;
    const custName = selectedCustomer?.name || selectedOrder?.customer_name || "";
    const custPhone = selectedCustomer?.phone || selectedOrder?.customer_phone || "";
    if (custName && !athMovilName) setAthMovilName(custName);
    if (custPhone && !athMovilPhone) setAthMovilPhone(custPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentModal, selectedCustomer?.id, selectedOrder?.id]);

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
        selectedOrder.cost_estimate
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
  const hasAthMeta = !!String(athMovilPhone || "").trim() && !!String(athMovilName || "").trim();

  const isPaymentValid = selectedOrder ?
    (paymentMode === "deposit" ? (parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= orderBalance && paymentMethod) :
    (paymentMethod === "cash" ? parseFloat(cashReceived) >= effectiveTotal :
    paymentMethod === "ath_movil" ? hasAthMeta :
    paymentMethod === "mixed" ? (mixedTotal >= effectiveTotal && (!mixedAth || hasAthMeta)) :
    paymentMethod ? true : false)) :
    (paymentMethod === "cash" ? parseFloat(cashReceived) >= total :
    paymentMethod === "ath_movil" ? hasAthMeta :
    paymentMethod === "mixed" ? (mixedTotal >= total && (!mixedAth || hasAthMeta)) :
    paymentMethod ? true : false);

  // Solo accesorios y dispositivos completos — igual que desktop
  const sellableProducts = products.filter(p =>
    p.tipo_principal === "accesorios" ||
    (p.tipo_principal === "dispositivos" && p.subcategoria === "dispositivo_completo")
  );

  const getFilteredItems = useCallback(() => {
    let items = [];
    const q = searchQuery.toLowerCase();

    if (activeTab === "all") {
      items = sellableProducts.map(p => ({ ...p, _type: 'product' }));
    } else if (activeTab === "accesorios") {
      items = sellableProducts.filter(p => p.tipo_principal === "accesorios").map(item => ({...item, _type: 'product'}));
    } else if (activeTab === "devices") {
      items = sellableProducts.filter(p => p.tipo_principal === "dispositivos").map(item => ({...item, _type: 'product'}));
    } else if (activeTab === "offers") {
      items = sellableProducts.filter(p => p.discount_active && p.discount_percentage > 0).map(item => ({...item, _type: 'product'}));
    }

    if (q) {
      items = items.filter(item => 
        (item.name || "").toLowerCase().includes(q) ||
        (item.sku || "").toLowerCase().includes(q)
      );
    }

    return items.slice(0, 100);
  }, [products, services, activeTab, searchQuery]);

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

      // 📧 Enviar recibo por email al cliente (si tiene email registrado)
      const _recipientEmail = selectedCustomer?.email || selectedOrder?.customer_email;
      if (_recipientEmail) {
        const _isDeposit = paymentMode === "deposit" || (selectedOrder && newBalance > 0.01);
        const _eventType = selectedOrder ? (_isDeposit ? "deposit_received" : "payment_received") : "sale_completed";
        const _deviceLine = selectedOrder
          ? [selectedOrder.device_brand, selectedOrder.device_model].filter(Boolean).join(" ") || selectedOrder.device_type || "tu equipo"
          : "";
        const _paymentMethodLabel = paymentMethod === "cash" ? "Efectivo"
          : paymentMethod === "card" ? "Tarjeta"
          : paymentMethod === "ath_movil" ? "ATH Móvil"
          : paymentMethod === "mixed" ? "Pago Mixto"
          : paymentMethod || "";
        sendTemplatedEmail({
          event_type: _eventType,
          order_data: {
            order_number: selectedOrder?.order_number || "",
            customer_name: selectedCustomer?.name || selectedOrder?.customer_name || "Cliente",
            customer_email: _recipientEmail,
            device_info: _deviceLine,
            sale_number: saleNumber,
            amount: effectiveTotal,
            total_paid: amountPaid,
            balance: selectedOrder ? newBalance : 0,
            payment_method: _paymentMethodLabel,
          }
        }).catch(err => console.warn("[POS Mobile] email recibo falló:", err?.message || err));
      }

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

      const cameFromOrder = !!selectedOrder;
      const orderIdBeforeClear = selectedOrder?.id || null;
      setCompletedOrderId(orderIdBeforeClear);

      setPrintData(sale);
      setCompletedSale(sale);
      setShowSaleActions(true);

      clearCart();

      if (!cameFromOrder) {
        setTimeout(() => {
          try { window.dispatchEvent(new Event("force-refresh")); } catch {}
        }, 500);
      }

    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error(`Error al procesar el pago: ${error?.message || "desconocido"}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loadingDrawer) return (
    <div className="h-screen flex items-center justify-center apple-surface">
      <Loader2 className="w-7 h-7 animate-spin text-apple-blue" />
    </div>
  );

  if (!currentDrawer) {
    return (
      <div className="h-full min-h-0 apple-surface flex items-center justify-center p-6 overflow-hidden apple-type">
        <div className="text-center space-y-8 max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-apple-red/15 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-apple-red" />
          </div>
          <div className="space-y-1.5">
            <h2 className="apple-text-title2 apple-label-primary">Caja cerrada</h2>
            <p className="apple-text-subheadline apple-label-secondary">Abre la caja para procesar pagos</p>
          </div>
          <button
            onClick={() => setShowOpenDrawerModal(true)}
            className="apple-btn apple-btn-primary apple-btn-lg"
          >
            Abrir caja
          </button>
        </div>
        {showOpenDrawerModal && <OpenDrawerDialog isOpen={true} onClose={() => setShowOpenDrawerModal(false)} onSuccess={() => { setShowOpenDrawerModal(false); checkCashDrawerStatus(); }} />}
      </div>
    );
  }

  return (
    <div className="h-screen apple-surface flex flex-col overflow-hidden apple-type">
      {/* ── Header estilo iOS: large title + acciones ─── */}
      <div
        className="flex-shrink-0 apple-surface-secondary px-5 pb-4 z-20 relative"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-apple-green animate-pulse" />
              <span className="apple-text-footnote apple-label-secondary">Terminal activa</span>
            </div>
            <h1 className="apple-text-large-title apple-label-primary">POS</h1>
            {selectedOrder && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-apple-blue/15 rounded-full mt-1.5">
                <span className="apple-text-caption1 font-medium text-apple-blue tabular-nums">#{selectedOrder.order_number}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            {(selectedCustomer || selectedOrder?.customer_name) && (
              <div className="hidden xs:flex items-center gap-1.5 px-3 py-2 bg-apple-blue/12 rounded-apple-md max-w-[140px]">
                <User className="w-3.5 h-3.5 text-apple-blue flex-shrink-0" />
                <span className="apple-text-footnote font-medium text-apple-blue truncate">{selectedCustomer?.name || selectedOrder?.customer_name}</span>
              </div>
            )}
            <button
              onClick={() => setShowRechargeDialog(true)}
              className="apple-press w-11 h-11 rounded-apple-md bg-apple-blue/15 text-apple-blue flex items-center justify-center apple-focusable"
              aria-label="Recarga"
            >
              <Zap className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setShowCustomerSelector(true)}
              className="apple-press w-11 h-11 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary flex items-center justify-center apple-focusable"
              aria-label="Cliente"
            >
              <User className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* ── Search field estilo iOS ─── */}
        <div className="relative mb-3.5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] apple-label-tertiary pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos o servicios"
            className="apple-input pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="apple-press absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-sys4 text-white flex items-center justify-center"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Category chips (segmented-style) ─── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar apple-scroll-snap-x -mx-1 px-1" style={{ touchAction: 'pan-x' }}>
          {[
            { id: "all", label: "Todo" },
            { id: "accesorios", label: "Accesorios" },
            { id: "devices", label: "Dispositivos" },
            { id: "offers", label: "Ofertas" }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "apple-press px-4 h-9 rounded-full whitespace-nowrap apple-text-footnote font-medium transition-colors duration-200",
                  isActive
                    ? "bg-apple-blue text-white shadow-apple-sm"
                    : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary hover:bg-gray-sys5 dark:hover:bg-gray-sys4"
                )}
              >
                {tab.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowManualItem(true)}
            className="apple-press px-4 h-9 rounded-full whitespace-nowrap apple-text-footnote font-medium bg-apple-orange/15 text-apple-orange flex items-center gap-1.5"
          >
            <PenLine className="w-3.5 h-3.5" />
            Manual
          </button>
        </div>
      </div>

      {/* ── Lista de productos ─── */}
      <div className="flex-1 overflow-hidden flex flex-col apple-surface">
        <div className="flex-1 overflow-y-auto apple-scroll px-4 pt-4 pb-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-apple-blue" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Search className="w-10 h-10 apple-label-quaternary" />
              <p className="apple-text-callout apple-label-tertiary">No hay resultados</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item) => {
                const finalPrice = toCurrencyNumber(item._type === "product" ? calculateDiscountedPrice(item) : item.price);
                const cartQty = safeCart.find(c => c.id === item.id)?.quantity || 0;
                const isOutOfStock = item._type === 'product' && item.stock <= 0;
                const isService = item._type === 'service';

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => !isOutOfStock && addToCart(item, item._type)}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "apple-card apple-card-interactive relative overflow-hidden p-4 text-left",
                      cartQty > 0 && "ring-2 ring-apple-blue/70 ring-offset-0",
                      isOutOfStock && "pointer-events-none"
                    )}
                  >
                    {/* Contenido atenuado si está agotado, pero el badge NO */}
                    <div className={cn(
                      "flex flex-col h-full justify-between gap-3 min-h-[112px]",
                      isOutOfStock && "opacity-40 grayscale"
                    )}>
                      <div className="space-y-3">
                        <div className={cn(
                          "w-10 h-10 rounded-apple-sm flex items-center justify-center",
                          isService ? "bg-apple-purple/15 text-apple-purple" : "bg-apple-blue/15 text-apple-blue"
                        )}>
                          {isService ? <LayoutGrid className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                        </div>
                        <h3 className="apple-text-footnote font-semibold apple-label-primary leading-snug line-clamp-2">
                          {item.name}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="apple-text-headline apple-label-primary tabular-nums">
                          ${finalPrice.toFixed(2)}
                        </span>

                        {cartQty > 0 && (
                          <div className="h-6 min-w-6 px-1.5 rounded-full bg-apple-blue text-white flex items-center justify-center apple-text-caption2 font-semibold tabular-nums">
                            {cartQty}
                          </div>
                        )}
                      </div>
                    </div>

                    {isOutOfStock && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-apple-red apple-text-caption2 font-semibold text-white tracking-wide shadow-apple-sm">
                        AGOTADO
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Barra inferior: totales + CTA ─── */}
        <div
          className="flex-shrink-0 apple-surface-secondary border-t border-[rgb(var(--separator)/0.3)] px-5 pt-4 space-y-4 relative z-30"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
        >
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="apple-text-subheadline apple-label-secondary">Subtotal</span>
              <span className="apple-text-subheadline apple-label-secondary tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="apple-text-subheadline apple-label-secondary">IVU (11.5%)</span>
              <span className="apple-text-subheadline apple-label-secondary tabular-nums">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2.5">
              <span className="apple-text-footnote apple-label-secondary">Total</span>
              <span className="apple-text-large-title apple-label-primary tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                if (safeCart.length === 0) {
                  toast.error("Agrega items al carrito");
                  return;
                }
                setShowPaymentModal(true);
              }}
              disabled={safeCart.length === 0}
              className="apple-btn apple-btn-primary apple-btn-lg"
            >
              <ShoppingCart className="w-[18px] h-[18px]" />
              <span>Finalizar cobro</span>
            </button>

            {safeCart.length > 0 && (
              <button
                onClick={clearCart}
                className="apple-btn apple-btn-plain text-apple-red mx-auto"
              >
                Vaciar carrito
              </button>
            )}
          </div>
        </div>
      </div>

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
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto">
          <CheckoutModal
          open={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentMethod(null);
            setCashReceived("");
            setSplitCashAmount("");
            setSplitAthAmount("");
            setAthMovilPhone("");
            setAthMovilName("");
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
          orderTotal={orderTotal}
          quickDepositAmounts={[50, 100, 150]}
          quickCashAmounts={[20, 50, 100]}
          />
          </div>
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

      {/* Post-sale actions */}
      <POSSaleActionsModal
        open={showSaleActions}
        onClose={() => {
          setShowSaleActions(false);
          setCompletedSale(null);
          if (completedOrderId) {
            setCompletedOrderId(null);
            navigate(createPageUrl(`OrdersMobile?openOrderId=${completedOrderId}`));
          }
        }}
        sale={completedSale}
        customer={selectedCustomer}
        cartItems={printData ? (Array.isArray(printData.items) ? printData.items : safeCart) : safeCart}
        onPrint={() => { setShowSaleActions(false); setShowPrintDialog(true); }}
      />

      {showPrintDialog && printData && (
        <UniversalPrintDialog
          open={showPrintDialog}
          onClose={() => setShowPrintDialog(false)}
          sale={printData}
          customer={selectedCustomer}
        />
      )}

      <POSSaleHistoryModal
        open={showSaleHistory}
        onClose={() => setShowSaleHistory(false)}
        onReopen={(entry) => {
          setCompletedSale(entry.sale);
          setPrintData(entry.sale);
          setShowSaleHistory(false);
          setShowSaleActions(true);
        }}
      />

      {/* ── Bottom sheet estilo iOS: artículo manual ─── */}
      {showManualItem && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-apple-fade-in apple-type"
          onClick={() => setShowManualItem(false)}
        >
          <div
            className="apple-surface-elevated w-full max-w-lg p-5 space-y-4 animate-apple-sheet-up"
            style={{
              borderTopLeftRadius: '1.75rem',
              borderTopRightRadius: '1.75rem',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* drag handle iOS */}
            <div className="mx-auto w-9 h-1.5 rounded-full bg-[rgb(var(--separator-opaque))] mb-1" />
            <h3 className="apple-text-title3 apple-label-primary">Artículo manual</h3>
            <input
              autoFocus
              placeholder="Nombre del artículo"
              value={manualItem.name}
              onChange={e => setManualItem(p => ({ ...p, name: e.target.value }))}
              className="apple-input"
            />
            <div className="flex gap-2.5">
              <input
                type="number"
                placeholder="Precio"
                value={manualItem.price}
                onChange={e => setManualItem(p => ({ ...p, price: e.target.value }))}
                className="apple-input flex-1"
              />
              <input
                type="number"
                placeholder="Cant."
                value={manualItem.qty}
                onChange={e => setManualItem(p => ({ ...p, qty: e.target.value }))}
                className="apple-input w-24"
              />
            </div>
            <button
              onClick={() => {
                if (!manualItem.name.trim() || !manualItem.price) { toast.error("Nombre y precio requeridos"); return; }
                const price = parseFloat(manualItem.price);
                const qty = parseInt(manualItem.qty) || 1;
                setCart(prev => [...prev, {
                  id: `manual-${Date.now()}`,
                  name: manualItem.name.trim(),
                  price,
                  cost: 0,
                  quantity: qty,
                  type: 'product',
                  taxable: true,
                }]);
                setManualItem({ name: "", price: "", qty: "1" });
                setShowManualItem(false);
                toast.success(`${manualItem.name} añadido`);
              }}
              className="apple-btn apple-btn-primary apple-btn-lg"
            >
              Añadir al carrito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
