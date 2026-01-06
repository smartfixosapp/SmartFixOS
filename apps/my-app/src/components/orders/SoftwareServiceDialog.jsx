import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Smartphone, Loader2, Code2 } from "lucide-react";

const SOFTWARE_SERVICES = [
  { value: "unlock", label: "🔓 Desbloqueo de Operadora" },
  { value: "blacklist", label: "📵 Remover de Lista Negra" },
  { value: "imei_change", label: "🔢 Cambio de IMEI" },
  { value: "icloud_bypass", label: "☁️ Bypass iCloud" },
  { value: "frp_bypass", label: "🔐 Bypass FRP (Google)" },
  { value: "software_repair", label: "⚙️ Reparación de Software" },
  { value: "data_recovery", label: "💾 Recuperación de Datos" },
  { value: "jailbreak", label: "🔓 Jailbreak / Root" },
  { value: "other", label: "📱 Otro Servicio" }
];

export default function SoftwareServiceDialog({ open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [formData, setFormData] = useState({
    // Cliente
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    // Equipo
    device_brand: "",
    device_model: "",
    device_serial: "",
    // Servicio
    service_type: "",
    service_description: "",
    price: "",
    notes: ""
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
      resetForm();
    }
  }, [open]);

  const loadCustomers = async () => {
    try {
      const data = await base44.entities.Customer.list("-created_date", 100);
      setCustomers(data || []);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      device_brand: "",
      device_model: "",
      device_serial: "",
      service_type: "",
      service_description: "",
      price: "",
      notes: ""
    });
    setSelectedCustomer(null);
    setShowNewCustomer(false);
    setSearchTerm("");
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_phone: customer.phone || "",
      customer_email: customer.email || ""
    }));
    setShowNewCustomer(false);
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!formData.customer_name.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }

    if (!formData.customer_phone.trim() && !formData.customer_email.trim()) {
      toast.error("Debes proporcionar teléfono o email del cliente");
      return;
    }

    if (!formData.device_brand.trim() || !formData.device_model.trim()) {
      toast.error("Marca y modelo del equipo son obligatorios");
      return;
    }

    if (!formData.device_serial.trim()) {
      toast.error("IMEI o Serial es obligatorio");
      return;
    }

    if (!formData.service_type) {
      toast.error("Selecciona el tipo de servicio");
      return;
    }

    setLoading(true);

    try {
      const user = await base44.auth.me();

      // Crear o actualizar cliente
      let customerId = selectedCustomer?.id;
      if (!customerId) {
        const newCustomer = await base44.entities.Customer.create({
          name: formData.customer_name,
          phone: formData.customer_phone || undefined,
          email: formData.customer_email || undefined
        });
        customerId = newCustomer.id;
      }

      // Generar número de orden usando timestamp
      const timestamp = Date.now();
      const orderNumber = `SW-${String(timestamp).slice(-6)}`;

      // Obtener label del servicio
      const serviceLabel = SOFTWARE_SERVICES.find(s => s.value === formData.service_type)?.label || formData.service_type;

      // Crear orden de servicio de software
      const order = await base44.entities.Order.create({
        order_number: orderNumber,
        customer_id: customerId,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        device_type: "Software",
        device_brand: formData.device_brand,
        device_model: formData.device_model,
        device_serial: formData.device_serial,
        initial_problem: `${serviceLabel}\n${formData.service_description || ""}`,
        status: "in_progress",
        cost_estimate: parseFloat(formData.price) || 0,
        balance_due: parseFloat(formData.price) || 0,
        created_by: user?.email,
        created_by_name: user?.full_name || user?.email,
        tags: ["software"]
      });

      // Crear evento inicial
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: orderNumber,
        event_type: "create",
        description: `Orden de servicio de software creada: ${serviceLabel}`,
        user_name: user?.full_name || user?.email || "Sistema",
        user_id: user?.id || null,
        metadata: {
          service_type: formData.service_type,
          device: `${formData.device_brand} ${formData.device_model}`,
          serial: formData.device_serial
        }
      });

      // Enviar email de confirmación al cliente
      if (formData.customer_email) {
        try {
          await base44.integrations.Core.SendEmail({
            from_name: "SmartFixOS",
            to: formData.customer_email,
            subject: `Confirmación de Servicio - Orden ${orderNumber}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
                <div style="background: white; padding: 30px; border-radius: 10px;">
                  <h2 style="color: #00A8E8; margin-bottom: 20px;">✅ Servicio Registrado</h2>
                  
                  <p style="color: #333; margin-bottom: 15px;">Hola <strong>${formData.customer_name}</strong>,</p>
                  
                  <p style="color: #555; margin-bottom: 20px;">
                    Hemos recibido tu solicitud de servicio de software. A continuación los detalles:
                  </p>
                  
                  <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Orden:</strong> ${orderNumber}</p>
                    <p style="margin: 5px 0;"><strong>Servicio:</strong> ${serviceLabel}</p>
                    <p style="margin: 5px 0;"><strong>Equipo:</strong> ${formData.device_brand} ${formData.device_model}</p>
                    <p style="margin: 5px 0;"><strong>IMEI/Serial:</strong> ${formData.device_serial}</p>
                    ${formData.price ? `<p style="margin: 5px 0;"><strong>Precio:</strong> $${parseFloat(formData.price).toFixed(2)}</p>` : ""}
                  </div>
                  
                  <p style="color: #555; margin-top: 20px;">
                    Te notificaremos cuando tu servicio esté completado.
                  </p>
                  
                  <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                    SmartFixOS - Sistema de Gestión
                  </p>
                </div>
              </div>
            `
          });
        } catch (emailError) {
          console.error("Error enviando email:", emailError);
        }
      }

      toast.success(`✅ Servicio ${orderNumber} creado exitosamente`);
      onSuccess?.();
      onClose();

    } catch (error) {
      console.error("Error creando servicio:", error);
      toast.error("Error al crear el servicio");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] border-cyan-500/30 theme-light:bg-white theme-light:border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2 theme-light:text-gray-900">
            <Code2 className="w-6 h-6 text-cyan-500" />
            Nuevo Desbloqueo / Servicio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Selección de Cliente */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide theme-light:text-cyan-700">
              👤 Cliente
            </h3>
            
            {!selectedCustomer && !showNewCustomer && (
              <>
                <Input
                  placeholder="Buscar cliente por nombre, teléfono o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />

                {searchTerm && filteredCustomers.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-white/10 rounded-lg p-2 bg-black/20 theme-light:bg-gray-50 theme-light:border-gray-200">
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full text-left p-3 rounded-lg bg-black/40 hover:bg-cyan-600/20 border border-white/10 transition-colors theme-light:bg-white theme-light:hover:bg-cyan-50 theme-light:border-gray-200"
                      >
                        <p className="text-white font-medium text-sm theme-light:text-gray-900">{customer.name}</p>
                        <p className="text-gray-400 text-xs theme-light:text-gray-600">
                          {customer.phone} {customer.email && `• ${customer.email}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  onClick={() => setShowNewCustomer(true)}
                  variant="outline"
                  className="w-full border-cyan-500/30 hover:bg-cyan-600/20 theme-light:border-cyan-300"
                >
                  + Nuevo Cliente
                </Button>
              </>
            )}

            {(selectedCustomer || showNewCustomer) && (
              <div className="space-y-3 p-4 bg-black/20 border border-cyan-500/20 rounded-lg theme-light:bg-cyan-50 theme-light:border-cyan-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-cyan-400 font-semibold theme-light:text-cyan-700">
                    {selectedCustomer ? "Cliente Seleccionado" : "Nuevo Cliente"}
                  </span>
                  <Button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setShowNewCustomer(false);
                      setSearchTerm("");
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Cambiar
                  </Button>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-gray-300 text-xs theme-light:text-gray-700">Nombre *</Label>
                    <Input
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                      disabled={!!selectedCustomer}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-gray-300 text-xs theme-light:text-gray-700">Teléfono</Label>
                      <Input
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                        disabled={!!selectedCustomer}
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 text-xs theme-light:text-gray-700">Email</Label>
                      <Input
                        value={formData.customer_email}
                        onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                        type="email"
                        className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                        disabled={!!selectedCustomer}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Información del Equipo */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide theme-light:text-emerald-700">
              📱 Equipo
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs theme-light:text-gray-700">Marca *</Label>
                <Input
                  value={formData.device_brand}
                  onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                  placeholder="Ej: Apple, Samsung..."
                  className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-xs theme-light:text-gray-700">Modelo *</Label>
                <Input
                  value={formData.device_model}
                  onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                  placeholder="Ej: iPhone 13 Pro..."
                  className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-300 text-xs theme-light:text-gray-700">IMEI / Serial Number *</Label>
              <Input
                value={formData.device_serial}
                onChange={(e) => setFormData({ ...formData, device_serial: e.target.value })}
                placeholder="Ej: 123456789012345..."
                className="bg-black/40 border-white/15 text-white font-mono theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
          </div>

          {/* Servicio */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide theme-light:text-purple-700">
              ⚙️ Servicio
            </h3>
            <div>
              <Label className="text-gray-300 text-xs theme-light:text-gray-700">Tipo de Servicio *</Label>
              <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                <SelectTrigger className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">
                  <SelectValue placeholder="Selecciona el servicio..." />
                </SelectTrigger>
                <SelectContent>
                  {SOFTWARE_SERVICES.map(service => (
                    <SelectItem key={service.value} value={service.value}>
                      {service.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300 text-xs theme-light:text-gray-700">Descripción / Detalles</Label>
              <Textarea
                value={formData.service_description}
                onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
                placeholder="Detalles adicionales del servicio..."
                className="bg-black/40 border-white/15 text-white min-h-[80px] theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs theme-light:text-gray-700">Precio (Opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-xs theme-light:text-gray-700">Notas Internas</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas privadas..."
                  className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 border-white/15 theme-light:border-gray-300"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Servicio"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
