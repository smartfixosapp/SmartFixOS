import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Store, Camera, Globe } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, Input, W } from "@/components/wizard/ui";
import { fetchSuppliers, createSupplier, updateSupplier, archiveSupplier, uploadSupplierLogo, imageToJpegBlob } from "@/lib/comprasApi";

const BRAND = "#F2662E";
const DRAFT_KEY = "compras.supplierDraft.v1";

const readDraft = () => { try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const writeDraft = (v) => { try { if (v) localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); else localStorage.removeItem(DRAFT_KEY); } catch { return; } };

export function SupplierAvatar({ supplier, size = 56 }) {
  const name = String(supplier?.name || "").trim();
  const init = name ? name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "?";
  if (supplier?.logo_url) return <img src={supplier.logo_url} alt="" style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", flexShrink: 0, background: "#fff" }} />;
  return <span style={{ width: size, height: size, borderRadius: 999, background: BRAND, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 800, flexShrink: 0 }}>{init}</span>;
}

export function SupplierEditDialog({ open, tenantId, supplier, onClose, onSaved }) {
  const editing = !!supplier;
  const blank = { name: "", phone: "", contact_name: "", email: "", website: "" };
  const [vals, setVals] = useState(blank);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    setRemoveLogo(false);
    if (supplier) {
      setVals({ name: supplier.name || "", phone: supplier.phone || "", contact_name: supplier.contact_name || "", email: supplier.email || "", website: supplier.website || "" });
      setPreview(supplier.logo_url || null);
    } else {
      setVals({ ...blank, ...(readDraft() || {}) });
      setPreview(null);
    }
  }, [open, supplier?.id]);

  useEffect(() => {
    if (!file) return undefined;
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const set = (k, v) => setVals((p) => { const n = { ...p, [k]: v }; if (!editing) writeDraft(n); return n; });
  const ok = vals.name.trim() && vals.phone.trim();

  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      let logo;
      if (file) {
        try { logo = await uploadSupplierLogo(tenantId, await imageToJpegBlob(file)); } catch (e) { throw new Error(`No se pudo subir el logo: ${e?.message || e}`); }
      } else if (removeLogo) logo = null;
      const saved = editing ? await updateSupplier(supplier.id, { ...vals, logo_url: logo }) : await createSupplier(tenantId, { ...vals, logo_url: logo || null });
      if (!editing) writeDraft(null);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title={editing ? "Editar suplidor" : "Nuevo suplidor"} width={460}
      leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>}
      trailing={<TextAction bold disabled={!ok || busy} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <div className="flex items-center gap-3">
          <SupplierAvatar supplier={{ name: vals.name, logo_url: removeLogo ? null : preview }} size={64} />
          <span className="flex-1 min-w-0">
            <span className="block" style={{ fontSize: 15, fontWeight: 700 }}>Logo del suplidor</span>
            <span className="block" style={{ fontSize: 12, color: W.sub }}>Aparece en la lista para reconocerlo rápido</span>
            <span className="flex" style={{ gap: 8, marginTop: 8 }}>
              <button onClick={() => inputRef.current?.click()} className="apple-press flex items-center gap-1" style={{ padding: "5px 12px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontSize: 13, fontWeight: 700 }}><Camera className="w-3.5 h-3.5" /> {preview && !removeLogo ? "Cambiar" : "Subir foto"}</button>
              {(preview && !removeLogo) && <button onClick={() => { setFile(null); setPreview(null); setRemoveLogo(true); }} className="apple-press" style={{ padding: "5px 12px", borderRadius: 999, background: tint("#FF7373", 0.16), color: "#FF7373", fontSize: 13, fontWeight: 700 }}>Quitar</button>}
            </span>
          </span>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setRemoveLogo(false); } e.target.value = ""; }} />
        </div>
        <Input label="Nombre del suplidor *" value={vals.name} onChange={(v) => set("name", v)} autoFocus />
        <Input label="Teléfono *" value={vals.phone} onChange={(v) => set("phone", v)} inputMode="tel" />
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Opcional</p>
        <Input label="Persona de contacto" value={vals.contact_name} onChange={(v) => set("contact_name", v)} />
        <Input label="Email" value={vals.email} onChange={(v) => set("email", v)} type="email" />
        <Input label="Página online (ej: mobilesentrix.com)" value={vals.website} onChange={(v) => set("website", v)} />
        {error && <Banner color="#FF7373">{error}</Banner>}
      </div>
    </Dialog>
  );
}

export function SuppliersManagerDialog({ open, tenantId, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [delTarget, setDelTarget] = useState(null);

  const load = () => fetchSuppliers(tenantId).then((r) => { setRows(r); setError(null); }, (e) => { setError(e?.message || String(e)); setRows((p) => p || []); });
  useEffect(() => { if (open) { setRows(null); load(); } }, [open, tenantId]);

  const doDelete = async (s) => {
    try { await archiveSupplier(s.id); setRows((p) => (p || []).filter((x) => x.id !== s.id)); } catch (e) { setError(`No se pudo borrar: ${e?.message || e}`); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Suplidores" width={560} height="86dvh" trailing={<button onClick={() => setForm({})} className="apple-press flex items-center gap-1" style={{ color: BRAND, fontSize: 15, fontWeight: 600 }}><Plus className="w-4 h-4" /> Nuevo</button>} leading={<TextAction onClick={onClose}>Cerrar</TextAction>}>
        <div className="flex flex-col" style={{ gap: 10, paddingTop: 6 }}>
          {error && <Banner color="#FF7373" onDismiss={() => setError(null)}>{error}</Banner>}
          {rows === null ? <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: W.sub }} /></div>
            : !rows.length ? <div className="flex flex-col items-center text-center" style={{ padding: "40px 16px", gap: 8, color: W.sub }}><Store className="w-8 h-8" /><b style={{ color: "#fff" }}>Sin suplidores</b><span>Crea tu primer suplidor para empezar</span></div>
              : (
                <div style={{ borderRadius: 14, background: "#2C2C2E", overflow: "hidden" }}>
                  {rows.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3" style={{ padding: "10px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                      <SupplierAvatar supplier={s} size={44} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                        <span className="flex items-center gap-1 truncate" style={{ fontSize: 12, color: W.sub }}>{s.website && <Globe className="w-3 h-3" />}{[s.phone, s.contact_name].filter(Boolean).join(" · ") || s.website || ""}</span>
                      </span>
                      <button onClick={() => setForm(s)} aria-label={`Editar ${s.name}`} className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDelTarget(s)} aria-label={`Borrar ${s.name}`} className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: tint("#FF7373", 0.16), color: "#FF7373", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
        </div>
      </Dialog>
      <SupplierEditDialog open={!!form} tenantId={tenantId} supplier={form && form.id ? form : null} onClose={() => setForm(null)} onSaved={() => load()} />
      <AlertDialog open={!!delTarget} title={`¿Borrar ${delTarget?.name || ""}?`} message="Las órdenes ya creadas mantienen el suplidor. Solo se oculta para nuevas compras." onClose={() => setDelTarget(null)}
        actions={[{ label: "Cancelar" }, { label: "Borrar suplidor", destructive: true, onPress: () => delTarget && doDelete(delTarget) }]} />
    </>
  );
}
