import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2, Edit2, Save } from "lucide-react";

/**
 * Editor de catálogos de dispositivos: marcas, modelos, tipos
 * Permite añadir, editar, eliminar y REORDENAR elementos con drag & drop
 */
export default function CatalogEditor({ open, onClose, onSuccess }) {
  const [tab, setTab] = useState("brands"); // brands, models, categories
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [newItemName, setNewItemName] = useState("");

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open, tab]);

  const loadItems = async () => {
    setLoading(true);
    try {
      let data = [];
      if (tab === "brands") {
        data = await base44.entities.Brand.list("order", 200);
      } else if (tab === "models") {
        data = await base44.entities.DeviceModel.list("order", 500);
      } else if (tab === "categories") {
        data = await base44.entities.DeviceCategory.list("order", 100);
      }

      const sorted = (data || []).sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 999;
        const orderB = typeof b.order === "number" ? b.order : 999;
        return orderA - orderB;
      });

      setItems(sorted);
    } catch (error) {
      console.error("Error loading catalog items:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newItemName.trim()) {
      alert("Ingresa un nombre");
      return;
    }

    try {
      const maxOrder = Math.max(...items.map((i) => i.order || 0), 0);
      const newItem = {
        name: newItemName.trim(),
        active: true,
        order: maxOrder + 1,
      };

      if (tab === "brands") {
        await base44.entities.Brand.create(newItem);
      } else if (tab === "models") {
        await base44.entities.DeviceModel.create(newItem);
      } else if (tab === "categories") {
        await base44.entities.DeviceCategory.create(newItem);
      }

      setNewItemName("");
      await loadItems();
      onSuccess?.();
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Error al añadir: " + (error.message || "Error desconocido"));
    }
  };

  const handleEdit = async (id, newName) => {
    if (!newName.trim()) {
      alert("El nombre no puede estar vacío");
      return;
    }

    try {
      if (tab === "brands") {
        await base44.entities.Brand.update(id, { name: newName.trim() });
      } else if (tab === "models") {
        await base44.entities.DeviceModel.update(id, { name: newName.trim() });
      } else if (tab === "categories") {
        await base44.entities.DeviceCategory.update(id, { name: newName.trim() });
      }

      setEditingId(null);
      setEditValue("");
      await loadItems();
      onSuccess?.();
    } catch (error) {
      console.error("Error updating item:", error);
      alert("Error al actualizar");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este elemento? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      if (tab === "brands") {
        await base44.entities.Brand.delete(id);
      } else if (tab === "models") {
        await base44.entities.DeviceModel.delete(id);
      } else if (tab === "categories") {
        await base44.entities.DeviceCategory.delete(id);
      }

      await loadItems();
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Error al eliminar: " + (error.message || "Puede estar en uso"));
    }
  };

  const saveOrder = async (orderedItems) => {
    try {
      for (let idx = 0; idx < orderedItems.length; idx++) {
        const item = orderedItems[idx];
        if (tab === "brands") {
          await base44.entities.Brand.update(item.id, { order: idx });
        } else if (tab === "models") {
          await base44.entities.DeviceModel.update(item.id, { order: idx });
        } else if (tab === "categories") {
          await base44.entities.DeviceCategory.update(item.id, { order: idx });
        }
      }
      onSuccess?.();
    } catch (error) {
      console.error("Error saving order:", error);
      alert("Error al guardar el orden");
      await loadItems(); // reload on error to restore original
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    // Optimistic update
    setItems(reordered);
    saveOrder(reordered);
  };

  const getTabLabel = () => {
    if (tab === "brands") return "Marcas";
    if (tab === "models") return "Modelos";
    if (tab === "categories") return "Categorías / Tipos";
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#111114] border-white/10" data-keyboard-aware>
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="text-white text-xl">
            📋 Administrar Catálogos de Dispositivos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={tab === "categories" ? "default" : "outline"}
              onClick={() => setTab("categories")}
              className={tab === "categories" ? "bg-red-600" : "border-white/15"}>
              Categorías
            </Button>
            <Button
              variant={tab === "brands" ? "default" : "outline"}
              onClick={() => setTab("brands")}
              className={tab === "brands" ? "bg-red-600" : "border-white/15"}>
              Marcas
            </Button>
            <Button
              variant={tab === "models" ? "default" : "outline"}
              onClick={() => setTab("models")}
              className={tab === "models" ? "bg-red-600" : "border-white/15"}>
              Modelos
            </Button>
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
            <p className="text-sm text-blue-200">
              💡 <strong>Editando: {getTabLabel()}</strong>
              <br />
              Arrastra el ícono <GripVertical className="inline w-3.5 h-3.5" /> para cambiar el orden de visualización en el Wizard.
            </p>
          </div>

          {/* Añadir nuevo */}
          <div className="p-4 bg-black/40 rounded-lg border border-white/10">
            <Label className="text-gray-300 font-medium mb-2 block">Añadir nuevo:</Label>
            <div className="flex gap-2">
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`Nombre de la ${tab === "brands" ? "marca" : tab === "models" ? "modelo" : "categoría"}...`}
                className="bg-black/40 border-white/15 text-white flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <Button onClick={handleAdd} className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                Añadir
              </Button>
            </div>
          </div>

          {/* Lista de items con drag & drop */}
          <div className="space-y-2">
            <Label className="text-gray-300 font-medium">
              {getTabLabel()} actuales ({items.length}):
            </Label>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Sin elementos</div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="catalog-list">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-1"
                    >
                      {items.map((item, index) => (
                        <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${
                                snapshot.isDragging
                                  ? "bg-red-600/20 border-red-500/50 shadow-lg"
                                  : "bg-white/5 border-white/10 hover:border-red-600/30"
                              }`}
                            >
                              {/* Drag handle */}
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-white flex-shrink-0"
                                title="Arrastra para reordenar"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              {/* Nombre (editable) */}
                              {editingId === item.id ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="bg-black/40 border-white/15 text-white flex-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleEdit(item.id, editValue);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingId(null);
                                      setEditValue("");
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white flex-1 truncate">{item.name}</span>
                              )}

                              {/* Botones de acción */}
                              {editingId === item.id ? (
                                <Button
                                  size="icon"
                                  onClick={() => handleEdit(item.id, editValue)}
                                  className="h-8 w-8 bg-green-600 hover:bg-green-700">
                                  <Save className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingId(item.id);
                                    setEditValue(item.name);
                                  }}
                                  className="h-8 w-8 text-gray-400 hover:text-white">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(item.id)}
                                className="h-8 w-8 text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </div>

        {/* Botón cerrar */}
        <div className="border-t border-white/10 pt-4">
          <Button onClick={onClose} variant="outline" className="w-full border-white/15">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
