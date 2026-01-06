import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Camera, UploadCloud, Trash2 } from "lucide-react";

// Helpers de API
const pickUrl = (res) => res?.file_url || res?.url || res?.public_url || res?.signed_url || res?.download_url || "";
const extractUrls = (attachments) => {
  const list = Array.isArray(attachments) ? attachments : [];
  return [...new Set(list.map(x => typeof x === "string" ? x : pickUrl(x)).filter(Boolean))];
};
const uploadFile = async (file) => {
  const r = await base44.integrations.Core.UploadFile({ file });
  const url = pickUrl(r);
  if (!url) throw new Error("Upload did not return a valid URL.");
  return { url, name: file.name, mime_type: file.type };
};

export default function PhotoDock({ order, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const [stagedPreviews, setStagedPreviews] = useState([]);
  const inputGalleryRef = useRef(null);
  const inputCameraRef = useRef(null);

  const backendUrls = useMemo(() => extractUrls(order?.attachments), [order?.attachments]);

  useEffect(() => () => {
    stagedPreviews.forEach((u) => u.startsWith("blob:") && URL.revokeObjectURL(u));
  }, [stagedPreviews]);

  const addFilesToStage = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f?.type?.startsWith("image/"));
    if (!files.length) return;
    const previews = files.map((f) => URL.createObjectURL(f));
    setStagedFiles((prev) => [...prev, ...files]);
    setStagedPreviews((prev) => [...prev, ...previews]);
  };

  const handleFileChange = (e) => {
    addFilesToStage(e.target.files);
    e.target.value = ""; // Reset input
  };

  const saveAll = async () => {
    if (!stagedFiles.length) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const uploaded = [];
      for (const f of stagedFiles) {
        uploaded.push(await uploadFile(f));
      }
      
      const existingUrls = backendUrls.map(url => ({ url }));
      const merged = [...existingUrls, ...uploaded];
      const uniqueAttachments = Array.from(new Set(merged.map(a => a.url))).map(url => merged.find(a => a.url === url));

      const write = base44.entities.Order.patch || base44.entities.Order.update;
      await write(order.id, { attachments: uniqueAttachments });
      
      stagedPreviews.forEach((u) => u.startsWith("blob:") && URL.revokeObjectURL(u));
      setStagedFiles([]);
      setStagedPreviews([]);
      
      setMsg("Fotos guardadas.");
      setTimeout(() => setMsg(""), 2000);
      onUpdate();
    } catch (e) {
      console.error(e);
      setErr("Error al guardar fotos.");
      setTimeout(() => setErr(""), 3000);
    } finally {
      setBusy(false);
    }
  };

  const removeStagedAt = (idx) => {
    URL.revokeObjectURL(stagedPreviews[idx]);
    setStagedPreviews((prev) => prev.filter((_, i) => i !== idx));
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const deletePersisted = async (urlToDelete) => {
    if (!confirm("¿Eliminar esta foto permanentemente?")) return;
    setBusy(true);
    try {
      const nextAttachments = (order.attachments || []).filter(a => (typeof a === 'string' ? a : a.url) !== urlToDelete);
      const write = base44.entities.Order.patch || base44.entities.Order.update;
      await write(order.id, { attachments: nextAttachments });
      onUpdate();
    } catch (e) {
      console.error("Error deleting photo", e);
      setErr("Error al eliminar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-red-500" />
                Fotos
            </h3>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 border-gray-700" onClick={() => inputGalleryRef.current?.click()} disabled={busy}>
                    <UploadCloud className="w-4 h-4 mr-2" /> Subir
                </Button>
                <Button size="sm" variant="outline" className="h-8 border-gray-700" onClick={() => inputCameraRef.current?.click()} disabled={busy}>
                    <Camera className="w-4 h-4 mr-2" /> Cámara
                </Button>
            </div>
            <input type="file" ref={inputGalleryRef} hidden multiple accept="image/*" onChange={handleFileChange} />
            <input type="file" ref={inputCameraRef} hidden capture="environment" accept="image/*" onChange={handleFileChange} />
        </div>

        {stagedFiles.length > 0 && (
            <div className="bg-blue-900/30 border border-blue-700/50 p-3 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-blue-300">{stagedFiles.length} foto(s) por guardar</p>
                    <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={saveAll} disabled={busy}>
                        {busy ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {stagedPreviews.map((u, i) => (
                        <div key={i} className="relative aspect-square rounded-md overflow-hidden group">
                            <img src={u} alt="preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeStagedAt(i)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {(err || msg) && <p className={`text-sm text-center ${err ? 'text-red-400' : 'text-green-400'}`}>{err || msg}</p>}

        {backendUrls.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                {backendUrls.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                        <img src={url} alt={`attachment-${i}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => deletePersisted(url)} disabled={busy}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            stagedFiles.length === 0 && <p className="text-center text-sm text-gray-500 py-4">No hay fotos en esta orden.</p>
        )}
    </div>
  );
}
