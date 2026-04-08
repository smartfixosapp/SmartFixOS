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
    gradient: "from-blue-500 to-cyan-500"
  },
  { 
    page: "SettingsMobile", 
    label: "Ajustes", 
    icon: Settings,
    gradient: "from-slate-600 to-slate-800"
  }
];

export default function MenuPage() {
  const navigate = useNavigate();

  return (
    // IMPORTANTE: h-full en lugar de min-h-screen para evitar desbordamiento que activa barras del navegador
    <div className="h-full bg-[#1A1A1A] p-6 pb-20 animate-in fade-in duration-300 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Menú</h1>
          <p className="text-sm text-gray-400">Navegación rápida</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate(-1)}
          aria-label="Cerrar menú"
          className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white"
        >
          <X className="w-7 h-7" />
        </Button>
      </div>
      
      {/* Grid of Apps */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 sm:gap-6 pb-10">
        {allMenuItems.map(({ page, label, icon: Icon, gradient }) => (
          <Link
            key={page}
            to={createPageUrl(page)}
            className="flex flex-col items-center gap-3 p-2 group"
          >
            <div className={`
              w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] bg-gradient-to-br ${gradient} 
              flex items-center justify-center text-white shadow-lg 
              group-active:scale-95 transition-all duration-200
              shadow-gray-200 dark:shadow-none
            `}>
              <Icon className="w-8 h-8" strokeWidth={2} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-center text-gray-300">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
