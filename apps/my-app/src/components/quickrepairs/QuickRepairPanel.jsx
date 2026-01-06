// === QuickRepairPanel.jsx — Reparaciones rápidas sin wizard ===

import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useI18n } from "@/components/utils/i18n";
import { createStatusChangeEmail, getBusinessInfo } from "@/components/utils/emailTemplates";
import {
  Wrench,
  User,
  Smartphone,
  Plus,
  X,
  Search,
  Zap,
  UserPlus } from
"lucide-react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function QuickRepairPanel({ open, onClose, onSuccess }) {
  const { t } = useI18n();
  const [step, setStep] = useState(1); // 1: Cliente, 2: Dispositivo, 3: Items, 4: Confirmar
  const [loading, setLoading] = useState(false);

  // Cliente
  const [searchCustomer, setSearchCustomer] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");

  // Dispositivo - Catálogo completo
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [problem, setProblem] = useState("");
  const [deviceSerial, setDeviceSerial] = useState("");

  // Items
  const [searchProduct, setSearchProduct] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  // Cargar datos iniciales
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
      base44.entities.Service.filter({ active: true })]
      );

      const combined = [
      ...(products || []).map((p) => ({ ...p, type: "product" })),
      ...(services || []).map((s) => ({ ...s, type: "service" }))];


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
      base44.entities.DeviceFamily.filter({ active: true }, "order")]
      );
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

  // Filtrar items inteligentemente basado en modelo seleccionado
  const filteredItems = useMemo(() => {
    let items = availableItems;

    // Si hay modelo seleccionado, filtrar automáticamente por compatibilidad
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

    // Aplicar búsqueda manual si hay texto
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
      }]
      );
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
      // Solo validar que tenga dispositivo completo (sin problema)
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
    setLoading(true);
    try {
      const orderNumber = `WO-${Date.now().toString().slice(-8)}`;

      // Generar problema automático basado en los items seleccionados
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

      const createdOrder = await base44.entities.Order.create(orderData);

      // Enviar email al cliente
      if (selectedCustomer.email) {
        try {
          const businessInfo = await getBusinessInfo();
          const deviceLine = `${selectedBrand?.name || ""} ${selectedModel?.name || ""}`.trim();

          const emailData = createStatusChangeEmail({
            orderNumber: orderNumber,
            customerName: selectedCustomer.name,
            deviceInfo: deviceLine || selectedCategory?.name || "su equipo",
            newStatus: "in_progress",
            previousStatus: "intake",
            businessInfo
          });

          await base44.integrations.Core.SendEmail({
            from_name: businessInfo.business_name || "SmartFixOS",
            to: selectedCustomer.email,
            subject: emailData.subject,
            body: emailData.body
          });

          console.log("✅ Email enviado al cliente");
        } catch (emailErr) {
          console.error("Error sending email:", emailErr);
          // No bloqueamos la creación si falla el email
        }
      }

      toast.success(t('orderCreated'));
      onSuccess?.();
    } catch (err) {
      console.error("Error creating quick repair:", err);
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
      <DialogContent className="bg-[#020617] border border-orange-500/30 max-w-3xl text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-400" />
            {t('quickOrders')}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex justify-between gap-2 mb-4">
          {[1, 2, 3, 4].map((s) =>
          <div
            key={s}
            className={`flex-1 h-2 rounded-full ${
            step >= s ?
            "bg-gradient-to-r from-orange-500 to-red-600" :
            "bg-slate-800"}`
            } />

          )}
        </div>

        <div className="min-h-[300px]">
          {/* STEP 1: Cliente */}
          {step === 1 &&
          <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-orange-400" />
                  <h3 className="font-semibold">{t('selectCustomer')}</h3>
                </div>
                <Button
                size="sm"
                onClick={() => setShowNewCustomer(true)}
                className="bg-gradient-to-r from-emerald-600 to-green-600 h-8">

                  <UserPlus className="w-4 h-4 mr-1" />
                  {t('newUser')}
                </Button>
              </div>

              {!showNewCustomer ?
            <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  placeholder="Buscar por nombre o teléfono..."
                  className="pl-10 bg-black/40 border-slate-700" />

                  </div>

                  {selectedCustomer ?
              <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-lg">{selectedCustomer.name}</p>
                          <p className="text-sm text-gray-300">{selectedCustomer.phone}</p>
                          {selectedCustomer.email &&
                    <p className="text-xs text-gray-400">{selectedCustomer.email}</p>
                    }
                        </div>
                        <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-red-400">

                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div> :

              <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto p-2 border border-slate-800 rounded-lg bg-black/20">
                      {filteredCustomers.length === 0 ?
                <p className="text-center text-sm text-gray-400 py-8">
                          {searchCustomer ? "No se encontraron clientes" : "Escribe para buscar o crea uno nuevo"}
                        </p> :

                filteredCustomers.map((c) =>
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className="w-full text-left p-4 bg-gradient-to-r from-slate-900/60 to-slate-800/60 hover:from-orange-600/20 hover:to-red-600/20 border border-slate-700 hover:border-orange-500/40 rounded-lg transition-all">

                            <p className="font-semibold text-base">{c.name}</p>
                            <p className="text-xs text-gray-400 mt-1">{c.phone}</p>
                          </button>
                )
                }
                    </div>
              }
                </> :

            <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-600/10">
                  <h4 className="text-sm font-semibold mb-3 text-emerald-300">Crear nuevo cliente</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Nombre completo *</label>
                      <Input
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="bg-black/40 border-slate-700" />

                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Teléfono *</label>
                      <Input
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="787-555-0123"
                    className="bg-black/40 border-slate-700" />

                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Email (opcional)</label>
                      <Input
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="bg-black/40 border-slate-700" />

                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewCustomer(false);
                      setNewCustomerName("");
                      setNewCustomerPhone("");
                      setNewCustomerEmail("");
                    }} className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-9 flex-1 border-slate-600">


                        Cancelar
                      </Button>
                      <Button
                    onClick={handleCreateCustomer}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600">

                        <UserPlus className="w-4 h-4 mr-1" />
                        Crear Cliente
                      </Button>
                    </div>
                  </div>
                </div>
            }
            </div>
          }

          {/* STEP 2: Dispositivo CON CATÁLOGO COMPLETO */}
          {step === 2 &&
          <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold">{t('deviceDetails')}</h3>
              </div>

              {/* Tipo de Dispositivo */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">{t('deviceType')} *</label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((cat) =>
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedBrand(null);
                    setSelectedModel(null);
                  }}
                  className={`px-2 py-2 rounded-md border text-xs transition-all flex items-center justify-center gap-1.5 ${
                  selectedCategory?.id === cat.id ?
                  "bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-transparent" :
                  "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}`
                  }>

                      <span>{cat.icon || "📱"}</span>
                      <span className="text-[11px] truncate">{cat.name}</span>
                    </button>
                )}
                </div>
              </div>

              {/* Marca */}
              {selectedCategory &&
            <div>
                  <label className="text-xs text-gray-400 mb-2 block">{t('brand')} *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {brands.
                filter((b) => b.category_id === selectedCategory.id).
                map((brand) =>
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => {
                    setSelectedBrand(brand);
                    setSelectedModel(null);
                  }}
                  className={`px-2 py-2 rounded-md border text-xs transition-all truncate ${
                  selectedBrand?.id === brand.id ?
                  "bg-gradient-to-r from-orange-600 to-red-600 text-white border-transparent" :
                  "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}`
                  }>

                          {brand.name}
                        </button>
                )}
                  </div>
                </div>
            }

              {/* Modelo - BOTONES MÁS CUADRADOS Y COMPACTOS */}
              {selectedBrand &&
            <div>
                  <label className="text-xs text-gray-400 mb-2 block">{t('model')} *</label>
                  <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto p-2 border border-slate-800 rounded-lg bg-black/20">
                    {models.
                filter((m) => m.brand_id === selectedBrand.id).
                map((model) =>
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModel(model)}
                  className={`px-2 py-1.5 rounded-md border text-[10px] transition-all whitespace-nowrap ${
                  selectedModel?.id === model.id ?
                  "bg-gradient-to-r from-orange-600 to-red-600 text-white border-transparent font-semibold" :
                  "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}`
                  }>

                          {model.name}
                        </button>
                )}
                  </div>
                </div>
            }

              {/* Problema - ELIMINADO - Al seleccionar modelo, paso directo a items con sugerencias */}
            </div>
          }

          {/* STEP 3: Items */}
          {step === 3 &&
          <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-400" />
                  <h3 className="font-semibold">{t('servicesAndProducts')}</h3>
                </div>
                {selectedModel && !searchProduct &&
              <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 text-xs">
                    💡 {filteredItems.length} para {selectedModel.name}
                  </Badge>
              }
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                placeholder={t('searchItems')}
                className="pl-10 bg-black/40 border-slate-700" />

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Disponibles - SIN SCROLLBAR, GRID LIMPIO */}
                <div className="border border-slate-800 rounded-lg p-3 bg-black/40">
                  <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wide">
                    {selectedModel && !searchProduct ? `💡 ${t('servicesAndProducts')} (${selectedModel.name})` : t('servicesAndProducts')}
                  </p>
                  {filteredItems.length === 0 ?
                <p className="text-xs text-gray-500 text-center py-8">
                      {searchProduct ? t('noResults') : selectedModel ? "No hay items compatibles" : t('searchItems')}
                    </p> :

                <div className="grid gap-2 max-h-96 overflow-y-auto pr-1">
                      {filteredItems.map((item) =>
                  <button
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    className="w-full text-left p-2.5 bg-gradient-to-r from-slate-900/80 to-slate-800/80 hover:from-orange-600/30 hover:to-red-600/30 border border-slate-700 hover:border-orange-500/50 rounded-lg text-sm transition-all group">

                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate group-hover:text-orange-300 leading-tight">{item.name}</p>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <Badge className={`text-[9px] px-1.5 py-0 ${
                          item.type === "service" ?
                          "bg-blue-600/20 text-blue-300 border-blue-600/30" :
                          "bg-emerald-600/20 text-emerald-300 border-emerald-600/30"}`
                          }>
                                  {item.type === "service" ? t('service') : t('product')}
                                </Badge>
                                {item.type === "product" &&
                          <span className={`text-[9px] ${
                          item.stock <= 0 ?
                          "text-red-400" :
                          item.stock <= (item.min_stock || 5) ?
                          "text-yellow-400" :
                          "text-emerald-400"}`
                          }>
                                    {t('stock')}: {item.stock ?? 0}
                                  </span>
                          }
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="font-bold text-emerald-400 text-sm">{money(item.price)}</span>
                              <div className="w-7 h-7 rounded-full bg-orange-600/20 flex items-center justify-center group-hover:bg-orange-600/40 transition-all">
                                <Plus className="w-3.5 h-3.5 text-orange-400" />
                              </div>
                            </div>
                          </div>
                        </button>
                  )}
                    </div>
                }
                </div>

                {/* Seleccionados */}
                <div className="border border-slate-800 rounded-lg p-3 bg-black/40">
                  <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wide">
                    {t('cart')} ({selectedItems.length})
                  </p>
                  {selectedItems.length === 0 ?
                <p className="text-xs text-gray-500 text-center py-8">
                      {t('noItemsAdded')}
                    </p> :

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {selectedItems.map((item) =>
                  <div
                    key={item.id}
                    className="bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-xs">

                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="font-semibold flex-1 truncate text-sm leading-tight">{item.name}</p>
                            <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveItem(item.id)}
                        className="h-6 w-6 text-red-400 hover:bg-red-600/20">

                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <label className="text-gray-400">{t('quantity') || 'Cant'}:</label>
                              <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleChangeQty(item.id, e.target.value)}
                          className="h-7 w-14 bg-slate-900 border-slate-700 text-right text-xs" />

                            </div>
                            <span className="text-gray-400">×</span>
                            <span className="text-gray-300">{money(item.price)}</span>
                            <span className="text-emerald-400 font-bold">
                              = {money(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                  )}
                      <div className="pt-3 border-t border-slate-800 flex justify-between font-semibold">
                        <span className="text-gray-300">{t('total')}:</span>
                        <span className="text-emerald-400 text-base">
                          {money(grandTotal)}
                        </span>
                      </div>
                    </div>
                }
                </div>
              </div>
            </div>
          }

          {/* STEP 4: Confirmar */}
          {step === 4 &&
          <div className="space-y-4">
              <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-orange-400" />
                  {t('summary')}
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('customer')}:</span>
                    <span className="font-semibold">{selectedCustomer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('device')}:</span>
                    <span className="font-semibold">{selectedBrand?.name} {selectedModel?.name}</span>
                  </div>
                  {deviceSerial &&
                <div className="flex justify-between">
                      <span className="text-gray-400">{t('serial')}:</span>
                      <span className="font-semibold font-mono text-xs">{deviceSerial}</span>
                    </div>
                }

                  <div className="pt-3 border-t border-white/10">
                    <p className="text-gray-400 mb-2">{t('cart')} ({selectedItems.length}):</p>
                    {selectedItems.map((item) =>
                  <div key={item.id} className="flex justify-between text-xs mb-1">
                        <span>{item.name} × {item.quantity}</span>
                        <span>{money(item.price * item.quantity)}</span>
                      </div>
                  )}
                  </div>

                  <div className="pt-3 border-t border-white/10 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('subtotal')}:</span>
                      <span>{money(total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('tax')}:</span>
                      <span>{money(taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
                      <span>{t('total').toUpperCase()}:</span>
                      <span className="text-emerald-400">{money(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {t('step')} {step} {t('of')} 4
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={step === 1 ? handleClose : () => setStep((s) => s - 1)} className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-9 border-slate-600"

              disabled={loading}>

              {step === 1 ? t('cancel') : t('back')}
            </Button>

            {step < 4 &&
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-gradient-to-r from-orange-600 to-red-600">

                {t('next')}
              </Button>
            }

            {step === 4 &&
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-gradient-to-r from-emerald-600 to-green-600">

                {loading ? t('creating') : t('createOrder')}
              </Button>
            }
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}
