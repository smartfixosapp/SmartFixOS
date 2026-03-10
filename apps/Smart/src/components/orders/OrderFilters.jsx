import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";

export default function OrderFilters({ filters, setFilters, employees }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Filter className="w-5 h-5 text-gray-400" />
      
      <Select 
        value={filters.status} 
        onValueChange={(value) => setFilters({ ...filters, status: value })}
      >
        <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white shadow-sm">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los Estados</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="in_progress">En Progreso</SelectItem>
          <SelectItem value="waiting_parts">Esperando Piezas</SelectItem>
          <SelectItem value="ready">Listo</SelectItem>
          <SelectItem value="completed">Completado</SelectItem>
          <SelectItem value="delivered">Entregado</SelectItem>
          <SelectItem value="overdue">Atrasados (2+ semanas)</SelectItem>
        </SelectContent>
      </Select>

      <Select 
        value={filters.priority} 
        onValueChange={(value) => setFilters({ ...filters, priority: value })}
      >
        <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white shadow-sm">
          <SelectValue placeholder="Prioridad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las Prioridades</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="urgent">Urgente</SelectItem>
        </SelectContent>
      </Select>

      {employees && employees.length > 0 && (
        <Select 
          value={filters.employee} 
          onValueChange={(value) => setFilters({ ...filters, employee: value })}
        >
          <SelectTrigger className="w-48 bg-gray-900 border-gray-700 text-white shadow-sm">
            <SelectValue placeholder="Empleado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Empleados</SelectItem>
            {employees.map(emp => (
              <SelectItem key={emp.id} value={emp.full_name || emp.email}>
                {emp.full_name || emp.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
