import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Upload } from "lucide-react";

export default function CreateCustomerDialog({ open, onClose, onCustomerCreated }) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: ""
  });
  const [devicePhotos, setDevicePhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const uploadedUrls = [];

    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploadedUrls.push(file_url);
    }

    setDevicePhotos([...devicePhotos, ...uploadedUrls]);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      alert("Nombre y teléfono son requeridos");
      return;
    }

    setLoading(true);

    try {
      const customer = await base44.entities.Customer.create({
        ...formData,
        device_photos: devicePhotos,
        total_orders: 0
      });

      // Send welcome email if email provided
      if (formData.email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: formData.email,
            subject: "Bienvenido a 911 SmartFix Puerto Rico",
            body: `
              <h2>¡Bienvenido ${formData.name}!</h2>
              <p>Gracias por confiar en 911 SmartFix Puerto Rico para el cuidado de tus equipos.</p>
              <p>Hemos registrado tu información y estaremos en contacto contigo.</p>
              <br/>
              <p><strong>911 SmartFix Puerto Rico</strong></p>
              <p>Tel: +1 (787) 782-3630</p>
            `
          });
        } catch (emailError) {
          console.error("Error sending welcome email:", emailError);
        }
      }

      onCustomerCreated();
      setFormData({ name: "", phone: "", email: "", address: "", notes: "" });
      setDevicePhotos([]);
    } catch (error) {
      alert("Error al crear cliente: " + error.message);
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-[#2B2B2B] to-black border-[#FF0000]/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">Nuevo Cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nombre Completo *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Juan Pérez"
                className="bg-black border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Teléfono *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="(787) 123-4567"
                className="bg-black border-gray-700 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Email (Opcional)</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="cliente@example.com"
              className="bg-black border-gray-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Dirección</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="Calle, Ciudad, Estado"
              className="bg-black border-gray-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Notas</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Información adicional del cliente..."
              className="bg-black border-gray-700 text-white"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Fotos del Equipo (Opcional)</Label>
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-[#FF0000]/50 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="device-photos"
              />
              <label htmlFor="device-photos" className="cursor-pointer">
                <Camera className="w-12 h-12 mx-auto text-gray-500 mb-2" />
                <p className="text-gray-400">Click para subir fotos</p>
                <p className="text-xs text-gray-600 mt-1">o arrastra y suelta aquí</p>
              </label>
            </div>
            {devicePhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {devicePhotos.map((url, idx) => (
                  <img key={idx} src={url} alt={`Device ${idx + 1}`} className="w-full h-20 object-cover rounded-lg border border-gray-700" />
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-gradient-to-r from-[#FF0000] to-red-800 hover:from-red-700 hover:to-red-900"
              disabled={loading || !formData.name || !formData.phone}
            >
              {loading ? "Creando..." : "Crear Cliente"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
