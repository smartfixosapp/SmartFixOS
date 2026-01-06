import React from "react";
import { LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LogoutModal({ open, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-black border-2 border-red-500/50 rounded-2xl text-white shadow-[0_0_80px_rgba(239,68,68,0.4)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-red-500/30 flex items-center justify-between bg-red-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg">
              <LogOut className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-xl">Cerrar Sesión</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors">

            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-300 text-lg mb-6">
            ¿Estás seguro que deseas cerrar sesión?
          </p>
          <p className="text-gray-400 text-sm">
            Tendrás que ingresar tu PIN nuevamente para volver a acceder al sistema.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-red-500/30 flex gap-3 bg-black/20">
          <Button
            onClick={onClose}
            variant="outline" className="bg-slate-50 text-slate-950 px-4 py-2 text-sm font-medium rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground flex-1 border-gray-600 hover:bg-gray-700/50 h-12">


            Cancelar
          </Button>
          <Button
            onClick={() => {
              localStorage.removeItem("employee_session");
              sessionStorage.removeItem("911-session");
              window.location.href = "/PinAccess";
            }}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 h-12 rounded-xl shadow-lg">

            <LogOut className="w-5 h-5 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </div>);

}
