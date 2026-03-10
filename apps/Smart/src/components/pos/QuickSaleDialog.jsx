import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  DollarSign,
  Package,
  Search,
  X,
  Tag,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import PaymentModal from "./PaymentModal";
import CustomerSelector from "./CustomerSelector";
import StockWarningBadge, { canAddToCart } from "./StockWarningBadge";

export default function QuickSaleDialog({ open, onClose, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [total, setTotal] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stockWarnings, setStockWarnings] = useState([]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const [productsData, servicesData] = await Promise.all([
        base44.entities.Product.filter({ active: true }),
        base44.entities.Service.filter({ active: true })
      ]);
      setProducts(productsData || []);
      setServices(servicesData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const checkStockAvailability = (productId, requestedQty) => {
    const product = products.find(p => p.id === productId);
    if (!product) return { available: false, message: "Producto no encontrado" };

    const currentStock = Number(product.stock || 0);
    const cartItem = cartItems.find(item => item.id === productId && item.type === "product");
    const qtyInCart = cartItem ? cartItem.quantity : 0;
    const totalRequested = qtyInCart + requestedQty;

    if (currentStock === 0) {
      return {
        available: false,
        message: "⛔ Producto AGOTADO"
      };
    }

    if (totalRequested > currentStock) {
      return {
        available: false,
        message: `⚠️ Stock insuficiente. Disponible: ${currentStock}, en carrito: ${qtyInCart}`
      };
    }

    if (currentStock <= (product.min_stock || 0)) {
      return {
        available: true,
        warning: `⚠️ Stock bajo (${currentStock} disponibles)`
      };
    }

    return { available: true };
  };

  const addToCart = (item, type) => {
    if (type === "product") {
      const stockCheck = checkStockAvailability(item.id, 1);
      
      if (!stockCheck.available) {
        alert(stockCheck.message);
        return;
      }

      if (stockCheck.warning) {
        const warnings = [...stockWarnings];
        if (!warnings.find(w => w.id === item.id)) {
          warnings.push({ id: item.id, message: stockCheck.warning });
          setStockWarnings(warnings);
        }
      }
    }

    const existingItem = cartItems.find(i => i.id === item.id && i.type === type);

    if (existingItem) {
      if (type === "product") {
        const stockCheck = checkStockAvailability(item.id, 1);
        if (!stockCheck.available) {
          alert(stockCheck.message);
          return;
        }
      }
      
      updateItemQuantity(existingItem.id, type, existingItem.quantity + 1);
    } else {
      const cartItem = {
        id: item.id,
        type,
        name: item.name,
        price: Number(item.price || 0),
        quantity: 1,
        discount: 0,
        note: "",
        total: Number(item.price || 0),
        stock: type === "product" ? item.stock : null
      };

      setCartItems([...cartItems, cartItem]);
      calculateTotals([...cartItems, cartItem]);
    }
  };

  const updateItemQuantity = (id, type, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(id, type);
      return;
    }

    if (type === "product") {
      const product = products.find(p => p.id === id);
      if (product) {
        const currentStock = Number(product.stock || 0);
        
        if (newQuantity > currentStock) {
          alert(`⚠️ Stock insuficiente. Disponible: ${currentStock}`);
          return;
        }

        if (currentStock <= (product.min_stock || 0)) {
          const warnings = [...stockWarnings];
          const existing = warnings.find(w => w.id === id);
          if (!existing) {
            warnings.push({ 
              id, 
              message: `⚠️ ${product.name}: Stock bajo (${currentStock} disponibles)` 
            });
            setStockWarnings(warnings);
          }
        }
      }
    }

    const updated = cartItems.map(item => {
      if (item.id === id && item.type === type) {
        const newTotal = (item.price * newQuantity) - item.discount;
        return { ...item, quantity: newQuantity, total: newTotal };
      }
      return item;
    });

    setCartItems(updated);
    calculateTotals(updated);
  };

  const updateItemDiscount = (id, type, newDiscount) => {
    const updated = cartItems.map(item => {
      if (item.id === id && item.type === type) {
        const discountValue = Math.min(Number(newDiscount) || 0, item.price * item.quantity);
        const newTotal = (item.price * item.quantity) - discountValue;
        return { ...item, discount: discountValue, total: newTotal };
      }
      return item;
    });

    setCartItems(updated);
    calculateTotals(updated);
  };

  const removeFromCart = (id, type) => {
    const filtered = cartItems.filter(item => !(item.id === id && item.type === type));
    setCartItems(filtered);
    calculateTotals(filtered);
    setStockWarnings(stockWarnings.filter(w => w.id !== id));
  };

  const calculateTotals = (items) => {
    const sub = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = sub * 0.115;
    const tot = sub + taxAmount - discount;

    setSubtotal(sub);
    setTax(taxAmount);
    setTotal(Math.max(0, tot));
  };

  const handlePaymentComplete = async (paymentData) => {
    setLoading(true);
    try {
      const user = await base44.auth.me().catch(() => ({}));

      const saleData = {
        sale_number: `S-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        time: format(new Date(), "HH:mm:ss"),
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || "Cliente General",
        items: cartItems,
        subtotal,
        tax,
        discount,
        total,
        payment_method: paymentData.method,
        amount_paid: paymentData.amountPaid,
        change_given: paymentData.change,
        status: "completed",
        cashier: user?.full_name || "Sistema",
        notes: ""
      };

      const sale = await base44.entities.Sale.create(saleData);

      for (const item of cartItems) {
        if (item.type === "product") {
          const product = products.find(p => p.id === item.id);
          if (product) {
            const newStock = Math.max(0, Number(product.stock || 0) - item.quantity);
            await base44.entities.Product.update(item.id, { stock: newStock });

            await base44.entities.InventoryMovement.create({
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
              performed_by: user?.full_name || "Sistema"
            });
          }
        }
      }

      const drawerMovement = {
        movement_type: "sale",
        amount: total,
        payment_method: paymentData.method,
        description: `Venta ${saleData.sale_number}`,
        reference_id: sale.id,
        reference_type: "sale",
        performed_by: user?.full_name || "Sistema"
      };

      await base44.entities.CashDrawerMovement.create(drawerMovement);

      const registers = await base44.entities.CashRegister.filter({ status: "open" });
      if (registers && registers.length > 0) {
        const register = registers[0];
        await base44.entities.CashRegister.update(register.id, {
          current_cash: (register.current_cash || 0) + (paymentData.method === "cash" ? total : 0),
          total_sales: (register.total_sales || 0) + total,
          transaction_count: (register.transaction_count || 0) + 1
        });
      }

      if (onSuccess) {
        onSuccess(sale);
      }

      setCartItems([]);
      setSelectedCustomer(null);
      setDiscount(0);
      setStockWarnings([]);
      calculateTotals([]);
      setShowPaymentModal(false);
      onClose();
    } catch (error) {
      console.error("Error processing sale:", error);
      alert("Error al procesar la venta: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (cartItems.length > 0) {
      if (!confirm("¿Deseas salir? Se perderá el carrito actual.")) {
        return;
      }
    }
    setCartItems([]);
    setSelectedCustomer(null);
    setDiscount(0);
    setStockWarnings([]);
    onClose();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl h-[95vh] bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-red-600" />
            Punto de Venta
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-5 gap-4 overflow-hidden">
          <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos o servicios..."
                  className="pl-10 bg-black/40 border-white/15 text-white"
                />
              </div>
              <Button
                onClick={() => setShowCustomerSelector(true)}
                variant="outline"
                className="border-white/15"
              >
                {selectedCustomer ? selectedCustomer.name : "Cliente General"}
              </Button>
            </div>

            <Tabs defaultValue="products" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="bg-black/40 border-b border-white/10">
                <TabsTrigger value="products">Productos</TabsTrigger>
                <TabsTrigger value="services">Servicios</TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="flex-1 overflow-y-auto mt-2 space-y-2">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product, "product")}
                    className="p-3 bg-black/40 rounded-lg border border-white/10 hover:border-red-600/50 cursor-pointer transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-white group-hover:text-red-400 transition">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-400">{product.sku}</p>
                        <div className="mt-1">
                          <StockWarningBadge product={product} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">${Number(product.price || 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">Stock: {product.stock || 0}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="services" className="flex-1 overflow-y-auto mt-2 space-y-2">
                {filteredServices.map(service => (
                  <div
                    key={service.id}
                    onClick={() => addToCart(service, "service")}
                    className="p-3 bg-black/40 rounded-lg border border-white/10 hover:border-red-600/50 cursor-pointer transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-white group-hover:text-red-400 transition">
                          {service.name}
                        </p>
                        {service.description && (
                          <p className="text-xs text-gray-400 mt-1">{service.description}</p>
                        )}
                      </div>
                      <p className="text-lg font-bold text-white">${Number(service.price || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          <div className="col-span-2 flex flex-col bg-black/40 rounded-lg border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-red-600" />
                Carrito ({cartItems.length})
              </h3>
            </div>

            {stockWarnings.length > 0 && (
              <div className="px-4 pb-2 space-y-1">
                {stockWarnings.map((warning, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-yellow-600/10 border border-yellow-600/30 rounded text-xs"
                  >
                    <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    <span className="text-yellow-300">{warning.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 space-y-2">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <Package className="w-16 h-16 mb-4 opacity-20" />
                  <p>Carrito vacío</p>
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <div key={`${item.id}-${item.type}-${idx}`} className="p-3 bg-black/60 rounded-lg border border-white/10">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">
                          ${item.price.toFixed(2)} × {item.quantity}
                          {item.type === "product" && item.stock !== null && (
                            <span className={`ml-2 ${item.stock <= 5 ? 'text-yellow-400' : 'text-gray-500'}`}>
                              ({item.stock} en stock)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => updateItemQuantity(item.id, item.type, item.quantity - 1)}
                          className="h-7 w-7"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-white font-medium w-8 text-center">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => updateItemQuantity(item.id, item.type, item.quantity + 1)}
                          className="h-7 w-7"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id, item.type)}
                          className="h-7 w-7 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-gray-400" />
                      <Input
                        type="number"
                        min="0"
                        max={item.price * item.quantity}
                        value={item.discount}
                        onChange={(e) => updateItemDiscount(item.id, item.type, e.target.value)}
                        placeholder="Descuento"
                        className="h-7 text-xs bg-black/40 border-white/10"
                      />
                      <span className="text-sm font-bold text-white whitespace-nowrap">
                        ${item.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/10 space-y-3 bg-black/60">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal:</span>
                <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">IVU (11.5%):</span>
                <span className="text-white font-medium">${tax.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Descuento:</span>
                <Input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={discount}
                  onChange={(e) => {
                    setDiscount(Number(e.target.value) || 0);
                    calculateTotals(cartItems);
                  }}
                  className="w-24 h-7 text-right bg-black/40 border-white/10"
                />
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-white/20">
                <span className="text-white">Total:</span>
                <span className="text-green-400">${total.toFixed(2)}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={cartItems.length === 0}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Cobrar
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="border-white/15"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {showCustomerSelector && (
          <CustomerSelector
            open={showCustomerSelector}
            onClose={() => setShowCustomerSelector(false)}
            onSelect={(customer) => {
              setSelectedCustomer(customer);
              setShowCustomerSelector(false);
            }}
          />
        )}

        {showPaymentModal && (
          <PaymentModal
            open={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            total={total}
            onComplete={handlePaymentComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
