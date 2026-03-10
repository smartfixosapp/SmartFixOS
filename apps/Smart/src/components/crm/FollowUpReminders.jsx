import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Check, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

export default function FollowUpReminders({ customerId }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reminder_date: "",
    priority: "normal"
  });

  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, [customerId]);

  const fetchReminders = async () => {
    try {
      if (customerId) {
        const data = await base44.entities.MaintenanceReminder.filter({
          customer_id: customerId
        });
        setReminders(data || []);
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReminder = async () => {
    if (!formData.title.trim() || !formData.reminder_date) {
      toast.error("Título y fecha son obligatorios");
      return;
    }

    try {
      await base44.entities.MaintenanceReminder.create({
        customer_id: customerId,
        ...formData,
        status: "pending"
      });
      toast.success("Recordatorio creado");
      setShowDialog(false);
      setFormData({ title: "", description: "", reminder_date: "", priority: "normal" });
      fetchReminders();
    } catch (error) {
      console.error("Error adding reminder:", error);
      toast.error("Error al crear recordatorio");
    }
  };

  const handleCompleteReminder = async (id) => {
    try {
      await base44.entities.MaintenanceReminder.update(id, {
        status: "completed",
        completed_date: new Date().toISOString()
      });
      toast.success("Recordatorio completado");
      fetchReminders();
    } catch (error) {
      console.error("Error completing reminder:", error);
      toast.error("Error al completar");
    }
  };

  const handleDeleteReminder = async (id) => {
    if (!window.confirm("¿Eliminar este recordatorio?")) return;
    
    try {
      await base44.entities.MaintenanceReminder.delete(id);
      toast.success("Recordatorio eliminado");
      fetchReminders();
    } catch (error) {
      console.error("Error deleting reminder:", error);
      toast.error("Error al eliminar");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "normal":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "low":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/30";
    }
  };

  const getStatus = (reminderDate) => {
    const today = new Date();
    const days = differenceInDays(new Date(reminderDate), today);
    
    if (days < 0) return { label: "Vencido", color: "text-red-400" };
    if (days === 0) return { label: "Hoy", color: "text-orange-400" };
    if (days <= 3) return { label: `En ${days} días`, color: "text-yellow-400" };
    return { label: `En ${days} días`, color: "text-cyan-400" };
  };

  const pending = reminders.filter(r => r.status === "pending");
  const completed = reminders.filter(r => r.status === "completed");

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;
  }

  return (
    <>
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            Recordatorios de Seguimiento
          </CardTitle>
          <Button onClick={() => setShowDialog(true)} className="gap-2 bg-cyan-600/80 hover:bg-cyan-600 h-8 px-3 text-sm">
            <Plus className="w-4 h-4" />
            Nuevo
          </Button>
        </CardHeader>
        <CardContent>
          {pending.length === 0 && completed.length === 0 ? (
            <p className="text-white/50 text-sm py-8 text-center">Sin recordatorios</p>
          ) : (
            <div className="space-y-4">
              {/* Pendientes */}
              {pending.length > 0 && (
                <div>
                  <h4 className="text-white/70 text-xs font-semibold mb-3 uppercase">Pendientes ({pending.length})</h4>
                  <div className="space-y-2">
                    {pending.map(reminder => {
                      const status = getStatus(reminder.reminder_date);
                      return (
                        <div key={reminder.id} className={`border rounded-lg p-3 ${getPriorityColor(reminder.priority)}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-semibold text-white text-sm">{reminder.title}</h5>
                              {reminder.description && (
                                <p className="text-white/60 text-xs mt-1">{reminder.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2 text-xs">
                                <Clock className="w-3 h-3" />
                                <span>{format(new Date(reminder.reminder_date), "dd MMM yyyy HH:mm", { locale: es })}</span>
                                <span className={status.color}>{status.label}</span>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleCompleteReminder(reminder.id)}
                              size="icon"
                              className="h-7 w-7 bg-green-600/80 hover:bg-green-600 ml-2"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completados */}
              {completed.length > 0 && (
                <div>
                  <h4 className="text-white/70 text-xs font-semibold mb-3 uppercase opacity-50">Completados ({completed.length})</h4>
                  <div className="space-y-2 opacity-50">
                    {completed.slice(0, 3).map(reminder => (
                      <div key={reminder.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-semibold text-white/60 text-sm line-through">{reminder.title}</h5>
                          </div>
                          <Button
                            onClick={() => handleDeleteReminder(reminder.id)}
                            size="icon"
                            className="h-6 w-6 bg-red-600/50 hover:bg-red-600 text-xs"
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#0A0A0A] border-white/10">
          <DialogHeader>
            <DialogTitle>Crear Recordatorio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-white/70 text-sm mb-2 block">Título *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="ej: Llamar al cliente"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-2 block">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Detalles..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-2 block">Fecha y Hora *</label>
              <input
                type="datetime-local"
                value={formData.reminder_date}
                onChange={(e) => setFormData({...formData, reminder_date: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-2 block">Prioridad</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setShowDialog(false)} variant="outline">Cancelar</Button>
              <Button onClick={handleAddReminder} className="bg-cyan-600/80 hover:bg-cyan-600">
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
