import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, LayoutGrid } from "lucide-react";
import {
  ClipboardList, Wrench, Smartphone, Zap, Package, Wallet,
  BarChart3, ExternalLink, Users, Settings as SettingsIcon,
  Bell, Clock, ShoppingCart, FileText
} from "lucide-react";

export default function MobileMoreMenu({ open, onClose, buttons, onButtonClick }) {
  const iconMap = {
    'ClipboardList': ClipboardList,
    'Wrench': Wrench,
    'Smartphone': Smartphone,
    'Zap': Zap,
    'Package': Package,
    'Wallet': Wallet,
    'BarChart3': BarChart3,
    'ExternalLink': ExternalLink,
    'Users': Users,
    'SettingsIcon': SettingsIcon,
    'Bell': Bell,
    'Clock': Clock,
    'ShoppingCart': ShoppingCart,
    'FileText': FileText
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type max-w-lg w-[95vw] max-h-[85vh] apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 apple-surface" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-apple-blue" />
            </div>
            <h2 className="apple-text-headline apple-label-primary">Más Opciones</h2>
          </div>
          <button
            onClick={onClose}
            className="apple-press w-8 h-8 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center"
          >
            <X className="w-4 h-4 apple-label-secondary" />
          </button>
        </div>

        {/* Grid de botones */}
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-80px)]">
          <div className="grid grid-cols-2 gap-3">
            {buttons.map(btn => {
              const IconComponent = (typeof btn.icon === 'string' && iconMap[btn.icon])
                ? iconMap[btn.icon]
                : ExternalLink;

              return (
                <Button
                  key={btn.id}
                  onClick={() => {
                    onButtonClick(btn);
                    onClose();
                  }}
                  className="apple-press relative overflow-hidden apple-card h-28 flex-col gap-2 rounded-apple-md p-4"
                >
                  <IconComponent className="w-7 h-7 text-apple-blue relative z-10" />
                  <span className="apple-text-caption1 font-semibold apple-label-primary relative z-10 text-center leading-tight">
                    {btn.label}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
