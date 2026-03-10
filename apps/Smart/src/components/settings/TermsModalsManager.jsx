import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, FileText, Shield, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function TermsModalsManager({ appConfig, setAppConfig, saveAppConfig, loading }) {
  const [activeModal, setActiveModal] = useState(null);
  const [tempText, setTempText] = useState("");

  const openModal = (type) => {
    if (type === "sales") {
      setTempText(appConfig.terms_sales || "");
    } else if (type === "repairs") {
      setTempText(appConfig.terms_repairs || "");
    } else if (type === "warranty_sales") {
      setTempText(appConfig.warranty_sales || "");
    } else if (type === "warranty_repairs") {
      setTempText(appConfig.warranty_repairs || "");
    }
    setActiveModal(type);
  };

  const handleSave = async () => {
    const updates = {};
    if (activeModal === "sales") {
      updates.terms_sales = tempText;
    } else if (activeModal === "repairs") {
      updates.terms_repairs = tempText;
    } else if (activeModal === "warranty_sales") {
      updates.warranty_sales = tempText;
    } else if (activeModal === "warranty_repairs") {
      updates.warranty_repairs = tempText;
    }

    const newConfig = { ...appConfig, ...updates };
    setAppConfig(newConfig);
    setActiveModal(null);
    
    // Guardar en BD automáticamente
    await saveAppConfig();
  };

  const getModalConfig = () => {
    const configs = {
      warranty_sales: {
        title: "Garantía por Venta",
        icon: Shield,
        color: "emerald",
        value: appConfig.warranty_sales || "",
      },
      warranty_repairs: {
        title: "Garantía por Orden de Trabajo",
        icon: Shield,
        color: "blue",
        value: appConfig.warranty_repairs || "",
      },
      terms_sales: {
        title: "Términos y Condiciones - Ventas",
        icon: FileText,
        color: "orange",
        value: appConfig.terms_sales || "",
      },
      terms_repairs: {
        title: "Términos y Condiciones - Reparaciones",
        icon: FileText,
        color: "cyan",
        value: appConfig.terms_repairs || "",
      },
    };
    return configs[activeModal] || {};
  };

  const config = getModalConfig();
  const Icon = config.icon || FileText;

  return (
    <div className="border-t border-white/10 pt-4 theme-light:border-gray-200">
      <h4 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
        <Shield className="w-5 h-5 text-amber-400" />
        Términos y Garantías
      </h4>
      <p className="text-xs text-gray-400 mb-4 theme-light:text-gray-600">
        Define los términos y garantías que los clientes verán en emails y formularios
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
         <button
           onClick={() => openModal("warranty_sales")}
           className="flex items-center gap-3 p-4 rounded-xl bg-emerald-600/10 border border-emerald-500/30 hover:border-emerald-500/60 text-left transition-all group theme-light:bg-emerald-50 theme-light:border-emerald-300"
         >
           <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform theme-light:bg-emerald-100 theme-light:text-emerald-600">
             <Shield className="w-5 h-5" />
           </div>
           <div className="flex-1">
             <p className="text-white font-bold text-sm theme-light:text-gray-900">Garantía por Venta</p>
             <p className="text-xs text-gray-400 theme-light:text-gray-600">
               {appConfig.warranty_sales ? "Configurado ✓" : "No configurado"}
             </p>
           </div>
         </button>

         <button
           onClick={() => openModal("warranty_repairs")}
           className="flex items-center gap-3 p-4 rounded-xl bg-blue-600/10 border border-blue-500/30 hover:border-blue-500/60 text-left transition-all group theme-light:bg-blue-50 theme-light:border-blue-300"
         >
           <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform theme-light:bg-blue-100 theme-light:text-blue-600">
             <Shield className="w-5 h-5" />
           </div>
           <div className="flex-1">
             <p className="text-white font-bold text-sm theme-light:text-gray-900">Garantía por Reparación</p>
             <p className="text-xs text-gray-400 theme-light:text-gray-600">
               {appConfig.warranty_repairs ? "Configurado ✓" : "No configurado"}
             </p>
           </div>
         </button>

         <button
           onClick={() => openModal("terms_sales")}
           className="flex items-center gap-3 p-4 rounded-xl bg-orange-600/10 border border-orange-500/30 hover:border-orange-500/60 text-left transition-all group theme-light:bg-orange-50 theme-light:border-orange-300"
         >
           <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform theme-light:bg-orange-100 theme-light:text-orange-600">
             <FileText className="w-5 h-5" />
           </div>
           <div className="flex-1">
             <p className="text-white font-bold text-sm theme-light:text-gray-900">Términos - Ventas</p>
             <p className="text-xs text-gray-400 theme-light:text-gray-600">
               {appConfig.terms_sales ? "Configurado ✓" : "No configurado"}
             </p>
           </div>
         </button>

         <button
           onClick={() => openModal("terms_repairs")}
           className="flex items-center gap-3 p-4 rounded-xl bg-cyan-600/10 border border-cyan-500/30 hover:border-cyan-500/60 text-left transition-all group theme-light:bg-cyan-50 theme-light:border-cyan-300"
         >
           <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform theme-light:bg-cyan-100 theme-light:text-cyan-600">
             <FileText className="w-5 h-5" />
           </div>
           <div className="flex-1">
             <p className="text-white font-bold text-sm theme-light:text-gray-900">Términos - Reparaciones</p>
             <p className="text-xs text-gray-400 theme-light:text-gray-600">
               {appConfig.terms_repairs ? "Configurado ✓" : "No configurado"}
             </p>
           </div>
         </button>
       </div>

      {/* Modal para editar */}
      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-950 to-black border border-white/10 p-0 z-[9999] overflow-hidden shadow-2xl">
          <DialogHeader className="border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-${config.color}-500/20 flex items-center justify-center text-${config.color}-400`}>
                <Icon className="w-5 h-5" />
              </div>
              <DialogTitle className="text-white text-lg">{config.title}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <textarea
              value={tempText}
              onChange={(e) => setTempText(e.target.value)}
              placeholder="Escribe el contenido aquí..."
              className="w-full h-64 bg-black/40 border border-white/10 text-white p-4 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setActiveModal(null)}
                className="border-white/10 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700"
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
