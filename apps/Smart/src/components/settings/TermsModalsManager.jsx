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
        tint: "green",
        value: appConfig.warranty_sales || "",
      },
      warranty_repairs: {
        title: "Garantía por Orden de Trabajo",
        icon: Shield,
        tint: "blue",
        value: appConfig.warranty_repairs || "",
      },
      terms_sales: {
        title: "Términos y Condiciones - Ventas",
        icon: FileText,
        tint: "orange",
        value: appConfig.terms_sales || "",
      },
      terms_repairs: {
        title: "Términos y Condiciones - Reparaciones",
        icon: FileText,
        tint: "blue",
        value: appConfig.terms_repairs || "",
      },
    };
    return configs[activeModal] || {};
  };

  const config = getModalConfig();
  const Icon = config.icon || FileText;

  return (
    <div className="apple-type pt-4" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
      <h4 className="apple-label-primary apple-text-headline mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-apple-orange" />
        Términos y Garantías
      </h4>
      <p className="apple-text-caption1 apple-label-tertiary mb-4">
        Define los términos y garantías que los clientes verán en emails y formularios
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
         <button
           onClick={() => openModal("warranty_sales")}
           className="flex items-center gap-3 p-4 rounded-apple-md bg-apple-green/12 text-left transition-all group apple-press"
         >
           <div className="w-10 h-10 rounded-apple-sm bg-apple-green/15 flex items-center justify-center text-apple-green group-hover:scale-110 transition-transform">
             <Shield className="w-5 h-5" />
           </div>
           <div className="flex-1">
             <p className="apple-label-primary apple-text-subheadline">Garantía por Venta</p>
             <p className="apple-text-caption1 apple-label-tertiary">
               {appConfig.warranty_sales ? "Configurado" : "No configurado"}
             </p>
           </div>
         </button>

         <button
           onClick={() => openModal("warranty_repairs")}
           className="flex items-center gap-3 p-4 rounded-apple-md bg-apple-blue/12 text-left transition-all group apple-press"
         >
           <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center text-apple-blue group-hover:scale-110 transition-transform">
             <Shield className="w-5 h-5" />
           </div>
           <div className="flex-1">
             <p className="apple-label-primary apple-text-subheadline">Garantía por Reparación</p>
             <p className="apple-text-caption1 apple-label-tertiary">
               {appConfig.warranty_repairs ? "Configurado" : "No configurado"}
             </p>
           </div>
         </button>

         <button
           onClick={() => openModal("terms_sales")}
           className="flex items-center gap-3 p-4 rounded-apple-md bg-apple-orange/12 text-left transition-all group apple-press"
         >
           <div className="w-10 h-10 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center text-apple-orange group-hover:scale-110 transition-transform">
             <FileText className="w-5 h-5" />
           </div>
           <div className="flex-1">
             <p className="apple-label-primary apple-text-subheadline">Términos - Ventas</p>
             <p className="apple-text-caption1 apple-label-tertiary">
               {appConfig.terms_sales ? "Configurado" : "No configurado"}
             </p>
           </div>
         </button>

         <button
           onClick={() => openModal("terms_repairs")}
           className="flex items-center gap-3 p-4 rounded-apple-md bg-apple-blue/12 text-left transition-all group apple-press"
         >
           <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center text-apple-blue group-hover:scale-110 transition-transform">
             <FileText className="w-5 h-5" />
           </div>
           <div className="flex-1">
             <p className="apple-label-primary apple-text-subheadline">Términos - Reparaciones</p>
             <p className="apple-text-caption1 apple-label-tertiary">
               {appConfig.terms_repairs ? "Configurado" : "No configurado"}
             </p>
           </div>
         </button>
       </div>

      {/* Modal para editar */}
      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-2xl z-[9999]">
          <DialogHeader className="p-6" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center text-apple-blue">
                <Icon className="w-5 h-5" />
              </div>
              <DialogTitle className="apple-label-primary apple-text-title3">{config.title}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <textarea
              value={tempText}
              onChange={(e) => setTempText(e.target.value)}
              placeholder="Escribe el contenido aquí..."
              className="apple-input w-full h-64 p-4 resize-none"
            />

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setActiveModal(null)}
                className="apple-btn apple-btn-secondary apple-press"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="apple-btn apple-btn-primary apple-press"
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
