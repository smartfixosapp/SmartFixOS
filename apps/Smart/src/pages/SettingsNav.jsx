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
import { cn } from "@/lib/utils";

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
      className="min-h-dvh apple-surface apple-type p-4 pb-28"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
    >
      {/* Header estilo iOS */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate("/SettingsMobile")}
          aria-label="Volver a configuración"
          className="apple-press h-10 pl-1 pr-2 rounded-full flex items-center gap-1 text-apple-blue"
        >
          <ChevronLeft className="w-[22px] h-[22px]" strokeWidth={2.4} />
          <span className="apple-text-body">Volver</span>
        </button>
      </div>
      <div className="mb-6 flex items-start gap-3 px-1">
        <div className="w-11 h-11 rounded-apple-sm bg-apple-blue/15 text-apple-blue flex items-center justify-center shrink-0">
          <LayoutGrid className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="apple-text-title1 apple-label-primary">Personalizar menú</h1>
          <p className="apple-text-footnote apple-label-secondary mt-0.5">Elige qué accesos mostrar en la barra inferior</p>
        </div>
      </div>

      {/* Lista estilo iOS Settings */}
      <div className="apple-list">
        {/* Home is always active */}
        <div className="apple-list-row opacity-60 cursor-not-allowed">
          <div className="apple-list-row-icon" style={{ backgroundColor: "rgb(var(--sys-gray-1))" }}>
            <Home className="w-4 h-4" />
          </div>
          <span className="apple-list-row-title">Inicio</span>
          <span className="apple-text-footnote apple-label-tertiary mr-3">Fijo</span>
          <Switch checked={true} disabled />
        </div>

        {AVAILABLE_ITEMS.map((item) => (
          <div key={item.id} className="apple-list-row cursor-default">
            <div
              className="apple-list-row-icon"
              style={{
                backgroundColor: config[item.id]
                  ? "rgb(var(--apple-blue))"
                  : "rgb(var(--sys-gray-3))"
              }}
            >
              <item.icon className="w-4 h-4" />
            </div>
            <span className={cn(
              "apple-list-row-title",
              !config[item.id] && "apple-label-secondary"
            )}>
              {item.label}
            </span>
            <Switch
              checked={config[item.id]}
              onCheckedChange={() => toggleItem(item.id)}
              className="data-[state=checked]:bg-apple-green"
            />
          </div>
        ))}
      </div>

      {/* Botón guardar flotante estilo iOS */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          backgroundColor: "rgb(var(--surface-primary) / 0.85)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          backdropFilter: "blur(24px) saturate(180%)",
          borderTop: "0.5px solid rgb(var(--separator) / 0.29)",
        }}
      >
        <button
          onClick={handleSave}
          className="apple-btn apple-btn-primary apple-btn-lg"
        >
          <Save className="w-[18px] h-[18px]" />
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
