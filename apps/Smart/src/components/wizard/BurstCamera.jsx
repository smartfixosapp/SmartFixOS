import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

export default function BurstCamera({ open, max, already, onDone, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [shots, setShots] = useState([]);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setShots([]);
    setError(null);
    setReady(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } } });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play(); setReady(true); }
      } catch (e) {
        if (alive) setError(e?.name === "NotAllowedError" ? "Sin permiso de cámara. Actívalo en la configuración del navegador." : "No se pudo abrir la cámara.");
      }
    })();
    return () => { alive = false; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const room = Math.max(0, max - already - shots.length);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || room <= 0) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((b) => { if (b) setShots((s) => [...s, new File([b], `foto_${Date.now()}.jpg`, { type: "image/jpeg" })]); }, "image/jpeg", 0.9);
  };

  const finish = () => { const list = shots; onDone(list); onClose(); };

  return createPortal(
    <div className="apple-type fixed inset-0 flex flex-col" style={{ zIndex: 480, background: "#000", color: "#fff" }} role="dialog" aria-modal="true">
      <div className="flex items-center justify-between" style={{ padding: 14 }}>
        <button onClick={onClose} style={{ fontSize: 16, color: "#F2662E" }}>Cancelar</button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{shots.length} {shots.length === 1 ? "foto" : "fotos"}</span>
        <button onClick={finish} disabled={!shots.length} className="disabled:opacity-40" style={{ fontSize: 16, fontWeight: 700, color: "#F2662E" }}>Listo</button>
      </div>
      <div className="flex-1 flex items-center justify-center relative" style={{ minHeight: 0 }}>
        {error ? <p style={{ color: "#FF453A", padding: 20, textAlign: "center" }}>{error}</p> : <video ref={videoRef} playsInline muted style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
        {!ready && !error && <Loader2 className="w-6 h-6 animate-spin absolute" style={{ color: "#8E8E93" }} />}
      </div>
      <div className="flex items-center justify-center" style={{ padding: 20, gap: 24 }}>
        <button onClick={snap} disabled={!ready || room <= 0} aria-label="Tomar foto" className="apple-press disabled:opacity-40" style={{ width: 72, height: 72, borderRadius: 999, background: "#fff", border: "5px solid #3A3A3C" }} />
      </div>
      {room <= 0 && <p className="text-center" style={{ fontSize: 13, color: "#8E8E93", paddingBottom: 12 }}>Llegaste al máximo de fotos.</p>}
    </div>,
    document.body,
  );
}
