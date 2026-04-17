import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, DollarSign, FileText } from "lucide-react";
import { toast } from "sonner";

export default function QuickItemModal({ open, onClose, onItemCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");

  const handleSave = () => {
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
      cost: Number(cost) || 0,
      qty: 1,
      from_inventory: false,
      is_manual: true
    };

    toast.success(`✅ Item añadido: ${itemData.name}`);

    if (onItemCreated) {
      onItemCreated(itemData);
    }

    setName("");
    setDescription("");
    setPrice("");
    setCost("");
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
      className="apple-type fixed inset-0 z-[9999999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>

      <div
        className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-md w-full"
        onClick={(e) => e.stopPropagation()}>

        <div className="sticky top-0 z-20 apple-surface-elevated p-6 pb-4" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <h2 className="apple-text-title2 apple-label-primary flex items-center gap-3">
            <div className="p-2 bg-apple-blue/15 rounded-apple-sm">
              <Wrench className="w-6 h-6 text-apple-blue" />
            </div>
            <span>Item Manual</span>
          </h2>
          <p className="apple-label-secondary apple-text-subheadline pl-14 mt-1">
            Para trabajos que no están en inventario
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Nombre */}
          <div className="space-y-2">
            <Label className="apple-label-secondary apple-text-subheadline flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Nombre del Trabajo *
            </Label>
            <Input
              type="text"
              placeholder="Ej: Mano de obra, Micro soldadura..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleEnterToSave}
              className="apple-input h-12 apple-text-body" />

          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label className="apple-label-secondary apple-text-subheadline flex items-center gap-2">
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
              className="apple-input min-h-[100px] apple-text-body resize-none" />

          </div>

          {/* Precio y Costo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="apple-label-secondary apple-text-subheadline flex items-center gap-2">
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
                className="apple-input h-12 apple-text-headline tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label className="apple-label-secondary apple-text-subheadline flex items-center gap-2">
                <DollarSign className="w-4 h-4 apple-label-tertiary" />
                Costo
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                onKeyDown={handleEnterToSave}
                className="apple-input h-12 apple-text-headline tabular-nums" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose} className="apple-btn apple-btn-secondary flex-1 h-12">


              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="apple-btn apple-btn-primary flex-1 h-12">
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
