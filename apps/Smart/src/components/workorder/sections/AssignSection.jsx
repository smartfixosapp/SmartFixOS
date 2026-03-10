import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function AssignSection({ order }) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          Asignación y Creación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-gray-400">Técnico asignado</label>
          <p className="text-white text-lg">
            {order.assigned_to_name || order.assigned_to || "Sin asignar"}
          </p>
        </div>

        <div className="pt-4 border-t border-gray-800">
          <label className="text-sm text-gray-400 mb-2 block">Creado por</label>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-gray-300">
              {order.created_by_name || order.created_by || "Sistema"}
            </span>
          </div>
          {order.created_date && (
            <p className="text-xs text-gray-500 mt-1">
              {format(new Date(order.created_date), "dd MMM yyyy, HH:mm", { locale: es })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
