import React, { useState, useEffect, useCallback } from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Plus, Minus, Trash2, User, AlertCircle, X, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/components/utils/helpers";
import { calculateDiscountedPrice } from "@/components/inventory/DiscountBadge";
import { motion } from "framer-motion";
import CustomerSelector from "../components/pos/CustomerSelector";
import CheckoutModalMobile from "../components/pos/CheckoutModalMobile";
import RechargeDialog from "../components/pos/RechargeDialog";
import OpenDrawerDialog from "../components/cash/OpenDrawerDialog";
import { AuditService } from "@/components/utils/auditService";
import { catalogCache } from "@/components/utils/dataCache";
import {
  getCachedStatus,
  subscribeToCashRegister,
  checkCashRegisterStatus
} from "@/components/cash/CashRegisterService";

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
  const [loadingDrawer, setLoadingDrawer] = useState(true);
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

  const urlParams = new URLSearchParams(window.location.search);
  const workOrderId = urlParams.get("workOrderId");
  const urlPaymentMode = urlParams.get("mode") || "full";
  const routeStateOrder = location.state?.workOrder || null;
  const routePaymentMode = location.state?.paymentMode || null;

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
    if (order.customer_id) {
      try {
        const customer = await dataClient.entities.Customer.get(order.customer_id);
        setSelectedCustomer(customer);
      } catch (e) {
        console.error("Error loading customer:", e);
      }
    }
  }, [routePaymentMode, urlPaymentMode]);

  useEffect(() => {
    Promise.all([loadInventory(), loadPaymentMethods(), loadTaxRate(), checkCashDrawerStatus()]);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCashRegister(({ drawer }) => {
      setCurrentDrawer(drawer || null);
      setLoadingDrawer(false);
    });
    checkCashRegisterStatus().finally(() => setLoadingDrawer(false));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (workOrderId) {
      loadWorkOrder();
    }
  }, [workOrderId]);

  useEffect(() => {
    if (routeStateOrder?.id && (!workOrderId || routeStateOrder.id === workOrderId)) {
      hydrateWorkOrder(routeStateOrder);
    }
  }, [routeStateOrder, workOrderId, hydrateWorkOrder]);

  useEffect(() => {
    if (workOrderId && selectedOrder) {
      setShowPaymentModal(true);
      if (urlPaymentMode === "deposit") {
        setPaymentMethod("cash");
      }
    }
  }, [workOrderId, selectedOrder]);

  const fetchWorkOrderById = useCallback(async (orderId) => {
    if (!orderId) return null;

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
            selectedOrder.balance_due != null
              ? selectedOrder.balance_due
              : (orderTotal - totalPaid)
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

  const getFilteredItems = useCallback(() => {
    let items = [];
    const q = searchQuery.toLowerCase();

    if (activeTab === "all") {
      items = [...products, ...services].map((item) => ({
        ...item,
        _type: item.duration_minutes ? 'service' : 'product'
      }));
    } else if (activeTab === "accesorios") {
      items = products.filter(p => p.tipo_principal === "accesorios").map(item => ({...item, _type: 'product'}));
    } else if (activeTab === "devices") {
      items = products.filter(p => p.tipo_principal === "dispositivos" && p.subcategoria === "dispositivo_completo").map(item => ({...item, _type: 'product'}));
    } else if (activeTab === "offers") {
      items = products.filter(p => p.discount_active && p.discount_percentage > 0).map(item => ({...item, _type: 'product'}));
    } else if (activeTab === "services") {
      items = services.map(item => ({...item, _type: 'service'}));
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
        payment_mode: paymentMode,
        is_deposit: paymentMode === "deposit"
      };

      let sale = null;
      try {
        sale = await dataClient.entities.Sale.create(saleData);
      } catch (saleError) {
        const details = saleError?.details ? ` (${saleError.details})` : "";
        throw new Error(`${saleError?.message || "No se pudo crear la venta"}${details}`);
      }

      try {
        await AuditService.logCreate("Sale", sale.id, saleNumber, saleData);
      } catch (auditError) {
        console.warn("Audit log (sale create) failed:", auditError);
      }

      // Registrar ingresos para Finanzas (ingresos por método de pago)
      try {
        const txCategory = selectedOrder || saleItems.some(i => i.type === "service") ? "repair_payment" : "parts";
        for (const methodDetail of paymentMethods) {
          await dataClient.entities.Transaction.create({
            order_id: selectedOrder?.id || null,
            order_number: selectedOrder?.order_number || null,
            type: "revenue",
            amount: Number(methodDetail.amount || 0),
            description: `Venta ${saleNumber}${paymentMode === "deposit" ? " (depósito)" : ""}`,
            category: txCategory,
            payment_method: methodDetail.method,
            recorded_by: me?.full_name || "Sistema"
          });
        }
      } catch (revenueTxError) {
        console.warn("Revenue transaction create failed:", revenueTxError);
        toast.warning("Venta creada, pero no se pudo registrar el ingreso en Finanzas");
      }

      if (selectedOrder) {
        const newTotalPaid = totalPaid + amountPaid;
        const oldBalance = orderBalance;
        const newBalance = Math.max(0, oldBalance - amountPaid);
        try {
          await dataClient.entities.Order.update(selectedOrder.id, { 
            total_paid: newTotalPaid,
            amount_paid: newTotalPaid,
            balance_due: newBalance,
            balance: newBalance,
            paid: newBalance <= 0.01
          });
        } catch (orderUpdateError) {
          console.warn("Order payment update failed:", orderUpdateError);
          toast.warning("Venta creada, pero no se pudo actualizar el balance de la orden");
        }
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

      toast.success(`✅ Venta procesada - ${saleNumber}`);
      try {
        window.dispatchEvent(new CustomEvent("sale-completed", {
          detail: {
            sale,
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
      clearCart();

      // Redirigir a órdenes después de completar el pago
      if (selectedOrder) {
        setTimeout(() => window.location.assign(createPageUrl("Orders")), 500);
      } else {
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
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <div
        className="flex-shrink-0 bg-gradient-to-b from-[#0a0a0a] to-black/50 px-4 pb-3 border-b border-white/5 z-20"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">POS</h1>
            {selectedOrder && (
              <div className="text-xs text-gray-400 mt-1">
                Orden: <span className="text-cyan-400 font-bold">{selectedOrder.order_number}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(selectedCustomer || selectedOrder?.customer_name) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-xl border border-blue-500/30">
                <User className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-blue-400 truncate max-w-[150px]">{selectedCustomer?.name || selectedOrder?.customer_name}</span>
              </div>
            )}
            <button
              onClick={() => setShowRechargeDialog(true)}
              className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              <Zap className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCustomerSelector(true)}
              className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="pl-10 h-10 bg-white/5 border-white/10 text-white text-sm rounded-lg"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "Todo" },
            { id: "accesorios", label: "Accesorios" },
            { id: "devices", label: "Dispositivos" },
            { id: "offers", label: "Ofertas" },
            { id: "services", label: "Servicios" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
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
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item) => {
                const finalPrice = toCurrencyNumber(item._type === "product" ? calculateDiscountedPrice(item) : item.price);
                const cartQty = safeCart.find(c => c.id === item.id)?.quantity || 0;
                const isOutOfStock = item._type === 'product' && item.stock <= 0;

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => !isOutOfStock && addToCart(item, item._type)}
                    whileTap={{ scale: 0.95 }}
                    className={`relative bg-[#0a0a0a] rounded-xl p-3 border transition-all ${
                      cartQty > 0 
                        ? "ring-2 ring-cyan-500 border-cyan-500/50" 
                        : "border-white/10 hover:border-white/20"
                    } ${isOutOfStock ? "opacity-50 grayscale" : ""}`}
                    disabled={isOutOfStock}
                  >
                    <div className="text-left space-y-2">
                      <h3 className="text-xs font-semibold text-white line-clamp-2 leading-tight">{item.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-cyan-400">${finalPrice.toFixed(2)}</span>
                        {cartQty > 0 && (
                          <span className="text-xs font-bold px-2 py-1 bg-cyan-500 text-white rounded-full">{cartQty}</span>
                        )}
                      </div>
                    </div>
                    {isOutOfStock && (
                      <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center">
                        <span className="text-xs font-bold text-red-400">AGOTADO</span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 bg-[#0a0a0a] border-t border-white/5 px-4 py-3 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span className="text-white font-bold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>IVU (11.5%)</span>
              <span className="text-white font-bold">${tax.toFixed(2)}</span>
            </div>
            <div className="h-px bg-white/10 my-2"></div>
            <div className="flex justify-between text-lg font-bold text-cyan-400">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <Button
            onClick={() => {
              if (safeCart.length === 0) {
                toast.error("Agrega items al carrito");
                return;
              }
              setShowPaymentModal(true);
            }}
            disabled={safeCart.length === 0}
            className="w-full h-12 bg-cyan-600 hover:bg-cyan-700 font-bold rounded-lg"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Cobrar ${total.toFixed(2)}
          </Button>

          {safeCart.length > 0 && (
            <button
              onClick={clearCart}
              className="w-full py-2 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
            >
              Vaciar carrito
            </button>
          )}
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
          <CheckoutModalMobile
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
          orderBalance={orderBalance}
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
    </div>
  );
}
