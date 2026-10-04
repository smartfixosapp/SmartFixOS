import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Plus, Camera, Loader2, ScanBarcode, Check, ChevronRight, Smartphone, Tablet, Laptop, Watch, Gamepad2, Headphones, Monitor, Tv, Printer, Video, Plane, HelpCircle, ArrowRight } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { searchModels, createCategory, createBrand, createFamily, createModel, saveModelPhoto } from "@/lib/wizard/api";
import { IOS, categoryKind, naturalCompare, problemSuggestions, toggleProblemText, similarName } from "@/lib/wizard/helpers";
import { tacLookup } from "@/lib/wizard/tac";
import { Caption, Chip, Input, W } from "./ui";

const KIND_ICON = { phone: Smartphone, tablet: Tablet, desktop: Monitor, computer: Laptop, watch: Watch, console: Gamepad2, audio: Headphones, tv: Tv, printer: Printer, camera: Video, drone: Plane, other: HelpCircle };

function NodeCard({ title, subtitle, badge, Icon, image, onClick, onCamera, selected, dashed }) {
  return (
    <div className="relative">
      <button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left" style={{ height: 76, padding: "0 14px", borderRadius: 20, background: dashed ? "transparent" : W.card, border: dashed ? `1.5px dashed ${tint(IOS.orange, 0.6)}` : `1px solid ${selected ? tint(IOS.pink, 0.6) : "transparent"}` }}>
        {image ? <img src={image} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} /> : (
          <span style={{ width: 42, height: 42, borderRadius: 12, background: tint(dashed ? IOS.orange : IOS.pink, 0.15), color: dashed ? IOS.orange : IOS.pink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 17, fontWeight: 700 }}>
            {Icon ? <Icon className="w-5 h-5" /> : String(title || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block" style={{ fontSize: 15, fontWeight: 600, color: dashed ? IOS.orange : "#fff", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{title}</span>
          {subtitle && <span className="block" style={{ fontSize: 12, color: W.sub }}>{subtitle}</span>}
        </span>
        {badge && <ChevronRight className="w-4 h-4" style={{ color: W.ter }} />}
      </button>
      {onCamera && <button onClick={onCamera} aria-label="Foto del modelo" className="absolute" style={{ right: 10, top: 10, width: 26, height: 26, borderRadius: 999, background: IOS.orange, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Camera className="w-3.5 h-3.5" /></button>}
    </div>
  );
}

function AddSheet({ level, ctx, prefill, onClose, onSave }) {
  const cfg = {
    category: { title: "Añadir tipo", fields: [["Tipo nuevo *", "Ej: Disco Duro, Smartwatch…"], ["Marca (opcional)"], ["Familia / Línea (opcional)"], ["Modelo (opcional)"]], existing: ctx.categories.map((c) => c.name) },
    brand: { title: "Añadir marca", fields: [[`Marca nueva * para ${ctx.category?.name || ""}`], ["Familia / Línea (opcional)"], ["Modelo (opcional)"]], existing: ctx.brandNames },
    family: { title: "Añadir familia", fields: [[`Familia nueva * para ${ctx.brand?.name || ""}`], ["Modelo (opcional)"]], existing: ctx.families.map((f) => f.name) },
    model: { title: "Añadir modelo", fields: [[`Modelo nuevo * para ${ctx.family?.name || ""}`]], existing: ctx.models.map((m) => m.name) },
  }[level];
  const [vals, setVals] = useState(() => cfg.fields.map((_, i) => (prefill && i === cfg.fields.length - 1 ? prefill : "")));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const similar = similarName(vals[0], cfg.existing);
  const save = async () => {
    if (!vals[0].trim() || busy) return;
    setBusy(true);
    setError(null);
    try { await onSave(vals.map((v) => v.trim())); onClose(); } catch (e) { setError(e?.message || String(e)); }
    setBusy(false);
  };
  return (
    <Dialog open onClose={onClose} title={cfg.title} width={460} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={!vals[0].trim() || busy} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        {cfg.fields.map(([label, ph], i) => <Input key={label} label={label} value={vals[i]} onChange={(v) => setVals((p) => p.map((x, j) => (j === i ? v : x)))} placeholder={ph} autoFocus={i === 0} />)}
        {similar && <p className="flex items-center gap-2" style={{ fontSize: 13, color: IOS.orange }}>Ya existe: {similar} <button onClick={() => { onSave(null, similar); onClose(); }} style={{ fontWeight: 700, textDecoration: "underline" }}>Usar ese</button></p>}
        {error && <p style={{ fontSize: 13, color: IOS.red }}><b>No se pudo guardar</b> {error}</p>}
        <p style={{ fontSize: 12, color: W.sub }}>Lo añadido queda guardado en tu catálogo y aparecerá automáticamente en próximas órdenes.</p>
      </div>
    </Dialog>
  );
}

function ModelPhotoSheet({ model, tenantId, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const save = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try { const url = await saveModelPhoto(tenantId, model.id, file); onSaved(model.id, url); onClose(); } catch { setError("No se pudo obtener la foto. Prueba con otra imagen."); }
    setBusy(false);
  };
  return (
    <Dialog open onClose={onClose} title="Foto del modelo" width={440} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={!file || busy} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        <Caption>Modelo</Caption>
        <p style={{ fontSize: 16, fontWeight: 600 }}>{model.name}</p>
        <Caption>Foto</Caption>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button onClick={() => inputRef.current?.click()} className="apple-press flex items-center gap-2" style={{ padding: 14, borderRadius: 12, background: W.card2, color: IOS.orange, fontWeight: 600 }}><Camera className="w-4 h-4" /> {file ? file.name : "Elegir de Fotos / cámara"}</button>
        {error && <p style={{ fontSize: 13, color: IOS.red }}>{error}</p>}
      </div>
    </Dialog>
  );
}

function ImeiSheet({ onClose, onUse }) {
  const [imei, setImei] = useState("");
  const digits = imei.replace(/\D/g, "");
  const hit = digits.length >= 8 ? tacLookup(digits) : null;
  return (
    <Dialog open onClose={onClose} title="Identificar por IMEI" width={440} leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        <Input value={imei} onChange={setImei} placeholder="IMEI" inputMode="numeric" mono autoFocus />
        {digits.length >= 8 && (hit ? (
          <div className="flex flex-col" style={{ gap: 8 }}>
            <p style={{ fontSize: 17, fontWeight: 700 }}>{hit.brand} {hit.model}</p>
            <button onClick={() => { onUse(`${hit.brand} ${hit.model}`); onClose(); }} className="apple-press" style={{ padding: "10px 14px", borderRadius: 12, background: IOS.orange, color: "#fff", fontWeight: 700 }}>Usar esta marca en la búsqueda</button>
          </div>
        ) : <p style={{ fontSize: 13, color: W.sub }}>No identificamos este equipo automáticamente — puedes seguir con la búsqueda manual.</p>)}
        <p style={{ fontSize: 12, color: W.sub }}>Marca *#06# en el teléfono para verlo, o búscalo en la caja del equipo.</p>
      </div>
    </Dialog>
  );
}

export default function StepDevice({ w, tenantId, cat, index, chips, onCatalogChange, autoAdvancing, onPicked, onCancelAdvance, onOverlay }) {
  const { s, set } = w;
  const [query, setQuery] = useState("");
  const [add, setAdd] = useState(null);
  const [addPrefill, setAddPrefill] = useState("");
  const [photoFor, setPhotoFor] = useState(null);
  const [imeiOpen, setImeiOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  const brandNamesFor = (categoryId) => [...new Set(cat.brands.filter((b) => b.category_id === categoryId).map((b) => String(b.name || "").trim()).filter(Boolean))].sort(naturalCompare);
  const families = useMemo(() => (s.brand ? cat.families.filter((f) => f.brand_id === s.brand.id) : []), [cat.families, s.brand]);
  const models = useMemo(() => (s.family ? cat.models.filter((m) => m.family_id === s.family.id) : []), [cat.models, s.family]);
  const brandNames = s.category ? brandNamesFor(s.category.id) : [];
  const results = useMemo(() => searchModels(index, query), [index, query]);
  const modelCount = (predicate) => cat.models.filter(predicate).length;

  const pickCategory = (c) => {
    const names = brandNamesFor(c.id);
    const patch = { category: c, brand: null, family: null, model: null, customModelText: "", stoppedEarly: false };
    if (names.length === 1) {
      const b = cat.brands.find((x) => String(x.name || "").trim() === names[0] && x.category_id === c.id);
      if (b) {
        patch.brand = b;
        const fams = cat.families.filter((f) => f.brand_id === b.id);
        if (fams.length === 1) patch.family = fams[0];
      }
    }
    set(patch);
  };
  const pickBrandName = (name) => {
    const b = cat.brands.find((x) => String(x.name || "").trim() === name && x.category_id === s.category?.id);
    if (!b) return;
    const fams = cat.families.filter((f) => f.brand_id === b.id);
    set({ brand: b, family: fams.length === 1 ? fams[0] : null, model: null, customModelText: "", stoppedEarly: false });
  };
  const pickFamily = (f) => set({ family: f, model: null, customModelText: "", stoppedEarly: false });
  const pickModel = (m) => { set({ model: m, customModelText: "" }); onPicked?.(); };
  const pickMatch = (m) => { set({ category: m.category, brand: m.brand, family: m.family, model: m.model, customModelText: "", stoppedEarly: false }); setQuery(""); onPicked?.(); };

  const level = !s.category ? "category" : !s.brand ? "brand" : !s.family ? "family" : "model";
  const complete = !!(s.category && s.brand && (s.stoppedEarly || s.model || s.customModelText || (s.family && models.length === 0)));
  const reset = (from) => {
    onCancelAdvance?.();
    const order = ["category", "brand", "family", "model"];
    const i = order.indexOf(from);
    set({ category: i <= 0 ? null : s.category, brand: i <= 1 ? null : s.brand, family: i <= 2 ? null : s.family, model: null, customModelText: "", stoppedEarly: false });
  };

  const saveAdd = async (vals, useExisting) => {
    const lvl = add;
    if (vals === null) {
      if (lvl === "category") { const c = cat.categories.find((x) => x.name === useExisting); if (c) pickCategory(c); }
      if (lvl === "brand") pickBrandName(useExisting);
      if (lvl === "family") { const f = families.find((x) => x.name === useExisting); if (f) pickFamily(f); }
      if (lvl === "model") { const m = models.find((x) => x.name === useExisting); if (m) pickModel(m); }
      return;
    }
    const [v0, v1, v2, v3] = vals;
    let category = s.category; let brand = s.brand; let family = s.family; let model = null;
    let customText = s.customModelText;
    const next = { categories: [...cat.categories], brands: [...cat.brands], families: [...cat.families], models: [...cat.models] };
    let created = 0;
    let failure = null;
    try {
      if (lvl === "category") { category = await createCategory(v0); next.categories.push(category); created += 1; brand = null; family = null; }
      if (lvl === "category" && v1) { brand = await createBrand(v1, category.id, tenantId); next.brands.push(brand); created += 1; }
      if (lvl === "brand") { brand = await createBrand(v0, category.id, tenantId); next.brands.push(brand); created += 1; family = null; }
      const famName = lvl === "category" ? v2 : lvl === "brand" ? v1 : lvl === "family" ? v0 : "";
      if (famName && brand) { family = await createFamily(famName, brand.id, tenantId); next.families.push(family); created += 1; }
      const modName = lvl === "category" ? v3 : lvl === "brand" ? v2 : lvl === "family" ? v1 : v0;
      if (modName && family) {
        try { model = await createModel(modName, family.id, tenantId); next.models.push(model); created += 1; } catch {
          customText = modName;
          setNotice(`No se pudo guardar el modelo «${modName}» en el catálogo; se usará como texto en la orden.`);
        }
      }
    } catch (e) {
      failure = e;
    }
    if (created > 0) {
      onCatalogChange(next);
      set({ category, brand, family, model, customModelText: model ? "" : customText, stoppedEarly: false });
      if (query.trim()) setQuery("");
      if (model) onPicked?.();
    }
    if (failure) {
      if (created === 0) throw failure;
      setNotice(`Se guardó solo una parte del catálogo: ${failure?.message || failure}. Añade lo que falte.`);
    }
  };

  useEffect(() => { onOverlay?.(!!(add || photoFor || imeiOpen)); }, [add, photoFor, imeiOpen]);
  useEffect(() => () => onOverlay?.(false), []);

  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(null), 3000); return () => clearTimeout(t); } return undefined; }, [notice]);

  const trail = [["Tipo", s.category?.name, "category"], ["Marca", s.brand?.name, "brand"], ["Familia", s.family?.name, "family"], ["Modelo", s.model?.name || s.customModelText, "model"]].filter((x) => x[1]);

  const grid = (children) => <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))" }}>{children}</div>;
  const caption = { category: "TIPO DE EQUIPO", brand: "MARCA", family: "FAMILIA", model: "MODELO" }[level];

  const suggestions = s.category ? problemSuggestions(s.category).slice(0, 6) : [];
  const selectedProblems = (t) => s.problem.toLowerCase().includes(t.toLowerCase());

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {trail.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          {trail.map(([label, value, k]) => (
            <button key={k} onClick={() => reset(k)} className="apple-press flex items-center gap-2" style={{ padding: "6px 8px 6px 14px", borderRadius: 999, background: W.card, fontSize: 14 }}>
              <span style={{ color: W.sub, fontSize: 11 }}>{label}</span> <b>{value}</b>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: IOS.orange, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-3 h-3" strokeWidth={3} /></span>
            </button>
          ))}
        </div>
      )}
      {!complete && (
        <>
          {!s.category && (
            <>
              <p style={{ fontSize: 14, color: W.sub }}>Toca el equipo o busca abajo</p>
              {chips.length > 0 && (
                <div className="flex overflow-x-auto" style={{ gap: 8, paddingBottom: 4 }}>
                  {chips.map((c) => <Chip key={c.match.model.id} label={c.match.model.name} color={IOS.pink} onClick={() => pickMatch(c.match)} Icon={c.fromCustomer ? Check : undefined} />)}
                </div>
              )}
            </>
          )}
          <label className="flex items-center gap-2" style={{ height: 46, padding: "0 14px", borderRadius: 12, background: W.card }}>
            <Search className="w-4 h-4" style={{ color: W.sub }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar modelo (ej. iPhone 13, Galaxy S23)..." aria-label="Buscar modelo" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 16, minWidth: 0 }} />
            {query && <button onClick={() => setQuery("")} aria-label="Limpiar" style={{ color: W.sub }}><X className="w-4 h-4" /></button>}
            <span style={{ width: 1, height: 22, background: W.sep }} />
            <button onClick={() => setImeiOpen(true)} aria-label="Identificar por IMEI" style={{ color: W.sub }}><ScanBarcode className="w-5 h-5" /></button>
          </label>
          {query.trim() ? (
            results.length ? (
              <div style={{ borderRadius: 16, background: W.card, overflow: "hidden" }}>
                {results.map((m, i) => (
                  <button key={m.model.id} onClick={() => pickMatch(m)} className="w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
                    <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 700 }}>{m.model.name}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{m.brand.name} · {m.family.name}</span></span>
                    <ChevronRight className="w-4 h-4" style={{ color: W.ter }} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-start" style={{ gap: 10 }}>
                <p style={{ fontSize: 15, color: W.sub }}>Sin resultados para “{query.trim()}”</p>
                {s.category ? <button onClick={() => { setAddPrefill(query.trim()); setAdd(level); }} className="apple-press" style={{ padding: "10px 14px", borderRadius: 12, background: tint(IOS.orange, 0.15), color: IOS.orange, fontWeight: 700 }}>Añadir «{query.trim()}» como modelo nuevo</button>
                  : <p style={{ fontSize: 13, color: W.sub }}>Escoge el tipo de equipo abajo para añadirlo como modelo nuevo.</p>}
                {w.canAdvance(2) && <button onClick={() => set({ stoppedEarly: true })} style={{ fontSize: 14, color: IOS.orange, textDecoration: "underline" }}>Seguir sin especificar el modelo</button>}
              </div>
            )
          ) : (
            <>
              <Caption>{caption}</Caption>
              {level === "category" && grid(<>
                {cat.categories.map((c) => { const k = categoryKind(c); const n = modelCount((m) => { const f = cat.families.find((x) => x.id === m.family_id); const b = f && cat.brands.find((x) => x.id === f.brand_id); return b?.category_id === c.id; }); return <NodeCard key={c.id} title={c.name} subtitle={n === 0 ? "vacío" : null} Icon={KIND_ICON[k]} onClick={() => pickCategory(c)} badge />; })}
                <NodeCard dashed title="Añadir" Icon={Plus} onClick={() => setAdd("category")} />
              </>)}
              {level === "brand" && grid(<>
                {brandNames.map((n) => <NodeCard key={n} title={n} onClick={() => pickBrandName(n)} badge />)}
                <NodeCard dashed title="Añadir" Icon={Plus} onClick={() => setAdd("brand")} />
              </>)}
              {level === "family" && grid(<>
                {families.map((f) => <NodeCard key={f.id} title={f.name} subtitle={modelCount((m) => m.family_id === f.id) === 0 ? "vacío" : null} onClick={() => pickFamily(f)} badge />)}
                <NodeCard dashed title="Añadir" Icon={Plus} onClick={() => setAdd("family")} />
              </>)}
              {level === "model" && grid(<>
                {models.map((m) => <NodeCard key={m.id} title={m.name} image={cat.photoByModel[m.id]} onClick={() => pickModel(m)} onCamera={cat.photoByModel[m.id] ? null : () => setPhotoFor(m)} selected={s.model?.id === m.id} />)}
                <NodeCard dashed title="Añadir" Icon={Plus} onClick={() => setAdd("model")} />
              </>)}
              {(level === "family" || level === "model") && <button onClick={() => set({ stoppedEarly: true })} className="self-start" style={{ fontSize: 14, color: IOS.orange, textDecoration: "underline" }}>Seguir sin especificar {level === "family" ? "la familia" : "el modelo"}</button>}
            </>
          )}
        </>
      )}
      {complete && (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <div className="flex items-center gap-3" style={{ padding: 14, borderRadius: 16, background: tint(IOS.green, 0.1), border: `1px solid ${tint(IOS.green, 0.3)}` }}>
            {s.model && cat.photoByModel[s.model.id] ? <img src={cat.photoByModel[s.model.id]} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: "cover" }} /> : <span style={{ width: 46, height: 46, borderRadius: 12, background: tint(IOS.green, 0.2), color: IOS.green, display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-6 h-6" /></span>}
            <span className="flex-1 min-w-0">
              {autoAdvancing && <span className="block" style={{ fontSize: 11, color: IOS.green, fontWeight: 600 }}>Equipo escogido</span>}
              <span className="block truncate" style={{ fontSize: 17, fontWeight: 700 }}>{s.model?.name || s.customModelText || s.family?.name || s.brand?.name || s.category?.name || "Sin especificar"}</span>
              <span className="block truncate" style={{ fontSize: 12, color: W.sub }}>{[s.category?.name, s.brand?.name, s.family?.name].filter(Boolean).join(" · ")}</span>
            </span>
            <button onClick={() => { onCancelAdvance?.(); set({ category: null, brand: null, family: null, model: null, customModelText: "", stoppedEarly: false }); }} className="apple-press" style={{ padding: "6px 14px", borderRadius: 999, background: tint(IOS.orange, 0.15), color: IOS.orange, fontSize: 13, fontWeight: 700 }}>Cambiar</button>
            {s.model && !cat.photoByModel[s.model.id] && <button onClick={() => setPhotoFor(s.model)} aria-label="Foto del modelo" style={{ width: 30, height: 30, borderRadius: 999, background: IOS.orange, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Camera className="w-4 h-4" /></button>}
          </div>
          {autoAdvancing && <div style={{ height: 4, borderRadius: 999, background: tint(IOS.green, 0.2), overflow: "hidden" }}><div style={{ height: "100%", background: IOS.green, animation: "wizprog 1.1s linear forwards" }} /><style>{"@keyframes wizprog{from{width:0}to{width:100%}}"}</style></div>}
          {autoAdvancing && <p className="flex items-center gap-1.5" style={{ fontSize: 12, color: W.sub }}>Pasando al siguiente paso… <ArrowRight className="w-3 h-3" /></p>}
          {suggestions.length > 0 && (
            <div className="flex flex-col" style={{ gap: 6 }}>
              <Caption style={{ paddingTop: 6 }}>Problema más común</Caption>
              {suggestions.map((t) => {
                const on = selectedProblems(t);
                return (
                  <button key={t} onClick={() => set((p) => ({ problem: toggleProblemText(p.problem, t) }))} className="apple-press flex items-center gap-3 text-left" style={{ padding: "11px 14px", borderRadius: 12, background: on ? tint(IOS.orange, 0.12) : W.card }}>
                    <span className="flex-1" style={{ fontSize: 15 }}>{t}</span>
                    {on ? <Check className="w-4 h-4" style={{ color: IOS.orange }} /> : <Plus className="w-4 h-4" style={{ color: W.sub }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {notice && <p style={{ fontSize: 13, color: IOS.orange }}>{notice}</p>}
      {add && <AddSheet level={add} prefill={addPrefill} ctx={{ categories: cat.categories, category: s.category, brand: s.brand, family: s.family, brandNames, families, models }} onClose={() => { setAdd(null); setAddPrefill(""); }} onSave={saveAdd} />}
      {photoFor && <ModelPhotoSheet model={photoFor} tenantId={tenantId} onClose={() => setPhotoFor(null)} onSaved={(id, url) => onCatalogChange({ ...cat, photoByModel: { ...cat.photoByModel, [id]: url } })} />}
      {imeiOpen && <ImeiSheet onClose={() => setImeiOpen(false)} onUse={(t) => setQuery(t)} />}
    </div>
  );
}
