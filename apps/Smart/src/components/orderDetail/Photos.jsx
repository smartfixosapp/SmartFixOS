import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, X, Trash2, Share2, ChevronLeft, ChevronRight, PenLine, Check, MessageCircle, MessageSquare, Mail, Loader2, Undo2 } from "lucide-react";
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

async function sharePhotos(urls, fallback) {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) {
    fallback?.();
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
    fallback?.();
  }
}

const digitsOf = (v) => String(v || "").replace(/[^\d]/g, "");

export function ClientPhotoShareSheet({ open, urls, order, onClose }) {
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (open) setMsg(null); }, [open]);
  const first = String(order?.customer_name || "").trim().split(/\s+/)[0] || "";
  const caption = `Hola${first ? ` ${first}` : ""}, aquí están las fotos de tu equipo (Orden ${order?.order_number || ""}).\n${(urls || []).join("\n")}`;
  const phone = String(order?.customer_phone || "").trim();
  const email = String(order?.customer_email || "").trim();
  const digits = digitsOf(phone);
  const count = (urls || []).length;
  const Item = ({ Icon, color, title, sub, href, onClick }) => {
    const content = (
      <>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
        <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span><span className="block" style={{ fontSize: 12, color: C.sub }}>{sub}</span></span>
      </>
    );
    const style = { padding: "12px 14px", background: C.card2 };
    return href
      ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="apple-press w-full flex items-center gap-3 text-left" style={style}>{content}</a>
      : <button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left" style={style}>{content}</button>;
  };
  const other = async () => {
    try {
      if (navigator.share) { await navigator.share({ text: caption }); return; }
      await navigator.clipboard.writeText(caption);
      setMsg("Enlaces copiados.");
    } catch (e) { if (e?.name !== "AbortError") setMsg("No se pudo compartir."); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Compartir con el cliente" width={420} zIndex={460}>
      <p style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>{count === 1 ? "1 foto seleccionada" : `${count} fotos seleccionadas`}</p>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, marginBottom: 8 }}>ENVIAR A</p>
      <div style={{ borderRadius: 14, overflow: "hidden" }} className="flex flex-col gap-px">
        {phone && <Item Icon={MessageSquare} color={C.blue} title={`SMS a ${phone}`} sub="Mensaje con los enlaces de las fotos" href={`sms:${digits}?&body=${encodeURIComponent(caption)}`} />}
        {phone && <Item Icon={MessageCircle} color={C.green} title="WhatsApp" sub="Mensaje con los enlaces de las fotos" href={`https://wa.me/${digits.length === 10 ? `1${digits}` : digits}?text=${encodeURIComponent(caption)}`} />}
        {email && <Item Icon={Mail} color={C.blue} title={`Email a ${email}`} sub="Correo con los enlaces de las fotos" href={`mailto:${email}?subject=${encodeURIComponent(`Fotos de tu equipo - ${order?.order_number || ""}`)}&body=${encodeURIComponent(caption)}`} />}
        <Item Icon={Share2} color={C.indigo} title="Otra app" sub="Menú de compartir del dispositivo" onClick={other} />
      </div>
      <p style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>En la web no se pueden adjuntar las fotos a un SMS o WhatsApp; se envían como enlaces.</p>
      {msg && <p style={{ fontSize: 13, color: C.amber, marginTop: 6 }}>{msg}</p>}
    </Sheet>
  );
}

const ANNOTATE_COLORS = ["#FF3B30", "#FFD60A", "#FFFFFF"];
const ANNOTATE_WIDTHS = [4, 8, 14];

