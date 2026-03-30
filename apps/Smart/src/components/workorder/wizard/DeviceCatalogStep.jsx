// === DeviceCatalogStep.jsx ===
// Versión mejorada — grid visual, breadcrumb, animaciones, búsqueda, frecuentes, auto-avance

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Pencil, Wand2, Search, Star,
  Smartphone, Laptop, Tablet, Watch, Monitor,
  Printer, Camera, Headphones, Cpu, Package,
  ChevronRight, Zap, Shield, Battery, Wifi,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

/* ─── Brand colors ────────────────────────────────────────────── */
const BRAND_STYLES = {
  apple:    { bg: "#1c1c1e", border: "#48484a", text: "#f2f2f7" },
  samsung:  { bg: "#0c2340", border: "#1428a0", text: "#e8f0ff" },
  google:   { bg: "#1a3c5e", border: "#4285f4", text: "#e8f0fe" },
  huawei:   { bg: "#c0001c", border: "#ff2040", text: "#fff" },
  xiaomi:   { bg: "#ff6900", border: "#ff9234", text: "#fff" },
  lg:       { bg: "#a50034", border: "#d0003e", text: "#fff" },
  motorola: { bg: "#003087", border: "#0064d3", text: "#e0eaff" },
  sony:     { bg: "#1a1a2e", border: "#4a4a6e", text: "#e0e0f0" },
  microsoft:{ bg: "#00188f", border: "#0078d4", text: "#e8f4ff" },
  dell:     { bg: "#007db8", border: "#00a5e0", text: "#fff" },
  hp:       { bg: "#0096d6", border: "#30b9f5", text: "#fff" },
  lenovo:   { bg: "#e2231a", border: "#ff4f44", text: "#fff" },
  asus:     { bg: "#00539b", border: "#007eff", text: "#e0f0ff" },
  acer:     { bg: "#83b81a", border: "#a8d62c", text: "#fff" },
  oneplus:  { bg: "#eb0029", border: "#ff2244", text: "#fff" },
  oppo:     { bg: "#1d7340", border: "#2ea860", text: "#e0fff0" },
};

const getBrandStyle = (name) => {
  if (!name) return null;
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(BRAND_STYLES)) {
    if (key.includes(k)) return v;
  }
  return null;
};

/* ─── Device type icons ───────────────────────────────────────── */
const TYPE_ICON_MAP = {
  smartphone: Smartphone, celular: Smartphone, teléfono: Smartphone, telefono: Smartphone,
  laptop: Laptop, portátil: Laptop, portatil: Laptop,
  tablet: Tablet, ipad: Tablet,
  watch: Watch, reloj: Watch, smartwatch: Watch,
  monitor: Monitor, desktop: Monitor, computadora: Monitor, pc: Monitor,
  printer: Printer, impresora: Printer,
  camera: Camera, cámara: Camera, camara: Camera,
  headphones: Headphones, audífonos: Headphones, audifonos: Headphones,
  cpu: Cpu, "all in one": Monitor,
};

const getTypeIcon = (name) => {
  if (!name) return Package;
  const key = name.toLowerCase();
  for (const [k, Icon] of Object.entries(TYPE_ICON_MAP)) {
    if (key.includes(k)) return Icon;
  }
  return Package;
};

/* ─── Slide animation helper ─────────────────────────────────── */
const SlideIn = ({ children, keyProp }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, [keyProp]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(18px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
      }}
    >
      {children}
    </div>
  );
};

/* ─── Inline edit panel ──────────────────────────────────────── */
const InlineEditPanel = ({ title, value, onChange, onConfirm, onCancel, confirmLabel }) => (
  <div className="mt-4 bg-black/70 border border-white/10 rounded-xl p-3 space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-xs text-white font-semibold">{title}</p>
      <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-white">
        Cerrar
      </button>
    </div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onConfirm()}
      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500/60"
      placeholder="Ej. Apple"
      autoFocus
    />
    <Button type="button" onClick={onConfirm} size="sm" className="bg-red-600 hover:bg-red-700">
      {confirmLabel}
    </Button>
  </div>
);

