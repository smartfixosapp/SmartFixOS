import React from "react";
import { LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LogoutModal({ open, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md apple-surface-elevated rounded-apple-lg shadow-apple-xl apple-type overflow-hidden">
        {/* Header */}
        <div
          className="px-5 pt-5 pb-3 flex items-center justify-between"
          style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-apple-sm bg-apple-red/15 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-apple-red" />
            </div>
            <h3 className="apple-text-title2 apple-label-primary">Cerrar Sesión</h3>
          </div>
          <button
            onClick={onClose}
            className="apple-label-tertiary hover:apple-label-primary transition-colors apple-press">

            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-2">
          <p className="apple-text-body apple-label-primary">
            ¿Estás seguro que deseas cerrar sesión?
          </p>
          <p className="apple-text-footnote apple-label-secondary">
            Tendrás que ingresar tu PIN nuevamente para volver a acceder al sistema.
          </p>
        </div>

        {/* Actions */}
        <div
          className="px-5 py-4 flex gap-3"
          style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <Button
            onClick={onClose}
            variant="outline"
            className="apple-btn apple-btn-secondary apple-btn-lg flex-1">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              localStorage.removeItem("employee_session");
              sessionStorage.removeItem("911-session");
              window.location.href = "/PinAccess";
            }}
            className="apple-btn apple-btn-destructive apple-btn-lg flex-1">

            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </div>);

}
