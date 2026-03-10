import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function NotesSection({ orderId, orderNumber, currentUser }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [mentionedUserId, setMentionedUserId] = useState(null);
  const [mentionedUserName, setMentionedUserName] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noteType, setNoteType] = useState("internal");
  const notesEndRef = useRef(null);

  const quickChips = [
    { id: "all", name: "Todos" },
    { id: "aida", name: "Aida" },
    { id: "tiffany", name: "Tiffany" },
    { id: "wanda", name: "Wanda" }
  ];

  useEffect(() => {
    loadEmployees();
    loadNotes();
  }, [orderId]);

  useEffect(() => {
    scrollToBottom();
  }, [notes]);

  const scrollToBottom = () => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadEmployees = async () => {
    try {
      const users = await base44.entities.User.list();
      const activeEmployees = users.filter(u => 
        u.active !== false && ["admin", "manager", "technician", "frontdesk"].includes(u.role)
      );
      setEmployees(activeEmployees);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const loadNotes = async () => {
    try {
      const events = await base44.entities.WorkOrderEvent.filter({ 
        order_id: orderId,
        event_type: "note_added"
      }, "-created_date");
      
      setNotes(events.map(e => ({
        id: e.id,
        note_text: e.description,
        user_id: e.user_id,
        user_name: e.user_name,
        mentioned_user_id: e.metadata?.mentioned_user_id || null,
        mentioned_user_name: e.metadata?.mentioned_user_name || null,
        note_type: e.metadata?.note_type || "internal",
        created_at: e.created_date
      })));
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  const handleSendNote = async () => {
    if (!newNote.trim()) return;

    setLoading(true);
    try {
      const noteData = {
        order_id: orderId,
        order_number: orderNumber,
        event_type: "note_added",
        description: newNote.trim(),
        user_id: currentUser?.id || null,
        user_name: currentUser?.full_name || currentUser?.email || "Usuario",
        user_role: currentUser?.role || "user",
        metadata: {
          mentioned_user_id: mentionedUserId,
          mentioned_user_name: mentionedUserName,
          note_type: noteType
        }
      };

      await base44.entities.WorkOrderEvent.create(noteData);
      
      setNewNote("");
      setMentionedUserId(null);
      setMentionedUserName("");
      await loadNotes();
    } catch (error) {
      console.error("Error sending note:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendNote();
    }
  };

  const handleQuickChip = (chipName) => {
    const employee = employees.find(e => 
      e.full_name?.toLowerCase().includes(chipName.toLowerCase())
    );
    
    if (chipName === "Todos") {
      setMentionedUserId("all");
      setMentionedUserName("Todos");
    } else if (employee) {
      setMentionedUserId(employee.id);
      setMentionedUserName(employee.full_name);
    }
  };

  const getNoteTypeLabel = (type) => {
    const types = {
      internal: "Nota interna",
      customer_call: "Llamada del cliente",
      part_pending: "Pieza pendiente",
      ready_pickup: "Listo para entrega"
    };
    return types[type] || type;
  };

  const getNoteTypeColor = (type) => {
    const colors = {
      internal: "bg-gray-600/20 text-gray-300 border-gray-600/30",
      customer_call: "bg-blue-600/20 text-blue-300 border-blue-600/30",
      part_pending: "bg-orange-600/20 text-orange-300 border-orange-600/30",
      ready_pickup: "bg-green-600/20 text-green-300 border-green-600/30"
    };
    return colors[type] || colors.internal;
  };

  return (
    <Card className="bg-[#1A1A1A] border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-red-600" />
            Notas y Comunicación
          </CardTitle>
          <Select value={noteType} onValueChange={setNoteType}>
            <SelectTrigger className="w-48 bg-black/30 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-white/10">
              <SelectItem value="internal">Nota interna</SelectItem>
              <SelectItem value="customer_call">Llamada del cliente</SelectItem>
              <SelectItem value="part_pending">Pieza pendiente</SelectItem>
              <SelectItem value="ready_pickup">Listo para entrega</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Chips */}
        <div className="flex flex-wrap gap-2">
          {quickChips.map(chip => (
            <button
              key={chip.id}
              onClick={() => handleQuickChip(chip.name)}
              className={`px-3 py-1 rounded-full text-xs transition ${
                mentionedUserName === chip.name
                  ? "bg-red-600 text-white"
                  : "bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              {chip.name}
            </button>
          ))}
        </div>

        {/* Employee Selector */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Dirigir nota a:</label>
          <Select 
            value={mentionedUserId || ""} 
            onValueChange={(value) => {
              setMentionedUserId(value);
              const employee = employees.find(e => e.id === value);
              setMentionedUserName(employee?.full_name || "");
            }}
          >
            <SelectTrigger className="bg-black/30 border-white/10 text-white">
              <SelectValue placeholder="Seleccionar empleado..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-white/10 max-h-64">
              <SelectItem value="all">Todos</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {emp.full_name || emp.email}
                    <Badge className="text-xs ml-2">{emp.role}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes History */}
        <div className="bg-black/30 rounded-lg border border-white/10 p-4 max-h-96 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay notas aún. ¡Sé el primero en escribir!</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-bold text-white">{note.user_name}</span>
                        {note.mentioned_user_name && (
                          <>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="font-semibold text-red-400">{note.mentioned_user_name}</span>
                          </>
                        )}
                        <span className="text-gray-400">:</span>
                        <span className="text-gray-200 ml-2">"{note.note_text}"</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                        </span>
                        <Badge className={`text-xs ${getNoteTypeColor(note.note_type)}`}>
                          {getNoteTypeLabel(note.note_type)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={notesEndRef} />
            </div>
          )}
        </div>

        {/* New Note Input */}
        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe una nota... (Enter para enviar, Shift+Enter para nueva línea)"
            className="bg-black/30 border-white/10 text-white placeholder:text-gray-500 min-h-[80px]"
            disabled={loading}
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {mentionedUserName ? `Nota dirigida a: ${mentionedUserName}` : "Selecciona un destinatario"}
            </p>
            <Button
              onClick={handleSendNote}
              disabled={loading || !newNote.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
