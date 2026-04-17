import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useI18n } from "@/components/utils/i18n";
import { createStatusChangeEmail, getBusinessInfo } from "@/components/utils/emailTemplates";
import { useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  User,
  Smartphone,
  Plus,
  X,
  Search,
  Zap,
  UserPlus,
  ChevronRight,
  ShoppingCart,
  CheckCircle2
} from "lucide-react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function QuickRepairPanel({ open, onClose, onSuccess }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Cliente
  const [searchCustomer, setSearchCustomer] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");

  // Dispositivo
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [deviceSerial, setDeviceSerial] = useState("");

  // Items
  const [searchProduct, setSearchProduct] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    if (!open) return;
    loadCustomers();
    loadInventory();
    loadCatalog();
  }, [open]);

  const loadCustomers = async () => {
    try {
      const list = await base44.entities.Customer.list("-updated_date", 100);
      setCustomers(list || []);
    } catch (err) {
      console.error("Error loading customers:", err);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      toast.error("Nombre y teléfono son requeridos");
      return;
    }

    try {
      const newCustomer = await base44.entities.Customer.create({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        email: newCustomerEmail.trim() || ""
      });

      setSelectedCustomer(newCustomer);
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      await loadCustomers();
      toast.success("Cliente creado");
    } catch (err) {
      console.error("Error creating customer:", err);
      toast.error("No se pudo crear el cliente");
    }
  };

  const loadInventory = async () => {
    try {
      const [products, services] = await Promise.all([
        base44.entities.Product.filter({ active: true }),
        base44.entities.Service.filter({ active: true })
      ]);

      const combined = [
        ...(products || []).map((p) => ({ ...p, type: "product" })),
        ...(services || []).map((s) => ({ ...s, type: "service" }))
      ];

      setAvailableItems(combined);
    } catch (err) {
      console.error("Error loading inventory:", err);
    }
  };

  const loadCatalog = async () => {
    try {
      const [cats, brds, mdls] = await Promise.all([
        base44.entities.DeviceCategory.filter({ active: true }, "order"),
        base44.entities.Brand.filter({ active: true }, "order"),
        base44.entities.DeviceFamily.filter({ active: true }, "order")
      ]);
      setCategories(cats || []);
      setBrands(brds || []);
      setModels(mdls || []);
    } catch (err) {
      console.error("Error loading catalog:", err);
    }
  };

  const filteredCustomers = searchCustomer.trim() ?
    customers.filter((c) =>
      String(c.name || "").toLowerCase().includes(searchCustomer.toLowerCase()) ||
      String(c.phone || "").includes(searchCustomer)
    ).slice(0, 10) :
    [];

  const filteredItems = useMemo(() => {
    let items = availableItems;

    if (selectedModel && !searchProduct.trim()) {
      const modelName = selectedModel.name.toLowerCase();
      items = items.filter((i) => {
        const itemName = (i.name || "").toLowerCase();
        const itemDesc = (i.description || "").toLowerCase();
        const compatModels = Array.isArray(i.compatibility_models) ?
          i.compatibility_models.map((m) => m.toLowerCase()) :
          [];

        return itemName.includes(modelName) ||
          itemDesc.includes(modelName) ||
          compatModels.some((m) => m.includes(modelName) || modelName.includes(m));
      });
    }

    if (searchProduct.trim()) {
      const q = searchProduct.toLowerCase();
      items = items.filter((i) =>
        String(i.name || "").toLowerCase().includes(q)
      );
    }

    return items.slice(0, 30);
  }, [availableItems, selectedModel, searchProduct]);

  const handleAddItem = (item) => {
    const exists = selectedItems.find((i) => i.id === item.id);
    if (exists) {
      setSelectedItems((prev) =>
        prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      );
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          id: item.id,
          name: item.name,
          type: item.type,
          price: Number(item.price || 0),
          quantity: 1
        }
      ]);
    }
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleChangeQty = (itemId, qty) => {
    const n = Math.max(1, Number(qty || 1));
    setSelectedItems((prev) =>
      prev.map((i) => i.id === itemId ? { ...i, quantity: n } : i)
    );
  };

  const total = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = 0.115;
  const taxAmount = total * taxRate;
  const grandTotal = total + taxAmount;

  const canProceed = () => {
    if (step === 1) return !!selectedCustomer;
    if (step === 2) {
      return selectedCategory && selectedBrand && selectedModel;
    }
    if (step === 3) return selectedItems.length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) {
      if (step === 1) toast.error(t('selectCustomer'));
      if (step === 2) toast.error("Completa los datos del dispositivo");
      if (step === 3) toast.error(t('noItemsAdded'));
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    const orderNumber = `WO-${Date.now().toString().slice(-8)}`;
    const autoProblem = selectedItems.length > 0 ?
      selectedItems.map((i) => i.name).slice(0, 3).join(", ") :
      "Reparación rápida";

    const orderData = {
      order_number: orderNumber,
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      customer_phone: selectedCustomer.phone,
      customer_email: selectedCustomer.email || "",
      device_type: selectedCategory?.name || "Smartphone",
      device_brand: selectedBrand?.name || "",
      device_model: selectedModel?.name || "",
      device_serial: deviceSerial || "",
      initial_problem: autoProblem,
      status: "in_progress",
      order_items: selectedItems.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      cost_estimate: grandTotal,
      created_date: new Date().toISOString()
    };

    // UI Optimista
    const optimisticOrder = {
      ...orderData,
      id: `temp-${Date.now()}`,
    };

    setLoading(true);

    try {
      // Actualizar caché inmediatamente
      queryClient.setQueryData(['orders'], (oldData) => {
        if (!oldData) return [optimisticOrder];
        return [optimisticOrder, ...oldData];
      });

      // Cerrar modal y notificar
      handleClose();
      toast.success(t('orderCreated'));

      // Mutación real en segundo plano
      const createdOrder = await base44.entities.Order.create(orderData);

      // Reemplazar orden temporal con la real
      queryClient.setQueryData(['orders'], (oldData) => {
        return oldData.map(o => 
          o.id === optimisticOrder.id ? createdOrder : o
        );
      });

      // Invalidar para refrescar
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onSuccess?.();
    } catch (err) {
      console.error("Error creating quick repair:", err);
      
      // Revertir cambio optimista
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.error("No se pudo crear la reparación");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedCustomer(null);
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedModel(null);
    setDeviceSerial("");
    setSelectedItems([]);
    setSearchCustomer("");
    setSearchProduct("");
    setShowNewCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="apple-surface-elevated border-0 max-w-3xl w-full apple-type rounded-apple-lg p-0 overflow-hidden shadow-apple-xl">

        {/* Header */}
        <div
            className="px-5 pt-5 pb-3 flex justify-between items-center"
            style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <div>
            <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-3">
              <div className="w-10 h-10 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-apple-orange" />
              </div>
              <span>Órdenes Rápidas</span>
            </DialogTitle>
            <p className="apple-text-footnote apple-label-secondary mt-1 ml-[52px]">Crea una orden en segundos</p>
          </div>

          {/* Steps */}
          <div className="flex gap-1.5 bg-gray-sys6 dark:bg-gray-sys5 p-1.5 rounded-full">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-8 h-1.5 rounded-full transition-all duration-500 ${
                  step >= s ? "bg-apple-orange" : "bg-gray-sys4 dark:bg-gray-sys3"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-5 min-h-[400px] flex flex-col">
          <div className="flex-1">
            {step === 1 && (
              <div className="space-y-4">
                {!showNewCustomer ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 apple-label-tertiary" />
                      <input
                        value={searchCustomer}
                        onChange={(e) => setSearchCustomer(e.target.value)}
                        placeholder="Buscar cliente por nombre o teléfono..."
                        className="apple-input w-full pl-12 pr-4"
                        autoFocus
                      />
                    </div>

                    {selectedCustomer ? (
                      <div className="bg-apple-orange/12 rounded-apple-md p-4 flex items-center justify-between cursor-default">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center text-apple-orange">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="apple-text-headline apple-label-primary">{selectedCustomer.name}</p>
                            <p className="apple-text-subheadline text-apple-orange">{selectedCustomer.phone}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedCustomer(null)}
                          aria-label="Quitar cliente seleccionado"
                          className="apple-label-tertiary hover:apple-label-primary rounded-full h-9 w-9 apple-press"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 apple-list">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedCustomer(c)}
                              className="apple-list-row w-full text-left p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md apple-press"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-apple-sm bg-gray-sys5 dark:bg-gray-sys4 flex items-center justify-center apple-label-secondary">
                                    <User className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="apple-text-subheadline apple-label-primary">{c.name}</p>
                                    <p className="apple-text-footnote apple-label-secondary">{c.phone}</p>
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 apple-label-tertiary" />
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-12 flex flex-col items-center">
                            <div className="w-14 h-14 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md flex items-center justify-center mb-4">
                              <User className="w-7 h-7 apple-label-tertiary" />
                            </div>
                            <p className="apple-text-headline apple-label-secondary mb-1">No se encontraron clientes</p>
                            <p className="apple-text-footnote apple-label-tertiary">Prueba buscar con otro término</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <Button
                        onClick={() => setShowNewCustomer(true)}
                        className="apple-btn apple-btn-tinted apple-btn-lg w-full"
                      >
                        <UserPlus className="w-5 h-5 mr-2" />
                        Crear Nuevo Cliente
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 bg-gray-sys6 dark:bg-gray-sys5 p-5 rounded-apple-md">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="apple-text-title3 apple-label-primary">Nuevo Cliente</h3>
                      <button onClick={() => setShowNewCustomer(false)} className="apple-label-tertiary hover:apple-label-primary apple-press">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="apple-text-footnote apple-label-secondary ml-1 mb-1.5 block">Nombre Completo</label>
                        <Input
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="apple-input"
                          placeholder="Ej: Juan Pérez"
                        />
                      </div>
                      <div>
                        <label className="apple-text-footnote apple-label-secondary ml-1 mb-1.5 block">Teléfono</label>
                        <Input
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="apple-input"
                          placeholder="Ej: 787-123-4567"
                        />
                      </div>
                      <div>
                        <label className="apple-text-footnote apple-label-secondary ml-1 mb-1.5 block">Email (Opcional)</label>
                        <Input
                          value={newCustomerEmail}
                          onChange={(e) => setNewCustomerEmail(e.target.value)}
                          className="apple-input"
                          placeholder="Ej: juan@email.com"
                        />
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button
                        onClick={handleCreateCustomer}
                        className="apple-btn apple-btn-primary apple-btn-lg w-full"
                      >
                        Guardar Cliente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="apple-text-footnote apple-label-secondary ml-1 block">Tipo de Dispositivo</label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setSelectedBrand(null);
                            setSelectedModel(null);
                          }}
                          className={`px-4 py-2.5 rounded-apple-md apple-text-subheadline transition-all apple-press ${
                            selectedCategory?.id === cat.id
                              ? "bg-apple-blue text-white"
                              : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedCategory && (
                    <div className="col-span-2 space-y-2 animate-in fade-in slide-in-from-bottom-2">
                      <label className="apple-text-footnote apple-label-secondary ml-1 block">Marca</label>
                      <div className="flex flex-wrap gap-2">
                        {brands
                          .filter(b => b.category_id === selectedCategory.id)
                          .map(brand => (
                            <button
                              key={brand.id}
                              onClick={() => {
                                setSelectedBrand(brand);
                                setSelectedModel(null);
                              }}
                              className={`px-4 py-2.5 rounded-apple-md apple-text-subheadline transition-all apple-press ${
                                selectedBrand?.id === brand.id
                                  ? "bg-apple-blue text-white"
                                  : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary"
                              }`}
                            >
                              {brand.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {selectedBrand && (
                    <div className="col-span-2 space-y-2 animate-in fade-in slide-in-from-bottom-2">
                      <label className="apple-text-footnote apple-label-secondary ml-1 block">Modelo</label>
                      <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
                        {models
                          .filter(m => m.brand_id === selectedBrand.id)
                          .map(model => (
                            <button
                              key={model.id}
                              onClick={() => setSelectedModel(model)}
                              className={`px-4 py-2 rounded-full apple-text-subheadline transition-all apple-press ${
                                selectedModel?.id === model.id
                                  ? "bg-apple-orange text-white"
                                  : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary"
                              }`}
                            >
                              {model.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 apple-label-tertiary" />
                  <Input
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    placeholder="Buscar servicios o repuestos..."
                    className="apple-input pl-12"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1 apple-list">
                  {filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleAddItem(item)}
                      className="apple-list-row flex items-center justify-between p-3 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 apple-press text-left"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="apple-text-subheadline apple-label-primary truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={item.type === "service" ? "bg-apple-blue/15 text-apple-blue" : "bg-apple-green/15 text-apple-green"}>
                            {item.type === "service" ? "Servicio" : "Producto"}
                          </Badge>
                          {item.type === "product" && (
                            <span className="apple-text-caption1 apple-label-tertiary">Stock: {item.stock || 0}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="apple-text-headline apple-label-primary tabular-nums">{money(item.price)}</span>
                        <div className="w-8 h-8 rounded-full bg-apple-blue/15 flex items-center justify-center text-apple-blue">
                          <Plus className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedItems.length > 0 && (
                  <div className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-4 mt-2">
                    <div className="flex items-center gap-2 mb-3 apple-label-secondary apple-text-footnote">
                      <ShoppingCart className="w-4 h-4" />
                      Carrito ({selectedItems.length})
                    </div>
                    <div className="space-y-2">
                      {selectedItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center apple-surface-elevated p-2.5 rounded-apple-sm">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-6 h-6 rounded-apple-xs bg-gray-sys5 dark:bg-gray-sys4 flex items-center justify-center apple-text-caption1 apple-label-primary tabular-nums">
                              {item.quantity}x
                            </div>
                            <span className="apple-text-subheadline apple-label-primary truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="apple-text-subheadline apple-label-primary tabular-nums">{money(item.price * item.quantity)}</span>
                            <button onClick={() => handleRemoveItem(item.id)} className="apple-label-tertiary hover:text-apple-red apple-press">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div
                          className="flex justify-between items-center pt-3 mt-2"
                          style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                        <span className="apple-text-headline apple-label-primary">Total Estimado</span>
                        <span className="apple-text-title2 text-apple-orange tabular-nums">{money(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-lg p-6 text-center">
                  <div className="w-16 h-16 bg-apple-green/15 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-apple-green" />
                  </div>
                  <h3 className="apple-text-title2 apple-label-primary mb-1">¡Todo Listo!</h3>
                  <p className="apple-text-footnote apple-label-secondary mb-6">Revisa los detalles antes de crear la orden</p>

                  <div className="apple-surface-elevated rounded-apple-md p-4 text-left space-y-3">
                    <div className="flex justify-between">
                      <span className="apple-text-footnote apple-label-secondary">Cliente</span>
                      <span className="apple-text-subheadline apple-label-primary">{selectedCustomer?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="apple-text-footnote apple-label-secondary">Dispositivo</span>
                      <span className="apple-text-subheadline apple-label-primary">{selectedBrand?.name} {selectedModel?.name}</span>
                    </div>
                    <div
                        className="pt-3 flex justify-between items-center"
                        style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                      <span className="apple-text-footnote apple-label-secondary">Total a Pagar</span>
                      <span className="apple-text-title2 text-apple-green tabular-nums">{money(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
            className="px-5 py-4 flex justify-between items-center"
            style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="apple-btn apple-btn-plain">
              Atrás
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleClose} className="apple-btn apple-btn-plain">
              Cancelar
            </Button>
          )}

          <Button
            onClick={step === 4 ? handleSubmit : handleNext}
            disabled={!canProceed() || loading}
            className="apple-btn apple-btn-primary apple-btn-lg px-8"
          >
            {step === 4 ? (loading ? "Creando..." : "Confirmar Orden") : "Continuar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