/* ═══════════════════════════════════════════════════════════════ */
export default function DeviceCatalogStep({ formData, updateFormData }) {
  /* ── Remote data ─────────────────────────────────────────── */
  const [types,    setTypes]    = useState([]);
  const [brands,   setBrands]   = useState([]);
  const [families, setFamilies] = useState([]);
  const [models,   setModels]   = useState([]);

  const [loadingTypes,    setLoadingTypes]    = useState(false);
  const [loadingBrands,   setLoadingBrands]   = useState(false);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [loadingModels,   setLoadingModels]   = useState(false);

  /* ── Usage frecuency ─────────────────────────────────────── */
  const [brandUsage, setBrandUsage] = useState({});

  /* ── Search ──────────────────────────────────────────────── */
  const [brandSearch,  setBrandSearch]  = useState("");
  const [familySearch, setFamilySearch] = useState("");
  const [modelSearch,  setModelSearch]  = useState("");

  /* ── Inline edit / create ────────────────────────────────── */
  const [editingBrand,     setEditingBrand]     = useState(null);
  const [editingBrandName, setEditingBrandName] = useState("");
  const [addingBrand,      setAddingBrand]      = useState(false);
  const [newBrandName,     setNewBrandName]      = useState("");

  const [editingFamily,     setEditingFamily]     = useState(null);
  const [editingFamilyName, setEditingFamilyName] = useState("");
  const [addingFamily,      setAddingFamily]      = useState(false);
  const [newFamilyName,     setNewFamilyName]      = useState("");

  const [editingModel,     setEditingModel]     = useState(null);
  const [editingModelName, setEditingModelName] = useState("");
  const [addingModel,      setAddingModel]      = useState(false);
  const [newModelName,     setNewModelName]      = useState("");

  /* ── Load on mount ───────────────────────────────────────── */
  useEffect(() => {
    loadTypes();
    loadBrands();
    loadBrandUsage();
  }, []);

  useEffect(() => {
    if (formData.device_brand) {
      loadFamiliesForBrand(formData.device_brand);
      updateFormData("device_family", "");
      updateFormData("device_model", "");
    } else {
      setFamilies([]);
      setModels([]);
    }
    setBrandSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.device_brand]);

  useEffect(() => {
    if (formData.device_brand && formData.device_family) {
      loadModelsForBrandAndFamily(formData.device_brand, formData.device_family);
    } else {
      setModels([]);
    }
    setFamilySearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.device_family]);

  /* ── Auto-advance: single family or single model ─────────── */
  useEffect(() => {
    if (
      families.length === 1 &&
      !loadingFamilies &&
      formData.device_brand &&
      !formData.device_family
    ) {
      updateFormData("device_family", families[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [families, loadingFamilies]);

  useEffect(() => {
    if (
      models.length === 1 &&
      !loadingModels &&
      formData.device_family &&
      !formData.device_model
    ) {
      updateFormData("device_model", models[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, loadingModels]);

  /* ── Loaders ─────────────────────────────────────────────── */
  const loadTypes = async () => {
    setLoadingTypes(true);
    try {
      const rows = await base44.entities.DeviceCategory.filter({}, "name");
      setTypes(rows || []);
    } catch (e) { console.warn(e); }
    finally { setLoadingTypes(false); }
  };

  const loadBrands = async () => {
    setLoadingBrands(true);
    try {
      const rows = await base44.entities.Brand.filter({}, "name");
      setBrands(rows || []);
    } catch (e) { console.warn(e); }
    finally { setLoadingBrands(false); }
  };

  const loadBrandUsage = async () => {
    try {
      const orders = await base44.entities.Order.filter({}, "device_brand");
      const counts = {};
      for (const o of orders || []) {
        if (o.device_brand) counts[o.device_brand] = (counts[o.device_brand] || 0) + 1;
      }
      setBrandUsage(counts);
    } catch { /* noop */ }
  };

  const loadFamiliesForBrand = async (brandName) => {
    setLoadingFamilies(true);
    try {
      const rows = await base44.entities.DeviceFamily?.filter?.({ brand: brandName }, "name");
      setFamilies(rows || []);
    } catch (e) { console.warn(e); setFamilies([]); }
    finally { setLoadingFamilies(false); }
  };

  const loadModelsForBrandAndFamily = async (brandName, familyName) => {
    setLoadingModels(true);
    try {
      const rows = await base44.entities.DeviceModel.filter(
        { brand: brandName, family: familyName }, "name"
      );
      setModels(rows || []);
    } catch (e) { console.warn(e); setModels([]); }
    finally { setLoadingModels(false); }
  };

  /* ── Selects ─────────────────────────────────────────────── */
  const handleSelectType  = (t) => { updateFormData("device_type", t.name); updateFormData("device_subcategory", t.name); };
  const handleSelectBrand = (b) => { updateFormData("device_brand", b.name); };
  const handleSelectFamily= (f) => { updateFormData("device_family", f.name); };
  const handleSelectModel = (m) => { updateFormData("device_model", m.name); };

  /* ── Brand CRUD ──────────────────────────────────────────── */
  const saveBrand = async () => {
    if (!editingBrandName.trim() || !editingBrand?.id) return;
    try {
      await base44.entities.Brand.update(editingBrand.id, { name: editingBrandName.trim() });
      await loadBrands();
      if (formData.device_brand === editingBrand.name) updateFormData("device_brand", editingBrandName.trim());
      setEditingBrand(null); setEditingBrandName("");
    } catch { alert("No se pudo guardar la marca"); }
  };
  const createBrand = async () => {
    if (!newBrandName.trim()) return;
    try {
      await base44.entities.Brand.create({ name: newBrandName.trim() });
      await loadBrands();
      updateFormData("device_brand", newBrandName.trim());
      setNewBrandName(""); setAddingBrand(false);
    } catch { alert("No se pudo crear la marca"); }
  };

  /* ── Family CRUD ─────────────────────────────────────────── */
  const saveFamily = async () => {
    if (!editingFamilyName.trim() || !editingFamily?.id) return;
    try {
      await base44.entities.DeviceFamily.update(editingFamily.id, { name: editingFamilyName.trim() });
      await loadFamiliesForBrand(formData.device_brand);
      if (formData.device_family === editingFamily.name) updateFormData("device_family", editingFamilyName.trim());
      setEditingFamily(null); setEditingFamilyName("");
    } catch { alert("No se pudo guardar la familia"); }
  };
  const createFamily = async () => {
    if (!newFamilyName.trim()) return;
    if (!formData.device_brand) { alert("Primero selecciona una marca"); return; }
    try {
      await base44.entities.DeviceFamily.create({ name: newFamilyName.trim(), brand: formData.device_brand });
      await loadFamiliesForBrand(formData.device_brand);
      updateFormData("device_family", newFamilyName.trim());
      setNewFamilyName(""); setAddingFamily(false);
    } catch { alert("No se pudo crear la familia"); }
  };

  /* ── Model CRUD ──────────────────────────────────────────── */
  const saveModel = async () => {
    if (!editingModelName.trim() || !editingModel?.id) return;
    try {
      await base44.entities.DeviceModel.update(editingModel.id, { name: editingModelName.trim() });
      await loadModelsForBrandAndFamily(formData.device_brand, formData.device_family);
      if (formData.device_model === editingModel.name) updateFormData("device_model", editingModelName.trim());
      setEditingModel(null); setEditingModelName("");
    } catch { alert("No se pudo guardar el modelo"); }
  };
  const createModel = async () => {
    if (!newModelName.trim()) return;
    if (!formData.device_brand)  { alert("Primero selecciona una marca"); return; }
    if (!formData.device_family) { alert("Primero selecciona la línea"); return; }
    try {
      await base44.entities.DeviceModel.create({
        name: newModelName.trim(), brand: formData.device_brand, family: formData.device_family,
      });
      await loadModelsForBrandAndFamily(formData.device_brand, formData.device_family);
      updateFormData("device_model", newModelName.trim());
      setNewModelName(""); setAddingModel(false);
    } catch { alert("No se pudo crear el modelo"); }
  };

  /* ── Quick services ──────────────────────────────────────── */
  const handleQuickService = (name) => updateFormData("initial_problem", name);

  /* ── Derived: sorted + filtered brands ──────────────────── */
  const sortedBrands = [...brands].sort((a, b) => (brandUsage[b.name] || 0) - (brandUsage[a.name] || 0));
  const filteredBrands  = sortedBrands.filter(b => !brandSearch  || b.name.toLowerCase().includes(brandSearch.toLowerCase()));
  const filteredFamilies= families.filter(f => !familySearch || f.name.toLowerCase().includes(familySearch.toLowerCase()));
  const filteredModels  = models.filter(m => !modelSearch   || m.name.toLowerCase().includes(modelSearch.toLowerCase()));

  /* ── Breadcrumb ──────────────────────────────────────────── */
  const crumbs = [
    formData.device_type   && { label: formData.device_type },
    formData.device_brand  && { label: formData.device_brand },
    formData.device_family && { label: formData.device_family },
    formData.device_model  && { label: formData.device_model },
  ].filter(Boolean);

  const selectionComplete = !!(formData.device_type && formData.device_brand && formData.device_model);

  /* ═══════════════ RENDER ════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Breadcrumb sticky ─────────────────────────────── */}
      {crumbs.length > 0 && (
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 px-4 py-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest mr-1">Selección</span>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: i === crumbs.length - 1 ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.08)",
                  color: i === crumbs.length - 1 ? "#fca5a5" : "#d1d5db",
                  border: `1px solid ${i === crumbs.length - 1 ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {c.label}
              </span>
              {i < crumbs.length - 1 && <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />}
            </React.Fragment>
          ))}
          {selectionComplete && (
            <span className="ml-auto text-[10px] text-green-400 font-semibold">✓ Completo</span>
          )}
        </div>
      )}

      {/* ── 1. Tipo de dispositivo ────────────────────────── */}
      <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-3">1. Tipo de dispositivo</h2>
        {loadingTypes ? (
          <p className="text-gray-400 text-sm animate-pulse">Cargando tipos…</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {types.map((t) => {
              const active = formData.device_type === t.name || formData.device_subcategory === t.name;
              const Icon = getTypeIcon(t.name);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectType(t)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all duration-200 ${
                    active
                      ? "bg-red-600/30 border-red-400/60 text-red-200 scale-[1.03]"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "text-red-400" : "text-gray-400"}`} />
                  <span className="text-center leading-tight">{t.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 2. Marca ──────────────────────────────────────── */}
      <SlideIn keyProp="brands-always">
        <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white mb-3">2. Marca</h2>

          {/* Search (show when > 6 brands) */}
          {brands.length > 6 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Buscar marca…"
                className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-red-500/60 placeholder:text-gray-600"
              />
            </div>
          )}

          {loadingBrands ? (
            <p className="text-gray-400 text-sm animate-pulse">Cargando marcas…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredBrands.map((b) => {
                const active = formData.device_brand === b.name;
                const style = getBrandStyle(b.name);
                const usageCount = brandUsage[b.name] || 0;
                const isFrequent = usageCount >= 3;

                return (
                  <div key={b.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => handleSelectBrand(b)}
                      className={`relative w-full flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 overflow-hidden ${
                        active ? "scale-[1.03] ring-2 ring-red-400/60" : "hover:scale-[1.02]"
                      }`}
                      style={
                        style
                          ? {
                              background: active
                                ? `linear-gradient(135deg, ${style.bg} 0%, ${style.border}55 100%)`
                                : style.bg,
                              borderColor: active ? style.border : `${style.border}60`,
                              color: style.text,
                            }
                          : {
                              background: active ? "rgba(220,38,38,0.25)" : "rgba(255,255,255,0.05)",
                              borderColor: active ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.1)",
                              color: "#f3f4f6",
                            }
                      }
                    >
                      {/* Shimmer on active */}
                      {active && (
                        <span
                          className="absolute inset-0 opacity-10 pointer-events-none"
                          style={{ background: "linear-gradient(135deg, white 0%, transparent 60%)" }}
                        />
                      )}
                      <span className="relative z-10 text-xs leading-tight">{b.name}</span>
                      {isFrequent && (
                        <span className="relative z-10 flex items-center gap-0.5 text-[9px] opacity-70 font-normal">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Frecuente
                        </span>
                      )}
                    </button>
                    {/* Edit pencil */}
                    <button
                      type="button"
                      onClick={() => { setEditingBrand(b); setEditingBrandName(b.name); setAddingBrand(false); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/80 border border-white/20 items-center justify-center text-white hover:bg-black hidden group-hover:flex transition-all"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}

              {/* Add brand */}
              <button
                type="button"
                onClick={() => { setAddingBrand((v) => !v); setEditingBrand(null); }}
                className="flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-dashed border-white/15 text-xs text-gray-400 hover:text-gray-200 hover:border-white/30 hover:bg-white/5 transition-all"
              >
                <span className="text-lg leading-none">+</span>
                <span>Añadir</span>
              </button>
            </div>
          )}

          {(editingBrand || addingBrand) && (
            <InlineEditPanel
              title={editingBrand ? "Editar marca" : "Nueva marca"}
              value={editingBrand ? editingBrandName : newBrandName}
              onChange={editingBrand ? setEditingBrandName : setNewBrandName}
              onConfirm={editingBrand ? saveBrand : createBrand}
              onCancel={() => { setEditingBrand(null); setAddingBrand(false); setEditingBrandName(""); setNewBrandName(""); }}
              confirmLabel={editingBrand ? "Guardar" : "Crear"}
            />
          )}
        </section>
      </SlideIn>

      {/* ── 3. Familia / línea ────────────────────────────── */}
      {formData.device_brand && (
        <SlideIn keyProp={`family-${formData.device_brand}`}>
          <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white mb-3">3. Línea / familia</h2>

            {families.length > 6 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  value={familySearch}
                  onChange={(e) => setFamilySearch(e.target.value)}
                  placeholder="Buscar línea…"
                  className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-red-500/60 placeholder:text-gray-600"
                />
              </div>
            )}

            {loadingFamilies ? (
              <p className="text-gray-400 text-sm animate-pulse">Cargando líneas…</p>
            ) : families.length === 1 ? (
              <p className="text-xs text-gray-400 italic">Auto-seleccionado: <span className="text-green-400 font-medium not-italic">{families[0].name}</span></p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredFamilies.map((f) => {
                  const active = formData.device_family === f.name;
                  return (
                    <div key={f.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => handleSelectFamily(f)}
                        className={`px-4 py-2 rounded-xl border text-sm transition-all duration-200 ${
                          active
                            ? "bg-red-600/70 border-red-400 text-white scale-[1.04]"
                            : "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:scale-[1.02]"
                        }`}
                      >
                        {f.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingFamily(f); setEditingFamilyName(f.name); setAddingFamily(false); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/80 border border-white/20 items-center justify-center text-white hover:bg-black hidden group-hover:flex"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { setAddingFamily((v) => !v); setEditingFamily(null); }}
                  className="px-3 py-2 rounded-xl border border-dashed border-white/15 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all"
                >
                  + Añadir línea
                </button>
              </div>
            )}

            {(editingFamily || addingFamily) && (
              <InlineEditPanel
                title={editingFamily ? "Editar línea" : "Nueva línea"}
                value={editingFamily ? editingFamilyName : newFamilyName}
                onChange={editingFamily ? setEditingFamilyName : setNewFamilyName}
                onConfirm={editingFamily ? saveFamily : createFamily}
                onCancel={() => { setEditingFamily(null); setAddingFamily(false); setEditingFamilyName(""); setNewFamilyName(""); }}
                confirmLabel={editingFamily ? "Guardar" : "Crear"}
              />
            )}
          </section>
        </SlideIn>
      )}

      {/* ── 4. Modelo ─────────────────────────────────────── */}
      {formData.device_family && (
        <SlideIn keyProp={`model-${formData.device_family}`}>
          <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white mb-3">4. Modelo</h2>

            {models.length > 8 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Buscar modelo…"
                  className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-red-500/60 placeholder:text-gray-600"
                />
              </div>
            )}

            {loadingModels ? (
              <p className="text-gray-400 text-sm animate-pulse">Cargando modelos…</p>
            ) : models.length === 1 ? (
              <p className="text-xs text-gray-400 italic">Auto-seleccionado: <span className="text-green-400 font-medium not-italic">{models[0].name}</span></p>
            ) : models.length === 0 ? (
              <p className="text-gray-400 text-sm">Esta línea no tiene modelos. Usa "+ Añadir modelo".</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredModels.map((m) => {
                  const active = formData.device_model === m.name;
                  return (
                    <div key={m.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => handleSelectModel(m)}
                        className={`px-4 py-2 rounded-xl border text-sm transition-all duration-200 ${
                          active
                            ? "bg-red-600/70 border-red-400 text-white scale-[1.04]"
                            : "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:scale-[1.02]"
                        }`}
                      >
                        {m.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingModel(m); setEditingModelName(m.name); setAddingModel(false); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/80 border border-white/20 items-center justify-center text-white hover:bg-black hidden group-hover:flex"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add/edit model */}
            <button
              type="button"
              onClick={() => { setAddingModel((v) => !v); setEditingModel(null); }}
              className="mt-3 text-xs text-gray-400 hover:text-white transition-colors"
            >
              + Añadir modelo
            </button>

            {(editingModel || addingModel) && (
              <InlineEditPanel
                title={editingModel ? "Editar modelo" : "Nuevo modelo"}
                value={editingModel ? editingModelName : newModelName}
                onChange={editingModel ? setEditingModelName : setNewModelName}
                onConfirm={editingModel ? saveModel : createModel}
                onCancel={() => { setEditingModel(null); setAddingModel(false); setEditingModelName(""); setNewModelName(""); }}
                confirmLabel={editingModel ? "Guardar" : "Crear"}
              />
            )}
          </section>
        </SlideIn>
      )}

      {/* ── 5. Servicios rápidos ──────────────────────────── */}
      <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-red-400" />
          Acciones rápidas (problema)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: "Cambio de pantalla",  icon: Smartphone },
            { label: "Cambio de batería",   icon: Battery },
            { label: "Líquido Glass",       icon: Shield, highlight: true },
            { label: "Sin señal / WiFi",    icon: Wifi },
            { label: "No carga",            icon: Zap },
            { label: "No enciende",         icon: Cpu },
          ].map(({ label, icon: Icon, highlight }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleQuickService(label)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 hover:scale-[1.02] ${
                formData.initial_problem === label
                  ? "bg-red-600/70 border-red-400 text-white"
                  : highlight
                  ? "bg-red-600/20 border-red-500/40 text-red-300 hover:bg-red-600/30"
                  : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
