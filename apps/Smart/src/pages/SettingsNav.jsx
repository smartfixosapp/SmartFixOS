import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Home, ClipboardList, Wallet, Users, Settings, 
  ChevronLeft, Save, LayoutGrid 
} from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_ITEMS = [
  { id: "orders", label: "Órdenes", icon: ClipboardList, path: "/OrdersMobile" },
  { id: "pos", label: "Caja / POS", icon: Wallet, path: "/POS" },
  { id: "customers", label: "Clientes", icon: Users, path: "/Customers" },
  { id: "settings", label: "Ajustes", icon: Settings, path: "/SettingsMobile" },
];

export default function SettingsNav() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    orders: true,
    pos: true,
    customers: true,
    settings: true
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const settings = await dataClient.entities.AppSettings.filter({ slug: "mobile-nav-config" });
      if (settings.length > 0) {
        setConfig(settings[0].payload || config);
      }
    } catch (error) {
      console.error("Error loading nav config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Save to AppSettings
      // First check if exists
      const existing = await dataClient.entities.AppSettings.filter({ slug: "mobile-nav-config" });
      
      if (existing.length > 0) {
        await dataClient.entities.AppSettings.update(existing[0].id, {
          payload: config
        });
      } else {
        await dataClient.entities.AppSettings.create({
          slug: "mobile-nav-config",
          payload: config,
          description: "Mobile Navigation Configuration"
        });
      }
      
      // Trigger a custom event so the nav updates immediately
      window.dispatchEvent(new Event("nav-config-updated"));
      
      toast.success("Configuración guardada");
      navigate("/SettingsMobile");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Error al guardar");
    }
  };

  const toggleItem = (id) => {
    setConfig(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className="min-h-screen bg-black p-4 pb-24 text-white"
      style={{ paddingTop: "10px" }}
    >
      <div className="flex items-center gap-3 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/SettingsMobile")}
          aria-label="Volver a configuración"
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-cyan-500" />
            Personalizar Menú
          </h1>
          <p className="text-gray-400 text-xs">Elige qué accesos mostrar en la barra inferior</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Home is always active */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold">Inicio</span>
          </div>
          <Switch checked={true} disabled />
        </div>

        {AVAILABLE_ITEMS.map((item) => (
          <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                config[item.id] ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-white/40"
              }`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className={`font-semibold ${config[item.id] ? "text-white" : "text-white/50"}`}>
                {item.label}
              </span>
            </div>
            <Switch 
              checked={config[item.id]} 
              onCheckedChange={() => toggleItem(item.id)} 
              className="data-[state=checked]:bg-cyan-600"
            />
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/10">
        <Button 
          onClick={handleSave} 
          className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg"
        >
          <Save className="w-5 h-5 mr-2" />
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
