import { useRef, useState } from "react";
import { Images, Camera, X, Trash2, Sparkles, Loader2 } from "lucide-react";
import { tint } from "@/components/pos/native/posUi";
import { warmUpload, analyzeDamagePhoto } from "@/lib/wizard/api";
import BurstCamera from "./BurstCamera";
import { IOS, PHOTO_EXCEPTIONS } from "@/lib/wizard/helpers";
import { Caption, W } from "./ui";

export const MAX_PHOTOS = 12;

export function usePhotoAdder({ tenantId, w, max = MAX_PHOTOS, key = "photos", warm = true }) {
  const { s, set } = w;
  const list = s[key];
  return (files) => {
    const room = max - list.length;
    const added = Array.from(files || []).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room)).map((file) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, preview: URL.createObjectURL(file), url: null }));
    if (!added.length) return;
    set((p) => ({ [key]: [...p[key], ...added], security: key === "photos" ? { ...p.security, photo_exception_reason: "" } : p.security }));
    if (!warm) return;
    added.forEach((ph) => {
      warmUpload(tenantId, ph.file).then((url) => set((p) => ({ [key]: p[key].map((x) => (x.id === ph.id ? { ...x, url } : x)) })), () => {});
    });
  };
}

export default function StepPhotos({ w, tenantId }) {
  const { s, set } = w;
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const add = usePhotoAdder({ tenantId, w });
  const full = s.photos.length >= MAX_PHOTOS;
  const [burst, setBurst] = useState(false);
  const useBurst = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches && !!navigator.mediaDevices?.getUserMedia;
  const [analyzing, setAnalyzing] = useState(false);
  const [vision, setVision] = useState(null);
  const [visionError, setVisionError] = useState(false);
  const analyze = async () => {
    const first = s.photos[0];
    if (!first?.file || analyzing) return;
    setAnalyzing(true);
    setVisionError(false);
    try {
      setVision(await analyzeDamagePhoto(first.file, [s.brand?.name, s.family?.name].filter(Boolean).join(" ")));
    } catch {
      setVisionError(true);
    }
    setAnalyzing(false);
  };
  const addToProblem = () => {
    const d = vision?.diagnosis;
    if (!d) return;
    set((p) => ({ problem: !p.problem ? d : p.problem.includes(d) ? p.problem : `${p.problem}\n${d}` }));
  };
  const remove = (id) => set((p) => ({ photos: p.photos.filter((x) => x.id !== id) }));
  const btn = (Icon, label, ref) => (
    <button onClick={() => ref.current?.click()} disabled={full} className="apple-press flex-1 flex items-center justify-center gap-2 disabled:opacity-40" style={{ height: 56, borderRadius: 16, background: W.card, fontSize: 16, fontWeight: 600 }}><Icon className="w-5 h-5" style={{ color: IOS.indigo }} /> {label}</button>
  );
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div>
        <p style={{ fontSize: 18, fontWeight: 700 }}>Fotos del dispositivo</p>
        <p style={{ fontSize: 14, color: W.sub }}>Requiere al menos 1 foto — o marca por qué no se pudo</p>
      </div>
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <BurstCamera open={burst} max={MAX_PHOTOS} already={s.photos.length} onDone={(files) => add(files)} onClose={() => setBurst(false)} />
      <div className="flex" style={{ gap: 12 }}>{btn(Images, "Galería", galleryRef)}{useBurst ? (
        <button onClick={() => setBurst(true)} disabled={full} className="apple-press flex-1 flex items-center justify-center gap-2 disabled:opacity-40" style={{ height: 56, borderRadius: 16, background: W.card, fontSize: 16, fontWeight: 600 }}><Camera className="w-5 h-5" style={{ color: IOS.indigo }} /> Cámara</button>
      ) : btn(Camera, "Cámara", cameraRef)}</div>
      {s.photos.length > 0 ? (
        <>
          <div className="flex items-center">
            <span className="flex-1" style={{ fontSize: 14, fontWeight: 600, color: W.sub }}>{s.photos.length} / {MAX_PHOTOS} fotos</span>
            <button onClick={() => set({ photos: [] })} className="flex items-center gap-1" style={{ fontSize: 13, color: IOS.red }}><Trash2 className="w-3.5 h-3.5" /> Borrar todas</button>
          </div>
          <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {s.photos.map((p) => (
              <div key={p.id} className="relative" style={{ height: 220, borderRadius: 16, overflow: "hidden", background: W.card }}>
                <img src={p.preview} alt="Foto del equipo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => remove(p.id)} aria-label="Quitar foto" className="absolute" style={{ top: 8, right: 8, width: 28, height: 28, borderRadius: 999, background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex flex-col" style={{ gap: 10 }}>
            <button onClick={analyze} disabled={analyzing} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ height: 46, borderRadius: 10, background: IOS.indigo, color: "#fff", fontSize: 15, fontWeight: 600 }}>
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzing ? "Analizando foto…" : "Analizar daño con Archi"}
            </button>
            {vision && (
              <div className="flex flex-col" style={{ gap: 6, padding: 12, borderRadius: 10, background: tint(IOS.indigo, 0.08) }}>
                <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: IOS.indigo }}><Sparkles className="w-3.5 h-3.5" /> Archi ve: {vision.confidence}</span>
                <span style={{ fontSize: 14 }}>{vision.diagnosis}</span>
                <button onClick={addToProblem} className="self-start" style={{ fontSize: 12, fontWeight: 600, color: IOS.indigo }}>Agregar a la descripción</button>
              </div>
            )}
            {visionError && <p style={{ fontSize: 12, color: W.sub }}>No se pudo analizar la foto. Intenta de nuevo.</p>}
          </div>
        </>
      ) : (
        <div className="flex flex-col" style={{ gap: 14 }}>
          <div className="flex flex-col items-center text-center" style={{ padding: "24px 0", gap: 6 }}>
            <Camera className="w-9 h-9" style={{ color: W.ter }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: W.sub }}>Sin fotos</p>
            <p style={{ fontSize: 13, color: W.ter }}>Las fotos ayudan a documentar el estado del dispositivo</p>
          </div>
          <Caption>¿No se puede tomar foto ahora?</Caption>
          {PHOTO_EXCEPTIONS.map((r) => {
            const on = s.security.photo_exception_reason === r;
            return (
              <button key={r} onClick={() => set((p) => ({ security: { ...p.security, photo_exception_reason: on ? "" : r } }))} className="apple-press flex items-center gap-3 text-left" style={{ padding: "14px 16px", borderRadius: 14, background: on ? tint(IOS.orange, 0.14) : W.card, border: `1px solid ${on ? IOS.orange : "transparent"}` }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${on ? IOS.orange : W.sub}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <span style={{ width: 10, height: 10, borderRadius: 999, background: IOS.orange }} />}</span>
                <span style={{ fontSize: 15 }}>{r}</span>
              </button>
            );
          })}
          <p style={{ fontSize: 12, color: W.sub }}>El cliente verá este motivo antes de firmar.</p>
        </div>
      )}
    </div>
  );
}
