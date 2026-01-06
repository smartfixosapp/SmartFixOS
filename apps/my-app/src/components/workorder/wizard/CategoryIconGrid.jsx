import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Smartphone, Laptop, Tablet, Watch, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">Selecciona la categoría</h3>
        <p className="text-gray-400 text-sm">¿Qué tipo de equipo vamos a reparar?</p>
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
    </div>
  );
}
