import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  ClipboardList,
  ShoppingCart,
  Package,
  Users,
  Clock,
  DollarSign,
  BarChart3,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

const menuItems = [
  { title: "Órdenes", icon: ClipboardList, page: "Orders", roles: ["admin", "manager", "frontdesk", "technician"] },
  { title: "POS", icon: ShoppingCart, page: "POS", roles: ["admin", "manager", "frontdesk"] },
  { title: "Inventario", icon: Package, page: "Inventory", roles: ["admin", "manager"] },
  { title: "Clientes", icon: Users, page: "Customers", roles: ["admin", "manager", "frontdesk"] },
  { title: "Ponches", icon: Clock, page: "TimeTracking", roles: ["admin", "manager", "frontdesk", "technician"] },
  { title: "Financiero", icon: DollarSign, page: "Financial", roles: ["admin", "manager"] },
  { title: "Reportes", icon: BarChart3, page: "Reports", roles: ["admin", "manager"] },
];

const adminItems = [
  { title: "Configuración", icon: Settings, page: "Settings", roles: ["admin"] }
];

export default function ActionsMenu({ user }) {
  const navigate = useNavigate();

  const handleNavigate = (page) => {
    navigate(createPageUrl(page), { state: { fromDashboard: true } });
  };

  const canAccess = (item) => user && item.roles.includes(user.role);

  const visibleItems = menuItems.filter(canAccess);
  const visibleAdminItems = adminItems.filter(canAccess);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="bg-gray-900/50 text-slate-50 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border h-10 border-gray-700 hover:bg-red-900/30 hover:text-red-400">
          <LayoutGrid className="w-4 h-4 mr-2" />
          Menú
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-gradient-to-br from-[#2b2b2b] to-black border-red-800/50 text-white">
        <DropdownMenuLabel>Atajos del Sistema</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-red-800/50" />
        {visibleItems.map(item => (
          <DropdownMenuItem key={item.page} onClick={() => handleNavigate(item.page)} className="cursor-pointer focus:bg-red-900/50">
            <item.icon className="w-4 h-4 mr-2" />
            <span>{item.title}</span>
          </DropdownMenuItem>
        ))}
        {visibleAdminItems.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-red-800/50" />
            {visibleAdminItems.map(item => (
              <DropdownMenuItem key={item.page} onClick={() => handleNavigate(item.page)} className="cursor-pointer focus:bg-red-900/50">
                <item.icon className="w-4 h-4 mr-2" />
                <span>{item.title}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
