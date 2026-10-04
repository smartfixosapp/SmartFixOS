import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, TextAction } from "@/components/pos/native/posUi";
import PODetailPanel from "@/components/compras/PODetail";
import { fetchPO } from "@/lib/comprasApi";

export default function POSheet({ open, poId, tenant, tenantId, employeeName, onClose, onChanged }) {
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !poId) return undefined;
    let live = true;
    setPo(null);
    setLoading(true);
    fetchPO(poId).then((row) => { if (live) setPo(row); }, () => {}).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open, poId]);

  return (
    <Dialog open={open} onClose={onClose} title={po?.po_number && po.po_number !== "BORRADOR" ? po.po_number : "Compra"} width={820} height="90dvh" bodyPadding="0" leading={<span />} trailing={<TextAction bold onClick={onClose}>Listo</TextAction>}>
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 60 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8E8E93" }} /></div>
      ) : po ? (
        <PODetailPanel po={po} tenant={tenant} tenantId={tenantId} employeeName={employeeName} onUpdated={(p) => { setPo(p); onChanged?.(); }} onBack={null} />
      ) : (
        <p className="text-center" style={{ padding: 40, color: "#8E8E93" }}>No se encontró la compra.</p>
      )}
    </Dialog>
  );
}
