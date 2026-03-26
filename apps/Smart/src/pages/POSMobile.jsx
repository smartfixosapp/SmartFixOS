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
  // Guard to ensure payment modal auto-opens exactly once per navigation
  const autoOpenPaymentFired = useRef(false);
  const [showManualItem, setShowManualItem] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", price: "", qty: "1" });
  const [showSaleActions, setShowSaleActions] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [completedOrderId, setCompletedOrderId] = useState(null);
  const [showSaleHistory, setShowSaleHistory] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printData, setPrintData] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const workOrderId = urlParams.get("workOrderId");
  const urlPaymentMode = urlParams.get("mode") || "full";
  const routeStateOrder = location.state?.workOrder || null;
  const routePaymentMode = location.state?.paymentMode || null;
  const urlBalance = parseFloat(urlParams.get("balance") || "0");
  const routeBalanceDue = parseFloat(location.state?.balanceDue || "0");

  const hydrateWorkOrder = useCallback(async (order) => {
    if (!order?.id) return;
    const paid = Number(order.total_paid || order.amount_paid || 0);
    setTotalPaid(paid);
    setSelectedOrder(order);
    setPaymentMode(routePaymentMode || urlPaymentMode);

    const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
    setCart(orderItems.map((item) => ({
      id: item.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: item.name,
      price: toCurrencyNumber(item.price),
      cost: toCurrencyNumber(item.line_cost != null ? Number(item.line_cost) / Math.max(1, Number(item.qty || item.quantity || 1)) : item.cost),
      quantity: item.qty || item.quantity || 1,
      type: item.type || "product",
      taxable: item.taxable !== false
    })));
    // Setear cliente desde campos embebidos de la orden de inmediato (sin esperar DB)
    if (order.customer_id || order.customer_name) {
      const immediateCustomer = {
        id: order.customer_id || null,
        name: order.customer_name || "",
        phone: order.customer_phone || order.phone || "",
        email: order.customer_email || order.email || "",
      };
      setSelectedCustomer(immediateCustomer);
      // Luego enriquecer con datos completos de DB
      if (order.customer_id) {
        try {
          const customer = await dataClient.entities.Customer.get(order.customer_id);
          if (customer?.id) setSelectedCustomer(customer);
        } catch (e) {
          console.error("Error loading customer:", e);
        }
      }
    }
  }, [routePaymentMode, urlPaymentMode]);

  useEffect(() => {
    // checkCashDrawerStatus se maneja por subscribeToCashRegister — no incluir aquí para evitar parpadeos
    Promise.all([loadInventory(), loadPaymentMethods(), loadTaxRate()]);
  }, []);

  // Auto-open drawer dialog when arriving from a work order and drawer is closed
  useEffect(() => {
    if (!loadingDrawer && !currentDrawer && workOrderId) {
      setShowOpenDrawerModal(true);
    }
  }, [loadingDrawer, currentDrawer, workOrderId]);

  useEffect(() => {
    const unsubscribe = subscribeToCashRegister(({ drawer, isInitialized }) => {
      setCurrentDrawer(drawer || null);
      if (isInitialized) {
        setLoadingDrawer(false);
      }
    });

    // Si ya tenemos caché inicializado, no bloquear la UI
    const status = getCachedStatus();
    if (status.isInitialized) {
      setLoadingDrawer(false);
      setCurrentDrawer(status.drawer || null);
    }

    // Solo re-verificar si no está inicializado o el caché es viejo (> 5 min)
    if (!status.isInitialized || Date.now() - status.lastCheck > 300000) {
      if (!status.isInitialized) setLoadingDrawer(true);
      checkCashRegisterStatus().finally(() => setLoadingDrawer(false));
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    const shouldAutoOpen = !!(workOrderId || location.state?.openPaymentImmediately);

    if (workOrderId && !routeStateOrder?.id) {
      // Sin datos en state → buscar en DB, luego abrir modal
      (async () => {
        await loadWorkOrder();
        if (shouldAutoOpen && !autoOpenPaymentFired.current) {
          autoOpenPaymentFired.current = true;
          setTimeout(() => setShowPaymentModal(true), 200);
        }
      })();
    } else if (routeStateOrder?.id && (!workOrderId || String(routeStateOrder.id) === String(workOrderId))) {
      // Datos en state → hidratar y abrir modal directamente
      hydrateWorkOrder(routeStateOrder).then(() => {
        if (shouldAutoOpen && !autoOpenPaymentFired.current) {
          autoOpenPaymentFired.current = true;
          setTimeout(() => setShowPaymentModal(true), 200);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWorkOrderById = useCallback(async (orderId) => {
    if (!orderId) return null;

    try {
      const localOrder = getLocalOrders().find((order) => String(order?.id || "") === String(orderId));
      if (localOrder?.id) return localOrder;
    } catch {}

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
        .select("*")
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
                : routeBalanceDue > 0
                  ? routeBalanceDue
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

  if (loadingDrawer) return <div className="h-screen flex items-center justify-center bg-black"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;

  if (!currentDrawer) {
    return (
      <div className="h-screen bg-black flex items-center justify-center p-4">
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
    <div className="h-screen bg-[#090909] flex flex-col overflow-hidden">
      <div
        className="flex-shrink-0 bg-[#0D0D0F] px-5 pb-5 border-b border-white/[0.08] z-20 relative"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">Terminal Activa</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">POS</h1>
            {selectedOrder && (
              <div className="inline-flex items-center px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full mt-2">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{selectedOrder.order_number}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(selectedCustomer || selectedOrder?.customer_name) && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 rounded-[18px] border border-blue-500/20 max-w-[150px] shadow-lg shadow-blue-500/5">
                <User className="w-4 h-4 text-blue-400" />
                <span className="text-[11px] font-black text-blue-400 truncate uppercase tracking-tight">{selectedCustomer?.name || selectedOrder?.customer_name}</span>
              </div>
            )}
            <button
              onClick={() => setShowRechargeDialog(true)}
              className="w-12 h-12 rounded-[20px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center active:scale-90 transition-all shadow-xl shadow-cyan-500/5"
            >
              <Zap className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCustomerSelector(true)}
              className="w-12 h-12 rounded-[20px] bg-white/5 border border-white/10 text-white/40 flex items-center justify-center active:scale-90 transition-all"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative group/search mb-5">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-white/20 group-focus-within/search:text-cyan-400 transition-all duration-300" />
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos o servicios..."
            className="bg-black/40 text-white pr-12 pl-12 py-5 text-sm rounded-[22px] block w-full border border-white/10 placeholder-white/20 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 focus:bg-black/60 transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]" 
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 text-white/60 flex items-center justify-center active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth" style={{ touchAction: 'pan-x' }}>
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
                  "px-6 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-500 whitespace-nowrap border",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-[0_10px_25px_rgba(6,182,212,0.3)] scale-105 z-10"
                    : "bg-white/[0.03] text-white/30 border-white/5 hover:bg-white/[0.06]"
                )}
              >
                {tab.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowManualItem(true)}
            className="px-6 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-[0.1em] whitespace-nowrap border bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1.5"
          >
            <PenLine className="w-3.5 h-3.5" />
            Manual
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Search className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No hay resultados</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
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
                      "group relative overflow-hidden rounded-[28px] p-5 text-left transition-all duration-500 border",
                      cartQty > 0 
                        ? "bg-cyan-500/15 border-cyan-500/40 shadow-[0_15px_40px_rgba(6,182,212,0.15)]" 
                        : "bg-[#121215]/60 border-white/10 hover:border-white/20 active:bg-white/[0.08]",
                      isOutOfStock && "opacity-40 grayscale pointer-events-none"
                    )}
                  >
                    <div className="relative z-10 flex flex-col h-full justify-between gap-3">
                      <div>
                        <div className={cn(
                          "w-11 h-11 rounded-[16px] flex items-center justify-center mb-4 shadow-inner",
                          isService ? "bg-purple-500/20 text-purple-400 border border-purple-500/20" : "bg-blue-500/20 text-blue-400 border border-blue-500/20"
                        )}>
                           {isService ? <LayoutGrid className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                        </div>
                        <h3 className="text-[13px] font-black text-white leading-tight line-clamp-2 uppercase tracking-tight">
                          {item.name}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[14px] font-black text-white tracking-tighter">
                          ${finalPrice.toFixed(2)}
                        </span>

                        {cartQty > 0 && (
                          <div className="h-6 w-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px] font-black">
                            {cartQty}
                          </div>
                        )}
                      </div>
                    </div>

                    {isOutOfStock && (
                      <div className="absolute inset-0 rounded-[24px] bg-black/40 backdrop-blur-[1px] flex items-center justify-center rotate-[-10deg]">
                        <span className="text-[9px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full">AGOTADO</span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 bg-[#0D0D0F] border-t border-white/[0.08] px-6 py-7 rounded-t-[40px] space-y-6 shadow-[0_-25px_50px_rgba(0,0,0,0.6)] relative z-30">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Subtotal</span>
              <span className="text-sm font-black text-white/60 tracking-tight">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">IVU (11.5%)</span>
              <span className="text-sm font-black text-white/60 tracking-tight">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-end pt-4 mt-2 border-t border-white/[0.05]">
              <span className="text-[12px] font-black text-cyan-400 uppercase tracking-[0.2em]">Total Final</span>
              <span className="text-4xl font-black text-white tracking-tighter shadow-sm">${total.toFixed(2)}</span>
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
              className="w-full h-20 bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-95 active:scale-[0.98] transition-all duration-300 shadow-[0_20px_40px_rgba(6,182,212,0.25)] disabled:opacity-30 disabled:grayscale rounded-[24px] border-t border-white/10"
            >
              <div className="flex items-center justify-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <span className="text-base font-black text-white uppercase tracking-[0.1em]">Finalizar Cobro</span>
              </div>
            </Button>

            {safeCart.length > 0 && (
              <button
                onClick={clearCart}
                className="w-full py-1 text-[9px] font-black text-red-400/40 hover:text-red-400 uppercase tracking-[0.3em] transition-all"
              >
                Vaciar Carrito
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

      {/* Manual item sheet */}
      {showManualItem && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowManualItem(false)}>
          <div className="bg-[#0f0f12] border border-white/10 rounded-t-3xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-black text-lg">Artículo Manual</h3>
            <input
              autoFocus
              placeholder="Nombre del artículo"
              value={manualItem.name}
              onChange={e => setManualItem(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="Precio"
                value={manualItem.price}
                onChange={e => setManualItem(p => ({ ...p, price: e.target.value }))}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-500/50"
              />
              <input
                type="number"
                placeholder="Qty"
                value={manualItem.qty}
                onChange={e => setManualItem(p => ({ ...p, qty: e.target.value }))}
                className="w-24 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-500/50"
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
                toast.success(`✅ ${manualItem.name} añadido`);
              }}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-2xl"
            >
              Añadir al Carrito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
