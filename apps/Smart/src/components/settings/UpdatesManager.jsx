import React, { useEffect, useState, useCallback } from "react";
import {
  Sparkles, Plus, Pencil, Trash2, Eye, EyeOff,
  CheckCircle2, X, Calendar, Tag, Layers
} from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";

// ── Configuración visual por tipo ─────────────────────────────────────────
const TYPE_CONFIG = {
  feature:     { label: "Función nueva",  bg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",    dot: "bg-cyan-400" },
  improvement: { label: "Mejora",         bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  fix:         { label: "Corrección",     bg: "bg-amber-500/20 text-amber-300 border-amber-500/30",  dot: "bg-amber-400" },
  breaking:    { label: "Cambio mayor",   bg: "bg-red-500/20 text-red-300 border-red-500/30",        dot: "bg-red-400" },
};

const EMPTY_FORM = {
  title: "", description: "", type: "feature",
  version: "", order: 0, published: false,
  published_at: new Date().toISOString().split("T")[0],
};

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.feature;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function UpdatesManager() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null = nuevo
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const list = await dataClient.entities.AppUpdate.list("-created_at");
      setUpdates(list || []);
    } catch {
      toast.error("Error cargando novedades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUpdates(); }, [loadUpdates]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, order: updates.length });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      description: item.description || "",
      type: item.type || "feature",
      version: item.version || "",
      order: item.order ?? updates.length,
      published: item.published ?? false,
      published_at: item.published_at || new Date().toISOString().split("T")[0],
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.warning("El título es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        version: form.version.trim() || null,
        order: Number(form.order) || 0,
        published: form.published,
        published_at: form.published ? form.published_at : null,
      };
      if (editingId) {
        await dataClient.entities.AppUpdate.update(editingId, payload);
        toast.success("Novedad actualizada");
      } else {
        await dataClient.entities.AppUpdate.create(payload);
        toast.success("Novedad creada");
      }
      setShowForm(false);
      loadUpdates();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (item) => {
    try {
      const nowPublished = !item.published;
      await dataClient.entities.AppUpdate.update(item.id, {
        published: nowPublished,
        published_at: nowPublished ? new Date().toISOString().split("T")[0] : null,
      });
      setUpdates((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? { ...u, published: nowPublished, published_at: nowPublished ? new Date().toISOString().split("T")[0] : null }
            : u
        )
      );
      toast.success(nowPublished ? "Publicado ✅" : "Despublicado");
    } catch { toast.error("Error al cambiar visibilidad"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta novedad?")) return;
    setDeleting(id);
    try {
      await dataClient.entities.AppUpdate.delete(id);
      setUpdates((prev) => prev.filter((u) => u.id !== id));
      toast.success("Novedad eliminada");
    } catch { toast.error("Error al eliminar"); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Novedades del Sistema</h2>
            <p className="text-white/50 text-sm">Publicadas en la pantalla de acceso</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600
            text-white font-bold text-sm hover:from-amber-400 hover:to-orange-500 transition-all active:scale-95 shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <div className="bg-white/5 border border-white/15 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white font-bold text-sm">
              {editingId ? "Editar novedad" : "Nueva novedad"}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white/70 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Título *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ej: Ahora puedes buscar clientes por teléfono"
              className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm
                placeholder-white/30 focus:outline-none focus:border-amber-400/60 transition-colors"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detalles adicionales sobre la novedad..."
              rows={3}
              className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm
                placeholder-white/30 focus:outline-none focus:border-amber-400/60 transition-colors resize-none"
            />
          </div>

          {/* Tipo + Versión + Orden */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm
                  focus:outline-none focus:border-amber-400/60 transition-colors"
              >
                <option value="feature">Función nueva</option>
                <option value="improvement">Mejora</option>
                <option value="fix">Corrección</option>
                <option value="breaking">Cambio mayor</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Versión</label>
              <input
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                placeholder="2.4.0"
                className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm
                  placeholder-white/30 focus:outline-none focus:border-amber-400/60 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Fecha</label>
              <input
                type="date"
                value={form.published_at}
                onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
                className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm
                  focus:outline-none focus:border-amber-400/60 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Publicar toggle */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/8">
            <div>
              <p className="text-sm font-semibold text-white">Publicar ahora</p>
              <p className="text-xs text-white/40">Visible en la pantalla de acceso</p>
            </div>
            <button
              onClick={() => setForm((f) => ({ ...f, published: !f.published }))}
              className={`relative w-11 h-6 rounded-full transition-all
                ${form.published ? "bg-emerald-500" : "bg-white/20"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                ${form.published ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm
                hover:from-amber-400 hover:to-orange-500 transition-all active:scale-95 disabled:opacity-60
                flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-3 rounded-2xl bg-white/8 text-white/60 font-semibold text-sm hover:bg-white/12 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de novedades */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : updates.length === 0 ? (
        <div className="text-center py-14 text-white/30 bg-white/3 border border-dashed border-white/10 rounded-3xl">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">No hay novedades todavía</p>
          <p className="text-sm mt-1">Crea la primera para que aparezca en la pantalla de acceso</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all
                ${item.published
                  ? "bg-white/5 border-white/12"
                  : "bg-white/[0.02] border-white/6 opacity-70"}`}
            >
              {/* Dot + tipo */}
              <div className="flex-shrink-0 mt-0.5">
                <TypeBadge type={item.type} />
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-white truncate">{item.title}</p>
                  {item.version && (
                    <span className="text-xs text-white/30 font-mono">v{item.version}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                {item.published_at && (
                  <p className="text-xs text-white/25 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => togglePublish(item)}
                  title={item.published ? "Despublicar" : "Publicar"}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all
                    ${item.published
                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-white/8 text-white/40 hover:bg-white/12"}`}
                >
                  {item.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => openEdit(item)}
                  className="w-8 h-8 rounded-xl bg-white/8 text-white/50 hover:bg-white/12 hover:text-white
                    flex items-center justify-center transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400
                    flex items-center justify-center transition-all disabled:opacity-40"
                >
                  {deleting === item.id
                    ? <div className="w-3 h-3 border border-red-400/50 border-t-red-400 rounded-full animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-white/25 text-xs text-center pb-2">
        Las novedades publicadas aparecen en la pantalla de acceso para todos los usuarios.
      </p>
    </div>
  );
}
