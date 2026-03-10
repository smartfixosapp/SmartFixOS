import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StickyNote, Plus, CheckCircle2, Trash2, Calendar as CalendarIcon, User, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function PersonalNotesWidget() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [user, setUser] = useState(null);
  
  // Form States
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [reminderDate, setReminderDate] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) loadNotes();
  }, [user]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadNotes = async () => {
    setLoading(true);
    try {
      const allNotes = await base44.entities.PersonalNote.filter({
        created_by: user.email
      }, "-created_date");
      setNotes(allNotes || []);
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!noteTitle.trim()) {
      toast.error("Escribe un título para la nota");
      return;
    }

    try {
      await base44.entities.PersonalNote.create({
        title: noteTitle,
        description: noteDescription,
        type: reminderDate ? "reminder" : "note",
        client_name: clientName,
        ticket_number: ticketNumber,
        reminder_date: reminderDate ? new Date(reminderDate).toISOString() : null,
        assigned_to: user.id,
        assigned_to_name: user.full_name || user.email,
        status: "pending"
      });
      
      toast.success("✅ Nota creada");
      resetForm();
      loadNotes();
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Error al crear nota");
    }
  };

  const resetForm = () => {
    setNoteTitle("");
    setNoteDescription("");
    setClientName("");
    setTicketNumber("");
    setReminderDate("");
    setShowCreateDialog(false);
  };

  const handleCompleteNote = async (noteId) => {
    try {
      await base44.entities.PersonalNote.delete(noteId);
      toast.success("✅ Nota completada");
      loadNotes();
    } catch (error) {
      console.error("Error completing note:", error);
      toast.error("Error al completar");
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await base44.entities.PersonalNote.delete(noteId);
      toast.success("Nota eliminada");
      loadNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      <Card className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl w-full h-full relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        <CardHeader className="pb-3 px-6 pt-6 relative z-10 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-xl font-bold flex items-center gap-2 tracking-tight">
              <StickyNote className="w-6 h-6 text-yellow-400" />
              Notas
            </CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowCreateDialog(true)}
              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded-full"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar relative z-10">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-4">Cargando...</p>
          ) : notes.length === 0 ? (
            <div className="text-center py-10 h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <StickyNote className="w-8 h-8 text-gray-600 opacity-50" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No tienes notas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group bg-[#1c1c1e] hover:bg-[#2c2c2e] active:scale-[0.98] transition-all duration-200 rounded-2xl p-4 border border-white/5 shadow-sm relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-semibold text-base truncate">
                          {note.title}
                        </h4>
                        {note.type === 'reminder' && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">
                            Recordatorio
                          </span>
                        )}
                      </div>

                      {(note.client_name || note.ticket_number || note.reminder_date) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 mb-2 text-xs text-gray-400 font-medium">
                          {note.client_name && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-blue-400" />
                              <span className="truncate max-w-[100px]">{note.client_name}</span>
                            </div>
                          )}
                          {note.ticket_number && (
                            <div className="flex items-center gap-1">
                              <Ticket className="w-3 h-3 text-green-400" />
                              <span>{note.ticket_number}</span>
                            </div>
                          )}
                          {note.reminder_date && (
                            <div className="flex items-center gap-1 text-red-400">
                              <CalendarIcon className="w-3 h-3" />
                              <span>
                                {format(new Date(note.reminder_date), "d MMM", { locale: es })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {note.description && (
                        <p className="text-gray-400 text-xs leading-relaxed line-clamp-3 font-medium">
                          {note.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCompleteNote(note.id)}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-green-500/20 text-gray-400 hover:text-green-400 flex items-center justify-center transition-colors"
                        title="Completar"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-[#1c1c1e] border border-white/10 max-w-sm w-full rounded-[32px] p-0 overflow-hidden shadow-2xl">
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white text-xl font-bold">
                Nueva Nota
              </DialogTitle>
              <button 
                onClick={() => setShowCreateDialog(false)} 
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-gray-400 text-xs font-semibold ml-3 uppercase tracking-wide">Título</Label>
                <Input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Ej: Llamar a cliente..."
                  className="bg-[#2c2c2e] border-transparent text-white focus:border-yellow-500/50 h-12 rounded-xl text-lg font-medium placeholder:text-gray-600"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-400 text-xs font-semibold ml-3 uppercase tracking-wide">Detalles</Label>
                <Textarea
                  value={noteDescription}
                  onChange={(e) => setNoteDescription(e.target.value)}
                  placeholder="Escribe los detalles aquí..."
                  className="bg-[#2c2c2e] border-transparent text-white min-h-[120px] resize-none rounded-xl text-base placeholder:text-gray-600"
                />
              </div>

              <div className="bg-[#2c2c2e] rounded-xl p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-gray-500 text-[10px] font-bold uppercase tracking-wider ml-1">Cliente</Label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Opcional"
                      className="bg-black/20 border-transparent text-white h-9 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-500 text-[10px] font-bold uppercase tracking-wider ml-1">Ticket #</Label>
                    <Input
                      value={ticketNumber}
                      onChange={(e) => setTicketNumber(e.target.value)}
                      placeholder="Opcional"
                      className="bg-black/20 border-transparent text-white h-9 rounded-lg text-sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-1 pt-1 border-t border-white/5">
                  <Label className="text-gray-500 text-[10px] font-bold uppercase tracking-wider ml-1">Recordatorio</Label>
                  <Input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="bg-black/20 border-transparent text-white h-9 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleCreateNote}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-12 rounded-xl shadow-lg shadow-yellow-900/20 text-base"
              >
                Guardar Nota
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
