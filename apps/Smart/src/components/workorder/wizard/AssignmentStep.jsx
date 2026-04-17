import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "../../../../../../lib/supabase-client.js";
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

      // 🔒 Filtrar SIEMPRE por tenant_id para evitar mostrar empleados de otras tiendas
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      let query = supabase
        .from("app_employee")
        .select("id, full_name, email, role, position, active, tenant_id")
        .eq("active", true);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data: empData } = await query;
      const allUsers = empData || [];

      // Filtrar técnicos en el cliente
      const techs = allUsers.filter(u => {
        if (!u.active) return false;
        const role = (u.role || "").toLowerCase();
        const name = (u.full_name || u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        if (role === "superadmin" || role === "super admin" || name.includes("super admin") || email.includes("superadmin")) return false;
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
      <div className="apple-surface apple-type space-y-4">
        <Label className="apple-text-headline apple-label-primary">Asignar técnico</Label>
        <div className="apple-text-subheadline apple-label-tertiary">Cargando técnicos...</div>
      </div>
    );
  }

  return (
    <div className="apple-surface apple-type space-y-4">
      <div className="flex items-center justify-between">
        <Label className="apple-text-title3 apple-label-primary">Asignar Técnico</Label>
        {formData.assigned_to && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUnassign}
            className="apple-btn apple-btn-plain text-apple-red"
          >
            Desasignar
          </Button>
        )}
      </div>

      {technicians.length === 0 ? (
        <div className="bg-apple-yellow/12 rounded-apple-md p-4">
          <p className="apple-text-subheadline text-apple-yellow">
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
                className={`apple-press p-4 rounded-apple-md text-left transition-all ${
                  isSelected
                    ? 'apple-card ring-2 ring-apple-red bg-apple-red/12'
                    : 'apple-card hover:apple-surface-elevated'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-apple-sm flex items-center justify-center font-semibold apple-text-headline
                    ${isSelected ? 'bg-apple-red text-white' : 'bg-apple-blue/15 text-apple-blue'}
                  `}>
                    {(tech.full_name || tech.email || "T").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="apple-text-headline apple-label-primary truncate">
                      {tech.full_name || tech.email}
                      {isCurrent && <span className="apple-text-caption1 apple-label-tertiary ml-2">(Tú)</span>}
                    </p>
                    <p className="apple-text-footnote apple-label-secondary capitalize">
                      {tech.role || "Técnico"}
                    </p>
                  </div>
                  {isSelected && <UserCheck className="w-5 h-5 text-apple-red" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-apple-blue/12 rounded-apple-md p-3 mt-4">
        <p className="apple-text-subheadline text-apple-blue flex items-start gap-2">
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
