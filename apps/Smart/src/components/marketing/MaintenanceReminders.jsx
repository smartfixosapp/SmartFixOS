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
import moment from "moment";

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
    if (status === 'completed' || status === 'booked') return "text-green-500 bg-green-500/10";
    if (status === 'sent') return "text-blue-500 bg-blue-500/10";
    
    const dueDate = moment(date);
    const today = moment();
    
    if (dueDate.isBefore(today, 'day')) return "text-red-500 bg-red-500/10 border-red-500/30"; // Overdue
    if (dueDate.diff(today, 'days') <= 7) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30"; // Due soon
    
    return "text-gray-400 bg-gray-500/10"; // Future
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
    <div className="flex flex-col h-full bg-black/40 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-cyan-500" />
            Mantenimientos Programados
          </h3>
          <p className="text-sm text-gray-400">
            Gestiona los recordatorios automáticos de tus clientes
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
          <button 
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm transition ${filter === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilter('overdue')}
            className={`px-3 py-1.5 rounded-md text-sm transition ${filter === 'overdue' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
          >
            Vencidos
          </button>
          <button 
            onClick={() => setFilter('due_soon')}
            className={`px-3 py-1.5 rounded-md text-sm transition ${filter === 'due_soon' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            Próximos
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-white/10 bg-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder="Buscar por cliente, dispositivo o servicio..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-black/40 border-white/10"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CalendarClock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No hay recordatorios pendientes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredReminders.map((reminder) => (
              <Card key={reminder.id} className="bg-black/20 border-white/10 hover:bg-white/5 transition">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  {/* Icon & Date */}
                  <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border shrink-0 ${getStatusColor(reminder.status, reminder.due_date)}`}>
                    <span className="text-xs font-bold uppercase">{moment(reminder.due_date).format("MMM")}</span>
                    <span className="text-2xl font-bold">{moment(reminder.due_date).format("D")}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-medium truncate">{reminder.customer_name}</h4>
                      <Badge variant="outline" className={`text-[10px] h-5 ${getStatusColor(reminder.status, reminder.due_date)}`}>
                        {getStatusLabel(reminder.status, reminder.due_date)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5" />
                      {reminder.device_model}
                      <span className="text-gray-600">•</span>
                      <Wrench className="w-3.5 h-3.5" />
                      {reminder.service_name}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
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
                          className="h-8 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                          onClick={() => handleSendReminder(reminder, 'email')}
                        >
                          <Mail className="w-3.5 h-3.5 mr-2" />
                          Email
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => handleSendReminder(reminder, 'sms')}
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-2" />
                          SMS
                        </Button>
                      </>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-black/90 border-white/10 text-white">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleSendReminder(reminder, 'email')}>
                          <Mail className="w-4 h-4 mr-2" /> Enviar Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendReminder(reminder, 'sms')}>
                          <MessageSquare className="w-4 h-4 mr-2" /> Enviar SMS
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={() => handleMarkBooked(reminder)}>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-400" /> Marcar Agendado
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
