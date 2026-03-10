import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { 
  Check, X, AlertCircle,
  Power, Volume2, Wifi, Battery, Camera, Mic,
  Smartphone, Zap, Speaker, Fingerprint, RefreshCw
} from "lucide-react";

const CHECKLIST_ITEMS = [
  { id: "power", label: "Encendido", icon: Power },
  { id: "screen", label: "Pantalla", icon: Smartphone },
  { id: "touch", label: "Touch", icon: Fingerprint },
  { id: "speakers", label: "Bocinas", icon: Speaker },
  { id: "microphone", label: "Micrófono", icon: Mic },
  { id: "camera_front", label: "Cámara Frontal", icon: Camera },
  { id: "camera_back", label: "Cámara Trasera", icon: Camera },
  { id: "buttons", label: "Botones", icon: Volume2 },
  { id: "wifi", label: "WiFi", icon: Wifi },
  { id: "bluetooth", label: "Bluetooth", icon: Wifi },
  { id: "charging", label: "Carga", icon: Zap },
  { id: "battery", label: "Batería", icon: Battery },
  { id: "ports", label: "Puertos", icon: RefreshCw }
];

const STATUS_OPTIONS = [
  { value: "ok", label: "Funciona", color: "emerald", icon: Check },
  { value: "damaged", label: "Dañado", color: "red", icon: X },
  { value: "not_tested", label: "No probado", color: "gray", icon: AlertCircle }
];

export default function ChecklistIconsStep({ formData, updateFormData }) {
  const [items, setItems] = useState(formData.checklist_items || []);
  const [notes, setNotes] = useState(formData.checklist_notes || "");

  useEffect(() => {
    // Inicializar items si está vacío
    if (items.length === 0) {
      const initialItems = CHECKLIST_ITEMS.map(item => ({
        id: item.id,
        label: item.label,
        status: "not_tested",
        notes: ""
      }));
      setItems(initialItems);
    }
  }, []);

  useEffect(() => {
    updateFormData("checklist_items", items);
  }, [items]);

  useEffect(() => {
    updateFormData("checklist_notes", notes);
  }, [notes]);

  const handleStatusChange = (itemId, newStatus) => {
    setItems(prevItems => {
      const existing = prevItems.find(i => i.id === itemId);
      if (existing) {
        return prevItems.map(i => i.id === itemId ? { ...i, status: newStatus } : i);
      } else {
        const item = CHECKLIST_ITEMS.find(i => i.id === itemId);
        return [...prevItems, { id: itemId, label: item.label, status: newStatus, notes: "" }];
      }
    });
  };

  const getItemStatus = (itemId) => {
    const item = items.find(i => i.id === itemId);
    return item?.status || "not_tested";
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "ok": return "emerald";
      case "damaged": return "red";
      default: return "gray";
    }
  };

  const okCount = items.filter(i => i.status === "ok").length;
  const damagedCount = items.filter(i => i.status === "damaged").length;
  const notTestedCount = CHECKLIST_ITEMS.length - okCount - damagedCount;

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div>
        <h3 className="text-white text-xl font-semibold mb-2">Inspección del Equipo</h3>
        <p className="text-gray-400 text-sm mb-4">
          Verifica cada componente y marca su estado actual
        </p>
        
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-emerald-600/10 border-emerald-500/30 p-3">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-emerald-400">{okCount}</p>
                <p className="text-xs text-emerald-300">Funcionan</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-red-600/10 border-red-500/30 p-3">
            <div className="flex items-center gap-2">
              <X className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-red-400">{damagedCount}</p>
                <p className="text-xs text-red-300">Dañados</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-gray-600/10 border-gray-500/30 p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-2xl font-bold text-gray-400">{notTestedCount}</p>
                <p className="text-xs text-gray-300">Sin probar</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Grid de items con diseño mejorado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHECKLIST_ITEMS.map((item) => {
          const Icon = item.icon;
          const status = getItemStatus(item.id);
          const color = getStatusColor(status);

          return (
            <Card 
              key={item.id} 
              className={`
                p-4 border-2 transition-all
                ${status === "ok" ? "border-emerald-500/40 bg-emerald-600/10" : 
                  status === "damaged" ? "border-red-500/40 bg-red-600/10" : 
                  "border-white/10 bg-black/40"}
              `}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${status === "ok" ? "bg-emerald-600/20" : 
                    status === "damaged" ? "bg-red-600/20" : 
                    "bg-gray-600/20"}
                `}>
                  <Icon className={`w-5 h-5 ${
                    status === "ok" ? "text-emerald-400" : 
                    status === "damaged" ? "text-red-400" : 
                    "text-gray-400"
                  }`} />
                </div>
                <span className="text-white font-medium text-sm">{item.label}</span>
              </div>

              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const OptionIcon = opt.icon;
                  const isSelected = status === opt.value;
                  
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleStatusChange(item.id, opt.value)}
                      className={`
                        flex-1 p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1
                        ${isSelected 
                          ? `border-${opt.color}-500 bg-${opt.color}-600/30 text-${opt.color}-300` 
                          : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30"}
                      `}
                      style={{
                        ...(isSelected && {
                          borderColor: opt.color === "emerald" ? "#10b981" : opt.color === "red" ? "#ef4444" : "#6b7280",
                          backgroundColor: opt.color === "emerald" ? "rgba(16, 185, 129, 0.2)" : opt.color === "red" ? "rgba(239, 68, 68, 0.2)" : "rgba(107, 114, 128, 0.2)",
                          color: opt.color === "emerald" ? "#6ee7b7" : opt.color === "red" ? "#fca5a5" : "#d1d5db"
                        })
                      }}
                    >
                      <OptionIcon className="w-4 h-4" />
                      <span className="text-[10px] font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Notas adicionales */}
      <div>
        <Label className="text-gray-300 mb-2 block">
          Notas Adicionales (opcional)
        </Label>
        <Textarea
          placeholder="Ej: Rayones en la pantalla, golpe en esquina inferior derecha..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-black/40 border-white/15 text-white placeholder:text-gray-500 min-h-[100px]"
        />
      </div>

      {/* Barra de progreso */}
      <Card className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-blue-500/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">Progreso de inspección</span>
          <span className="text-sm font-bold text-white">
            {((okCount + damagedCount) / CHECKLIST_ITEMS.length * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
            style={{ width: `${((okCount + damagedCount) / CHECKLIST_ITEMS.length * 100)}%` }}
          />
        </div>
      </Card>
    </div>
  );
}
