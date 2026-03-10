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
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] p-0 border-cyan-500/25 bg-gradient-to-br from-slate-900 to-black overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-600/10 to-emerald-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Más Opciones</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
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
                  className={`relative overflow-hidden bg-gradient-to-br ${btn.gradient} hover:brightness-110 h-28 flex-col gap-2 rounded-2xl shadow-lg active:scale-95 transition-all p-4`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10" />
                  <IconComponent className="w-7 h-7 relative z-10" />
                  <span className="text-xs font-bold relative z-10 text-center leading-tight">
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
