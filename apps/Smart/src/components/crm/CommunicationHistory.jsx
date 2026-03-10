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
      call: "text-blue-400",
      email: "text-cyan-400",
      sms: "text-green-400",
      whatsapp: "text-emerald-400",
      note: "text-yellow-400"
    };
    return colors[type] || "text-gray-400";
  };

  const filtered = filterType === "all" 
    ? communications 
    : communications.filter(c => c.type === filterType);

  const sortedComm = [...filtered].sort((a, b) => 
    new Date(b.created_date) - new Date(a.created_date)
  );

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;
  }

  return (
    <>
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
            Historial de Comunicaciones
          </CardTitle>
          <Button onClick={() => setShowDialog(true)} className="gap-2 bg-cyan-600/80 hover:bg-cyan-600 h-8 px-3 text-sm">
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
                className={filterType === type ? "bg-cyan-600/80" : ""}
              >
                {type === "all" ? "Todos" : type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {sortedComm.length === 0 ? (
              <p className="text-white/50 text-sm py-8 text-center">Sin comunicaciones registradas</p>
            ) : (
              sortedComm.map(comm => (
                <div key={comm.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 bg-white/10 rounded-lg ${getTypeColor(comm.type)}`}>
                      {getIcon(comm.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-white text-sm">{comm.subject}</h4>
                        <span className="text-xs text-white/40">{comm.type.toUpperCase()}</span>
                      </div>
                      {comm.content && (
                        <p className="text-white/60 text-xs mb-2 line-clamp-2">{comm.content}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(comm.created_date), "dd MMM yyyy HH:mm", { locale: es })}
                        </span>
                        {comm.status && (
                          <span className="px-2 py-0.5 bg-white/10 rounded text-cyan-400 capitalize">
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
        <DialogContent className="bg-[#0A0A0A] border-white/10">
          <DialogHeader>
            <DialogTitle>Registrar Comunicación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-white/70 text-sm mb-2 block">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="call">Llamada</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="note">Nota</option>
              </select>
            </div>
            <div>
              <label className="text-white/70 text-sm mb-2 block">Asunto *</label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                placeholder="ej: Seguimiento de orden"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-2 block">Detalles</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Notas de la comunicación..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none h-24"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setShowDialog(false)} variant="outline">Cancelar</Button>
              <Button onClick={handleAddCommunication} className="bg-cyan-600/80 hover:bg-cyan-600">
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
