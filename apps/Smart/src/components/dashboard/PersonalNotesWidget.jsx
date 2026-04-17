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
      <Card className="apple-type apple-card rounded-apple-lg shadow-apple-xl border-0 w-full h-full relative overflow-hidden flex flex-col group">
        <CardHeader className="pb-3 px-6 pt-6 relative z-10 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="apple-text-title3 apple-label-primary flex items-center gap-3">
              <div className="w-10 h-10 rounded-apple-sm bg-apple-yellow/15 flex items-center justify-center">
                <StickyNote className="w-5 h-5 text-apple-yellow" />
              </div>
              Notas
            </CardTitle>
            <Button
              size="icon"
              onClick={() => setShowCreateDialog(true)}
              aria-label="Crear nueva nota"
              className="apple-press w-10 h-10 rounded-apple-sm bg-apple-yellow/15 text-apple-yellow transition-all"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar relative z-10">
          {loading ? (
            <p className="apple-label-secondary apple-text-subheadline text-center py-4">Cargando...</p>
          ) : notes.length === 0 ? (
            <div className="text-center py-10 h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center mx-auto mb-3">
                <StickyNote className="w-8 h-8 apple-label-tertiary opacity-50" />
              </div>
              <p className="apple-label-tertiary apple-text-subheadline font-medium">No tienes notas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="apple-press group apple-surface transition-all duration-300 rounded-apple-md p-5 relative overflow-hidden"
                >
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="apple-label-primary font-semibold apple-text-headline truncate">
                          {note.title}
                        </h4>
                        {note.type === 'reminder' && (
                          <span className="apple-text-caption2 bg-apple-red/15 text-apple-red px-2 py-0.5 rounded-full font-semibold">
                            Recordatorio
                          </span>
                        )}
                      </div>

                      {(note.client_name || note.ticket_number || note.reminder_date) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 mb-3 apple-text-caption2 apple-label-tertiary font-semibold">
                          {note.client_name && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-apple-blue" />
                              <span className="truncate max-w-[120px]">{note.client_name}</span>
                            </div>
                          )}
                          {note.ticket_number && (
                            <div className="flex items-center gap-1.5">
                              <Ticket className="w-3.5 h-3.5 text-apple-green" />
                              <span className="tabular-nums">{note.ticket_number}</span>
                            </div>
                          )}
                          {note.reminder_date && (
                            <div className="flex items-center gap-1.5 text-apple-red">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span className="tabular-nums">
                                {format(new Date(note.reminder_date), "d MMM", { locale: es })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {note.description && (
                        <p className="apple-label-secondary apple-text-subheadline leading-relaxed line-clamp-3 font-medium">
                          {note.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCompleteNote(note.id)}
                        className="apple-press w-10 h-10 rounded-apple-sm bg-apple-green/15 text-apple-green flex items-center justify-center transition-all"
                        title="Completar"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="apple-press w-10 h-10 rounded-apple-sm bg-apple-red/15 text-apple-red flex items-center justify-center transition-all"
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
        <DialogContent className="apple-type max-w-md apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-apple-sm bg-apple-yellow/15 flex items-center justify-center">
                  <StickyNote className="w-6 h-6 text-apple-yellow" />
                </div>
                <DialogTitle className="apple-text-title2 apple-label-primary text-left">
                  Nueva Nota
                </DialogTitle>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="apple-text-caption1 font-semibold apple-label-tertiary ml-1">Título</Label>
                <Input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Ej: Llamar a cliente..."
                  className="apple-input h-12 text-lg font-semibold px-5"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="apple-text-caption1 font-semibold apple-label-tertiary ml-1">Detalles</Label>
                <Textarea
                  value={noteDescription}
                  onChange={(e) => setNoteDescription(e.target.value)}
                  placeholder="Escribe los detalles aquí..."
                  className="apple-input min-h-[120px] resize-none text-base p-5 font-medium"
                />
              </div>

              <div className="apple-surface rounded-apple-md p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="apple-text-caption1 font-semibold apple-label-tertiary ml-1">Cliente</Label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Opcional"
                      className="apple-input h-11 px-4 font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="apple-text-caption1 font-semibold apple-label-tertiary ml-1">Ticket #</Label>
                    <Input
                      value={ticketNumber}
                      onChange={(e) => setTicketNumber(e.target.value)}
                      placeholder="Opcional"
                      className="apple-input h-11 px-4 font-semibold tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                  <Label className="apple-text-caption1 font-semibold apple-label-tertiary ml-1">Recordatorio</Label>
                  <Input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="apple-input h-11 px-4 font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreateDialog(false)}
                className="apple-btn apple-btn-secondary flex-1 h-14"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateNote}
                className="apple-btn apple-btn-primary flex-1 h-14"
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
