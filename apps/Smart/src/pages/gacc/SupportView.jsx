/**
 * GACC — Support Center
 * Internal notes per store, email sending, communication history
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeadphonesIcon, StickyNote, Mail, Send, Search, Plus, X,
  Building2, Clock, Tag, CheckCircle, AlertCircle, RefreshCw,
  ChevronRight, Filter, MessageSquare, Pencil, Trash2, Save,
  Eye
} from "lucide-react";
import { useGACC, timeAgo } from "./gaccContext";
import { toast } from "sonner";

// ── Notes Manager ────────────────────────────────────────────────────────────
function NotesManager({ tenants }) {
  const { adminSupabase } = useGACC();
  const [notes, setNotes] = useState({}); // { [tenantId]: { text, tags, updated } }
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editTags, setEditTags] = useState([]);
  const [saving, setSaving] = useState(false);

  const TAGS = ["general", "billing", "bug", "feature-request", "onboarding", "urgent"];

  // Load notes from tenant metadata
  useEffect(() => {
    const loaded = {};
    tenants.forEach(t => {
      if (t.metadata?.admin_notes || t.metadata?.support_tags) {
        loaded[t.id] = {
          text: t.metadata.admin_notes || "",
          tags: t.metadata.support_tags || [],
          updated: t.metadata.notes_updated || null,
        };
      }
    });
    setNotes(loaded);
  }, [tenants]);

  const tenantsWithNotes = useMemo(() => {
    return tenants
      .filter(t => {
        const note = notes[t.id];
        if (!note?.text && tagFilter === "all" && !search) return true; // show all if no filters
        if (search) {
          const q = search.toLowerCase();
          if (!(t.name || "").toLowerCase().includes(q) && !(t.email || "").toLowerCase().includes(q) && !(note?.text || "").toLowerCase().includes(q)) return false;
        }
        if (tagFilter !== "all") {
          if (!note?.tags?.includes(tagFilter)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aNotes = notes[a.id]?.text ? 1 : 0;
        const bNotes = notes[b.id]?.text ? 1 : 0;
        return bNotes - aNotes; // stores with notes first
      });
  }, [tenants, notes, search, tagFilter]);

  const saveNote = async (tenantId) => {
    setSaving(true);
    try {
      const tenant = tenants.find(t => t.id === tenantId);
      const metadata = {
        ...(tenant?.metadata || {}),
        admin_notes: editText.trim(),
        support_tags: editTags,
        notes_updated: new Date().toISOString(),
      };
      const { error } = await adminSupabase.from("tenant").update({ metadata }).eq("id", tenantId);
      if (error) throw error;
      setNotes(prev => ({ ...prev, [tenantId]: { text: editText.trim(), tags: editTags, updated: metadata.notes_updated } }));
      setEditingId(null);
      toast.success("Nota guardada");
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tenantId) => {
    const note = notes[tenantId];
    setEditingId(tenantId);
    setEditText(note?.text || "");
    setEditTags(note?.tags || []);
  };

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tienda o contenido de nota..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40 transition-all"
          />
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.05]">
          <button
            onClick={() => setTagFilter("all")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${tagFilter === "all" ? "bg-white/[0.08] text-white" : "text-gray-600"}`}
          >
            Todas
          </button>
          {TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag === tagFilter ? "all" : tag)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${tagFilter === tag ? "bg-white/[0.08] text-white" : "text-gray-600"}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Notes list */}
      <div className="space-y-2">
        {tenantsWithNotes.slice(0, 30).map(tenant => {
          const note = notes[tenant.id];
          const isEditing = editingId === tenant.id;

          return (
            <div key={tenant.id} className={`rounded-xl border bg-white/[0.02] overflow-hidden transition-all ${
              isEditing ? "border-purple-500/30" : note?.text ? "border-white/[0.08]" : "border-white/[0.04]"
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] text-white font-semibold truncate">{tenant.name}</p>
                    <p className="text-[10px] text-gray-600">{tenant.email}</p>
                  </div>
                  {note?.tags?.map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/20 font-semibold">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {note?.updated && <span className="text-[10px] text-gray-700">{timeAgo(note.updated)}</span>}
                  <button
                    onClick={() => isEditing ? setEditingId(null) : startEdit(tenant.id)}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.05] transition-all"
                  >
                    {isEditing ? <X className="w-3.5 h-3.5" /> : note?.text ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Note content */}
              {note?.text && !isEditing && (
                <div className="px-4 pb-3">
                  <p className="text-[12px] text-gray-400 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                </div>
              )}

              {/* Edit mode */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/[0.05] px-4 py-3 space-y-3"
                  >
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      placeholder="Escribe una nota interna sobre esta tienda..."
                      rows={4}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40 resize-none"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-gray-600">Tags:</span>
                      {TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                          className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold transition-all ${
                            editTags.includes(tag)
                              ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                              : "bg-white/[0.03] text-gray-600 border-white/[0.07] hover:text-gray-400"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-white transition-all">
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveNote(tenant.id)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50"
                      >
                        {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Guardar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Email Composer ────────────────────────────────────────────────────────────
function EmailComposer({ tenants }) {
  const { appClient } = useGACC();
  const [mode, setMode] = useState("individual"); // individual | bulk
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const TEMPLATES = [
    { label: "Bienvenida", subject: "Bienvenido a SmartFixOS", body: "Hola {{name}},\n\nGracias por registrarte en SmartFixOS. Estamos aqui para ayudarte a configurar tu taller.\n\nSi necesitas ayuda, no dudes en contactarnos.\n\n- Equipo SmartFixOS" },
    { label: "Trial expirando", subject: "Tu trial de SmartFixOS vence pronto", body: "Hola {{name}},\n\nTu periodo de prueba de SmartFixOS vence en pocos dias. Para continuar usando el sistema, activa tu suscripcion.\n\nSi tienes preguntas sobre los planes, respondenos a este email.\n\n- Equipo SmartFixOS" },
    { label: "Pago fallido", subject: "Problema con tu pago - SmartFixOS", body: "Hola {{name}},\n\nNo pudimos procesar tu ultimo pago. Por favor verifica tu metodo de pago para evitar interrupciones en el servicio.\n\nSi necesitas ayuda, estamos aqui.\n\n- Equipo SmartFixOS" },
    { label: "Nueva feature", subject: "Nueva funcionalidad en SmartFixOS", body: "Hola {{name}},\n\nHemos lanzado una nueva funcionalidad que creemos te sera muy util.\n\n[Describe la feature aqui]\n\n- Equipo SmartFixOS" },
  ];

  const filteredTenants = useMemo(() => {
    if (!search) return tenants;
    const q = search.toLowerCase();
    return tenants.filter(t => (t.name || "").toLowerCase().includes(q) || (t.email || "").toLowerCase().includes(q));
  }, [tenants, search]);

  const applyTemplate = (tpl) => {
    let s = tpl.subject;
    let b = tpl.body;
    if (selectedTenant) {
      b = b.replace(/\{\{name\}\}/g, selectedTenant.admin_name || selectedTenant.name || "");
    }
    setSubject(s);
    setBody(b);
  };

  const sendEmail = async () => {
    if (!subject.trim() || !body.trim()) { toast.error("Subject y body requeridos"); return; }

    setSending(true);
    try {
      if (mode === "individual") {
        if (!selectedTenant) { toast.error("Selecciona una tienda"); setSending(false); return; }
        await appClient.functions.sendEmail({
          to: selectedTenant.email,
          subject: subject.trim(),
          html: body.trim().replace(/\n/g, "<br>"),
        });
        toast.success(`Email enviado a ${selectedTenant.name}`);
      } else {
        const targets = tenants.filter(t => t.status === "active" && t.email);
        for (const t of targets) {
          const personalBody = body.replace(/\{\{name\}\}/g, t.admin_name || t.name || "");
          await appClient.functions.sendEmail({
            to: t.email,
            subject: subject.trim(),
            html: personalBody.replace(/\n/g, "<br>"),
          });
        }
        toast.success(`Email enviado a ${targets.length} tiendas`);
      }
      setSubject("");
      setBody("");
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" />
          <p className="text-[13px] font-bold text-white">Email Center</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
          <button onClick={() => setMode("individual")} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${mode === "individual" ? "bg-white/[0.08] text-white" : "text-gray-600"}`}>
            Individual
          </button>
          <button onClick={() => setMode("bulk")} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${mode === "bulk" ? "bg-white/[0.08] text-white" : "text-gray-600"}`}>
            Masivo
          </button>
        </div>
      </div>

      {/* Recipient */}
      {mode === "individual" && (
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-1.5">Destinatario</p>
          {selectedTenant ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div>
                <p className="text-[12px] text-white font-semibold">{selectedTenant.name}</p>
                <p className="text-[10px] text-gray-600">{selectedTenant.email}</p>
              </div>
              <button onClick={() => setSelectedTenant(null)} className="text-gray-600 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="space-y-1">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tienda..."
                className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[12px] text-white placeholder:text-gray-700 focus:outline-none"
              />
              {search && (
                <div className="max-h-32 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#141416]">
                  {filteredTenants.slice(0, 6).map(t => (
                    <button key={t.id} onClick={() => { setSelectedTenant(t); setSearch(""); }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all">
                      <Building2 className="w-3 h-3" /> {t.name} <span className="text-gray-700">{t.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "bulk" && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-[11px] text-amber-400 font-semibold">Envio masivo a {tenants.filter(t => t.status === "active").length} tiendas activas</p>
          <p className="text-[10px] text-gray-600">Usa {"{{name}}"} para personalizar</p>
        </div>
      )}

      {/* Templates */}
      <div>
        <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-1.5">Templates</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.label}
              onClick={() => applyTemplate(tpl)}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.07] text-gray-500 hover:text-white hover:border-white/[0.15] transition-all font-semibold"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject + Body */}
      <input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="Asunto del email..."
        className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Contenido del email..."
        rows={6}
        className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[12px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40 resize-none"
      />

      <div className="flex justify-end">
        <button
          onClick={sendEmail}
          disabled={sending || !subject.trim() || !body.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-50"
        >
          {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {mode === "bulk" ? "Enviar a todas" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

// ── Main Support View ────────────────────────────────────────────────────────
export default function SupportView() {
  const { tenants, loading, refresh } = useGACC();
  const [tab, setTab] = useState("notes"); // notes | email

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Support</h2>
          <p className="text-[11px] text-gray-600">Notas internas, comunicaciones y soporte</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.05]">
            <button onClick={() => setTab("notes")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${tab === "notes" ? "bg-white/[0.08] text-white" : "text-gray-600"}`}>
              <StickyNote className="w-3.5 h-3.5" /> Notas
            </button>
            <button onClick={() => setTab("email")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${tab === "email" ? "bg-white/[0.08] text-white" : "text-gray-600"}`}>
              <Mail className="w-3.5 h-3.5" /> Email
            </button>
          </div>
        </div>
      </div>

      {tab === "notes" && <NotesManager tenants={tenants} />}
      {tab === "email" && <EmailComposer tenants={tenants} />}
    </div>
  );
}
