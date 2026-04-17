import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Users, Mail, MessageSquare, Send, CheckCircle2, 
  X, Filter, Check, Smartphone, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function CreateCampaign() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [channel, setChannel] = useState("email"); // email | sms
  const [message, setMessage] = useState({ subject: "", body: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      // Fetching all customers (with limit for now)
      const data = await base44.entities.Customer.list();
      setCustomers(data || []);
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Error cargando clientes");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const lowerSearch = search.toLowerCase();
    return customers.filter(c => 
      (c.name || "").toLowerCase().includes(lowerSearch) ||
      (c.email || "").toLowerCase().includes(lowerSearch) ||
      (c.phone || "").toLowerCase().includes(lowerSearch)
    );
  }, [customers, search]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecciona al menos un cliente");
      return;
    }
    if (channel === "email" && (!message.subject || !message.body)) {
      toast.error("Completa el asunto y el mensaje");
      return;
    }
    if (channel === "sms" && !message.body) {
      toast.error("Escribe un mensaje");
      return;
    }

    setSending(true);
    
    // Simulate sending for now
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const count = selectedIds.size;
      toast.success(`Mensaje enviado a ${count} clientes`, {
        description: `Canal: ${channel === 'email' ? 'Email' : 'SMS'}`
      });
      
      // Reset form
      setMessage({ subject: "", body: "" });
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Error enviando campaña");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="apple-type grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Left Column: Customer Selection */}
      <div className="lg:col-span-1 apple-card rounded-apple-lg flex flex-col overflow-hidden">
        <div className="p-4 space-y-4" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <div className="flex items-center justify-between">
            <h3 className="apple-text-headline apple-label-primary flex items-center gap-2">
              <Users className="w-4 h-4 text-apple-blue" />
              Clientes ({filteredCustomers.length})
            </h3>
            <Badge variant="secondary" className="bg-apple-blue/15 text-apple-blue border-0 tabular-nums">
              {selectedIds.size} seleccionados
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary" />
            <Input
              placeholder="Buscar por nombre, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="apple-input pl-9"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length}
              onCheckedChange={handleSelectAll}
            />
            <label
              htmlFor="select-all"
              className="apple-text-subheadline font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 apple-label-secondary"
            >
              Seleccionar todos
            </label>
          </div>
        </div>

        <ScrollArea className="flex-1 p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-apple-blue" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center p-8 apple-label-tertiary apple-text-subheadline">
              No se encontraron clientes
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  className={`apple-press flex items-center space-x-3 p-3 rounded-apple-md transition-colors cursor-pointer ${
                    selectedIds.has(customer.id)
                      ? "bg-apple-blue/12"
                      : ""
                  }`}
                  onClick={() => toggleSelection(customer.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(customer.id)}
                    onCheckedChange={() => toggleSelection(customer.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`apple-text-subheadline font-medium truncate ${selectedIds.has(customer.id) ? "text-apple-blue" : "apple-label-primary"}`}>
                      {customer.name}
                    </p>
                    <p className="apple-text-caption1 apple-label-tertiary truncate">
                      {customer.email || customer.phone || "Sin contacto"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Column: Message Composition */}
      <div className="lg:col-span-2 apple-card rounded-apple-lg flex flex-col p-6">
        <h3 className="apple-text-title2 apple-label-primary mb-6">Componer Mensaje</h3>

        <div className="space-y-6 flex-1">
          {/* Channel Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setChannel("email")}
              className={`apple-press p-4 rounded-apple-md flex flex-col items-center gap-2 transition-all ${
                channel === "email"
                  ? "bg-apple-purple/15 text-apple-purple"
                  : "apple-surface apple-label-secondary"
              }`}
            >
              <Mail className="w-6 h-6" />
              <span className="apple-text-subheadline font-medium">Email Marketing</span>
            </button>
            <button
              onClick={() => setChannel("sms")}
              className={`apple-press p-4 rounded-apple-md flex flex-col items-center gap-2 transition-all ${
                channel === "sms"
                  ? "bg-apple-green/15 text-apple-green"
                  : "apple-surface apple-label-secondary"
              }`}
            >
              <MessageSquare className="w-6 h-6" />
              <span className="apple-text-subheadline font-medium">Mensaje SMS</span>
            </button>
          </div>

          {/* Message Fields */}
          <div className="space-y-4 apple-surface p-6 rounded-apple-md">
            {channel === "email" && (
              <div>
                <label className="apple-text-subheadline apple-label-secondary mb-1.5 block">Asunto</label>
                <Input
                  placeholder="Ej: ¡Oferta Especial de Verano!"
                  value={message.subject}
                  onChange={(e) => setMessage({ ...message, subject: e.target.value })}
                  className="apple-input"
                />
              </div>
            )}

            <div>
              <label className="apple-text-subheadline apple-label-secondary mb-1.5 block">
                {channel === "email" ? "Cuerpo del Correo" : "Mensaje de Texto"}
              </label>
              <Textarea
                placeholder={channel === "email" ? "Escribe tu mensaje aquí..." : "Escribe tu SMS (max 160 caracteres)..."}
                value={message.body}
                onChange={(e) => setMessage({ ...message, body: e.target.value })}
                className="apple-input min-h-[200px]"
                maxLength={channel === "sms" ? 160 : undefined}
              />
              {channel === "sms" && (
                <p className="apple-text-caption1 text-right apple-label-tertiary mt-1 tabular-nums">
                  {message.body.length}/160 caracteres
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end items-center gap-4 pt-4" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <div className="apple-text-subheadline apple-label-secondary">
            Se enviará a <span className="apple-label-primary font-semibold tabular-nums">{selectedIds.size}</span> destinatarios
          </div>
          <Button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0}
            className={`apple-btn apple-btn-primary min-w-[150px] ${
              channel === "sms" ? "" : ""
            }`}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Campaña
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
