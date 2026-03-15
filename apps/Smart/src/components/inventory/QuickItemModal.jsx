import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, DollarSign, FileText } from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";
import { catalogCache } from "@/components/utils/dataCache";
import { supabase } from "../../../../../lib/supabase-client.js";

export default function QuickItemModal({ open, onClose, onItemCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!price || Number(price) <= 0) {
      toast.error("El precio debe ser mayor a 0");
      return;
    }

    const itemData = {
      __kind: "manual",
      type: "service",
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      qty: 1,
      from_inventory: false,
      is_manual: true
    };

    setSaving(true);
    // Persistir en el catálogo (Product table) para que aparezca en búsquedas futuras
    try {
      let created = null;
      try {
        created = await dataClient.entities.Product.create({
          name: itemData.name,
          description: itemData.description,
          price: itemData.price,
          type: "service",
          active: true,
          stock: 0,
          cost: 0,
          category: "other",
        });
      } catch (primaryError) {
        console.warn("[QuickItemModal] dataClient create failed, trying direct supabase fallback:", primaryError);
        const { data, error } = await supabase
          .from("product")
          .insert({
            name: itemData.name,
            description: itemData.description,
            price: itemData.price,
            type: "service",
            active: true,
            stock: 0,
            cost: 0,
            category: "other",
          })
          .select("id, name, description, price, type, stock, category")
          .single();

        if (error) throw error;
        created = data;
      }
      // Invalidar caché para que AddItemModal recargue el catálogo
      catalogCache.invalidate("pos-active-products");
      catalogCache.invalidate("pos-active-services");
      // Usar el ID real si está disponible
      if (created?.id) itemData.id = created.id;
    } catch (err) {
      // Si falla guardar en catálogo, continuamos de todos modos (el item se añade al carrito)
      console.warn("[QuickItemModal] No se pudo guardar en catálogo:", err);
    } finally {
      setSaving(false);
    }

    toast.success(`✅ Item añadido: ${itemData.name}`);

    // Llamar callback para añadir al carrito
    if (onItemCreated) {
      onItemCreated(itemData);
    }

    // Limpiar y cerrar
    setName("");
    setDescription("");
    setPrice("");
    onClose();
  };

  const handleEnterToSave = (e) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    e.preventDefault();
    handleSave();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>

      <div
        className="bg-[#0A0A0A]/95 backdrop-blur-2xl border border-white/10 text-white shadow-2xl rounded-[32px] p-0 overflow-hidden max-w-md w-full"
        onClick={(e) => e.stopPropagation()}>

        <div className="sticky top-0 z-20 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 p-6 pb-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-2xl">
              <Wrench className="w-6 h-6 text-cyan-400" />
            </div>
            <span className="text-white tracking-tight">Item Manual</span>
          </h2>
          <p className="text-white/50 text-sm font-medium pl-14 mt-1">
            Para trabajos que no están en inventario
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Nombre */}
          <div className="space-y-2">
            <Label className="text-white/70 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Nombre del Trabajo *
            </Label>
            <Input
              type="text"
              placeholder="Ej: Mano de obra, Micro soldadura..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleEnterToSave}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 text-base" />

          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label className="text-white/70 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              ¿Qué se hizo?
            </Label>
            <Textarea
              placeholder="Ej: Se le añadió esta pieza del taller, se soldó este circuito..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[100px] text-base resize-none" />

          </div>

          {/* Precio */}
          <div className="space-y-2">
            <Label className="text-white/70 text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Precio *
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={handleEnterToSave}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 text-lg" />

          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose} className="bg-background text-slate-900 px-4 py-2 text-sm font-semibold rounded-full inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground flex-1 border-white/20 hover:bg-white/10 h-12">


              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white font-semibold h-12">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
