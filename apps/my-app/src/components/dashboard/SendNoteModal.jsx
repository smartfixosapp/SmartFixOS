
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Search, Send, StickyNote, Loader2 } from "lucide-react"; // Added Loader2
import { toast } from "sonner";

export default function SendNoteModal({ open, onClose, initialText = "" }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState("note");
  const [sendToAll, setSendToAll] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [loading, setLoading] = useState(false); // Renamed sending to loading for consistency
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setText(initialText);
      setType("note");
      setSendToAll(false);
      setSelectedUsers([]);
      setUserSearch("");
      setUserResults([]);
      setExpiresAt("");
    }
  }, [open, initialText]);

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setUserResults([]);
      return;
    }
    try {
      const users = await base44.entities.User.filter({ active: true });
      const filtered = users.filter(u =>
        (u.full_name || "").toLowerCase().includes(query.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(query.toLowerCase())
      );
      setUserResults(filtered.slice(0, 20));
    } catch {
      setUserResults([]);
    }
  };

  const toggleUser = (user) => {
    const exists = selectedUsers.find(u => u.id === user.id);
    if (exists) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
    setUserResults([]);
    setUserSearch("");
  };

  const removeUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleSend = async () => {
    if (!text.trim()) {
      toast.error("El mensaje no puede estar vacío");
      return;
    }

    if (!sendToAll && selectedUsers.length === 0) {
      toast.error("Selecciona al menos un destinatario");
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading("Enviando anuncio...");
    
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      
      let recipients = [];
      if (sendToAll) {
        const allUsers = await base44.entities.User.filter({ active: true });
        recipients = allUsers;
      } else {
        recipients = selectedUsers;
      }

      const announcement = await base44.entities.Announcement.create({
        title: title || "Nota del administrador",
        message: text,
        sent_to: sendToAll ? "all" : "specific",
        recipients: recipients.map(r => ({
          user_id: r.id,
          user_name: r.full_name || r.email,
          read: false,
          read_at: null
        })),
        sent_by: me?.id || null,
        sent_by_name: me?.full_name || me?.email || "Sistema",
        sent_at: new Date().toISOString(),
        type: type,
        expires_at: expiresAt || null,
        active: true
      });

      for (const recipient of recipients) {
        await base44.entities.CommunicationQueue.create({
          type: "in_app",
          user_id: recipient.id,
          subject: title || "📢 Nota del administrador",
          body_html: text,
          status: "pending",
          meta: {
            source: "announcement",
            announcement_id: announcement.id,
            type: type,
            sent_by: me?.full_name || me?.email || "Sistema"
          }
        });
      }

      toast.success(`✅ Anuncio enviado a ${recipients.length} usuario(s)`, { id: loadingToast });
      
      // ✅ Limpiar TODOS los campos
      setTitle("");
      setText("");
      setType("note");
      setSendToAll(false);
      setSelectedUsers([]);
      setExpiresAt("");
      setUserSearch("");
      setUserResults([]);
      
      // ✅ Cerrar modal con resultado exitoso
      if (onClose) {
        onClose({ success: true, count: recipients.length });
      }
      
    } catch (e) {
      console.error("Error sending announcement:", e);
      toast.error("Error al enviar", { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose({ success: false })}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto bg-black/90 backdrop-blur-xl border-cyan-500/20 shadow-[0_24px_80px_rgba(0,168,232,0.7)] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3 text-2xl theme-light:text-gray-900">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-cyan-600/30">
              <StickyNote className="w-7 h-7 text-white" />
            </div>
            Enviar Anuncio al Equipo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo con colores del logo */}
          <div className="space-y-2">
            <Label className="text-gray-300 theme-light:text-gray-700">Tipo de anuncio</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setType("note")}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  type === "note"
                    ? "bg-gradient-to-r from-cyan-600/20 to-cyan-800/20 border-cyan-500/50 text-cyan-300 theme-light:from-cyan-100 theme-light:to-cyan-200 theme-light:border-cyan-400 theme-light:text-cyan-700"
                    : "bg-black/30 border-white/10 text-gray-300 hover:bg-white/5 theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:text-gray-700"
                }`}
              >
                📝 Nota
              </button>
              <button
                onClick={() => setType("offer")}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  type === "offer"
                    ? "bg-gradient-to-r from-emerald-600/20 to-emerald-800/20 border-emerald-500/50 text-emerald-300 theme-light:from-emerald-100 theme-light:to-emerald-200 theme-light:border-emerald-400 theme-light:text-emerald-700"
                    : "bg-black/30 border-white/10 text-gray-300 hover:bg-white/5 theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:text-gray-700"
                }`}
              >
                🎁 Oferta
              </button>
              <button
                onClick={() => setType("alert")}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  type === "alert"
                    ? "bg-gradient-to-r from-lime-600/20 to-lime-800/20 border-lime-500/50 text-lime-300 theme-light:from-lime-100 theme-light:to-lime-200 theme-light:border-lime-400 theme-light:text-lime-700"
                    : "bg-black/30 border-white/10 text-gray-300 hover:bg-white/5 theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:text-gray-700"
                }`}
              >
                ⚠️ Alerta
              </button>
            </div>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label className="text-gray-300 theme-light:text-gray-700">Título (opcional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-black/40 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              placeholder="Ej. Oferta de la semana"
            />
          </div>

          {/* Mensaje */}
          <div className="space-y-2">
            <Label className="text-gray-300 theme-light:text-gray-700">Mensaje</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="bg-black/40 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              placeholder="Escribe el mensaje que quieres enviar al equipo..."
            />
          </div>

          {/* Expiración (para ofertas) */}
          {type === "offer" && (
            <div className="space-y-2">
              <Label className="text-gray-300 theme-light:text-gray-700">Fecha de expiración (opcional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="bg-black/40 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            </div>
          )}

          {/* Enviar a todos con gradiente del logo */}
          <div className="flex items-center space-x-2 p-4 bg-gradient-to-r from-cyan-600/10 to-emerald-600/10 border border-cyan-500/30 rounded-xl theme-light:from-cyan-50 theme-light:to-emerald-50 theme-light:border-cyan-300">
            <Checkbox
              id="sendToAll"
              checked={sendToAll}
              onCheckedChange={setSendToAll}
            />
            <label
              htmlFor="sendToAll"
              className="text-sm text-white font-medium leading-none cursor-pointer theme-light:text-gray-900"
            >
              📢 Enviar a todos los usuarios activos
            </label>
          </div>

          {/* Destinatarios específicos */}
          {!sendToAll && (
            <div className="space-y-2">
              <Label className="text-gray-300 theme-light:text-gray-700">Destinatarios específicos</Label>
              
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-3 bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl theme-light:bg-gray-50 theme-light:border-gray-200">
                  {selectedUsers.map(u => (
                    <div
                      key={u.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-600/20 to-emerald-600/20 border border-cyan-600/30 text-cyan-300 text-sm theme-light:from-cyan-100 theme-light:to-emerald-100 theme-light:border-cyan-300 theme-light:text-cyan-700"
                    >
                      <span>{u.full_name || u.email}</span>
                      <button
                        onClick={() => removeUser(u.id)}
                        className="hover:bg-cyan-600/40 rounded-full p-0.5 theme-light:hover:bg-cyan-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Buscar usuario por nombre o email..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="bg-black/40 border-cyan-500/20 text-white pl-10 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                />
              </div>

              {userResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto bg-black/60 border border-cyan-500/20 rounded-xl theme-light:bg-white theme-light:border-gray-200">
                  {userResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u)}
                      disabled={selectedUsers.find(su => su.id === u.id)}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-cyan-600/10 text-white border-b border-white/5 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors theme-light:text-gray-900 theme-light:hover:bg-cyan-50 theme-light:border-gray-100"
                    >
                      <div className="font-medium">{u.full_name || u.email}</div>
                      {u.email && u.full_name && (
                        <div className="text-xs text-gray-400 theme-light:text-gray-600">{u.email}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-cyan-500/10 theme-light:border-gray-200">
          <Button
            variant="outline"
            onClick={() => onClose({ success: false })}
            disabled={loading}
            className="border-white/15 text-white hover:bg-white/10 px-6 theme-light:border-gray-300 theme-light:text-gray-700 theme-light:hover:bg-gray-100"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || !text.trim()}
            className="bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 shadow-[0_8px_32px_rgba(0,168,232,0.5)] px-6"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Anuncio
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
