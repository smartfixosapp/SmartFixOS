import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, X, Trash2, Share2, ChevronLeft, ChevronRight } from "lucide-react";
import { ORDER_STATUS, statusInfo } from "@/lib/orderStatus";
import { photoThumbURL } from "@/lib/orderEmails";
import { photoThumbCandidate } from "@/lib/orderDetailApi";
import { C, tint, Sheet, Btn, SectionHeader, Card } from "./ui";

function SmartImg({ url, style, alt = "" }) {
  return (
    <img
      src={photoThumbCandidate(url)}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget;
        const step = el.dataset.step || "0";
        if (step === "0") { el.dataset.step = "1"; el.src = photoThumbURL(url, 480); }
        else if (step === "1") { el.dataset.step = "2"; el.src = url; }
      }}
      style={{ objectFit: "cover", background: C.card2, ...style }}
    />
  );
}

export function PhotosCaptureSheet({ open, onClose, onSave, busy, initialFiles }) {
  const [files, setFiles] = useState([]);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => { if (open) setFiles(Array.isArray(initialFiles) ? [...initialFiles] : []); }, [open, initialFiles]);
  const add = (list) => setFiles((prev) => [...prev, ...Array.from(list || []).filter((f) => f.type.startsWith("image/"))]);
  return (
    <Sheet
      open={open}
      onClose={() => !busy && onClose()}
      title="Fotos del equipo"
      width={560}
      dismissable={!busy}
      footer={(
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Btn onClick={() => cameraRef.current?.click()} icon={Camera} style={{ flex: 1 }} disabled={busy}>Tomar foto</Btn>
            <Btn onClick={() => galleryRef.current?.click()} variant="secondary" icon={ImagePlus} disabled={busy} style={{ width: 56, padding: 0 }} />
          </div>
          <div className="flex gap-2">
            <Btn onClick={onClose} variant="ghost" disabled={busy} style={{ flex: 1 }}>Cancelar</Btn>
            <Btn onClick={() => onSave(files)} disabled={busy || files.length === 0} color={C.green} style={{ flex: 1 }}>
              {busy ? "Subiendo…" : `Guardar (${files.length})`}
            </Btn>
          </div>
        </div>
      )}
    >
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <p style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>{files.length} {files.length === 1 ? "foto" : "fotos"}</p>
      {files.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}
          className="flex flex-col items-center justify-center text-center"
          style={{ padding: "40px 12px", borderRadius: 14, border: `1.5px dashed ${C.sep}`, color: C.sub, fontSize: 14 }}
        >
          <Camera className="w-8 h-8" style={{ marginBottom: 8 }} />
          Toca Tomar foto para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((u, i) => (
            <div key={u} className="relative" style={{ aspectRatio: "1 / 1" }}>
              <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
              <button onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} disabled={busy} aria-label="Quitar foto"
                className="apple-press absolute" style={{ top: 4, right: 4, width: 24, height: 24, borderRadius: 999, background: "rgba(0,0,0,0.7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export function PhotoGateSheet({ open, onClose, mode, onTakePhoto, onSkip }) {
  return (
    <Sheet open={open} onClose={onClose} width={420}>
      <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
        <span style={{ width: 64, height: 64, borderRadius: 999, background: tint(C.amber, 0.14), color: C.amber, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Camera className="w-7 h-7" />
        </span>
        <p style={{ fontSize: 19, fontWeight: 800 }}>Toma la foto del equipo reparado</p>
        <p style={{ fontSize: 15, color: C.sub, marginTop: 8 }}>
          {mode === "deliveryProof"
            ? "Todavía no hay foto de la reparación terminada. Con una basta para entregarla."
            : "Con una foto basta para pasarla a Listo para Recoger y entregarla."}
        </p>
        <div className="w-full flex flex-col gap-2" style={{ marginTop: 22 }}>
          <Btn onClick={onTakePhoto} icon={Camera}>Tomar foto</Btn>
          <Btn onClick={onSkip} variant="secondary" color={C.brand} style={{ background: tint(C.brand, 0.12), color: C.brand }}>Continuar sin foto</Btn>
          <p style={{ fontSize: 12, color: C.sub }}>Queda anotado en las notas quién la omitió</p>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Sheet>
  );
}

function groupPhotos(order) {
  const urls = Array.isArray(order.device_photos) ? order.device_photos : [];
  const meta = Array.isArray(order.photos_metadata) ? order.photos_metadata : [];
  const byUrl = new Map();
  meta.forEach((m) => { if (m?.url && !byUrl.has(m.url)) byUrl.set(m.url, m); });
  const groups = {};
  urls.forEach((u) => {
    const m = byUrl.get(u);
    const st = m?.status && ORDER_STATUS[m.status] ? m.status : "intake";
    (groups[st] = groups[st] || []).push({ url: u, meta: m || null, status: st });
  });
  return Object.keys(ORDER_STATUS).filter((k) => groups[k]).map((k) => ({ status: k, items: groups[k] }));
}

async function sharePhotos(urls) {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) {
    urls.forEach((u) => window.open(u, "_blank", "noopener"));
    return;
  }
  let files;
  try {
    files = await Promise.all(urls.map(async (u, i) => {
      const blob = await (await fetch(u)).blob();
      return new File([blob], `foto_${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
    }));
  } catch {
    files = null;
  }
  try {
    if (files && navigator.canShare({ files })) await navigator.share({ files });
    else await navigator.share({ text: urls.join("\n") });
  } catch (e) {
    if (e?.name === "AbortError") return;
    if (urls[0]) window.open(urls[0], "_blank", "noopener");
  }
}

export function PhotoViewer({ items, index, onClose, onDelete }) {
  const [i, setI] = useState(index);
  useEffect(() => setI(index), [index]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => Math.min(items.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);
  const cur = items[i];
  if (!cur || typeof document === "undefined") return null;
  const st = statusInfo(cur.status);
  const when = cur.meta?.taken_at ? new Date(cur.meta.taken_at).toLocaleString("es-PR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  return createPortal(
    <div className="apple-type fixed inset-0 z-[400] flex flex-col" style={{ background: "#000", color: "#fff" }} role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3" style={{ padding: 14 }}>
        <button onClick={onClose} aria-label="Cerrar" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-2 flex-wrap justify-center" style={{ fontSize: 13 }}>
          <span>{i + 1} de {items.length}</span>
          <span style={{ padding: "3px 10px", borderRadius: 999, fontWeight: 700, color: st.color, background: tint(st.color, 0.18) }}>{st.label}</span>
          {(when || cur.meta?.by) && <span style={{ color: C.sub }}>{[when, cur.meta?.by].filter(Boolean).join(" · ")}</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => sharePhotos([cur.url])} aria-label="Compartir" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}><Share2 className="w-4 h-4" /></button>
          <button onClick={() => onDelete(cur.url)} aria-label="Eliminar esta foto" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: C.card, color: C.red, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center relative" style={{ minHeight: 0 }}>
        <img src={cur.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        {i > 0 && <button onClick={() => setI(i - 1)} aria-label="Anterior" className="apple-press absolute" style={{ left: 12, width: 44, height: 44, borderRadius: 999, background: "rgba(28,28,30,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft className="w-6 h-6" /></button>}
        {i < items.length - 1 && <button onClick={() => setI(i + 1)} aria-label="Siguiente" className="apple-press absolute" style={{ right: 12, width: 44, height: 44, borderRadius: 999, background: "rgba(28,28,30,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight className="w-6 h-6" /></button>}
      </div>
      <div className="flex gap-2 overflow-x-auto" style={{ padding: 12 }}>
        {items.map((it, j) => (
          <button key={it.url} onClick={() => setI(j)} className="apple-press shrink-0" style={{ outline: j === i ? `2px solid ${C.brand}` : "none", borderRadius: 8 }}>
            <SmartImg url={it.url} style={{ width: 56, height: 42, borderRadius: 8 }} />
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

export function PhotoStrip({ order, onOpen, onDeleteAll }) {
  const groups = groupPhotos(order);
  const flat = groups.flatMap((g) => g.items);
  if (!flat.length) return null;
  return (
    <div>
      <SectionHeader
        right={(
          <div className="flex items-center gap-3">
            <button onClick={() => sharePhotos(flat.map((p) => p.url))} className="apple-press flex items-center gap-1" style={{ fontSize: 13, color: C.brand, fontWeight: 600 }}><Share2 className="w-3.5 h-3.5" /> Compartir</button>
            <button onClick={onDeleteAll} className="apple-press" style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>Eliminar todas</button>
            <span style={{ padding: "2px 9px", borderRadius: 999, background: C.card2, fontSize: 12, color: C.sub }}>{flat.length}</span>
          </div>
        )}
      >
        Fotos del equipo
      </SectionHeader>
      <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groups.map((g) => {
          const st = statusInfo(g.status);
          return (
            <div key={g.status}>
              <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: C.sub, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: st.color }} />
                {st.label.toUpperCase()} <span style={{ fontWeight: 500 }}>{g.items.length}</span>
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                {g.items.map((p) => (
                  <button key={p.url} onClick={() => onOpen(flat, flat.findIndex((x) => x.url === p.url))} className="apple-press" style={{ aspectRatio: "4 / 3" }}>
                    <SmartImg url={p.url} style={{ width: "100%", height: "100%", borderRadius: 8 }} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
