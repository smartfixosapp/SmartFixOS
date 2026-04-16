import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Video } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function MediaStep({ formData, updateFormData, config }) {
  const [uploading, setUploading] = useState(false);

  const maxFiles = config?.media_config?.max_files || 10;
  const maxSizeMB = config?.media_config?.max_size_mb || 10;

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);

    if (formData.media_files.length + files.length > maxFiles) {
      alert(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    const newFiles = [];
    for (const file of files) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`${file.name} excede el tamaño máximo de ${maxSizeMB}MB`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      newFiles.push({
        id: Date.now() + Math.random(),
        file,
        preview,
        type: file.type.startsWith('video/') ? 'video' : 'image'
      });
    }

    updateFormData('media_files', [...formData.media_files, ...newFiles]);
  };

  const removeFile = (id) => {
    const newFiles = formData.media_files.filter(f => f.id !== id);
    updateFormData('media_files', newFiles);
  };

  return (
    <div className="apple-type space-y-6">
      <div>
        <h3 className="apple-text-title2 apple-label-primary mb-2 font-semibold">Fotos y videos</h3>
        <p className="apple-text-subheadline apple-label-secondary tabular-nums">
          Documenta el estado del equipo (máx. {maxFiles} archivos, {maxSizeMB}MB c/u)
        </p>
      </div>

      <label className="block">
        <input
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />
        <Button
          type="button"
          variant="outline"
          className="apple-btn apple-btn-secondary apple-press w-full h-24 cursor-pointer"
          asChild
        >
          <div>
            <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 text-apple-blue flex items-center justify-center mb-2">
              <Camera className="w-5 h-5" />
            </div>
            <p className="apple-text-subheadline apple-label-primary font-medium">Capturar evidencia</p>
          </div>
        </Button>
      </label>

      {formData.media_files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {formData.media_files.map(file => (
            <Card key={file.id} className="apple-press relative group overflow-hidden bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-lg border-0">
              {file.type === 'video' ? (
                <div className="aspect-square flex items-center justify-center bg-gray-sys5 dark:bg-gray-sys4">
                  <Video className="w-12 h-12 apple-label-tertiary" />
                </div>
              ) : (
                <img
                  src={file.preview}
                  alt="Preview"
                  className="w-full aspect-square object-cover"
                />
              )}
              <Button
                onClick={() => removeFile(file.id)}
                size="icon"
                variant="destructive"
                aria-label="Eliminar archivo"
                className="apple-btn apple-btn-destructive apple-press absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {formData.media_files.length === 0 && (
        <div className="apple-card text-center py-12">
          <div className="w-14 h-14 rounded-apple-sm bg-apple-blue/15 text-apple-blue flex items-center justify-center mx-auto mb-3">
            <Camera className="w-7 h-7" />
          </div>
          <p className="apple-text-body apple-label-secondary">No hay archivos adjuntos</p>
          <p className="apple-text-subheadline apple-label-tertiary mt-1">
            Las fotos ayudan a documentar el estado del equipo
          </p>
        </div>
      )}

      <div className="apple-text-caption1 apple-label-tertiary tabular-nums">
        {formData.media_files.length} / {maxFiles} archivos
      </div>
    </div>
  );
}
