import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Zap, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function QuickRepairDialog({ open, onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    device_type: "",
    issue_description: "",
    items: []
  });

  const [newItem, setNewItem] = useState({
    type: "service",
    id: "",
    name: "",
    price: 0
  });

  useEffect(() => {
    if (open) {
      loadData();
      resetForm();
    }
  }, [open]);

  const loadData = async () => {
    const [customersData, productsData, servicesData, userData] = await Promise.all([
      base44.entities.Customer.list("-created_date", 50),
      base44.entities.Product.filter({ active: true }),
      base44.entities.Service.filter({ active: true }),
      base44.auth.me()
    ]);
    setCustomers(customersData);
    setProducts(productsData);
    setServices(servicesData);
    setUser(userData);
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      customer_name: "",
      customer_phone: "",
      device_type: "",
      issue_description: "",
      items: []
    });
    setNewItem({ type: "service", id: "", name: "", price: 0 });
    setSearchQuery("");
  };

  const selectCustomer = (customer) => {
    setFormData({
      ...formData,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone
    });
    setSearchQuery("");
  };

  const addItem = () => {
    if (!newItem.name || newItem.price <= 0) return;
    
    setFormData({
      ...formData,
      items: [...formData.items, { ...newItem, id: Date.now().toString() }]
    });
    setNewItem({ type: "service", id: "", name: "", price: 0 });
  };

  const removeItem = (itemId) => {
    setFormData({
      ...formData,
      items: formData.items.filter(i => i.id !== itemId)
    });
  };

  const selectProduct = (product) => {
    setNewItem({
      type: "product",
      id: product.id,
      name: product.name,
      price: product.price
    });
  };

  const selectService = (service) => {
    setNewItem({
      type: "service",
      id: service.id,
      name: service.name,
      price: service.price
    });
  };

  const subtotal = formData.items.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * 0.115;
  const total = subtotal + tax;

  const handleSubmit = async () => {
    if (!formData.customer_name || !formData.device_type || formData.items.length === 0) {
      alert("Por favor completa todos los campos requeridos");
      return;
    }

    setLoading(true);

    try {
      let customerId = formData.customer_id;
      
      // Create customer if new
      if (!customerId && formData.customer_phone) {
        const newCustomer = await base44.entities.Customer.create({
          name: formData.customer_name,
          phone: formData.customer_phone,
          total_orders: 1
        });
        customerId = newCustomer.id;
      }

      // Create quick order
      const orderNumber = `QR-${Date.now().toString().slice(-8)}`;
      
      await base44.entities.Order.create({
        order_number: orderNumber,
        customer_id: customerId,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        device_type: formData.device_type,
        known_issues: [formData.issue_description],
        repair_tasks: formData.items.map(item => ({
          id: item.id,
          description: item.name,
          status: "in_progress",
          cost: item.price
        })),
        status: "in_progress",
        priority: "normal",
        progress_percentage: 0,
        cost_estimate: total,
        created_by: user?.full_name || user?.email,
        assigned_to: user?.full_name || user?.email
      });

      // Update product stock
      for (const item of formData.items) {
        if (item.type === "product") {
          const product = products.find(p => p.id === item.id);
          if (product && product.stock > 0) {
            await base44.entities.Product.update(item.id, {
              stock: product.stock - 1
            });
          }
        }
      }

      alert(`✓ Reparación rápida creada!\nOrden: ${orderNumber}\nTotal: $${total.toFixed(2)}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating quick repair:", error);
      alert("Error al crear la reparación rápida");
    }

    setLoading(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#2B2B2B] to-black border-[#FF0000]/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#FF0000]" />
            Reparación Rápida
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Search */}
          <div className="space-y-2">
            <Label className="text-gray-300">Cliente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-black border-gray-700 text-white"
              />
            </div>
            {searchQuery && filteredCustomers.length > 0 && (
              <div className="border border-gray-700 rounded-lg max-h-32 overflow-y-auto bg-black">
                {filteredCustomers.map(customer => (
                  <div
                    key={customer.id}
                    className="p-2 hover:bg-[#FF0000]/10 cursor-pointer border-b border-gray-800 last:border-b-0"
                    onClick={() => selectCustomer(customer)}
                  >
                    <p className="font-medium text-white">{customer.name}</p>
                    <p className="text-sm text-gray-400">{customer.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nombre *</Label>
              <Input
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="bg-black border-gray-700 text-white"
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Teléfono *</Label>
              <Input
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                className="bg-black border-gray-700 text-white"
                placeholder="(787) 123-4567"
              />
            </div>
          </div>

          {/* Device */}
          <div className="space-y-2">
            <Label className="text-gray-300">Dispositivo *</Label>
            <Input
              value={formData.device_type}
              onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
              className="bg-black border-gray-700 text-white"
              placeholder="iPhone 14 Pro Max"
            />
          </div>

          {/* Issue Description */}
          <div className="space-y-2">
            <Label className="text-gray-300">Descripción del problema</Label>
            <Textarea
              value={formData.issue_description}
              onChange={(e) => setFormData({ ...formData, issue_description: e.target.value })}
              className="bg-black border-gray-700 text-white"
              rows={2}
              placeholder="Pantalla rota, no enciende..."
            />
          </div>

          {/* Add Items */}
          <div className="space-y-3">
            <Label className="text-gray-300">Servicios / Piezas *</Label>
            
            <div className="flex gap-2">
              <Select value={newItem.type} onValueChange={(value) => setNewItem({ ...newItem, type: value, id: "", name: "", price: 0 })}>
                <SelectTrigger className="w-32 bg-black border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="product">Pieza</SelectItem>
                </SelectContent>
              </Select>

              {newItem.type === "service" && (
                <Select value={newItem.id} onValueChange={(value) => {
                  const service = services.find(s => s.id === value);
                  if (service) selectService(service);
                }}>
                  <SelectTrigger className="flex-1 bg-black border-gray-700 text-white">
                    <SelectValue placeholder="Seleccionar servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - ${service.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {newItem.type === "product" && (
                <Select value={newItem.id} onValueChange={(value) => {
                  const product = products.find(p => p.id === value);
                  if (product) selectProduct(product);
                }}>
                  <SelectTrigger className="flex-1 bg-black border-gray-700 text-white">
                    <SelectValue placeholder="Seleccionar pieza..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - ${product.price} (Stock: {product.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button onClick={addItem} size="icon" className="bg-[#FF0000] hover:bg-red-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {formData.items.length > 0 && (
              <div className="space-y-2">
                {formData.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-black rounded-lg border border-gray-800">
                    <div>
                      <p className="font-medium text-white">{item.name}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {item.type === "service" ? "Servicio" : "Pieza"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-green-400">${item.price.toFixed(2)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          {formData.items.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-[#FF0000]/10 to-red-900/10 rounded-lg border border-[#FF0000]/30 space-y-2">
              <div className="flex justify-between text-gray-300">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>IVU (11.5%):</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-[#FF0000]/30">
                <span>Total:</span>
                <span className="text-[#FF0000]">${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !formData.customer_name || !formData.device_type || formData.items.length === 0}
              className="flex-1 bg-gradient-to-r from-[#FF0000] to-red-800 hover:from-red-700 hover:to-red-900"
            >
              <Zap className="w-4 h-4 mr-2" />
              {loading ? "Creando..." : "Crear Reparación Rápida"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
