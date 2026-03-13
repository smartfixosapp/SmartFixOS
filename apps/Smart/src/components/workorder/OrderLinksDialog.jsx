import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link as LinkIcon, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteOrderLink, loadOrderLinks, saveOrderLink } from "@/components/workorder/utils/orderLinksStore";

const ACCENT_STYLES = {
  cyan: {
    badge: "border-cyan-400/20 bg-cyan-500/15 text-cyan-300",
    border: "border-cyan-500/20",
    gradient: "bg-[linear-gradient(90deg,rgba(56,189,248,0.12),rgba(37,99,235,0.06),transparent)]",
    button: "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-950/30",
    link: "text-cyan-300",
    ring: "focus:border-cyan-400/40 focus:ring-cyan-500/30",
    hover: "hover:border-cyan-400/25",
  },
  amber: {
    badge: "border-yellow-400/20 bg-yellow-500/15 text-yellow-300",
    border: "border-yellow-500/20",
    gradient: "bg-gradient-to-r from-yellow-500/10 to-transparent",
    button: "bg-yellow-500 hover:bg-yellow-400 shadow-yellow-950/30 text-black",
    link: "text-yellow-300",
    ring: "focus:border-yellow-400/40 focus:ring-yellow-500/30",
    hover: "hover:border-yellow-400/25",
  },
};

export default function OrderLinksDialog({
  order,
  user,
  onUpdate,
  open,
  onOpenChange,
  accent = "cyan",
  allowAdd = true,
  title = "Ver y Añadir Links",
  subtitle = "Links de piezas",
  onLinksChange,
}) {
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.cyan;
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partName, setPartName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");

  const summary = useMemo(() => {
    if (links.length === 0) return "Sin links todavía";
    return `${links.length} link${links.length === 1 ? "" : "s"} registrado${links.length === 1 ? "" : "s"}`;
  }, [links]);

  const refreshLinks = async () => {
    if (!order?.id) {
      setLinks([]);
      onLinksChange?.([]);
      return;
    }

    setLoading(true);
    try {
      const result = await loadOrderLinks(order);
      const nextLinks = Array.isArray(result?.links) ? result.links : [];
      setLinks(nextLinks);
      onLinksChange?.(nextLinks);
    } catch (error) {
      console.error("Error loading order links:", error);
      setLinks([]);
      onLinksChange?.([]);
      toast.error("No se pudieron cargar los links");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLinks();
  }, [order?.id]);

  useEffect(() => {
    if (open) refreshLinks();
  }, [open]);

  const handleSave = async () => {
    if (!partName.trim() || !url.trim()) {
      toast.error("Nombre de pieza y link son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const result = await saveOrderLink({
        order,
        partName,
        url,
        price,
        user,
      });
      const nextLinks = Array.isArray(result?.links) ? result.links : [];
      setLinks(nextLinks);
      onLinksChange?.(nextLinks);
      setPartName("");
      setUrl("");
      setPrice("");
      onUpdate?.();
      toast.success("Link guardado");
    } catch (error) {
      console.error("Error saving order link:", error);
      toast.error("No se pudo guardar el link");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (linkId) => {
    if (!linkId) return;
    if (!window.confirm("¿Eliminar este link y su item manual asociado?")) return;

    setSaving(true);
    try {
      const result = await deleteOrderLink({ order, linkId });
      const nextLinks = Array.isArray(result?.links) ? result.links : [];
      setLinks(nextLinks);
      onLinksChange?.(nextLinks);
      onUpdate?.();
      toast.success("Link eliminado");
    } catch (error) {
      console.error("Error deleting order link:", error);
      toast.error("No se pudo eliminar el link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[calc(100vw-1rem)] max-w-4xl border ${styles.border} bg-[#05080f] p-0 z-[9999] overflow-hidden rounded-[24px] sm:w-full sm:rounded-[28px]`}>
        <Button
          variant="ghost"
          className="absolute right-2 top-2 z-[10000] h-10 w-10 rounded-xl p-0 text-gray-400 hover:text-white sm:right-4 sm:top-4"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className={`border-b border-white/10 px-4 py-4 pr-14 sm:px-6 sm:py-5 ${styles.gradient}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${styles.badge} sm:h-11 sm:w-11`}>
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">{subtitle}</p>
              <h3 className="text-base font-black tracking-tight text-white sm:text-lg">{title}</h3>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {allowAdd && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="Nombre de la pieza"
                  className={`h-11 rounded-2xl border-white/10 bg-black/30 text-sm text-white placeholder:text-white/25 ${styles.ring}`}
                />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className={`h-11 rounded-2xl border-white/10 bg-black/30 text-sm text-white placeholder:text-white/25 ${styles.ring}`}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Precio"
                  className={`h-11 rounded-2xl border-white/10 bg-black/30 text-sm text-white placeholder:text-white/25 ${styles.ring}`}
                />
              </div>

              <div className="flex justify-stretch sm:justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving || !partName.trim() || !url.trim()}
                  className={`h-11 w-full rounded-2xl border-0 px-5 shadow-lg sm:w-auto ${styles.button}`}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  {saving ? "Guardando..." : "Añadir Link"}
                </Button>
              </div>
            </>
          )}

          <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/55">
            {summary}
          </div>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[360px]">
            {!loading && links.length === 0 && (
              <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                No hay links guardados aun.
              </div>
            )}

            {loading && (
              <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
                Cargando links...
              </div>
            )}

            {links.map((link) => (
              <div
                key={link.id}
                className={`group flex flex-col items-stretch gap-3 rounded-[18px] border border-white/10 bg-black/20 p-3 ${styles.hover} hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{link.partName}</p>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 sm:justify-end sm:border-t-0 sm:pl-3 sm:pt-0">
                  <span className="text-sm font-semibold text-emerald-300">${Number(link.price || 0).toFixed(2)}</span>
                  <div className="flex items-center gap-2">
                    {link.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold ${styles.link} hover:bg-white/10 transition-colors`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Link
                      </a>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDelete(link.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
