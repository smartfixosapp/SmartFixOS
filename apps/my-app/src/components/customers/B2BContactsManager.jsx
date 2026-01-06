import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Star, Mail, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function B2BContactsManager({ customer, onUpdate }) {
  const [contacts, setContacts] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    is_primary: false,
    notifications_enabled: true
  });

  useEffect(() => {
    setContacts(customer?.b2b_contacts || []);
  }, [customer]);

  const resetForm = () => {
    setForm({
      name: "",
      role: "",
      phone: "",
      email: "",
      is_primary: false,
      notifications_enabled: true
    });
    setEditingIndex(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleEdit = (index) => {
    setForm(contacts[index]);
    setEditingIndex(index);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nombre y email son requeridos");
      return;
    }

    try {
      let updated = [...contacts];
      
      if (editingIndex !== null) {
        updated[editingIndex] = form;
      } else {
        if (form.is_primary) {
          updated = updated.map(c => ({ ...c, is_primary: false }));
        }
        updated.push(form);
      }

      await base44.entities.Customer.update(customer.id, {
        b2b_contacts: updated
      });

      setContacts(updated);
      setShowDialog(false);
      resetForm();
      onUpdate?.();
      toast.success("Contacto guardado");

    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("Error al guardar contacto");
    }
  };

  const handleRemove = async (index) => {
    if (!confirm("¿Eliminar este contacto?")) return;

    try {
      const updated = contacts.filter((_, i) => i !== index);
      await base44.entities.Customer.update(customer.id, {
        b2b_contacts: updated
      });
      setContacts(updated);
      onUpdate?.();
      toast.success("Contacto eliminado");
    } catch (error) {
      console.error("Error removing contact:", error);
      toast.error("Error al eliminar contacto");
    }
  };

  const handleSetPrimary = async (index) => {
    try {
      const updated = contacts.map((c, i) => ({
        ...c,
        is_primary: i === index
      }));

      await base44.entities.Customer.update(customer.id, {
        b2b_contacts: updated
      });
      setContacts(updated);
      onUpdate?.();
      toast.success("Contacto principal actualizado");
    } catch (error) {
      console.error("Error setting primary:", error);
      toast.error("Error al actualizar");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-semibold text-sm">Contactos de la Empresa</h4>
        <Button
          size="sm"
          onClick={handleAdd}
          className="bg-gradient-to-r from-purple-600 to-pink-600 h-8">
          <Plus className="w-4 h-4 mr-1" />
          Añadir
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-white/10 rounded-lg">
          <p className="text-gray-400 text-sm">No hay contactos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact, index) => (
            <Card key={index} className="bg-black/40 border-white/10">
              <div className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold text-sm">{contact.name}</p>
                    {contact.is_primary && (
                      <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30 text-xs">
                        <Star className="w-3 h-3 mr-1" />
                        Principal
                      </Badge>
                    )}
                  </div>
                  {contact.role && <p className="text-xs text-gray-400">{contact.role}</p>}
                  <div className="flex flex-col gap-1 mt-2">
                    {contact.email && (
                      <span className="text-xs text-gray-300 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="text-xs text-gray-300 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!contact.is_primary && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSetPrimary(index)}
                      className="h-7 w-7 text-purple-400 hover:bg-purple-600/20"
                      title="Marcar como principal">
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(index)}
                    className="h-7 w-7 text-cyan-400 hover:bg-cyan-600/20">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemove(index)}
                    className="h-7 w-7 text-red-400 hover:bg-red-600/20">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#0f0f10] border border-purple-500/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingIndex !== null ? "Editar Contacto" : "Nuevo Contacto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-300 mb-1.5 block">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="María López"
                className="bg-black/40 border-purple-500/30 text-white" />
            </div>

            <div>
              <label className="text-xs text-gray-300 mb-1.5 block">Cargo / Rol</label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="CFO, IT Manager, Gerente..."
                className="bg-black/40 border-purple-500/30 text-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-300 mb-1.5 block">Email *</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="maria@empresa.com"
                  className="bg-black/40 border-purple-500/30 text-white" />
              </div>

              <div>
                <label className="text-xs text-gray-300 mb-1.5 block">Teléfono</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="787-555-0123"
                  className="bg-black/40 border-purple-500/30 text-white" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
                className="w-4 h-4 rounded border-purple-500/30" />
              <label className="text-sm text-gray-300">Contacto principal</label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifications_enabled}
                onChange={(e) => setForm({ ...form, notifications_enabled: e.target.checked })}
                className="w-4 h-4 rounded border-purple-500/30" />
              <label className="text-sm text-gray-300">Recibir notificaciones de órdenes</label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
                className="flex-1 border-white/15">
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
