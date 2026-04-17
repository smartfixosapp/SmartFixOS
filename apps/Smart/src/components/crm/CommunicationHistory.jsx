import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Phone, Mail, Plus, Calendar, Clock, User, Loader2, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function CommunicationHistory({ customerId }) {
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [formData, setFormData] = useState({
    type: "call",
    subject: "",
    content: "",
    status: "completed"
  });

  useEffect(() => {
    fetchCommunications();
  }, [customerId]);

  const fetchCommunications = async () => {
    try {
      const data = await base44.entities.CommunicationHistory.filter({
        customer_id: customerId
      });
      setCommunications(data || []);
    } catch (error) {
      console.error("Error fetching communications:", error);
      toast.error("Error al cargar historial");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCommunication = async () => {
    if (!formData.subject.trim()) {
      toast.error("El asunto es obligatorio");
      return;
    }

    try {
      await base44.entities.CommunicationHistory.create({
        customer_id: customerId,
        ...formData
      });
      toast.success("Comunicación registrada");
      setShowDialog(false);
      setFormData({ type: "call", subject: "", content: "", status: "completed" });
      fetchCommunications();
    } catch (error) {
      console.error("Error adding communication:", error);
      toast.error("Error al registrar");
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "call":
        return <Phone className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      case "sms":
      case "whatsapp":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      call: "text-apple-blue",
      email: "text-apple-blue",
      sms: "text-apple-green",
      whatsapp: "text-apple-green",
      note: "text-apple-yellow"
    };
    return colors[type] || "apple-label-secondary";
  };

  const filtered = filterType === "all"
    ? communications
    : communications.filter(c => c.type === filterType);

  const sortedComm = [...filtered].sort((a, b) =>
    new Date(b.created_date) - new Date(a.created_date)
  );

  if (loading) {
    return <div className="apple-type flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-apple-blue" /></div>;
  }

  return (
    <>
      <Card className="apple-type apple-card border-0 rounded-apple-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-apple-blue" />
            Historial de Comunicaciones
          </CardTitle>
          <Button onClick={() => setShowDialog(true)} className="apple-btn apple-btn-primary gap-2 h-8 px-3">
            <Plus className="w-4 h-4" />
            Registrar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2 flex-wrap">
            {["all", "call", "email", "whatsapp", "note"].map(type => (
              <Button
                key={type}
                onClick={() => setFilterType(type)}
                size="sm"
                variant={filterType === type ? "default" : "outline"}
                className={filterType === type ? "apple-btn apple-btn-primary" : "apple-btn apple-btn-secondary"}
              >
                {type === "all" ? "Todos" : type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {sortedComm.length === 0 ? (
              <p className="apple-label-tertiary apple-text-subheadline py-8 text-center">Sin comunicaciones registradas</p>
            ) : (
              sortedComm.map(comm => (
                <div key={comm.id} className="apple-press apple-surface rounded-apple-md p-4 transition">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-apple-sm bg-apple-blue/15 ${getTypeColor(comm.type)}`}>
                      {getIcon(comm.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="apple-text-subheadline font-semibold apple-label-primary">{comm.subject}</h4>
                        <span className="apple-text-caption2 apple-label-tertiary font-semibold">{comm.type}</span>
                      </div>
                      {comm.content && (
                        <p className="apple-label-secondary apple-text-caption1 mb-2 line-clamp-2">{comm.content}</p>
                      )}
                      <div className="flex items-center gap-3 apple-text-caption2 apple-label-tertiary">
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {format(new Date(comm.created_date), "dd MMM yyyy HH:mm", { locale: es })}
                        </span>
                        {comm.status && (
                          <span className="px-2 py-0.5 bg-apple-blue/15 rounded text-apple-blue capitalize">
                            {comm.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="apple-text-title2 apple-label-primary">Registrar Comunicación</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="apple-label-secondary apple-text-subheadline mb-2 block">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="apple-input w-full rounded-apple-md px-3 py-2"
                >
                  <option value="call">Llamada</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="note">Nota</option>
                </select>
              </div>
              <div>
                <label className="apple-label-secondary apple-text-subheadline mb-2 block">Asunto *</label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="ej: Seguimiento de orden"
                  className="apple-input"
                />
              </div>
              <div>
                <label className="apple-label-secondary apple-text-subheadline mb-2 block">Detalles</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Notas de la comunicación..."
                  className="apple-input w-full rounded-apple-md px-3 py-2 resize-none h-24"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowDialog(false)} variant="outline" className="apple-btn apple-btn-secondary">Cancelar</Button>
                <Button onClick={handleAddCommunication} className="apple-btn apple-btn-primary">
                  Registrar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
