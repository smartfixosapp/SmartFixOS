import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Smartphone, Laptop, Tablet, Watch, Wrench, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const defaultCategories = [
  { id: "smartphone", name: "Smartphone", icon: "📱", Icon: Smartphone },
  { id: "laptop", name: "Laptop", icon: "💻", Icon: Laptop },
  { id: "tablet", name: "Tablet", icon: "📱", Icon: Tablet },
  { id: "smartwatch", name: "SmartWatch", icon: "⌚", Icon: Watch },
  { id: "other", name: "Otro", icon: "🔧", Icon: Wrench }
];

export default function CategoryIconGrid({ formData, updateFormData }) {
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.DeviceCategory.filter({ active: true });
      
      if (data.length === 0) {
        // Use defaults and create them
        for (const cat of defaultCategories) {
          await base44.entities.DeviceCategory.create({
            name: cat.name,
            icon: cat.icon,
            active: true,
            order: defaultCategories.indexOf(cat)
          });
        }
        setCategories(defaultCategories.map((c, i) => ({ ...c, order: i })));
      } else {
        // Map existing categories with icons
        const mapped = data.map(cat => {
          const def = defaultCategories.find(d => d.name.toLowerCase() === cat.name.toLowerCase());
          return {
            ...cat,
            Icon: def?.Icon || Wrench
          };
        });
        setCategories(mapped.sort((a, b) => (a.order || 0) - (b.order || 0)));
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      setCategories(defaultCategories);
    }
    setLoading(false);
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (category) => {
    updateFormData('device_type', category.name);
    updateFormData('device_category', category);
    updateFormData('device_brand', null);
    updateFormData('device_subcategory', null);
    updateFormData('device_family', null);
    updateFormData('device_model', null);
  };

  const handleKeyDown = (e, category) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(category);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      const newCat = await base44.entities.DeviceCategory.create({
        name: newCategoryName.trim(),
        icon: "📱",
        active: true,
        order: categories.length
      });

      toast.success(`✅ Categoría "${newCategoryName}" creada`);
      setNewCategoryName("");
      setShowNewCategory(false);
      await loadCategories();
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("No se pudo crear la categoría");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">Selecciona la categoría</h3>
          <p className="text-gray-400 text-sm">¿Qué tipo de equipo vamos a reparar?</p>
        </div>
        <Button
          onClick={() => setShowNewCategory(true)}
          className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Categoría
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          placeholder="Buscar categoría..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-black border-gray-700 text-white"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredCategories.map(category => {
          const IconComponent = category.Icon;
          const isSelected = formData.device_category?.id === category.id;
          
          return (
            <Card
              key={category.id}
              onClick={() => handleSelect(category)}
              onKeyDown={(e) => handleKeyDown(e, category)}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              className={`
                p-6 cursor-pointer transition-all 
                hover:scale-105 active:scale-95
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black
                min-h-[44px]
                ${isSelected
                  ? 'bg-gradient-to-br from-red-600 to-red-800 border-red-500 shadow-lg shadow-red-600/50 ring-2 ring-red-500'
                  : 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-red-500/50'
                }
              `}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`
                  w-16 h-16 rounded-2xl flex items-center justify-center
                  ${isSelected ? 'bg-white/20' : 'bg-gray-800'}
                `}>
                  {category.icon_url ? (
                    <img src={category.icon_url} alt={category.name} className="w-12 h-12 object-contain" />
                  ) : category.icon ? (
                    <span className="text-4xl">{category.icon}</span>
                  ) : (
                    <IconComponent className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-white text-lg">{category.name}</p>
                  {isSelected && (
                    <Badge className="mt-2 bg-white/20 text-white border-white/30 text-xs">
                      ✓ Seleccionado
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No se encontraron categorías</p>
        </div>
      )}

      {/* Modal para crear nueva categoría */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent className="bg-[#0A0A0A]/95 backdrop-blur-2xl border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-2xl">
                <Plus className="w-6 h-6 text-cyan-400" />
              </div>
              <span>Nueva Categoría</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm text-white/70 mb-2 block">
              Nombre de la categoría
            </label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ej: Consola de juegos, Auriculares..."
              className="bg-black/40 border-white/20 text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
              }}
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowNewCategory(false);
                setNewCategoryName("");
              }}
              className="border-white/20 flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCategory}
              className="bg-gradient-to-r from-cyan-600 to-emerald-600 flex-1"
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
