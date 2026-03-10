import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Users, Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function CustomerSegmentation() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "custom",
    color: "#00A8E8"
  });

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const data = await base44.entities.CustomerSegment.list();
      setSegments(data || []);
    } catch (error) {
      console.error("Error fetching segments:", error);
      toast.error("Error al cargar segmentos");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre del segmento es obligatorio");
      return;
    }

    try {
      if (editingId) {
        await base44.entities.CustomerSegment.update(editingId, formData);
        toast.success("Segmento actualizado");
      } else {
        await base44.entities.CustomerSegment.create(formData);
        toast.success("Segmento creado");
      }
      setShowDialog(false);
      setFormData({ name: "", description: "", type: "custom", color: "#00A8E8" });
      setEditingId(null);
      fetchSegments();
    } catch (error) {
      console.error("Error saving segment:", error);
      toast.error("Error al guardar segmento");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este segmento?")) return;
    
    try {
      await base44.entities.CustomerSegment.delete(id);
      toast.success("Segmento eliminado");
      fetchSegments();
    } catch (error) {
      console.error("Error deleting segment:", error);
      toast.error("Error al eliminar");
    }
  };

  const handleEdit = (segment) => {
    setFormData({
      name: segment.name,
      description: segment.description,
      type: segment.type,
      color: segment.color
    });
    setEditingId(segment.id);
    setShowDialog(true);
  };

  const handleOpenNew = () => {
    setFormData({ name: "", description: "", type: "custom", color: "#00A8E8" });
    setEditingId(null);
    setShowDialog(true);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;
  }

  return (
    <>
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            Segmentación de Clientes
          </CardTitle>
          <Button onClick={handleOpenNew} className="gap-2 bg-cyan-600/80 hover:bg-cyan-600 h-8 px-3 text-sm">
            <Plus className="w-4 h-4" />
            Nuevo Segmento
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map(segment => (
              <div key={segment.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
                    <h3 className="font-semibold text-white text-sm">{segment.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => handleEdit(segment)}
                      size="icon"
                      className="h-7 w-7 bg-blue-600/80 hover:bg-blue-600"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(segment.id)}
                      size="icon"
                      className="h-7 w-7 bg-red-600/80 hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {segment.description && (
                  <p className="text-white/60 text-xs mb-2">{segment.description}</p>
                )}
                <div className="text-xs text-cyan-400 font-semibold">
                  {segment.member_count || 0} clientes
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#0A0A0A] border-white/10">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Segmento" : "Nuevo Segmento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-white/70 text-sm mb-2 block">Nombre</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="ej: VIP, Nuevos Clientes"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-2 block">Descripción</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descripción del segmento"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-2 block">Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  className="h-10 w-16 rounded cursor-pointer"
                />
                <span className="text-white/60 text-sm flex items-center">{formData.color}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button onClick={() => setShowDialog(false)} variant="outline">Cancelar</Button>
              <Button onClick={handleSave} className="bg-cyan-600/80 hover:bg-cyan-600">
                {editingId ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
