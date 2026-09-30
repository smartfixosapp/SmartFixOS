import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";
import { Dialog, TextAction } from "@/components/pos/native/posUi";
import { workshopCode } from "@/lib/punchApi";
import { copyText, shareText, invitationText } from "@/lib/teamApi";
import { W } from "@/components/wizard/ui";

export default function WorkshopCodeDialog({ open, onClose, tenant, tenantId }) {
  const code = workshopCode(tenantId);
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(null);
  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setShared(null);
    QRCode.toDataURL(code, { width: 380, margin: 1, errorCorrectionLevel: "M" }).then(setQr, () => setQr(null));
  }, [open, code]);
  useEffect(() => { if (!copied) return undefined; const t = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t); }, [copied]);
  return (
    <Dialog open={open} onClose={onClose} title="Código del taller" width={420} leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      <div className="flex flex-col items-center" style={{ gap: 14, paddingTop: 8 }}>
        <div style={{ width: 190, height: 190, background: "#fff", borderRadius: 14, padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {qr ? <img src={qr} alt={`Código QR ${code}`} style={{ width: "100%", height: "100%" }} /> : null}
        </div>
        <button onClick={async () => setCopied(await copyText(code))} className="apple-press flex items-center gap-3" aria-label="Copiar código" style={{ padding: "12px 20px", borderRadius: 14, background: copied ? "rgba(77,199,128,0.16)" : "#2C2C2E", color: copied ? "#4DC780" : "#fff" }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "0.08em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{code}</span>
          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" style={{ color: W.sub }} />}
        </button>
        <p className="text-center" style={{ fontSize: 13, color: W.sub }}>Tus empleados lo escanean o lo escriben al entrar como empleado desde su iPhone</p>
        <button onClick={async () => { const ok = await shareText(invitationText(tenant, code)); setShared(ok ? (navigator.share ? null : "Invitación copiada") : "No se pudo compartir"); }} className="apple-press w-full" style={{ padding: "13px 0", borderRadius: 14, background: "#F2662E", color: "#fff", fontWeight: 700, fontSize: 16 }}>Compartir invitación</button>
        {shared && <p style={{ fontSize: 13, color: W.sub }}>{shared}</p>}
      </div>
    </Dialog>
  );
}
