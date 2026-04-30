import React, { useState, useEffect } from "react";
import { 
  CalendarClock, CheckCircle2, AlertCircle, Mail, MessageSquare, 
  Search, Filter, Smartphone, Wrench, MoreHorizontal 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Compat shim: parse a value that may already be a Date or an ISO string.
const toDate = (v) => (v instanceof Date ? v : parseISO(String(v)));

export default function MaintenanceReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pending, due, overdue
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      setLoading(true);
      // Fetch reminders sorted by due_date ascending
      const data = await base44.entities.MaintenanceReminder.filter({}, { due_date: 1 }, 100);
      setReminders(data || []);
    } catch (error) {
      console.error("Error loading reminders:", error);
      toast.error("Error cargando recordatorios");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status, date) => {
    if (status === 'completed' || status === 'booked') return "text-apple-green bg-apple-green/15";
    if (status === 'sent') return "text-apple-blue bg-apple-blue/15";

    const dueDate = moment(date);
    const today = moment();

    if (dueDate.isBefore(today, 'day')) return "text-apple-red bg-apple-red/15"; // Overdue
    if (dueDate.diff(today, 'days') <= 7) return "text-apple-yellow bg-apple-yellow/15"; // Due soon

    return "apple-label-secondary bg-gray-sys6 dark:bg-gray-sys5"; // Future
  };

  const getStatusLabel = (status, date) => {
    if (status === 'booked') return "Agendado";
    if (status === 'sent') return "Notificado";
    
    const dueDate = moment(date);
    const today = moment();
    
    if (dueDate.isBefore(today, 'day')) return "Vencido";
    if (dueDate.diff(today, 'days') <= 7) return "Próximo";
    
    return "Pendiente";
  };

  const handleSendReminder = async (reminder, method) => {
    try {
      toast.info(`Enviando ${method === 'email' ? 'correo' : 'SMS'} a ${reminder.customer_name}...`);
      
      // Update status
      await base44.entities.MaintenanceReminder.update(reminder.id, {
        status: 'sent'
      });
      
      // Update UI
      setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, status: 'sent' } : r));
      toast.success("Recordatorio enviado correctamente");
    } catch (error) {
      toast.error("Error enviando recordatorio");
    }
  };

  const handleMarkBooked = async (reminder) => {
    try {
      await base44.entities.MaintenanceReminder.update(reminder.id, {
        status: 'booked'
      });
      setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, status: 'booked' } : r));
      toast.success("Marcado como agendado");
    } catch (error) {
      toast.error("Error actualizando estado");
    }
  };

  const filteredReminders = reminders.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      const match = (r.customer_name || "").toLowerCase().includes(q) || 
                    (r.device_model || "").toLowerCase().includes(q) ||
                    (r.service_name || "").toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filter === 'all') return true;
    
    const dueDate = moment(r.due_date);
    const today = moment();
    
    if (filter === 'overdue') return dueDate.isBefore(today, 'day') && r.status === 'pending';
    if (filter === 'due_soon') return dueDate.diff(today, 'days') <= 30 && dueDate.isAfter(today, 'day') && r.status === 'pending';
    if (filter === 'pending') return r.status === 'pending';
    
    return true;
  });

  return (
    <div className="apple-type flex flex-col h-full apple-card rounded-apple-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
        <div>
          <h3 className="apple-text-title3 apple-label-primary flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-apple-blue" />
            Mantenimientos Programados
          </h3>
          <p className="apple-text-subheadline apple-label-secondary">
            Gestiona los recordatorios automáticos de tus clientes
          </p>
        </div>

        <div className="flex items-center gap-2 apple-surface p-1 rounded-apple-md">
          <button
            onClick={() => setFilter('all')}
            className={`apple-press px-3 py-1.5 rounded-apple-sm apple-text-subheadline transition ${filter === 'all' ? 'apple-surface-elevated apple-label-primary' : 'apple-label-secondary'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('overdue')}
            className={`apple-press px-3 py-1.5 rounded-apple-sm apple-text-subheadline transition ${filter === 'overdue' ? 'bg-apple-red/15 text-apple-red' : 'apple-label-secondary'}`}
          >
            Vencidos
          </button>
          <button
            onClick={() => setFilter('due_soon')}
            className={`apple-press px-3 py-1.5 rounded-apple-sm apple-text-subheadline transition ${filter === 'due_soon' ? 'bg-apple-yellow/15 text-apple-yellow' : 'apple-label-secondary'}`}
          >
            Próximos
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 apple-surface" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary" />
          <Input
            placeholder="Buscar por cliente, dispositivo o servicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="apple-input pl-9"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-apple-blue border-t-transparent rounded-full"></div>
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="text-center py-12 apple-label-tertiary">
            <CalendarClock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="apple-text-subheadline">No hay recordatorios pendientes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredReminders.map((reminder) => (
              <Card key={reminder.id} className="apple-press apple-surface border-0 rounded-apple-md transition">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  {/* Icon & Date */}
                  <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-apple-sm shrink-0 ${getStatusColor(reminder.status, reminder.due_date)}`}>
                    <span className="apple-text-caption2 font-semibold">{moment(reminder.due_date).format("MMM")}</span>
                    <span className="apple-text-title2 font-semibold tabular-nums">{moment(reminder.due_date).format("D")}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="apple-label-primary apple-text-subheadline font-medium truncate">{reminder.customer_name}</h4>
                      <Badge variant="outline" className={`apple-text-caption2 h-5 border-0 ${getStatusColor(reminder.status, reminder.due_date)}`}>
                        {getStatusLabel(reminder.status, reminder.due_date)}
                      </Badge>
                    </div>
                    <div className="apple-text-subheadline apple-label-secondary flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5" />
                      {reminder.device_model}
                      <span className="apple-label-tertiary">•</span>
                      <Wrench className="w-3.5 h-3.5" />
                      {reminder.service_name}
                    </div>
                    <p className="apple-text-caption1 apple-label-tertiary mt-1 tabular-nums">
                      Último servicio: {moment(reminder.last_service_date).format("DD/MM/YYYY")}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {reminder.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="apple-btn apple-btn-tinted h-8"
                          onClick={() => handleSendReminder(reminder, 'email')}
                        >
                          <Mail className="w-3.5 h-3.5 mr-2" />
                          Email
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="apple-btn apple-btn-tinted h-8"
                          style={{ backgroundColor: 'rgb(var(--apple-green) / 0.12)', color: 'rgb(var(--apple-green))' }}
                          onClick={() => handleSendReminder(reminder, 'sms')}
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-2" />
                          SMS
                        </Button>
                      </>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Acciones del recordatorio" className="apple-btn apple-btn-plain h-8 w-8 apple-label-secondary">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="apple-surface-elevated rounded-apple-md border-0 shadow-apple-xl apple-label-primary">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleSendReminder(reminder, 'email')}>
                          <Mail className="w-4 h-4 mr-2" /> Enviar Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendReminder(reminder, 'sms')}>
                          <MessageSquare className="w-4 h-4 mr-2" /> Enviar SMS
                        </DropdownMenuItem>
                        <DropdownMenuSeparator style={{ backgroundColor: 'rgb(var(--separator) / 0.29)' }} />
                        <DropdownMenuItem onClick={() => handleMarkBooked(reminder)}>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-apple-green" /> Marcar Agendado
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
