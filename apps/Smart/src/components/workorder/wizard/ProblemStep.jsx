// === ProblemStep.jsx — versión alineada con WorkOrderWizard (usa media_urls) ===
import React, { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Trash2 } from "lucide-react";

export default function ProblemStep({ formData, updateFormData }) {
  const fileRef = useRef(null);

  // 👇 helper para asegurarnos que siempre tengamos array
  const safeMedia = Array.isArray(formData.media_urls)
    ? formData.media_urls
    : [];

  const handleProblemChange = (e) => {
    updateFormData("initial_problem", e.target.value);
  };

  const addFiles = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const next = [...safeMedia, ...list]; // 👈 guardamos File(s) directamente, igual que en el wizard
    updateFormData("media_urls", next);   // 👈 IMPORTANT: media_urls
  };

  const removeAt = (idx) => {
    const next = safeMedia.filter((_, i) => i !== idx);
    updateFormData("media_urls", next); // 👈 misma key
  };

  // 👇 presets de descripción
  const applyPreset = (text) => {
    updateFormData("initial_problem", text);
  };

  return (
    <div className="apple-type space-y-6">
      {/* Presets rápidos */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => applyPreset("Pantalla rota / no responde")}
          className="apple-btn apple-btn-tinted apple-press"
        >
          Pantalla rota
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => applyPreset("Batería durando poco / se apaga")}
          className="apple-btn apple-btn-tinted apple-press"
        >
          Batería
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => applyPreset("Puerto de carga dañado / no carga")}
          className="apple-btn apple-btn-tinted apple-press"
        >
          Puerto
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => applyPreset("Aplicación de Líquido Glass")}
          className="apple-btn apple-press bg-apple-red/15 text-apple-red border-transparent hover:bg-apple-red/20"
        >
          Líquido Glass
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => applyPreset("🔓 Desbloqueo de equipo")}
          className="apple-btn apple-press bg-apple-blue/12 text-apple-blue border-transparent hover:bg-apple-blue/20"
        >
          🔓 Desbloqueo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => applyPreset("📵 Sacar de lista negra (Blacklist removal)")}
          className="apple-btn apple-press bg-apple-purple/12 text-apple-purple border-transparent hover:bg-apple-purple/20"
        >
          📵 Lista Negra
        </Button>
      </div>

      {/* Descripción */}
      <div className="space-y-2">
        <Label className="apple-text-subheadline apple-label-secondary">Descripción del problema</Label>
        <Textarea
          value={formData.initial_problem || ""}
          onChange={handleProblemChange}
          placeholder="Ej. No enciende / pantalla quebrada / batería dura poco…"
          className="apple-input min-h-[110px]"
        />
      </div>

      {/* Evidencias */}
      <div className="space-y-3">
        <Label className="apple-text-subheadline apple-label-secondary">Fotos / Evidencias</Label>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="apple-btn apple-btn-primary apple-press"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Añadir archivos
          </Button>
          <span className="apple-text-caption1 apple-label-tertiary">
            Puedes subir imágenes o videos (estado del equipo).
          </span>
        </div>

        {/* Previews */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {safeMedia.map((f, idx) => {
            const isFile = f instanceof File || f instanceof Blob;
            const url = isFile
              ? URL.createObjectURL(f)
              : f.url || f.publicUrl;
            const mime = isFile ? f.type : f.mime;
            const isVideo =
              (mime || "").startsWith("video");

            return (
              <div
                key={idx}
                className="relative rounded-apple-sm overflow-hidden bg-gray-sys6 dark:bg-gray-sys5"
                style={{ border: "0.5px solid rgb(var(--separator) / 0.29)" }}
              >
                {isVideo ? (
                  <video
                    src={url}
                    className="w-full h-28 object-cover"
                    controls
                  />
                ) : (
                  <img
                    src={url}
                    alt={`evidence-${idx}`}
                    className="w-full h-28 object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="absolute top-1 right-1 bg-apple-red/15 hover:bg-apple-red/20 rounded-full p-1 apple-press"
                  title="Quitar"
                >
                  <Trash2 className="w-4 h-4 text-apple-red" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
