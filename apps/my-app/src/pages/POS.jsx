import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart, Search, Plus, Minus, Trash2, User, AlertCircle,
  DollarSign, Package, X, Sparkles, CreditCard, Smartphone, Banknote,
  ArrowLeft, Gift, Star, Tag, TrendingUp, Zap,
  Landmark, FileText, History
} from "lucide-react";
import { toast } from "sonner";
import CustomerSelector from "../components/pos/CustomerSelector";
import ReceiptModal from "../components/pos/ReceiptModal";
import SalesHistoryDialog from "../components/pos/SalesHistoryDialog";
import UniversalPrintDialog from "../components/printing/UniversalPrintDialog";
import { useKeyboardScrollIntoView } from "@/components/utils/KeyboardAwareLayout";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import MobilePOS from "../components/pos/MobilePOS";
import { calculateDiscountedPrice } from "../components/inventory/DiscountBadge";
import OpenDrawerDialog from "../components/cash/OpenDrawerDialog";

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [cashReceived, setCashReceived] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [discountType, setDiscountType] = useState(null);
  const [discountValue, setDiscountValue] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [applyingCode, setApplyingCode] = useState(false);
  const [manualDiscountAmount, setManualDiscountAmount] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState({
    cash: true,
    card: true,
    ath_movil: true,
    bank_transfer: false,
    check: false
  });
  const [customPaymentMethods, setCustomPaymentMethods] = useState([]);
  const [athMovilPhone, setAthMovilPhone] = useState("");
  const [athMovilName, setAthMovilName] = useState("");
  const [taxRate, setTaxRate] = useState(0.115);
  const [showDrawerClosedAlert, setShowDrawerClosedAlert] = useState(false);
  const [showOpenDrawerModal, setShowOpenDrawerModal] = useState(false);

  const containerRef = useRef(null);
  useKeyboardScrollIntoView(containerRef);

  const urlParams = new URLSearchParams(window.location.search);
  const workOrderId = urlParams.get("workOrderId");
  const paymentMode = urlParams.get("mode") || "full";
  const balanceFromUrl = parseFloat(urlParams.get("balance")) || 0;

  const navigate = useNavigate();

  const CATEGORIES = useMemo(() => [
    { id: "accessories", label: "Accesorios", icon: Package, color: "from-purple-600 to-pink-600", count: products.filter(p => p.tipo_principal === "accesorios").length },
    { id: "devices", label: "Dispositivos", icon: Smartphone, color: "from-cyan-600 to-emerald-600", count: products.filter(p => p.tipo_principal === "dispositivos" && p.subcategoria === "dispositivo_completo").length },
    { id: "services", label: "Servicios", icon: Sparkles, color: "from-blue-600 to-indigo-600", count: services.length },
    { id: "offers", label: "Ofertas", icon: Tag, color: "from-orange-600 to-red-600", count: products.filter(p => p.discount_active && p.discount_percentage > 0 && (!p.discount_end_date || new Date(p.discount_end_date) >= new Date())).length }
  ], [products, services]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    loadInventory();
    loadPaymentMethods();
    loadTaxRate();
    checkCashDrawerStatus();
    if (workOrderId) loadWorkOrder();
    
    const pendingRecharge = sessionStorage.getItem("pending_recharge");
    if (pendingRecharge) {
      try {
        const rechargeData = JSON.parse(pendingRecharge);
        sessionStorage.removeItem("pending_recharge");
        
        setCart([{
          id: `recharge-${Date.now()}`,
          name: `Recarga ${rechargeData.carrier_display}`,
          price: rechargeData.amount,
          quantity: 1,
          type: "recharge",
          rechargeData: rechargeData
        }]);
        
        toast.success(`📱 Recarga de $${rechargeData.amount} agregada`);
      } catch (err) {
        console.error("Error loading pending recharge:", err);
      }
    }
  }, [workOrderId]);

  const checkCashDrawerStatus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const registers = await dataClient.entities.CashRegister.filter({
        date: today,
        status: "open"
      });

      if (!registers || registers.length === 0) {
        setTimeout(() => setShowDrawerClosedAlert(true), 500);
      }
    } catch (error) {
      console.error("Error verificando caja:", error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "payment-methods" });
      if (configs?.length) {
        const saved = configs[0].payload;
        setEnabledPaymentMethods(prev => ({ ...prev, ...saved }));
        setCustomPaymentMethods(saved.custom_methods || []);
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

  const loadInventory = async () => {
    setLoading(true);
    try {
      const [productsResponse, servicesResponse] = await Promise.all([
        dataClient.entities.Product.filter({ active: true }, undefined, 200),
        dataClient.entities.Service.filter({ active: true }, undefined, 100)
      ]);
      setProducts(productsResponse || []);
      setServices(servicesResponse || []);
    } catch (error) {
      console.error("Error loading inventory:", error);
      toast.error("Error cargando inventario");
    } finally {
      setLoading(false);
    }
  };

  const loadWorkOrder = async () => {
    try {
      const order = await dataClient.entities.Order.get(workOrderId);
      if (order) {
        const orderItems = order.order_items || [];
        let orderTotal = Number(order.total || 0);

        if (orderTotal === 0 && orderItems.length > 0) {
          const itemsSubtotal = orderItems.reduce((sum, item) => {
            const price = Number(item.price || 0);
            const qty = Number(item.qty || item.quantity || 1);
            return sum + price * qty;
          }, 0);
          const itemsTax = itemsSubtotal * 0.115;
          orderTotal = itemsSubtotal + itemsTax;
        }

        const totalPaid = Number(order.total_paid || order.amount_paid || 0);
        const actualBalance = Math.max(0, orderTotal - totalPaid);

        if (actualBalance <= 0.01) {
          toast.error("Esta orden ya está completamente pagada", {
            duration: 5000,
            description: `Total: $${orderTotal.toFixed(2)} | Pagado: $${totalPaid.toFixed(2)}`
          });
          setTimeout(() => window.history.back(), 2000);
          return;
        }

        if (totalPaid > 0) {
          toast.info(`Depósito previo: $${totalPaid.toFixed(2)}`, {
            duration: 4000,
            description: `Balance pendiente: $${actualBalance.toFixed(2)}`
          });
        }

        setCart(orderItems.map((item) => ({
          id: item.__source_id || item.id || `temp-${Date.now()}-${Math.random()}`,
          name: item.name,
          price: item.price,
          quantity: item.qty || item.quantity || 1,
          type: item.__kind || item.type || "product",
          stock: item.stock,
          sku: item.sku,
          code: item.code,
          originalPrice: item.originalPrice,
          discountApplied: item.discountApplied,
          discountLabel: item.discountLabel
        })));

        if (order.customer_id) {
          try {
            const customer = await dataClient.entities.Customer.get(order.customer_id);
            setSelectedCustomer(customer);
          } catch (e) {
            console.error("Error loading customer:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error loading work order:", error);
      toast.error("Error cargando orden de trabajo");
    }
  };

  const getCategoryItems = useCallback((category) => {
    const q = categorySearch.toLowerCase().trim();
    let items = [];

    if (category === "accessories") {
      items = products.filter(p => p.tipo_principal === "accesorios");
    } else if (category === "devices") {
      items = products.filter(p => p.tipo_principal === "dispositivos" && p.subcategoria === "dispositivo_completo");
    } else if (category === "offers") {
      items = products.filter(p => {
        const hasDiscount = p.discount_active && p.discount_percentage > 0;
        const notExpired = !p.discount_end_date || new Date(p.discount_end_date) >= new Date();
        return hasDiscount && notExpired;
      });
    } else if (category === "services") {
      items = services;
    }

    if (q) {
      items = items.filter(item =>
        (item.name || "").toLowerCase().includes(q) ||
        (item.sku || "").toLowerCase().includes(q) ||
        (item.code || "").toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q)
      );
    }

    return items.slice(0, 100);
  }, [products, services, categorySearch]);

  const addToCart = (item, type) => {
    const existingIndex = cart.findIndex((i) => i.id === item.id && i.type === type);

    const finalPrice = type === "product" ? calculateDiscountedPrice(item) : item.price;
    const hasDiscount = type === "product" && finalPrice < item.price;

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      const currentItem = updatedCart[existingIndex];
      const newQuantity = currentItem.quantity + 1;

      if (type === "product" && item.stock !== undefined && item.stock !== null && newQuantity > item.stock) {
        toast.warning(`Stock insuficiente. Solo quedan ${item.stock} unidades`);
        return;
      }

      currentItem.quantity = newQuantity;
      setCart(updatedCart);
      toast.success(`${item.name} añadido${hasDiscount ? ' 🏷️ CON OFERTA' : ''}`);
    } else {
      if (type === "product" && item.stock !== undefined && item.stock !== null && item.stock <= 0) {
        toast.error("Producto agotado");
        return;
      }

      setCart([...cart, {
        id: item.id,
        name: item.name,
        price: finalPrice,
        originalPrice: hasDiscount ? item.price : null,
        discountApplied: hasDiscount ? item.discount_percentage : null,
        discountLabel: hasDiscount ? item.discount_label : null,
        quantity: 1,
        type,
        stock: item.stock,
        sku: item.sku,
        code: item.code
      }]);
      toast.success(`✅ ${item.name}${hasDiscount ? ' 🏷️ CON OFERTA' : ''}`);
    }
    
    setShowCategoryModal(null);
    setCategorySearch("");
  };

  const updateCartQuantity = (index, delta) => {
    const updatedCart = [...cart];
    const currentItem = updatedCart[index];
    const newQuantity = currentItem.quantity + delta;

    if (newQuantity < 1) {
      removeItem(index);
      return;
    }

    if (currentItem.type === "product" && currentItem.stock !== undefined && currentItem.stock !== null && newQuantity > currentItem.stock) {
      toast.warning("Stock insuficiente");
      return;
    }

    currentItem.quantity = newQuantity;
    setCart(updatedCart);
  };

  const removeItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (!confirm("¿Vaciar el carrito?")) return;
    setCart([]);
    setPaymentMethod(null);
    setCashReceived("");
    setDepositAmount("");
    setAppliedDiscount(null);
    setDiscountType(null);
    setDiscountValue("");
    setDiscountCode("");
    setManualDiscountAmount("");
    setAthMovilPhone("");
    setAthMovilName("");
    setShowCategoryModal(null);
    setCategorySearch("");
    toast.info("Carrito vaciado");
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let discountAmount = 0;
  if (appliedDiscount) {
    if (appliedDiscount.type === 'percentage') {
      discountAmount = subtotal * (appliedDiscount.value / 100);
    } else if (appliedDiscount.type === 'fixed') {
      discountAmount = Math.min(appliedDiscount.value, subtotal);
    }
  }

  const subtotalAfterDiscount = subtotal - discountAmount;
  const tax = subtotalAfterDiscount * taxRate;
  const total = subtotalAfterDiscount + tax;

  const effectiveTotal = balanceFromUrl > 0 ? balanceFromUrl : total;

  const amountToPay = paymentMode === "deposit" && depositAmount ?
    Math.min(parseFloat(depositAmount) || 0, effectiveTotal) :
    effectiveTotal;

  const pointsToEarn = Math.floor(total);

  const change = paymentMethod === "cash" && cashReceived ?
    Math.max(0, parseFloat(cashReceived) - amountToPay) :
    0;

  const isPaymentValid = paymentMode === "deposit" ?
    depositAmount &&
    parseFloat(depositAmount) > 0 &&
    parseFloat(depositAmount) <= effectiveTotal &&
    paymentMethod && (
      paymentMethod === "cash" ? parseFloat(cashReceived) >= amountToPay :
      paymentMethod === "ath_movil" ? athMovilPhone && athMovilName : true
    ) :
    paymentMethod === "cash" ? parseFloat(cashReceived) >= effectiveTotal :
    paymentMethod === "ath_movil" ? athMovilPhone && athMovilName :
    paymentMethod ? true : false;

  const applyQuickDiscount = (percentage) => {
    setAppliedDiscount({
      type: 'percentage',
      value: percentage,
      description: `${percentage}% descuento`
    });
    setDiscountType(null);
    toast.success(`✅ Descuento del ${percentage}% aplicado`);
  };

  const applyManualDiscount = () => {
    const amount = parseFloat(manualDiscountAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    if (amount > subtotal) {
      toast.error("El descuento no puede ser mayor al subtotal");
      return;
    }

    setAppliedDiscount({
      type: 'fixed',
      value: amount,
      description: `Descuento de $${amount.toFixed(2)}`
    });
    setDiscountType(null);
    setManualDiscountAmount("");
    toast.success(`✅ Descuento de $${amount.toFixed(2)} aplicado`);
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountType(null);
    setDiscountValue("");
    setDiscountCode("");
    setManualDiscountAmount("");
    toast.info("Descuento removido");
  };

  const handleProcessPayment = async () => {
    if (!isPaymentValid) {
      toast.error("Monto de pago inválido");
      return;
    }

    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const registers = await dataClient.entities.CashRegister.filter({ date: today, status: "open" });

      if (!registers || registers.length === 0) {
        toast.error("⚠️ La caja está cerrada. Debes abrirla para procesar pagos.", { duration: 5000 });
        setShowPaymentModal(false);
        return;
      }
    } catch (error) {
      console.error("Error validando caja:", error);
      toast.error("Error verificando estado de la caja");
      return;
    }

    setProcessing(true);

    try {
      let me = null;
      try { me = await dataClient.auth.me(); } catch {}

      const amountPaid = paymentMethod === "cash" ? parseFloat(cashReceived) : amountToPay;

      const paymentDetails = {
        methods: [{ method: paymentMethod, amount: amountPaid }],
        change_given: change
      };

      if (paymentMethod === "ath_movil") {
        paymentDetails.ath_movil_info = {
          phone: athMovilPhone,
          name: athMovilName
        };
      }

      const now = new Date();
      const saleNumber = `S-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;

      const saleData = {
        sale_number: saleNumber,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || null,
        items: cart.map((item) => ({
          type: item.type === "recharge" ? "service" : item.type,
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          originalPrice: item.originalPrice,
          discountApplied: item.discountApplied,
          discountLabel: item.discountLabel,
          total: item.price * item.quantity
        })),
        subtotal,
        discount_amount: discountAmount,
        discount_code: appliedDiscount?.code || null,
        discount_type: appliedDiscount?.type || null,
        discount_value: appliedDiscount?.value || 0,
        tax_rate: taxRate,
        tax_amount: tax,
        total,
        amount_paid: amountPaid,
        amount_due: 0,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
        points_earned: paymentMode === "deposit" ? 0 : pointsToEarn,
        employee: me?.full_name || "Sistema",
        order_id: workOrderId || null,
        notes: paymentMode === "deposit" ? `Depósito parcial: $${amountPaid.toFixed(2)}` : ""
      };

      const sale = await dataClient.entities.Sale.create(saleData);

      const rechargeItems = cart.filter(item => item.type === "recharge");
      for (const item of rechargeItems) {
        if (item.rechargeData) {
          await dataClient.entities.Recharge.create({
            recharge_number: saleNumber,
            phone_number: item.rechargeData.phone_number,
            carrier: item.rechargeData.carrier,
            carrier_custom: item.rechargeData.carrier_custom || "",
            amount: item.rechargeData.amount,
            commission: item.rechargeData.commission,
            customer_name: item.rechargeData.customer_name,
            payment_method: paymentMethod,
            status: "completed",
            confirmation_code: item.rechargeData.confirmation_code,
            sale_id: sale.id,
            sale_number: saleNumber,
            employee_id: item.rechargeData.employee_id,
            employee_name: item.rechargeData.employee_name,
            notes: item.rechargeData.notes || ""
          });
        }
      }

      await dataClient.entities.Transaction.create({
        type: "revenue",
        amount: total,
        description: `Venta ${saleData.sale_number}${selectedCustomer ? ` - ${selectedCustomer.name}` : ''}${paymentMethod === "ath_movil" && athMovilName ? ` - ATH de ${athMovilName} (${athMovilPhone})` : ''}`,
        category: "repair_payment",
        payment_method: paymentMethod,
        recorded_by: me?.full_name || "Sistema",
        order_id: workOrderId || null,
        order_number: null,
        ...(paymentMethod === "ath_movil" && {
          payment_details: {
            ath_movil_phone: athMovilPhone,
            ath_movil_name: athMovilName
          }
        })
      });

      for (const item of cart) {
        if (item.type === "product") {
          const product = products.find((p) => p.id === item.id);
          if (product) {
            const newStock = Math.max(0, Number(product.stock || 0) - item.quantity);
            await dataClient.entities.Product.update(item.id, { stock: newStock });

            await dataClient.entities.InventoryMovement.create({
              product_id: item.id,
              product_name: item.name,
              movement_type: "sale",
              quantity: -item.quantity,
              previous_stock: product.stock || 0,
              new_stock: newStock,
              reference_type: "sale",
              reference_id: sale.id,
              reference_number: saleData.sale_number,
              notes: `Venta POS ${saleData.sale_number}`,
              performed_by: me?.full_name || "Sistema"
            });
          }
        }
      }

      if (selectedCustomer && paymentMode !== "deposit") {
        const currentPoints = Number(selectedCustomer.loyalty_points || 0);
        const newPoints = currentPoints + pointsToEarn;
        const newTotalSpent = Number(selectedCustomer.total_spent || 0) + total;

        let tier = 'bronze';
        if (newTotalSpent >= 5000) tier = 'platinum';
        else if (newTotalSpent >= 2000) tier = 'gold';
        else if (newTotalSpent >= 500) tier = 'silver';

        await dataClient.entities.Customer.update(selectedCustomer.id, {
          loyalty_points: newPoints,
          loyalty_tier: tier,
          total_spent: newTotalSpent,
          total_orders: (selectedCustomer.total_orders || 0) + 1
        });
      }

      if (appliedDiscount?.codeId) {
        try {
          const code = await dataClient.entities.DiscountCode.get(appliedDiscount.codeId);
          await dataClient.entities.DiscountCode.update(appliedDiscount.codeId, {
            times_used: (code.times_used || 0) + 1
          });
        } catch (e) {
          console.error("Error updating discount code usage:", e);
        }
      }

      let finalOrderDetails = null;
      if (workOrderId) {
        const order = await dataClient.entities.Order.get(workOrderId);
        const orderTotal = Number(order.total || 0);
        const currentPaid = Number(order.total_paid || order.amount_paid || 0);
        const newTotalPaid = currentPaid + amountPaid;
        const newBalance = Math.max(0, orderTotal - newTotalPaid);

        const updateData = {
          total_paid: newTotalPaid,
          amount_paid: newTotalPaid,
          balance_due: newBalance,
          paid: newBalance <= 0.01
        };

        if (paymentMode === "full" && newBalance <= 0.01) {
          const currentStatus = String(order.status || "").toLowerCase();
          const terminalStatuses = ["picked_up", "cancelled", "completed"];

          if (!terminalStatuses.includes(currentStatus)) {
            updateData.status = "ready_for_pickup";
          }
        }

        await dataClient.entities.Order.update(workOrderId, updateData);

        await dataClient.entities.WorkOrderEvent.create({
          order_id: workOrderId,
          order_number: order.order_number,
          event_type: "payment",
          description: `${paymentMode === "deposit" ? "Depósito recibido" : "Pago completo recibido"}: $${amountPaid.toFixed(2)} (${paymentMethod})${change > 0 ? ` - Cambio: $${change.toFixed(2)}` : ""}${paymentMethod === "ath_movil" && athMovilName ? ` - ATH de ${athMovilName} (${athMovilPhone})` : ""} | Balance pendiente: $${newBalance.toFixed(2)}`,
          user_name: me?.full_name || me?.email || "Sistema",
          user_id: me?.id || null,
          metadata: {
            amount: amountPaid,
            method: paymentMethod,
            change_given: change,
            total_paid: newTotalPaid,
            balance: newBalance,
            sale_number: saleData.sale_number,
            is_full_payment: newBalance <= 0.01,
            payment_mode: paymentMode,
            discount_amount: discountAmount,
            discount_code: appliedDiscount?.code,
            ...(paymentMethod === "ath_movil" && {
              ath_movil_phone: athMovilPhone,
              ath_movil_name: athMovilName
            })
          }
        });

        window.dispatchEvent(new CustomEvent('order-payment-processed', {
          detail: { orderId: workOrderId, amountPaid, newBalance, totalPaid: newTotalPaid }
        }));

        if (newBalance <= 0.01) {
          toast.success(`✅ ORDEN SALDADA`, { duration: 3000 });
        } else {
          toast.success(`✅ ${paymentMode === "deposit" ? "Depósito" : "Pago"} procesado - Balance: $${newBalance.toFixed(2)}`, { duration: 3000 });
        }

        finalOrderDetails = {
          order_id: order.id,
          order_number: order.order_number,
          order_total: orderTotal,
          initial_paid: currentPaid,
          total_paid_after_this_payment: newTotalPaid,
          balance_after_this_payment: newBalance,
          payment_mode: paymentMode,
          device_brand: order.device_brand,
          device_model: order.device_model,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone
        };
      } else {
        toast.success(`✅ Venta procesada exitosamente`, { duration: 3000 });
      }

      const receiptData = {
        ...saleData,
        customer: selectedCustomer,
        workOrder: finalOrderDetails
      };

      setCompletedSale(receiptData);
      setShowPaymentModal(false);
      setShowPrintDialog(true);

      window.dispatchEvent(new Event("force-refresh"));
      window.dispatchEvent(new CustomEvent("sale-completed", {
        detail: { saleId: sale.id, amount: total, method: paymentMethod }
      }));

      setCart([]);
      setPaymentMethod(null);
      setCashReceived("");
      setDepositAmount("");
      setAppliedDiscount(null);
      setDiscountType(null);
      setDiscountValue("");
      setDiscountCode("");
      setManualDiscountAmount("");
      setAthMovilPhone("");
      setAthMovilName("");

    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Error al procesar el pago: " + (error.message || "Error desconocido"));
    } finally {
      setProcessing(false);
    }
  };

  const quickCashAmounts = [20, 50, 100];
  const quickDepositAmounts = [50, 100, 150];

  if (isMobile) {
    return (
      <div>
        <MobilePOS
          products={products}
          services={services}
          cart={cart}
          addToCart={addToCart}
          updateCartQuantity={updateCartQuantity}
          removeItem={removeItem}
          clearCart={clearCart}
          selectedCustomer={selectedCustomer}
          onOpenCustomerSelector={() => setShowCustomerSelector(true)}
          onProceedToPayment={() => setShowPaymentModal(true)}
          subtotal={subtotal}
          tax={tax}
          total={total}
          discountAmount={discountAmount}
          appliedDiscount={appliedDiscount}
          removeDiscount={removeDiscount}
          applyQuickDiscount={applyQuickDiscount}
          setDiscountType={setDiscountType}
          discountType={discountType}
          manualDiscountAmount={manualDiscountAmount}
          setManualDiscountAmount={setManualDiscountAmount}
          applyManualDiscount={applyManualDiscount}
          loading={loading}
          searchQuery={categorySearch}
          setSearchQuery={setCategorySearch}
          filteredProducts={getCategoryItems("accessories")}
          filteredServices={services}
          activeTab="accessories"
          setActiveTab={(tab) => setShowCategoryModal(tab)}
          workOrderId={workOrderId}
          paymentMode={paymentMode}
          balanceFromUrl={balanceFromUrl}
          pointsToEarn={pointsToEarn}
          enabledPaymentMethods={enabledPaymentMethods}
        />

        <CustomerSelector
          open={showCustomerSelector}
          onClose={() => setShowCustomerSelector(false)}
          onSelect={(customer) => {
            setSelectedCustomer(customer);
            setShowCustomerSelector(false);
            if (customer) toast.success(`Cliente "${customer.name}" seleccionado`);
          }}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={(customer) => {
            setSelectedCustomer(customer);
            setShowCustomerSelector(false);
            if (customer) toast.success(`Cliente "${customer.name}" seleccionado`);
          }}
        />

        {showPrintDialog && completedSale && (
          <UniversalPrintDialog
            open={showPrintDialog}
            onClose={() => {
              setShowPrintDialog(false);
              setCompletedSale(null);
              setSelectedCustomer(null);
              if (workOrderId) window.history.back();
            }}
            type="sale"
            data={completedSale}
            customer={selectedCustomer}
          />
        )}

        {showPaymentModal && (
          <div className="fixed inset-0 z-[100]">
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowPaymentModal(false)} />
            <div className="absolute inset-0 grid place-items-center p-4 overflow-y-auto">
              <div className="w-full max-w-md bg-white rounded-2xl p-6 theme-dark:bg-[#0F0F12] theme-dark:border theme-dark:border-white/10">
                {/* ... contenido del modal móvil ... */}
              </div>
            </div>
          </div>
        )}

        <SalesHistoryDialog
          open={showSalesHistory}
          onClose={() => setShowSalesHistory(false)}
        />

        {showDrawerClosedAlert && !showOpenDrawerModal && (
          <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-amber-600/20 to-red-600/20 border-2 border-amber-500/50 rounded-2xl p-8 max-w-md w-full shadow-[0_24px_80px_rgba(245,158,11,0.5)]">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <AlertCircle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-black text-white mb-4">🔒 Caja Cerrada</h2>
                <p className="text-amber-200 text-base mb-6 leading-relaxed">
                  La caja registradora está cerrada. Debes abrirla para procesar pagos.
                </p>
                <p className="text-white font-semibold mb-8">¿Deseas abrir la caja ahora?</p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowDrawerClosedAlert(false);
                      navigate(-1);
                    }}
                    variant="outline"
                    className="flex-1 border-gray-400 text-gray-300 hover:bg-gray-700 h-12 text-base font-semibold"
                  >
                    No, volver
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDrawerClosedAlert(false);
                      setShowOpenDrawerModal(true);
                    }}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 h-12 text-base font-bold shadow-[0_8px_24px_rgba(16,185,129,0.4)]"
                  >
                    ✅ Sí, abrir caja
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showOpenDrawerModal && (
          <OpenDrawerDialog
            open={showOpenDrawerModal}
            onClose={() => setShowOpenDrawerModal(false)}
            onSuccess={() => {
              setShowOpenDrawerModal(false);
              toast.success("✅ Caja abierta");
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-screen flex flex-col bg-[#0A0A0A] theme-light:bg-gradient-to-br theme-light:from-gray-50 theme-light:to-gray-100"
      data-keyboard-aware
    >
      {/* Header - Cliente e Historial */}
      <div className="relative bg-gradient-to-r from-cyan-600/10 via-emerald-600/10 to-lime-600/10 backdrop-blur-xl border-b border-cyan-500/20 p-4 sm:p-6 theme-light:bg-white theme-light:border-gray-200">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-emerald-500/5 blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 theme-light:text-gray-900">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-50"></div>
                  <ShoppingCart className="relative w-7 h-7 sm:w-8 sm:h-8 text-cyan-500" />
                </div>
                Punto de Venta
              </h1>
              {workOrderId && (
                <Badge className="mt-2 bg-gradient-to-r from-cyan-600/30 to-emerald-600/30 text-cyan-200 border border-cyan-500/40 shadow-lg theme-light:from-cyan-100 theme-light:to-emerald-100 theme-light:text-cyan-700 theme-light:border-cyan-300">
                  🎯 Cobrando Orden {paymentMode === "deposit" ? "(Depósito)" : "(Total)"}
                  {balanceFromUrl > 0 && ` • $${balanceFromUrl.toFixed(2)}`}
                </Badge>
              )}
            </div>

            <Button
              onClick={() => setShowSalesHistory(true)}
              variant="outline"
              size="sm"
              className="border-2 border-purple-500/30 text-purple-400 hover:bg-purple-600/20 hover:border-purple-500/50 theme-light:border-purple-300 theme-light:text-purple-700 theme-light:hover:bg-purple-50"
            >
              <History className="w-4 h-4 sm:w-5 sm:h-5 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Historial</span>
            </Button>
          </div>

          {/* Cliente y botones de categorías */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Cliente */}
            <div className="flex-1">
              {!selectedCustomer ? (
                <button
                  onClick={() => setShowCustomerSelector(true)}
                  className="w-full group overflow-hidden rounded-xl p-4 border-2 border-dashed border-gray-600/50 hover:border-cyan-500/50 transition-all bg-slate-800/30 hover:bg-slate-800/50 theme-light:bg-gray-100 theme-light:border-gray-300 theme-light:hover:border-cyan-500/50 theme-light:hover:bg-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border-2 border-gray-600/50 flex items-center justify-center group-hover:scale-110 transition-transform theme-light:from-gray-200 theme-light:to-gray-300 theme-light:border-gray-400">
                      <User className="w-5 h-5 text-gray-400 theme-light:text-gray-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-bold text-sm theme-light:text-gray-900">Añadir Cliente</p>
                      <p className="text-xs text-gray-400 theme-light:text-gray-600">Opcional</p>
                    </div>
                    <Plus className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors theme-light:text-gray-600 theme-light:group-hover:text-cyan-500" />
                  </div>
                </button>
              ) : (
                <div className="overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600/20 via-emerald-600/20 to-lime-600/20 border-2 border-cyan-500/40 p-4 theme-light:from-cyan-50 theme-light:via-emerald-50 theme-light:to-lime-50 theme-light:border-cyan-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm theme-light:text-gray-900">{selectedCustomer.name}</p>
                        <p className="text-cyan-200 text-xs theme-light:text-gray-700">{selectedCustomer.phone}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-white/70 hover:text-white hover:bg-white/10 theme-light:text-gray-600 theme-light:hover:text-gray-900 theme-light:hover:bg-gray-100"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Botones de categorías */}
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setShowCategoryModal(cat.id)}
                    disabled={cat.count === 0}
                    className={`relative overflow-hidden rounded-xl p-3 sm:p-4 border-2 transition-all group ${
                      cat.count === 0
                        ? "opacity-40 cursor-not-allowed bg-black/20 border-slate-800 theme-light:bg-gray-100 theme-light:border-gray-200"
                        : `bg-gradient-to-br ${cat.color}/20 border-current/40 hover:border-current/70 hover:shadow-lg active:scale-95`
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${cat.color}/0 group-hover:${cat.color}/20 transition-all duration-300`}></div>
                    <div className="relative flex flex-col items-center gap-1.5">
                      <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${cat.id === 'offers' ? 'text-orange-400 animate-pulse' : 'text-white'} theme-light:text-gray-900`} />
                      <span className="text-xs sm:text-sm font-bold text-white theme-light:text-gray-900 text-center leading-tight">
                        {cat.label}
                      </span>
                      <Badge className="bg-white/20 text-white text-[10px] px-1.5 py-0 theme-light:bg-gray-900/10 theme-light:text-gray-900">
                        {cat.count}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Carrito - Ocupa toda la pantalla */}
      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 py-6 pb-24">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-cyan-500 blur-3xl opacity-20"></div>
              <ShoppingCart className="relative w-32 h-32 text-gray-700 opacity-20 theme-light:text-gray-400" />
            </div>
            <h2 className="text-3xl font-black text-gray-600 mb-3 theme-light:text-gray-700">Carrito Vacío</h2>
            <p className="text-lg text-gray-500 theme-light:text-gray-600">Selecciona una categoría arriba para añadir productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-32">
            {cart.map((item, index) => (
              <div
                key={`${item.id}-${index}-${item.type}`}
                className="group relative overflow-hidden bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl border-2 border-white/10 hover:border-cyan-500/50 rounded-2xl p-5 transition-all hover:shadow-[0_12px_40px_rgba(0,168,232,0.2)] theme-light:from-white theme-light:to-gray-50 theme-light:border-gray-200 theme-light:hover:border-cyan-500/50 theme-light:hover:shadow-lg"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/5 to-transparent blur-2xl"></div>

                <div className="relative flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="font-bold text-white text-base mb-2 theme-light:text-gray-900">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={item.type === "service" ?
                          "bg-blue-600/30 text-blue-200 border-blue-500/50 theme-light:bg-blue-100 theme-light:text-blue-700 theme-light:border-blue-300" :
                          "bg-emerald-600/30 text-emerald-200 border-emerald-500/50 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300"
                        }>
                          {item.type === "service" ? "🔧 Servicio" : "📦 Producto"}
                        </Badge>
                        {item.discountApplied && (
                          <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white animate-pulse">
                            🏷️ -{item.discountApplied}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-600/20 flex-shrink-0 theme-light:text-red-600 theme-light:hover:text-red-700 theme-light:hover:bg-red-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10 theme-light:border-gray-200">
                    <div className="text-gray-400 text-sm theme-light:text-gray-600">
                      ${item.price.toFixed(2)} c/u
                      {item.originalPrice && (
                        <span className="ml-2 line-through text-xs text-gray-600">
                          ${item.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-gradient-to-r from-cyan-600/20 to-emerald-600/20 backdrop-blur-sm rounded-xl p-1.5 border-2 border-cyan-500/30 theme-light:from-gray-100 theme-light:to-gray-200 theme-light:border-gray-300">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-white hover:bg-cyan-600/40 rounded-lg theme-light:text-gray-800 theme-light:hover:bg-gray-300"
                          onClick={() => updateCartQuantity(index, -1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-10 text-center font-black text-white text-lg theme-light:text-gray-900">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-white hover:bg-cyan-600/40 rounded-lg theme-light:text-gray-800 theme-light:hover:bg-gray-300"
                          onClick={() => updateCartQuantity(index, 1)}
                          disabled={item.type === "product" && item.stock !== null && item.quantity >= item.stock}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent min-w-[100px] text-right theme-light:from-cyan-600 theme-light:to-emerald-600">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botón de pago flotante */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setShowPaymentModal(true)}
            className="h-16 px-8 bg-gradient-to-r from-cyan-600 via-emerald-600 to-lime-600 hover:from-cyan-700 hover:via-emerald-700 hover:to-lime-700 shadow-[0_16px_48px_rgba(0,168,232,0.6)] font-black text-xl rounded-2xl"
          >
            <DollarSign className="w-7 h-7 mr-3" />
            PAGAR ${effectiveTotal.toFixed(2)}
          </Button>
        </div>
      )}

      {/* MODAL DE CATEGORÍAS */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md">
          <div className="h-full flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-[#111114] to-[#0D0D0D] border-2 border-cyan-500/30 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-[0_24px_80px_rgba(0,168,232,0.6)] theme-light:bg-white theme-light:border-gray-300">
              {/* Header del modal */}
              <div className="flex items-center justify-between p-5 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-600/10 to-emerald-600/10 theme-light:border-gray-200 theme-light:from-cyan-50 theme-light:to-emerald-50">
                <h2 className="text-2xl font-black text-white flex items-center gap-3 theme-light:text-gray-900">
                  {showCategoryModal === "accessories" && <><Package className="w-7 h-7 text-purple-400" /> Accesorios</>}
                  {showCategoryModal === "devices" && <><Smartphone className="w-7 h-7 text-cyan-400" /> Dispositivos</>}
                  {showCategoryModal === "services" && <><Sparkles className="w-7 h-7 text-blue-400" /> Servicios</>}
                  {showCategoryModal === "offers" && <><Tag className="w-7 h-7 text-orange-400 animate-pulse" /> Ofertas 🔥</>}
                  <Badge className="bg-white/10 text-white theme-light:bg-gray-900/10 theme-light:text-gray-900">
                    {getCategoryItems(showCategoryModal).length}
                  </Badge>
                </h2>
                <button
                  onClick={() => {
                    setShowCategoryModal(null);
                    setCategorySearch("");
                  }}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:rotate-90 theme-light:bg-gray-100 theme-light:hover:bg-gray-200"
                >
                  <X className="w-6 h-6 text-white theme-light:text-gray-900" />
                </button>
              </div>

              {/* Búsqueda del modal */}
              <div className="px-5 pt-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="🔍 Buscar..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="pl-12 h-12 bg-black/40 border-2 border-cyan-500/30 text-white placeholder:text-gray-500 focus:border-cyan-500/60 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                    autoFocus
                  />
                </div>
              </div>

              {/* Grid de productos */}
              <div className="flex-1 overflow-y-auto p-5">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-400 theme-light:text-gray-600">Cargando...</p>
                    </div>
                  </div>
                ) : getCategoryItems(showCategoryModal).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Package className="w-20 h-20 text-gray-700 mb-4 opacity-30 theme-light:text-gray-400" />
                    <p className="text-xl text-gray-400 mb-2 theme-light:text-gray-600">
                      {categorySearch ? "No se encontraron resultados" : "Sin items"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {getCategoryItems(showCategoryModal).map((item) => {
                      const isProduct = showCategoryModal !== "services";
                      const finalPrice = isProduct ? calculateDiscountedPrice(item) : item.price;
                      const hasDiscount = isProduct && finalPrice < item.price;
                      const inCart = cart.find(i => i.id === item.id);
                      const qtyInCart = inCart?.quantity || 0;
                      const isOutOfStock = isProduct && item.stock <= 0;
                      const isLowStock = isProduct && item.stock > 0 && item.stock <= (item.min_stock || 5);

                      return (
                        <button
                          key={item.id}
                          onClick={() => !isOutOfStock && addToCart(item, isProduct ? "product" : "service")}
                          disabled={isOutOfStock}
                          className={`relative group overflow-hidden rounded-xl p-4 border-2 transition-all min-h-[140px] ${
                            isOutOfStock
                              ? "opacity-40 cursor-not-allowed bg-red-900/20 border-red-600/30"
                              : hasDiscount
                              ? "bg-gradient-to-br from-orange-800/60 to-red-900/60 border-orange-500/40 hover:border-orange-400/70 hover:shadow-[0_12px_32px_rgba(249,115,22,0.5)] active:scale-95"
                              : "bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_12px_32px_rgba(0,168,232,0.3)] active:scale-95 theme-light:from-white theme-light:to-gray-50 theme-light:border-gray-200"
                          }`}
                        >
                          {qtyInCart > 0 && (
                            <div className="absolute -top-2 -left-2 bg-gradient-to-r from-red-500 to-red-700 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg border-2 border-white animate-bounce z-10">
                              {qtyInCart}
                            </div>
                          )}

                          {hasDiscount && (
                            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-3 py-1 rounded-full text-xs font-black shadow-lg z-10 animate-pulse">
                              🏷️ -{item.discount_percentage}%
                            </div>
                          )}

                          <div className="h-full flex flex-col justify-between">
                            <div>
                              <h3 className="font-bold text-white text-sm mb-2 line-clamp-2 min-h-[2.5rem] theme-light:text-gray-900">
                                {item.name}
                              </h3>
                              {(item.sku || item.code) && (
                                <p className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded inline-block mb-2 theme-light:bg-gray-100 theme-light:text-gray-600">
                                  {item.sku || item.code}
                                </p>
                              )}
                            </div>

                            <div className="flex items-end justify-between pt-3 border-t border-white/10 theme-light:border-gray-200">
                              <div>
                                <div className={`text-lg font-black ${hasDiscount ? 'text-orange-400' : showCategoryModal === 'services' ? 'text-blue-400' : 'text-cyan-400'} theme-light:${hasDiscount ? 'text-orange-600' : showCategoryModal === 'services' ? 'text-blue-600' : 'text-cyan-600'}`}>
                                  ${finalPrice.toFixed(2)}
                                </div>
                                {hasDiscount && (
                                  <div className="text-xs text-gray-500 line-through">
                                    ${item.price.toFixed(2)}
                                  </div>
                                )}
                              </div>

                              {isProduct && (
                                isOutOfStock ? (
                                  <Badge className="bg-red-600/30 text-red-200 border-red-500/50 text-[9px] px-1.5 py-0">AGOTADO</Badge>
                                ) : isLowStock ? (
                                  <Badge className="bg-yellow-600/30 text-yellow-200 border-yellow-500/50 text-[9px] px-1.5 py-0 animate-pulse">
                                    {item.stock} ⚠️
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-600/30 text-emerald-200 border-emerald-500/50 text-[9px] px-1.5 py-0">
                                    {item.stock} ✓
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <CustomerSelector
        open={showCustomerSelector}
        onClose={() => setShowCustomerSelector(false)}
        onSelect={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerSelector(false);
          if (customer) toast.success(`Cliente "${customer.name}" seleccionado`);
        }}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerSelector(false);
          if (customer) toast.success(`Cliente "${customer.name}" seleccionado`);
        }}
      />

      {showPrintDialog && completedSale && (
        <UniversalPrintDialog
          open={showPrintDialog}
          onClose={() => {
            setShowPrintDialog(false);
            setCompletedSale(null);
            setSelectedCustomer(null);
            if (workOrderId) window.history.back();
          }}
          type="sale"
          data={completedSale}
          customer={selectedCustomer}
        />
      )}

      <SalesHistoryDialog
        open={showSalesHistory}
        onClose={() => setShowSalesHistory(false)}
      />

      {showDrawerClosedAlert && !showOpenDrawerModal && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-amber-600/20 to-red-600/20 border-2 border-amber-500/50 rounded-2xl p-8 max-w-md w-full shadow-[0_24px_80px_rgba(245,158,11,0.5)]">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <AlertCircle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-4">🔒 Caja Cerrada</h2>
              <p className="text-amber-200 text-base mb-6 leading-relaxed">
                La caja registradora está cerrada. Debes abrirla para procesar pagos.
              </p>
              <p className="text-white font-semibold mb-8">¿Deseas abrir la caja ahora?</p>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowDrawerClosedAlert(false);
                    navigate(createPageUrl("Dashboard"));
                  }}
                  variant="outline"
                  className="flex-1 border-gray-400 text-gray-300 hover:bg-gray-700 h-12 text-base font-semibold"
                >
                  No, volver
                </Button>
                <Button
                  onClick={() => {
                    setShowDrawerClosedAlert(false);
                    setShowOpenDrawerModal(true);
                  }}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 h-12 text-base font-bold shadow-[0_8px_24px_rgba(16,185,129,0.4)]"
                >
                  ✅ Sí, abrir caja
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOpenDrawerModal && (
        <OpenDrawerDialog
          open={showOpenDrawerModal}
          onClose={() => {
            setShowOpenDrawerModal(false);
            navigate(createPageUrl("Dashboard"));
          }}
          onSuccess={() => {
            setShowOpenDrawerModal(false);
            setShowDrawerClosedAlert(false);
            toast.success("✅ Caja abierta");
          }}
        />
      )}

      {/* MODAL DE PAGO */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => {
            setShowPaymentModal(false);
            setPaymentMethod(null);
            setCashReceived("");
            setDepositAmount("");
            setAthMovilPhone("");
            setAthMovilName("");
          }} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0F0F12] border-2 border-cyan-500/30 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,168,232,0.3)] max-h-[90vh] overflow-y-auto theme-light:bg-white theme-light:border-gray-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-white flex items-center gap-2 theme-light:text-gray-900">
                  {paymentMode === "deposit" ? "💰 Depósito" : "💳 Pago"}
                </h3>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentMethod(null);
                    setCashReceived("");
                    setDepositAmount("");
                    setAthMovilPhone("");
                    setAthMovilName("");
                  }}
                  className="text-gray-400 hover:text-white theme-light:text-gray-600 theme-light:hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Resumen de Items */}
              <div className="mb-6 bg-black/40 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
                <h4 className="text-sm font-bold text-cyan-400 mb-3 theme-light:text-cyan-700">📦 Resumen de Compra</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 theme-light:text-gray-700">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="text-white font-semibold theme-light:text-gray-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-white/10 space-y-1 theme-light:border-gray-300">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 theme-light:text-gray-600">Subtotal</span>
                    <span className="text-white theme-light:text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400 theme-light:text-green-700">Descuento</span>
                      <span className="text-green-400 theme-light:text-green-700">-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 theme-light:text-gray-600">IVU (11.5%)</span>
                    <span className="text-white theme-light:text-gray-900">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black pt-2 border-t border-cyan-500/30 theme-light:border-cyan-300">
                    <span className="text-cyan-400 theme-light:text-cyan-700">Total</span>
                    <span className="text-cyan-400 theme-light:text-cyan-700">${effectiveTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {paymentMode === "deposit" && !paymentMethod && (
                <div className="space-y-4 mb-6">
                  <label className="text-gray-300 text-sm font-bold theme-light:text-gray-700">Monto del depósito</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-black/60 border-2 border-cyan-500/30 text-white h-16 text-3xl text-center font-black focus:border-cyan-500/60 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                    autoFocus
                    min="0.01"
                    max={total}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    {quickDepositAmounts.map((amt) => (
                      <Button
                        key={amt}
                        variant="outline"
                        onClick={() => setDepositAmount(String(Math.min(amt, total)))}
                        className="h-12 border-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 hover:border-emerald-500/50 font-bold theme-light:border-emerald-300 theme-light:text-emerald-700 theme-light:hover:bg-emerald-100"
                      >
                        ${amt}
                      </Button>
                    ))}
                  </div>

                  {depositAmount && parseFloat(depositAmount) > 0 && (
                    <div className="bg-blue-600/10 border-2 border-blue-500/30 rounded-xl p-4 theme-light:bg-blue-50 theme-light:border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-300 text-sm theme-light:text-blue-700">Balance restante</span>
                        <span className="text-blue-400 font-black text-xl theme-light:text-blue-800">
                          ${(total - parseFloat(depositAmount)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(paymentMode !== "deposit" || (depositAmount && parseFloat(depositAmount) > 0)) && !paymentMethod && (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm font-bold theme-light:text-gray-700">Selecciona método de pago</p>

                  {enabledPaymentMethods.cash && (
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-2 border-green-500/40 rounded-2xl hover:border-green-400/60 transition-all group theme-light:from-green-50 theme-light:to-emerald-50 theme-light:border-green-300 theme-light:hover:border-green-400"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Banknote className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-lg theme-light:text-gray-900">Efectivo</p>
                        <p className="text-sm text-gray-400 theme-light:text-gray-600">Ingresa monto recibido</p>
                      </div>
                    </button>
                  )}

                  {enabledPaymentMethods.card && (
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-2 border-blue-500/40 rounded-2xl hover:border-blue-400/60 transition-all group theme-light:from-blue-50 theme-light:to-cyan-50 theme-light:border-blue-300 theme-light:hover:border-blue-400"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <CreditCard className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-lg theme-light:text-gray-900">Tarjeta</p>
                        <p className="text-sm text-gray-400 theme-light:text-gray-600">Exacto: ${amountToPay.toFixed(2)}</p>
                      </div>
                    </button>
                  )}

                  {enabledPaymentMethods.ath_movil && (
                    <button
                      onClick={() => setPaymentMethod("ath_movil")}
                      className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-orange-600/20 to-amber-600/20 border-2 border-orange-500/40 rounded-2xl hover:border-orange-400/60 transition-all group theme-light:from-orange-50 theme-light:to-amber-50 theme-light:border-orange-300 theme-light:hover:border-orange-400"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Smartphone className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-lg theme-light:text-gray-900">ATH Móvil</p>
                        <p className="text-sm text-gray-400 theme-light:text-gray-600">Exacto: ${amountToPay.toFixed(2)}</p>
                      </div>
                    </button>
                  )}

                  {enabledPaymentMethods.bank_transfer && (
                    <button
                      onClick={() => setPaymentMethod("bank_transfer")}
                      className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-600/20 to-purple-800/20 border-2 border-purple-500/40 rounded-2xl hover:border-purple-400/60 transition-all group theme-light:from-purple-50 theme-light:to-purple-100 theme-light:border-purple-300 theme-light:hover:border-purple-400"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Landmark className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-lg theme-light:text-gray-900">Transferencia</p>
                        <p className="text-sm text-gray-400 theme-light:text-gray-600">Exacto: ${amountToPay.toFixed(2)}</p>
                      </div>
                    </button>
                  )}

                  {enabledPaymentMethods.check && (
                    <button
                      onClick={() => setPaymentMethod("check")}
                      className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-gray-600/20 to-gray-800/20 border-2 border-gray-500/40 rounded-2xl hover:border-gray-400/60 transition-all group theme-light:from-gray-50 theme-light:to-gray-100 theme-light:border-gray-300 theme-light:hover:border-gray-400"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <FileText className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-lg theme-light:text-gray-900">Cheque</p>
                        <p className="text-sm text-gray-400 theme-light:text-gray-600">Exacto: ${amountToPay.toFixed(2)}</p>
                      </div>
                    </button>
                  )}

                  {customPaymentMethods.map((method, index) => (
                    <button
                      key={`custom-${index}`}
                      onClick={() => setPaymentMethod(method.toLowerCase().replace(/\s+/g, '_'))}
                      className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-pink-600/20 to-purple-600/20 border-2 border-pink-500/40 rounded-2xl hover:border-pink-400/60 transition-all group theme-light:from-pink-50 theme-light:to-purple-50 theme-light:border-pink-300 theme-light:hover:border-pink-400"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <DollarSign className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-lg theme-light:text-gray-900">{method}</p>
                        <p className="text-sm text-gray-400 theme-light:text-gray-600">Exacto: ${amountToPay.toFixed(2)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {paymentMethod && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl theme-light:bg-gray-100">
                    {paymentMethod === "cash" && <Banknote className="w-6 h-6 text-green-400 theme-light:text-green-700" />}
                    {paymentMethod === "card" && <CreditCard className="w-6 h-6 text-blue-400 theme-light:text-blue-700" />}
                    {paymentMethod === "ath_movil" && <Smartphone className="w-6 h-6 text-orange-400 theme-light:text-orange-700" />}
                    {paymentMethod === "bank_transfer" && <Landmark className="w-6 h-6 text-purple-400 theme-light:text-purple-700" />}
                    {paymentMethod === "check" && <FileText className="w-6 h-6 text-gray-400 theme-light:text-gray-700" />}
                    {!["cash", "card", "ath_movil", "bank_transfer", "check"].includes(paymentMethod) && <DollarSign className="w-6 h-6 text-pink-400 theme-light:text-pink-700" />}
                    <span className="text-white font-bold flex-1 theme-light:text-gray-900">
                      {paymentMethod === "cash" ? "Efectivo" :
                        paymentMethod === "card" ? "Tarjeta" :
                        paymentMethod === "ath_movil" ? "ATH Móvil" :
                        paymentMethod === "bank_transfer" ? "Transferencia" :
                        paymentMethod === "check" ? "Cheque" :
                        customPaymentMethods.find(m => m.toLowerCase().replace(/\s+/g, '_') === paymentMethod) || paymentMethod}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPaymentMethod(null);
                        setCashReceived("");
                        setAthMovilPhone("");
                        setAthMovilName("");
                      }}
                      className="text-gray-400 hover:text-white theme-light:text-gray-600 theme-light:hover:text-gray-900"
                    >
                      Cambiar
                    </Button>
                  </div>

                  {paymentMethod === "cash" && (
                    <>
                      <div>
                        <label className="text-gray-300 text-sm font-bold mb-2 block theme-light:text-gray-700">
                          Efectivo recibido
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder="0.00"
                          className="bg-black/60 border-2 border-cyan-500/30 text-white h-16 text-3xl text-center font-black theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                          autoFocus
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {quickCashAmounts.map((amt) => (
                          <Button
                            key={amt}
                            variant="outline"
                            onClick={() => setCashReceived(String(amt))}
                            className="h-12 border-2 border-green-500/30 text-green-400 hover:bg-green-600/20 hover:border-green-500/50 font-bold theme-light:border-green-300 theme-light:text-green-700 theme-light:hover:bg-green-100"
                          >
                            ${amt}
                          </Button>
                        ))}
                      </div>

                      {change > 0 && (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600/20 to-lime-600/20 border-2 border-emerald-500/40 p-5 theme-light:from-emerald-50 theme-light:to-lime-50 theme-light:border-emerald-300">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-300 font-bold text-lg theme-light:text-emerald-700">Cambio</span>
                            <span className="text-emerald-400 font-black text-4xl theme-light:text-emerald-800">${change.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {paymentMethod === "ath_movil" && (
                    <div className="space-y-3">
                      <div className="bg-orange-600/10 border-2 border-orange-500/30 rounded-2xl p-5 theme-light:bg-orange-50 theme-light:border-orange-300">
                        <div className="flex justify-between items-center">
                          <span className="text-orange-300 font-bold theme-light:text-orange-700">Se cobrará</span>
                          <span className="text-orange-400 font-black text-4xl theme-light:text-orange-800">${amountToPay.toFixed(2)}</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-gray-300 text-sm font-bold mb-2 block theme-light:text-gray-700">
                          📱 Teléfono del pagador *
                        </label>
                        <Input
                          type="tel"
                          value={athMovilPhone}
                          onChange={(e) => setAthMovilPhone(e.target.value)}
                          placeholder="787-123-4567"
                          className="bg-black/60 border-2 border-orange-500/30 text-white h-12 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                        />
                      </div>

                      <div>
                        <label className="text-gray-300 text-sm font-bold mb-2 block theme-light:text-gray-700">
                          👤 Nombre del pagador *
                        </label>
                        <Input
                          type="text"
                          value={athMovilName}
                          onChange={(e) => setAthMovilName(e.target.value)}
                          placeholder="Nombre completo"
                          className="bg-black/60 border-2 border-orange-500/30 text-white h-12 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                        />
                      </div>

                      {(!athMovilPhone || !athMovilName) && (
                        <div className="p-3 bg-amber-600/10 border border-amber-500/30 rounded-xl theme-light:bg-amber-50 theme-light:border-amber-300">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-400 theme-light:text-amber-700" />
                            <span className="text-amber-300 text-sm theme-light:text-amber-700">
                              Completa los datos del pagador
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(paymentMethod === "card" || paymentMethod === "bank_transfer" || paymentMethod === "check" || (!["cash", "ath_movil"].includes(paymentMethod) && paymentMethod)) && (
                    <div className="bg-blue-600/10 border-2 border-blue-500/30 rounded-2xl p-5 theme-light:bg-blue-50 theme-light:border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-300 font-bold theme-light:text-blue-700">Se cobrará</span>
                        <span className="text-blue-400 font-black text-4xl theme-light:text-blue-800">${amountToPay.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleProcessPayment}
                    disabled={processing || !isPaymentValid}
                    className="w-full h-16 bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600 hover:from-emerald-700 hover:via-green-700 hover:to-lime-700 shadow-[0_12px_40px_rgba(5,150,105,0.5)] disabled:opacity-50 font-black text-xl"
                  >
                    {processing ? (
                      "PROCESANDO..."
                    ) : (
                      <>
                        <Zap className="w-7 h-7 mr-3" />
                        CONFIRMAR ${amountToPay.toFixed(2)}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
