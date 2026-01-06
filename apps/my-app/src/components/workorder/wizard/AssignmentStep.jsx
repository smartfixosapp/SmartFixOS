import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserCheck, Users } from "lucide-react";

export default function AssignmentStep({ formData, updateFormData, currentUser }) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      
      // Simplificar consulta - solo obtener usuarios activos
      const allUsers = await base44.entities.User.list();
      
      // Filtrar técnicos en el cliente (más confiable que filtros complejos)
      const techs = (allUsers || []).filter(u => {
        if (!u.active) return false;
        const role = (u.role || "").toLowerCase();
        return role === "technician" || role === "técnico" || role === "admin" || role === "administrador" || role === "administrator" || role === "manager";
      });
      
      setTechnicians(techs);
      
      // Auto-asignar si hay solo uno
      if (techs.length === 1 && !formData.assigned_to) {
        updateFormData("assigned_to", techs[0].id);
        updateFormData("assigned_to_name", techs[0].full_name || techs[0].email);
      }
      
      // Auto-asignar al usuario actual si es técnico y no hay asignación
      if (!formData.assigned_to && currentUser) {
        const currentRole = (currentUser.role || "").toLowerCase();
        if (currentRole === "technician" || currentRole === "técnico" || currentRole === "admin" || currentRole === "administrador" || currentRole === "administrator") {
          updateFormData("assigned_to", currentUser.id);
          updateFormData("assigned_to_name", currentUser.full_name || currentUser.email);
        }
      }
      
    } catch (error) {
      console.error("Error loading technicians:", error);
      
      // Fallback: si falla, al menos asignar al usuario actual si es técnico
      if (currentUser) {
        const role = (currentUser.role || "").toLowerCase();
        if (role === "technician" || role === "técnico" || role === "admin" || role === "administrador" || role === "administrator") {
          setTechnicians([currentUser]);
          if (!formData.assigned_to) {
            updateFormData("assigned_to", currentUser.id);
            updateFormData("assigned_to_name", currentUser.full_name || currentUser.email);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = (tech) => {
    updateFormData("assigned_to", tech.id);
    updateFormData("assigned_to_name", tech.full_name || tech.email);
  };

  const handleUnassign = () => {
    updateFormData("assigned_to", "");
    updateFormData("assigned_to_name", "");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Label className="text-white">Asignar técnico</Label>
        <div className="text-gray-400 text-sm">Cargando técnicos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-white text-lg">Asignar Técnico</Label>
        {formData.assigned_to && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUnassign}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            Desasignar
          </Button>
        )}
      </div>

      {technicians.length === 0 ? (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            No hay técnicos disponibles. La orden se creará sin asignar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {technicians.map((tech) => {
            const isSelected = formData.assigned_to === tech.id;
            const isCurrent = currentUser?.id === tech.id;
            
            return (
              <button
                key={tech.id}
                type="button"
                onClick={() => handleAssign(tech)}
                className={`
                  p-4 rounded-lg border-2 transition-all text-left
                  ${isSelected 
                    ? 'border-red-500 bg-red-900/20' 
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold
                    ${isSelected ? 'bg-red-600' : 'bg-gray-700'}
                  `}>
                    {(tech.full_name || tech.email || "T").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">
                      {tech.full_name || tech.email}
                      {isCurrent && <span className="text-xs text-gray-400 ml-2">(Tú)</span>}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">
                      {tech.role || "Técnico"}
                    </p>
                  </div>
                  {isSelected && <UserCheck className="w-5 h-5 text-red-400" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mt-4">
        <p className="text-blue-300 text-sm flex items-start gap-2">
          <Users className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {formData.assigned_to 
              ? "Orden será asignada a este técnico automáticamente"
              : "Puedes asignar un técnico ahora o dejarlo para después"
            }
          </span>
        </p>
      </div>
    </div>
  );
}
