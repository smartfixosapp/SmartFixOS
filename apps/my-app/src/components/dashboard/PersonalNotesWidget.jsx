import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StickyNote, Plus, CheckCircle2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export default function PersonalNotesWidget() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [user, setUser] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");

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
        type: "note",
        assigned_to: user.id,
        assigned_to_name: user.full_name || user.email
      });
      
      toast.success("✅ Nota creada");
      setNoteTitle("");
      setNoteDescription("");
      setShowCreateDialog(false);
      loadNotes();
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Error al crear nota");
    }
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
      <Card className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 backdrop-blur-xl border border-purple-500/20 theme-light:bg-white theme-light:border-gray-200 w-full">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm sm:text-base font-bold flex items-center gap-2 theme-light:text-gray-900">
              <StickyNote className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              📝 Mis Notas
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-7 sm:h-8 px-2 sm:px-3"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-4">Cargando...</p>
          ) : notes.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <StickyNote className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2 opacity-30" />
              <p className="text-gray-500 text-xs sm:text-sm">No hay notas</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="bg-black/20 border border-purple-500/20 rounded-lg p-2 sm:p-3 hover:border-purple-500/40 transition-all theme-light:bg-purple-50"
              >
                <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
                  <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                    <StickyNote className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                    <p className="text-white font-semibold text-xs sm:text-sm theme-light:text-gray-900 truncate">
                      {note.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCompleteNote(note.id)}
                      className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400 hover:bg-emerald-600/20"
                      title="Marcar como completada"
                    >
                      <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteNote(note.id)}
                      className="h-6 w-6 sm:h-7 sm:w-7 text-red-400 hover:bg-red-600/20"
                    >
                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                  </div>
                </div>

                {note.description && (
                  <p className="text-gray-400 text-[10px] sm:text-xs line-clamp-2 theme-light:text-gray-600 pl-4 sm:pl-6">
                    {note.description}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gradient-to-br from-[#2B2B2B] to-black border-purple-500/30 max-w-md theme-light:bg-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <StickyNote className="w-6 h-6 text-purple-400" />
              Nueva Nota
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">Título *</Label>
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="¿Qué necesitas recordar?"
                className="bg-black/40 border-purple-500/20 text-white theme-light:bg-white theme-light:text-gray-900"
              />
            </div>

            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">Descripción (opcional)</Label>
              <Textarea
                value={noteDescription}
                onChange={(e) => setNoteDescription(e.target.value)}
                placeholder="Detalles adicionales..."
                className="bg-black/40 border-purple-500/20 text-white min-h-[100px] theme-light:bg-white theme-light:text-gray-900"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNoteTitle("");
                  setNoteDescription("");
                }}
                className="flex-1 border-white/15"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateNote}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
