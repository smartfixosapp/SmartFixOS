import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import {
  Home,
  ClipboardList,
  Wallet,
  Users,
  Settings,
  Zap,
  Package,
  DollarSign,
  BarChart3,
  Clock,
  Calendar,
  Megaphone,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

const allMenuItems = [
  {
    page: "Dashboard",
    label: "Inicio",
    icon: Home,
    tint: "bg-apple-blue/12 text-apple-blue"
  },
  {
    page: "SettingsMobile",
    label: "Ajustes",
    icon: Settings,
    tint: "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
  }
];

export default function MenuPage() {
  const navigate = useNavigate();

  return (
    // IMPORTANTE: h-full en lugar de min-h-screen para evitar desbordamiento que activa barras del navegador
    <div className="h-full apple-surface apple-type p-6 pb-20 animate-in fade-in duration-300 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="apple-text-large-title apple-label-primary">Menú</h1>
          <p className="apple-text-footnote apple-label-secondary">Navegación rápida</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate(-1)}
          aria-label="Cerrar menú"
          className="h-12 w-12 rounded-full bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary apple-press"
        >
          <X className="w-7 h-7" />
        </Button>
      </div>

      {/* Grid of Apps */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 sm:gap-6 pb-10">
        {allMenuItems.map(({ page, label, icon: Icon, tint }) => (
          <Link
            key={page}
            to={createPageUrl(page)}
            className="flex flex-col items-center gap-3 p-2 group apple-press"
          >
            <div className={`
              w-20 h-20 sm:w-24 sm:h-24 rounded-apple-lg ${tint}
              flex items-center justify-center
              group-active:scale-95 transition-all duration-200
            `}>
              <Icon className="w-8 h-8" strokeWidth={2} />
            </div>
            <span className="apple-text-caption1 sm:apple-text-footnote font-medium text-center apple-label-primary">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
