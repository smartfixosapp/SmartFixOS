import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Palette, Eye } from "lucide-react";

const DEFAULT_THEME = {
  primary_color: "#DC2626",
  secondary_color: "#1F2937",
  accent_color: "#EF4444",
  success_color: "#10B981",
  warning_color: "#F59E0B",
  error_color: "#DC2626",
  background_start: "#0D0D0D",
  background_end: "#1A1A1A",
  card_bg: "#1F2937",
  border_color: "#374151",
  font_family: "Inter, system-ui, sans-serif"
};

export default function ThemesTab({ user }) {
  const [data, setData] = useState(DEFAULT_THEME);
  const [originalData, setOriginalData] = useState(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onSave = () => saveData();
    const onRevert = () => setData(originalData);
    
    window.addEventListener("settings-save", onSave);
    window.addEventListener("settings-revert", onRevert);
    
    return () => {
      window.removeEventListener("settings-save", onSave);
      window.removeEventListener("settings-revert", onRevert);
    };
  }, [originalData]);

  useEffect(() => {
    const isDirty = JSON.stringify(data) !== JSON.stringify(originalData);
    if (isDirty) {
      window.dispatchEvent(new Event("settings-dirty"));
    }
  }, [data, originalData]);

  const loadData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.theme" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_THEME, ...parsed });
        setOriginalData({ ...DEFAULT_THEME, ...parsed });
      } else {
        setData(DEFAULT_THEME);
        setOriginalData(DEFAULT_THEME);
      }
    } catch (e) {
      console.error("Error loading theme:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.theme" });
      
      const payload = {
        key: "settings.theme",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de temas visuales"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.theme",
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role,
        changes: { before: originalData, after: data }
      });

      setOriginalData(data);
      window.dispatchEvent(new Event("settings-clean"));
      window.dispatchEvent(new Event("force-refresh"));
      
      alert("Tema guardado. Recarga la página para ver cambios.");
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  const resetToDefault = () => {
    if (!confirm("¿Restaurar tema por defecto?")) return;
    setData(DEFAULT_THEME);
  };

  if (loading) return <div className="text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-red-500" />
            Colores del Sistema
          </CardTitle>
          <CardDescription>Personaliza la apariencia visual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data).filter(([key]) => key.includes("color") || key.includes("background")).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <Label className="text-gray-300 capitalize">
                  {key.replace(/_/g, " ")}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={value}
                    onChange={(e) => setData({ ...data, [key]: e.target.value })}
                    className="w-20 h-10 p-1 bg-black border-gray-700"
                  />
                  <Input
                    value={value}
                    onChange={(e) => setData({ ...data, [key]: e.target.value })}
                    className="flex-1 bg-black border-gray-700 text-white"
                    placeholder="#000000"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={resetToDefault} variant="outline" className="border-gray-700">
              Restaurar por defecto
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="border-gray-700"
            >
              <Eye className="w-4 h-4 mr-2" />
              Vista previa (recargar)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
