import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { P, Dialog, TextAction } from "@/components/pos/native/posUi";

export default function ScannerDialog({ open, onClose, onCode }) {
  const videoRef = useRef(null);
  const onCodeRef = useRef(onCode);
  const onCloseRef = useRef(onClose);
  onCodeRef.current = onCode;
  onCloseRef.current = onClose;
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    setError(null);
    const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    setUnsupported(!supported);
    if (!supported) return undefined;
    let stream = null;
    let controls = null;
    let alive = true;
    let raf = 0;
    const found = (value) => {
      if (!alive) return;
      alive = false;
      onCodeRef.current(value);
      onCloseRef.current();
    };
    (async () => {
      try {
        const video = videoRef.current;
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (!alive || !video) { stream.getTracks().forEach((t) => t.stop()); return; }
          video.srcObject = stream;
          await video.play();
          const detector = new window.BarcodeDetector();
          const tick = async () => {
            if (!alive) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length && codes[0].rawValue) { found(codes[0].rawValue); return; }
            } catch {
              alive = alive && true;
            }
            raf = requestAnimationFrame(tick);
          };
          tick();
          return;
        }
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (!alive || !video) return;
        const reader = new BrowserMultiFormatReader();
        const ctl = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video, (result) => { if (result) found(result.getText()); });
        if (!alive) ctl.stop(); else controls = ctl;
      } catch (e) {
        if (alive) setError(e?.name === "NotAllowedError" ? "Sin permiso de cámara. Actívalo en la configuración del navegador." : e?.message || String(e));
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title="Escanear código de barras" width={520} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={null}>
      {unsupported ? (
        <div className="flex flex-col items-center text-center" style={{ padding: 24, gap: 10 }}>
          <Camera className="w-10 h-10" style={{ color: P.ter }} />
          <p style={{ fontSize: 15, color: P.sub }}>No se pudo acceder a la cámara en este navegador. Usa un lector de código de barras conectado o escribe el código en la búsqueda y presiona Enter.</p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 14, background: "#000", aspectRatio: "4 / 3", objectFit: "cover" }} />
          {error && <p style={{ fontSize: 13, color: P.danger }}>{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
