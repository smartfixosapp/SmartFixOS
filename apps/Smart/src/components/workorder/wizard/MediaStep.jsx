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
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Fotos y videos</h3>
        <p className="text-gray-400 text-sm">
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
          className="w-full h-24 border-gray-700 hover:bg-gray-800 cursor-pointer"
          asChild
        >
          <div>
            <Camera className="w-6 h-6 mb-2 text-gray-300" />
            <p className="text-sm">Capturar evidencia</p>
          </div>
        </Button>
      </label>

      {formData.media_files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {formData.media_files.map(file => (
            <Card key={file.id} className="relative group overflow-hidden bg-gray-900 border-gray-800">
              {file.type === 'video' ? (
                <div className="aspect-square flex items-center justify-center bg-black">
                  <Video className="w-12 h-12 text-gray-500" />
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
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {formData.media_files.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg">
          <Camera className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500">No hay archivos adjuntos</p>
          <p className="text-sm text-gray-600 mt-1">
            Las fotos ayudan a documentar el estado del equipo
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500">
        {formData.media_files.length} / {maxFiles} archivos
      </div>
    </div>
  );
}