function PhotoAnnotator({ url, onCancel, onSave }) {
  const canvasRef = useRef(null);
  const bitmapRef = useRef(null);
  const strokes = useRef([]);
  const drawing = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [color, setColor] = useState(ANNOTATE_COLORS[0]);
  const [width, setWidth] = useState(ANNOTATE_WIDTHS[1]);
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);

  const redraw = () => {
    const canvas = canvasRef.current;
    const bmp = bitmapRef.current;
    if (!canvas || !bmp) return;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const unit = canvas.width / 1000;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokes.current.forEach((st) => {
      ctx.strokeStyle = st.color;
      ctx.fillStyle = st.color;
      ctx.lineWidth = st.width * unit;
      if (st.points.length === 1) {
        ctx.beginPath();
        ctx.arc(st.points[0].x, st.points[0].y, (st.width * unit) / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      st.points.forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.stroke();
    });
  };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const blob = await (await fetch(url)).blob();
        const bmp = await createImageBitmap(blob);
        if (!live) return;
        bitmapRef.current = bmp;
        const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
        const canvas = canvasRef.current;
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        setReady(true);
        redraw();
      } catch {
        if (live) setError("No se pudo cargar la foto para anotar.");
      }
    })();
    return () => { live = false; };
  }, [url]);

  const point = (e) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  };
  const down = (e) => {
    if (!ready) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = { color, width, points: [point(e)] };
    strokes.current.push(drawing.current);
    setCount(strokes.current.length);
    redraw();
  };
  const move = (e) => {
    if (!drawing.current) return;
    drawing.current.points.push(point(e));
    redraw();
  };
  const up = () => { drawing.current = null; };
  const undo = () => { strokes.current.pop(); setCount(strokes.current.length); redraw(); };
  const clear = () => { strokes.current = []; setCount(0); redraw(); };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || saving) return;
    setSaving(true);
    canvas.toBlob(async (blob) => {
      if (!blob) { setSaving(false); setError("No se pudo guardar la foto."); return; }
      try {
        await onSave(new File([blob], `anotada_${Date.now()}.jpg`, { type: "image/jpeg" }));
      } catch {
        setError("No se pudo guardar la foto.");
        setSaving(false);
      }
    }, "image/jpeg", 0.85);
  };

  return createPortal(
    <div className="apple-type fixed inset-0 z-[450] flex flex-col" style={{ background: "#000", color: "#fff" }} role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3" style={{ padding: 14 }}>
        <button onClick={onCancel} disabled={saving} style={{ fontSize: 16, color: C.brand, fontWeight: 500 }}>Cancelar</button>
        <p style={{ fontSize: 16, fontWeight: 700 }}>Anotar foto</p>
        <button onClick={save} disabled={!ready || saving || count === 0} className="disabled:opacity-40" style={{ fontSize: 16, color: C.brand, fontWeight: 700 }}>{saving ? "Guardando…" : "Guardar"}</button>
      </div>
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: 0, padding: "0 8px" }}>
        {error && !ready ? <p style={{ color: C.red }}>{error}</p> : (
          <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ maxWidth: "100%", maxHeight: "100%", touchAction: "none", cursor: "crosshair", background: ready ? "transparent" : C.card2 }} />
        )}
        {!ready && !error && <Loader2 className="w-6 h-6 animate-spin absolute" style={{ color: C.sub }} />}
      </div>
      {error && ready && <p className="text-center" style={{ fontSize: 13, color: C.red, padding: 6 }}>{error}</p>}
      <div className="flex items-center justify-center gap-4 flex-wrap" style={{ padding: 14 }}>
        <div className="flex items-center gap-2">
          {ANNOTATE_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`} style={{ width: 30, height: 30, borderRadius: 999, background: c, border: color === c ? `3px solid ${C.brand}` : "2px solid #3A3A3C" }} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {ANNOTATE_WIDTHS.map((w) => (
            <button key={w} onClick={() => setWidth(w)} aria-label={`Grosor ${w}`} style={{ width: 34, height: 34, borderRadius: 999, background: width === w ? C.card2 : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: Math.max(6, w + 2), height: Math.max(6, w + 2), borderRadius: 999, background: "#fff" }} />
            </button>
          ))}
        </div>
        <button onClick={undo} disabled={!count} className="apple-press flex items-center gap-1 disabled:opacity-40" style={{ fontSize: 14, color: "#fff" }}><Undo2 className="w-4 h-4" /> Deshacer</button>
        <button onClick={clear} disabled={!count} className="apple-press disabled:opacity-40" style={{ fontSize: 14, color: C.red }}>Borrar todo</button>
      </div>
    </div>,
    document.body
  );
}

export function PhotoViewer({ items, index, onClose, onDelete, order, onSaveAnnotated }) {
  const [i, setI] = useState(index);
  const [annotating, setAnnotating] = useState(false);
  const [clientShare, setClientShare] = useState(false);
  useEffect(() => setI(index), [index]);
  useEffect(() => {
    if (annotating || clientShare) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => Math.min(items.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [items.length, onClose, annotating, clientShare]);
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
          {onSaveAnnotated && <button onClick={() => setAnnotating(true)} aria-label="Anotar foto" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: C.card, color: C.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><PenLine className="w-4 h-4" /></button>}
          {order && <button onClick={() => setClientShare(true)} aria-label="Compartir con el cliente" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}><MessageCircle className="w-4 h-4" /></button>}
          <button onClick={() => sharePhotos([cur.url], () => setClientShare(true))} aria-label="Compartir" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}><Share2 className="w-4 h-4" /></button>
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
      {annotating && <PhotoAnnotator url={cur.url} onCancel={() => setAnnotating(false)} onSave={async (file) => { await onSaveAnnotated(file, cur); setAnnotating(false); }} />}
      {order && <ClientPhotoShareSheet open={clientShare} urls={[cur.url]} order={order} onClose={() => setClientShare(false)} />}
    </div>,
    document.body
  );
}

export function PhotoStrip({ order, onOpen, onDeleteAll, onDeleteOne }) {
  const groups = groupPhotos(order);
  const flat = groups.flatMap((g) => g.items);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [shareUrls, setShareUrls] = useState(null);
  const [menu, setMenu] = useState(null);
  if (!flat.length) return null;

  const toggle = (url) => setSelected((prev) => { const next = new Set(prev); if (next.has(url)) next.delete(url); else next.add(url); return next; });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const shareSelected = () => { const urls = flat.filter((p) => selected.has(p.url)).map((p) => p.url); if (!urls.length) return; sharePhotos(urls, () => setShareUrls(urls)).then(exitSelect); };
  const shareAll = () => { const urls = flat.map((p) => p.url); sharePhotos(urls, () => setShareUrls(urls)); };

  return (
    <div>
      <SectionHeader
        right={(
          <div className="flex items-center gap-3">
            {selectMode ? (
              <>
                <button onClick={shareSelected} disabled={!selected.size} className="apple-press disabled:opacity-40" style={{ fontSize: 13, color: C.brand, fontWeight: 600 }}>{`Compartir (${selected.size})`}</button>
                <button onClick={exitSelect} className="apple-press" style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>Cancelar</button>
              </>
            ) : (
              <>
                <button onClick={shareAll} className="apple-press flex items-center gap-1" style={{ fontSize: 13, color: C.brand, fontWeight: 600 }}><Share2 className="w-3.5 h-3.5" /> Compartir</button>
                <button onClick={() => setSelectMode(true)} className="apple-press" style={{ fontSize: 13, color: C.brand, fontWeight: 600 }}>Seleccionar</button>
                <button onClick={onDeleteAll} className="apple-press" style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>Eliminar todas</button>
              </>
            )}
            <span style={{ padding: "2px 9px", borderRadius: 999, background: tint(C.brand, 0.18), color: C.brand, fontSize: 12, fontWeight: 700 }}>{flat.length}</span>
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
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
                {g.items.map((p) => {
                  const on = selected.has(p.url);
                  return (
                    <button
                      key={p.url}
                      onClick={() => (selectMode ? toggle(p.url) : onOpen(flat, flat.findIndex((x) => x.url === p.url)))}
                      onContextMenu={(e) => { e.preventDefault(); setMenu({ url: p.url, x: e.clientX, y: e.clientY }); }}
                      className="apple-press relative"
                      style={{ aspectRatio: "4 / 3", outline: on ? `2px solid ${C.brand}` : "none", borderRadius: 8 }}
                    >
                      <SmartImg url={p.url} style={{ width: "100%", height: "100%", borderRadius: 8 }} />
                      {selectMode && (
                        <span className="absolute flex items-center justify-center" style={{ top: 6, right: 6, width: 22, height: 22, borderRadius: 999, background: on ? C.brand : "rgba(0,0,0,0.5)", border: "1.5px solid #fff" }}>
                          {on && <Check className="w-3.5 h-3.5" style={{ color: "#fff" }} />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>
      {menu && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 3000 }} onPointerDown={() => setMenu(null)}>
          <div onPointerDown={(e) => e.stopPropagation()} style={{ position: "fixed", left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 160), width: 220, borderRadius: 14, background: "rgba(44,44,46,0.97)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)", padding: 4 }}>
            {[
              ["Compartir con el cliente", "#fff", () => setShareUrls([menu.url])],
              onDeleteOne && ["Eliminar esta foto", C.red, () => onDeleteOne(menu.url)],
              ["Eliminar TODAS las fotos", C.red, () => onDeleteAll()],
            ].filter(Boolean).map(([label, col, fn]) => (
              <button key={label} onClick={() => { setMenu(null); fn(); }} className="apple-press w-full text-left" style={{ padding: "11px 12px", borderRadius: 10, fontSize: 15, color: col }}>{label}</button>
            ))}
          </div>
        </div>,
        document.body
      )}
      <ClientPhotoShareSheet open={!!shareUrls} urls={shareUrls || []} order={order} onClose={() => setShareUrls(null)} />
    </div>
  );
}
