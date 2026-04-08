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
      <Card className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl w-full h-full relative overflow-hidden flex flex-col group">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-yellow-500/10 rounded-full blur-[60px] group-hover:bg-yellow-500/20 transition-all duration-700" />
        
        <CardHeader className="pb-3 px-6 pt-6 relative z-10 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-xl font-black flex items-center gap-3 tracking-tight">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <StickyNote className="w-5 h-5 text-white" />
              </div>
              Notas
            </CardTitle>
            <Button
              size="icon"
              onClick={() => setShowCreateDialog(true)}
              aria-label="Crear nueva nota"
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-yellow-500/20 border border-white/5 hover:border-yellow-500/30 text-white/50 hover:text-yellow-400 transition-all"
            >
              <Plus className="w-5 h-5" />
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
                  className="group bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all duration-300 rounded-[24px] p-5 border border-white/5 hover:border-white/10 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white font-bold text-lg truncate tracking-tight">
                          {note.title}
                        </h4>
                        {note.type === 'reminder' && (
                          <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                            Recordatorio
                          </span>
                        )}
                      </div>

                      {(note.client_name || note.ticket_number || note.reminder_date) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 mb-3 text-[10px] text-white/50 font-bold uppercase tracking-widest">
                          {note.client_name && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-blue-400" />
                              <span className="truncate max-w-[120px]">{note.client_name}</span>
                            </div>
                          )}
                          {note.ticket_number && (
                            <div className="flex items-center gap-1.5">
                              <Ticket className="w-3.5 h-3.5 text-green-400" />
                              <span>{note.ticket_number}</span>
                            </div>
                          )}
                          {note.reminder_date && (
                            <div className="flex items-center gap-1.5 text-red-400">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span>
                                {format(new Date(note.reminder_date), "d MMM", { locale: es })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {note.description && (
                        <p className="text-white/60 text-sm leading-relaxed line-clamp-3 font-medium">
                          {note.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCompleteNote(note.id)}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-white/40 hover:text-emerald-400 flex items-center justify-center transition-all border border-transparent hover:border-emerald-500/30"
                        title="Completar"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 flex items-center justify-center transition-all border border-transparent hover:border-red-500/30"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
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
        <DialogContent className="max-w-md bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-0 overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-amber-600" />
          
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                  <StickyNote className="w-6 h-6 text-yellow-500" />
                </div>
                <DialogTitle className="text-2xl font-black text-white tracking-tight text-left">
                  Nueva Nota
                </DialogTitle>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Título</Label>
                <Input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Ej: Llamar a cliente..."
                  className="bg-white/5 border-white/10 text-white focus:border-yellow-500/50 h-12 rounded-2xl text-lg font-bold px-5"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Detalles</Label>
                <Textarea
                  value={noteDescription}
                  onChange={(e) => setNoteDescription(e.target.value)}
                  placeholder="Escribe los detalles aquí..."
                  className="bg-white/5 border-white/10 text-white min-h-[120px] resize-none rounded-2xl text-base p-5 focus:border-yellow-500/50 font-medium"
                />
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Cliente</Label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Opcional"
                      className="bg-black/40 border-white/10 text-white h-11 rounded-xl px-4 focus:border-yellow-500/50 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Ticket #</Label>
                    <Input
                      value={ticketNumber}
                      onChange={(e) => setTicketNumber(e.target.value)}
                      placeholder="Opcional"
                      className="bg-black/40 border-white/10 text-white h-11 rounded-xl px-4 focus:border-yellow-500/50 font-bold"
                    />
                  </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Recordatorio</Label>
                  <Input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="bg-black/40 border-white/10 text-white h-11 rounded-xl px-4 focus:border-yellow-500/50 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 h-14 rounded-2xl font-black uppercase tracking-widest transition-all"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateNote}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white font-black uppercase tracking-widest h-14 rounded-2xl shadow-xl shadow-yellow-900/20 active:scale-95 transition-all"
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
