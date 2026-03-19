import React, { useState, useEffect } from "react";
import appClient from "@/api/appClient";
import { generateCustomerNumber } from "@/components/utils/sequenceHelpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, Mail, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LOCAL_CUSTOMERS_KEY = "smartfix_local_customers";

function readLocalCustomers() {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCustomers(customers) {
  try {
    localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(customers || []));
  } catch {
    // no-op
  }
}

export default function CreateCustomerDialog({ open, onClose, onSuccess, customer }) {
  const EMPTY_CUSTOMER_FORM = {
    name: "",
    phone: "",
    email: "",
    additional_phones: [],
    additional_contact_info: []
  };
  const [formData, setFormData] = useState({
    ...EMPTY_CUSTOMER_FORM
  });
  const [loading, setLoading] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Handle editing mode population
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        additional_phones: customer.additional_phones || [],
        additional_contact_info: customer.additional_contact_info || []
      });
    } else {
      setFormData({ ...EMPTY_CUSTOMER_FORM });
    }
  }, [customer, open]);

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission
    
    if (!formData.name || !formData.phone) {
      toast.error("Nombre y teléfono son requeridos");
      return;
    }

    setLoading(true);

    try {
      let createdCustomer = null;
      if (customer) {
        // Update existing
        await appClient.entities.Customer.update(customer.id, {
          ...formData,
        });
        
        // Actualizar TODAS las órdenes del cliente (por ID o por nombre/teléfono)
        const ordersByCustomerId = await appClient.entities.Order.filter({ customer_id: customer.id });
        const ordersByPhone = await appClient.entities.Order.filter({ customer_phone: customer.phone });
        
        // Combinar y eliminar duplicados
        const allOrders = [...ordersByCustomerId];
        for (const order of ordersByPhone) {
          if (!allOrders.find(o => o.id === order.id)) {
            allOrders.push(order);
          }
        }
        
        console.log(`🔄 Actualizando ${allOrders.length} órdenes del cliente...`);
        
        for (const order of allOrders) {
          await appClient.entities.Order.update(order.id, {
            customer_id: customer.id, // Asegurar que tenga el ID
            customer_name: formData.name,
            customer_phone: formData.phone,
            customer_email: formData.email || "",
            customer_additional_phones: formData.additional_phones
          });
        }
        
        toast.success(`✅ Cliente y ${allOrders.length} órdenes actualizadas`);
      } else {
        // Create new
        const customerNumber = await generateCustomerNumber();
        createdCustomer = await appClient.entities.Customer.create({
          ...formData,
          customer_number: customerNumber,
          total_orders: 0,
        });

        // Si el backend no retorna entidad válida, guardamos respaldo local para no perder el alta.
        if (!createdCustomer?.id) {
          createdCustomer = {
            id: `local-customer-${Date.now()}`,
            ...formData,
            customer_number: customerNumber,
            total_orders: 0,
            is_local: true,
            created_date: new Date().toISOString()
          };
          const local = readLocalCustomers();
          writeLocalCustomers([createdCustomer, ...local.filter((c) => c.id !== createdCustomer.id)]);
        }
        
        // Send welcome email if email provided (only for new customers)
        if (formData.email) {
            try {
              await appClient.integrations.Core.SendEmail({
                to: formData.email,
                subject: "Bienvenido a SmartFixOS",
                body: `
                  <h2>¡Bienvenido ${formData.name}!</h2>
                  <p>Gracias por confiar en nosotros.</p>
                  <p>Hemos registrado tu información exitosamente.</p>
                `
              });
            } catch (emailError) {
              console.error("Error sending welcome email:", emailError);
            }
        }
        
        toast.success("Cliente creado correctamente");
      }

      if (onSuccess) onSuccess(createdCustomer);
      else if (onClose) onClose(); // Fallback if onSuccess not provided
      
      onClose();
      
      if (!customer) {
          setFormData({ ...EMPTY_CUSTOMER_FORM });
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Error al guardar cliente: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-white/20 dark:border-white/10 rounded-[2rem] shadow-2xl p-0 overflow-hidden">
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {customer ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="group">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-3 mb-1.5 block uppercase tracking-wider">
                  Nombre Completo
                </Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej. Juan Pérez"
                    className="h-12 pl-12 rounded-2xl bg-slate-100 dark:bg-white/5 border-transparent focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all font-medium text-base"
                    autoFocus
                  />
                </div>
              </div>

              <div className="group">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-3 mb-1.5 block uppercase tracking-wider">
                  Teléfono
                </Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                    <Phone className="w-5 h-5" />
                  </div>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="(000) 000-0000"
                    className="h-12 pl-12 rounded-2xl bg-slate-100 dark:bg-white/5 border-transparent focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all font-medium text-base"
                    type="tel"
                  />
                </div>
              </div>

              <div className="group">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-3 mb-1.5 block uppercase tracking-wider">
                  Email (Opcional)
                </Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="cliente@email.com"
                    className="h-12 pl-12 rounded-2xl bg-slate-100 dark:bg-white/5 border-transparent focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all font-medium text-base"
                    type="email"
                  />
                </div>
              </div>

              {/* Teléfonos Adicionales */}
              <div className="group">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-3 mb-1.5 block uppercase tracking-wider">
                  Teléfonos Adicionales
                </Label>
                <div className="space-y-2">
                  {formData.additional_phones.map((phone, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={phone}
                        onChange={(e) => {
                          const updated = [...formData.additional_phones];
                          updated[idx] = e.target.value;
                          setFormData({...formData, additional_phones: updated});
                        }}
                        className="h-10 rounded-xl bg-slate-100 dark:bg-white/5 border-transparent text-sm"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const updated = formData.additional_phones.filter((_, i) => i !== idx);
                          setFormData({...formData, additional_phones: updated});
                        }}
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 text-red-500 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Agregar teléfono..."
                      className="h-10 rounded-xl bg-slate-100 dark:bg-white/5 border-transparent text-sm"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newPhone.trim()) {
                          setFormData({...formData, additional_phones: [...formData.additional_phones, newPhone]});
                          setNewPhone("");
                        }
                      }}
                      size="sm"
                      className="h-10 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Emails Adicionales */}
              <div className="group">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-3 mb-1.5 block uppercase tracking-wider">
                  Emails Adicionales
                </Label>
                <div className="space-y-2">
                  {formData.additional_contact_info.filter(c => c.type === 'email').map((contact, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={contact.value}
                        onChange={(e) => {
                          const updated = [...formData.additional_contact_info];
                          const emailIdx = updated.findIndex((c, i) => c.type === 'email' && formData.additional_contact_info.filter(x => x.type === 'email').indexOf(c) === idx);
                          if (emailIdx !== -1) updated[emailIdx].value = e.target.value;
                          setFormData({...formData, additional_contact_info: updated});
                        }}
                        className="h-10 rounded-xl bg-slate-100 dark:bg-white/5 border-transparent text-sm"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const updated = formData.additional_contact_info.filter((c, i) => 
                            !(c.type === 'email' && formData.additional_contact_info.filter(x => x.type === 'email').indexOf(c) === idx)
                          );
                          setFormData({...formData, additional_contact_info: updated});
                        }}
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 text-red-500 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Agregar email..."
                      type="email"
                      className="h-10 rounded-xl bg-slate-100 dark:bg-white/5 border-transparent text-sm"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newEmail.trim()) {
                          setFormData({
                            ...formData, 
                            additional_contact_info: [
                              ...formData.additional_contact_info, 
                              { type: 'email', value: newEmail, label: 'Email adicional' }
                            ]
                          });
                          setNewEmail("");
                        }
                      }}
                      size="sm"
                      className="h-10 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 pb-6 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-medium"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 h-12 rounded-xl bg-[#0071e3] hover:bg-[#0077ED] text-white shadow-lg shadow-blue-500/30 font-semibold text-lg transition-all active:scale-[0.98]"
                disabled={loading || !formData.name || !formData.phone}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  customer ? "Guardar Cambios" : "Crear Cliente"
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
