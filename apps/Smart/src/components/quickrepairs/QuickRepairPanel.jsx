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
      <DialogContent className="bg-[#1c1c1e] border border-white/10 max-w-3xl w-full text-white rounded-[32px] p-0 overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="bg-[#2c2c2e]/50 border-b border-white/5 p-6 flex justify-between items-center">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Wrench className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <span className="text-white">Órdenes Rápidas</span>
            </DialogTitle>
            <p className="text-white/40 text-sm mt-1 ml-14">Crea una orden en segundos</p>
          </div>
          
          {/* Steps */}
          <div className="flex gap-1.5 bg-black/20 p-1.5 rounded-full">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-8 h-1.5 rounded-full transition-all duration-500 ${
                  step >= s ? "bg-orange-500" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-6 min-h-[400px] flex flex-col">
          <div className="flex-1">
            {step === 1 && (
              <div className="space-y-6">
                {!showNewCustomer ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        value={searchCustomer}
                        onChange={(e) => setSearchCustomer(e.target.value)}
                        placeholder="Buscar cliente por nombre o teléfono..."
                        className="w-full pl-12 pr-4 bg-[#2c2c2e] border-transparent text-white h-14 rounded-2xl text-lg placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        autoFocus
                      />
                    </div>

                    {selectedCustomer ? (
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 flex items-center justify-between group cursor-default">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-lg">{selectedCustomer.name}</p>
                            <p className="text-orange-300/80 font-medium">{selectedCustomer.phone}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedCustomer(null)}
                          className="text-white/40 hover:text-white hover:bg-white/10 rounded-full h-10 w-10"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedCustomer(c)}
                              className="w-full text-left p-4 bg-[#2c2c2e] hover:bg-[#3a3a3c] rounded-2xl transition-all group border border-transparent hover:border-white/5"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white group-hover:bg-white/10 transition-colors">
                                    <User className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-white text-base">{c.name}</p>
                                    <p className="text-white/40 text-sm">{c.phone}</p>
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-12 flex flex-col items-center">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                              <User className="w-8 h-8 text-white/50" />
                            </div>
                            <p className="text-white/40 text-base font-medium mb-1">No se encontraron clientes</p>
                            <p className="text-white/50 text-sm">Prueba buscar con otro término</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <Button
                        onClick={() => setShowNewCustomer(true)}
                        className="w-full h-14 rounded-2xl bg-white/5 text-white font-semibold hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 text-base"
                      >
                        <UserPlus className="w-5 h-5 mr-2" />
                        Crear Nuevo Cliente
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-5 bg-[#2c2c2e] p-6 rounded-3xl border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-white text-lg">Nuevo Cliente</h3>
                      <button onClick={() => setShowNewCustomer(false)} className="text-white/40 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-white/40 text-xs font-bold uppercase ml-3 mb-1 block">Nombre Completo</label>
                        <Input
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="bg-black/20 border-transparent h-12 rounded-xl text-white focus:bg-black/40"
                          placeholder="Ej: Juan Pérez"
                        />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs font-bold uppercase ml-3 mb-1 block">Teléfono</label>
                        <Input
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="bg-black/20 border-transparent h-12 rounded-xl text-white focus:bg-black/40"
                          placeholder="Ej: 787-123-4567"
                        />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs font-bold uppercase ml-3 mb-1 block">Email (Opcional)</label>
                        <Input
                          value={newCustomerEmail}
                          onChange={(e) => setNewCustomerEmail(e.target.value)}
                          className="bg-black/20 border-transparent h-12 rounded-xl text-white focus:bg-black/40"
                          placeholder="Ej: juan@email.com"
                        />
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button
                        onClick={handleCreateCustomer}
                        className="w-full bg-white text-black hover:bg-white/90 h-12 rounded-xl font-bold text-base shadow-lg"
                      >
                        Guardar Cliente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-3">
                    <label className="text-xs text-white/40 uppercase font-bold ml-1 block">Tipo de Dispositivo</label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setSelectedBrand(null);
                            setSelectedModel(null);
                          }}
                          className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${
                            selectedCategory?.id === cat.id
                              ? "bg-white text-black border-white shadow-lg"
                              : "bg-[#2c2c2e] text-white/60 border-transparent hover:bg-[#3a3a3c] hover:text-white"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedCategory && (
                    <div className="col-span-2 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                      <label className="text-xs text-white/40 uppercase font-bold ml-1 block">Marca</label>
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
                              className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${
                                selectedBrand?.id === brand.id
                                  ? "bg-white text-black border-white shadow-lg"
                                  : "bg-[#2c2c2e] text-white/60 border-transparent hover:bg-[#3a3a3c] hover:text-white"
                              }`}
                            >
                              {brand.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {selectedBrand && (
                    <div className="col-span-2 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                      <label className="text-xs text-white/40 uppercase font-bold ml-1 block">Modelo</label>
                      <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
                        {models
                          .filter(m => m.brand_id === selectedBrand.id)
                          .map(model => (
                            <button
                              key={model.id}
                              onClick={() => setSelectedModel(model)}
                              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                                selectedModel?.id === model.id
                                  ? "bg-orange-500 text-white border-orange-500 shadow-md"
                                  : "bg-[#2c2c2e] text-white/60 border-transparent hover:bg-[#3a3a3c] hover:text-white"
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
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    placeholder="Buscar servicios o repuestos..."
                    className="pl-12 bg-[#2c2c2e] border-transparent text-white h-12 rounded-xl focus:bg-[#3a3a3c]"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleAddItem(item)}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#2c2c2e] hover:bg-[#3a3a3c] transition-colors border border-transparent text-left group"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="font-semibold text-white truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={item.type === "service" ? "bg-blue-500/20 text-blue-300" : "bg-green-500/20 text-green-300"}>
                            {item.type === "service" ? "Servicio" : "Producto"}
                          </Badge>
                          {item.type === "product" && (
                            <span className="text-xs text-white/40">Stock: {item.stock || 0}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-lg">{money(item.price)}</span>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white/20 transition-colors">
                          <Plus className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedItems.length > 0 && (
                  <div className="bg-[#2c2c2e] rounded-2xl p-4 mt-2">
                    <div className="flex items-center gap-2 mb-3 text-white/40 text-xs font-bold uppercase tracking-wider">
                      <ShoppingCart className="w-4 h-4" />
                      Carrito ({selectedItems.length})
                    </div>
                    <div className="space-y-2">
                      {selectedItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-xs font-bold text-white">
                              {item.quantity}x
                            </div>
                            <span className="text-sm text-white font-medium truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-white">{money(item.price * item.quantity)}</span>
                            <button onClick={() => handleRemoveItem(item.id)} className="text-white/50 hover:text-red-400 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-3 mt-2 border-t border-white/5">
                        <span className="font-bold text-white">Total Estimado</span>
                        <span className="font-bold text-orange-400 text-xl">{money(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="bg-[#2c2c2e] rounded-[32px] p-6 text-center">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">¡Todo Listo!</h3>
                  <p className="text-white/60 text-sm mb-6">Revisa los detalles antes de crear la orden</p>

                  <div className="bg-black/20 rounded-2xl p-4 text-left space-y-3">
                    <div className="flex justify-between">
                      <span className="text-white/40 text-sm">Cliente</span>
                      <span className="font-medium text-white">{selectedCustomer?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40 text-sm">Dispositivo</span>
                      <span className="font-medium text-white">{selectedBrand?.name} {selectedModel?.name}</span>
                    </div>
                    <div className="border-t border-white/5 pt-3 flex justify-between items-center">
                      <span className="text-white/40 text-sm">Total a Pagar</span>
                      <span className="font-bold text-xl text-green-400">{money(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-[#2c2c2e]/30 border-t border-white/5 flex justify-between items-center">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="text-white/40 hover:text-white hover:bg-white/5 rounded-xl">
              Atrás
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleClose} className="text-white/40 hover:text-white hover:bg-white/5 rounded-xl">
              Cancelar
            </Button>
          )}
          
          <Button
            onClick={step === 4 ? handleSubmit : handleNext}
            disabled={!canProceed() || loading}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 h-12 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
          >
            {step === 4 ? (loading ? "Creando..." : "Confirmar Orden") : "Continuar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
