// === DeviceCatalogStep.jsx
// 👈 versión 911 SmartFix — tipo → marca → familia → modelo
// 👈 edición inline en el mismo sitio (sin abrir modal aparte)
// 👈 incluye “Líquido glass” como servicio rápido al final

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Loader2, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function DeviceCatalogStep({ formData, updateFormData }) {
  // ==== state remoto ====
  const [types, setTypes] = useState([]);               // 👈 DeviceCategory
  const [brands, setBrands] = useState([]);             // 👈 Brand
  const [families, setFamilies] = useState([]);         // 👈 DeviceFamily / sub-línea
  const [models, setModels] = useState([]);             // 👈 DeviceModel

  // ==== loading flags ====
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // ==== edición inline ====
  const [editingBrand, setEditingBrand] = useState(null);
  const [editingBrandName, setEditingBrandName] = useState("");

  const [editingFamily, setEditingFamily] = useState(null);
  const [editingFamilyName, setEditingFamilyName] = useState("");

  const [editingModel, setEditingModel] = useState(null);
  const [editingModelName, setEditingModelName] = useState("");

  // ==== crear inline ====
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");

  const [addingFamily, setAddingFamily] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");

  const [addingModel, setAddingModel] = useState(false);
  const [newModelName, setNewModelName] = useState("");

  // ==== cargar al montar ====
  useEffect(() => {
    loadTypes();
    loadBrands();
  }, []);

  // cuando cambia marca → cargo familias
  useEffect(() => {
    if (formData.device_brand) {
      loadFamiliesForBrand(formData.device_brand);
      // 👇 si cambiaste de marca, borramos familia y modelo
      updateFormData("device_family", "");
      updateFormData("device_model", "");
    } else {
      setFamilies([]);
      setModels([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.device_brand]);

  // cuando cambia familia → cargo modelos
  useEffect(() => {
    if (formData.device_brand && formData.device_family) {
      loadModelsForBrandAndFamily(formData.device_brand, formData.device_family);
    } else {
      setModels([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.device_family]);

  // ===== loaders =====
  const loadTypes = async () => {
    setLoadingTypes(true);
    try {
      const rows = await base44.entities.DeviceCategory.filter({}, "name");
      setTypes(rows || []);
    } catch (e) {
      console.warn("No se pudieron cargar los tipos", e);
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadBrands = async () => {
    setLoadingBrands(true);
    try {
      const rows = await base44.entities.Brand.filter({}, "name");
      setBrands(rows || []);
    } catch (e) {
      console.warn("No se pudieron cargar las marcas", e);
    } finally {
      setLoadingBrands(false);
    }
  };

  const loadFamiliesForBrand = async (brandName) => {
    setLoadingFamilies(true);
    try {
      // 👈 aquí asumo que tienes una entidad DeviceFamily o algo similar
      // si no la tienes y usas DeviceModel con campo family, se puede ajustar
      const rows = await base44.entities.DeviceFamily?.filter?.(
        { brand: brandName },
        "name"
      );
      setFamilies(rows || []);
    } catch (e) {
      console.warn("No se pudieron cargar las familias", e);
      setFamilies([]);
    } finally {
      setLoadingFamilies(false);
    }
  };

  const loadModelsForBrandAndFamily = async (brandName, familyName) => {
    setLoadingModels(true);
    try {
      // 👈 aquí amarramos por marca y familia
      const rows = await base44.entities.DeviceModel.filter(
        { brand: brandName, family: familyName },
        "name"
      );
      setModels(rows || []);
    } catch (e) {
      console.warn("No se pudieron cargar los modelos", e);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  // ===== selects =====
  const handleSelectType = (t) => {
    updateFormData("device_type", t.name);
    updateFormData("device_subcategory", t.name);
  };

  const handleSelectBrand = (b) => {
    updateFormData("device_brand", b.name);
  };

  const handleSelectFamily = (f) => {
    updateFormData("device_family", f.name);
  };

  const handleSelectModel = (m) => {
    updateFormData("device_model", m.name);
  };

  // ===== editar MARCA =====
  const startEditBrand = (brand) => {
    setEditingBrand(brand);
    setEditingBrandName(brand.name || "");
    setAddingBrand(false);
  };

  const saveBrand = async () => {
    if (!editingBrandName.trim() || !editingBrand?.id) return;
    try {
      await base44.entities.Brand.update(editingBrand.id, {
        name: editingBrandName.trim(),
      });
      await loadBrands();
      // 👇 si era la seleccionada, actualizamos el form
      if (formData.device_brand === editingBrand.name) {
        updateFormData("device_brand", editingBrandName.trim());
      }
      setEditingBrand(null);
      setEditingBrandName("");
    } catch (e) {
      alert("No se pudo guardar la marca");
    }
  };

  const createBrand = async () => {
    if (!newBrandName.trim()) return;
    try {
      const created = await base44.entities.Brand.create({
        name: newBrandName.trim(),
      });
      await loadBrands();
      updateFormData("device_brand", newBrandName.trim());
      setNewBrandName("");
      setAddingBrand(false);
    } catch (e) {
      alert("No se pudo crear la marca");
    }
  };

  // ===== editar FAMILIA =====
  const startEditFamily = (fam) => {
    setEditingFamily(fam);
    setEditingFamilyName(fam.name || "");
    setAddingFamily(false);
  };

  const saveFamily = async () => {
    if (!editingFamilyName.trim() || !editingFamily?.id) return;
    try {
      await base44.entities.DeviceFamily.update(editingFamily.id, {
        name: editingFamilyName.trim(),
      });
      await loadFamiliesForBrand(formData.device_brand);
      if (formData.device_family === editingFamily.name) {
        updateFormData("device_family", editingFamilyName.trim());
      }
      setEditingFamily(null);
      setEditingFamilyName("");
    } catch (e) {
      alert("No se pudo guardar la familia");
    }
  };

  const createFamily = async () => {
    if (!newFamilyName.trim()) return;
    if (!formData.device_brand) {
      alert("Primero selecciona una marca");
      return;
    }
    try {
      await base44.entities.DeviceFamily.create({
        name: newFamilyName.trim(),
        brand: formData.device_brand,
      });
      await loadFamiliesForBrand(formData.device_brand);
      updateFormData("device_family", newFamilyName.trim());
      setNewFamilyName("");
      setAddingFamily(false);
    } catch (e) {
      alert("No se pudo crear la familia");
    }
  };

  // ===== editar MODELO =====
  const startEditModel = (m) => {
    setEditingModel(m);
    setEditingModelName(m.name || "");
    setAddingModel(false);
  };

  const saveModel = async () => {
    if (!editingModelName.trim() || !editingModel?.id) return;
    try {
      await base44.entities.DeviceModel.update(editingModel.id, {
        name: editingModelName.trim(),
      });
      await loadModelsForBrandAndFamily(
        formData.device_brand,
        formData.device_family
      );
      if (formData.device_model === editingModel.name) {
        updateFormData("device_model", editingModelName.trim());
      }
      setEditingModel(null);
      setEditingModelName("");
    } catch (e) {
      alert("No se pudo guardar el modelo");
    }
  };

  const createModel = async () => {
    if (!newModelName.trim()) return;
    if (!formData.device_brand) {
      alert("Primero selecciona una marca");
      return;
    }
    if (!formData.device_family) {
      alert("Primero selecciona la familia / línea");
      return;
    }
    try {
      await base44.entities.DeviceModel.create({
        name: newModelName.trim(),
        brand: formData.device_brand,
        family: formData.device_family,
      });
      await loadModelsForBrandAndFamily(
        formData.device_brand,
        formData.device_family
      );
      updateFormData("device_model", newModelName.trim());
      setNewModelName("");
      setAddingModel(false);
    } catch (e) {
      alert("No se pudo crear el modelo");
    }
  };

  // ===== servicio rápido (aquí metí Líquido glass) =====
  const handleQuickService = (name) => {
    // 👈 esto no pisa el modelo, solo te pone el “problema” en el form
    // pero como este componente no tiene acceso directo al problema del otro step,
    // lo guardo en el form como “initial_problem” para que el ProblemStep lo vea
    updateFormData("initial_problem", name); // 👈
  };

  return (
    <div className="space-y-6">
      {/* 1. Tipo */}
      <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-3">
          1. Tipo de dispositivo
        </h2>
        <div className="flex flex-wrap gap-2">
          {loadingTypes ? (
            <p className="text-gray-300 text-sm">Cargando tipos...</p>
          ) : (
            types.map((t) => {
              const active =
                formData.device_type === t.name ||
                formData.device_subcategory === t.name;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectType(t)}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                    active
                      ? "bg-red-600/90 border-red-300 text-white"
                      : "bg-white/5 border-white/10 text-gray-100 hover:bg-white/10"
                  }`}
                >
                  {t.name}
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* 2. Marca */}
      <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-3">
          2. Marca
        </h2>
        <div className="flex flex-wrap gap-2">
          {loadingBrands ? (
            <p className="text-gray-300 text-sm">Cargando marcas...</p>
          ) : (
            brands.map((b) => {
              const active = formData.device_brand === b.name;
              return (
                <div key={b.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleSelectBrand(b)}
                    className={`px-4 py-2 rounded-xl border text-sm pr-9 ${
                      active
                        ? "bg-red-600/80 border-red-400 text-white"
                        : "bg-black/10 border-white/10 text-gray-100 hover:bg-white/10"
                    }`}
                  >
                    {b.name}
                  </button>
                  {/* editar marca */}
                  <button
                    type="button"
                    onClick={() => startEditBrand(b)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-[10px] text-white hover:bg-black"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
          {/* crear marca */}
          <button
            type="button"
            onClick={() => {
              setAddingBrand((v) => !v);
              setEditingBrand(null);
            }}
            className="px-3 py-2 rounded-xl border border-dashed border-white/15 text-xs text-gray-200 hover:bg-white/5"
          >
            + Añadir marca
          </button>
        </div>

        {(editingBrand || addingBrand) && (
          <div className="mt-4 bg-black/70 border border-white/10 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white font-semibold">
                {editingBrand ? "Editar marca" : "Nueva marca"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingBrand(null);
                  setAddingBrand(false);
                  setEditingBrandName("");
                  setNewBrandName("");
                }}
                className="text-xs text-gray-300 hover:text-white"
              >
                Cerrar
              </button>
            </div>
            {editingBrand ? (
              <>
                <input
                    value={editingBrandName}
                    onChange={(e) => setEditingBrandName(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                    placeholder="Ej. Apple"
                  />
                <Button
                  type="button"
                  onClick={saveBrand}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <input
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  placeholder="Ej. Apple"
                />
                <Button
                  type="button"
                  onClick={createBrand}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Crear
                </Button>
              </>
            )}
          </div>
        )}
      </section>

      {/* 3. Familia / línea (iPhone, iPad, Mac…) */}
      <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-3">
          3. Línea / familia del equipo
        </h2>
        {!formData.device_brand ? (
          <p className="text-gray-400 text-sm">
            Primero selecciona una marca.
          </p>
        ) : loadingFamilies ? (
          <p className="text-gray-300 text-sm">Cargando familias…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {families.map((f) => {
              const active = formData.device_family === f.name;
              return (
                <div key={f.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleSelectFamily(f)}
                    className={`px-4 py-2 rounded-xl border text-sm pr-9 ${
                      active
                        ? "bg-red-600/80 border-red-400 text-white"
                        : "bg-black/10 border-white/10 text-gray-100 hover:bg-white/10"
                    }`}
                  >
                    {f.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditFamily(f)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-[10px] text-white hover:bg-black"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setAddingFamily((v) => !v);
                setEditingFamily(null);
              }}
              className="px-3 py-2 rounded-xl border border-dashed border-white/15 text-xs text-gray-200 hover:bg-white/5"
            >
              + Añadir línea
            </button>
          </div>
        )}

        {(editingFamily || addingFamily) && (
          <div className="mt-4 bg-black/70 border border-white/10 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white font-semibold">
                {editingFamily ? "Editar línea" : "Nueva línea"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingFamily(null);
                  setAddingFamily(false);
                  setEditingFamilyName("");
                  setNewFamilyName("");
                }}
                className="text-xs text-gray-300 hover:text-white"
              >
                Cerrar
              </button>
            </div>
            {editingFamily ? (
              <>
                <input
                  value={editingFamilyName}
                  onChange={(e) => setEditingFamilyName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  placeholder="Ej. iPhone"
                />
                <Button
                  type="button"
                  onClick={saveFamily}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <input
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  placeholder="Ej. iPhone"
                />
                <Button
                  type="button"
                  onClick={createFamily}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Crear
                </Button>
              </>
            )}
          </div>
        )}
      </section>

      {/* 4. Modelo */}
      <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-3">
          4. Modelo
        </h2>
        {!formData.device_family ? (
          <p className="text-gray-400 text-sm">
            Primero selecciona una línea (iPhone, iPad, Galaxy…)
          </p>
        ) : loadingModels ? (
          <p className="text-gray-300 text-sm">Cargando modelos…</p>
        ) : models.length === 0 ? (
          <p className="text-gray-300 text-sm">
            Esta línea no tiene modelos. Usa “+ Añadir modelo”.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {models.map((m) => {
              const active = formData.device_model === m.name;
              return (
                <div key={m.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleSelectModel(m)}
                    className={`px-4 py-2 rounded-xl border text-sm pr-9 ${
                      active
                        ? "bg-red-600/80 border-red-400 text-white"
                        : "bg-black/10 border-white/10 text-gray-100 hover:bg-white/10"
                    }`}
                  >
                    {m.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditModel(m)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-[10px] text-white hover:bg-black"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* caja de edición / creación de modelo */}
        {(editingModel || addingModel) && (
          <div className="mt-4 bg-black/70 border border-white/10 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white font-semibold">
                {editingModel ? "Editar modelo" : "Nuevo modelo"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingModel(null);
                  setAddingModel(false);
                  setEditingModelName("");
                  setNewModelName("");
                }}
                className="text-xs text-gray-300 hover:text-white"
              >
                Cerrar
              </button>
            </div>
            {editingModel ? (
              <>
                <input
                  value={editingModelName}
                  onChange={(e) => setEditingModelName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  placeholder="Ej. iPhone 14 Pro Max"
                />
                <Button
                  type="button"
                  onClick={saveModel}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <input
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  placeholder="Ej. iPhone 14 Pro Max"
                />
                <Button
                  type="button"
                  onClick={createModel}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Crear
                </Button>
              </>
            )}
          </div>
        )}

        {/* add modelo */}
        <button
          type="button"
          onClick={() => {
            setAddingModel((v) => !v);
            setEditingModel(null);
          }}
          className="mt-3 text-xs text-gray-200 hover:text-white"
        >
          + Añadir modelo
        </button>
      </section>

      {/* 5. Servicios rápidos */}
      <section className="bg-black/40 rounded-2xl border border-red-500/10 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-red-400" />
          Acciones rápidas (problema)
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleQuickService("Cambio de pantalla")}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-100 text-xs hover:bg-white/10"
          >
            Cambio pantalla
          </button>
          <button
            type="button"
            onClick={() => handleQuickService("Cambio de batería")}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-100 text-xs hover:bg-white/10"
          >
            Cambio batería
          </button>
          <button
            type="button"
            onClick={() => handleQuickService("Aplicación de Líquido Glass")} // 👈
            className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-xs hover:bg-red-500"
          >
            Líquido Glass
          </button>
        </div>
      </section>
    </div>
  );
}
