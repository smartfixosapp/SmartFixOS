import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Smartphone, CheckSquare, Edit2 } from "lucide-react";
import { toast } from "sonner";

export default function MultiJobPanel({ jobs = [], onJobsChange }) {
  const [showAddJob, setShowAddJob] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newJob, setNewJob] = useState({
    device_type: "",
    device_brand: "",
    device_model: "",
    device_serial: "",
    initial_problem: ""
  });

  const handleAddJob = () => {
    if (!newJob.device_type || !newJob.initial_problem) {
      toast.error("Tipo de equipo y problema son requeridos");
      return;
    }

    if (editingIndex !== null) {
      const updated = [...jobs];
      updated[editingIndex] = { ...newJob, id: jobs[editingIndex].id };
      onJobsChange(updated);
      toast.success("Trabajo actualizado");
    } else {
      onJobsChange([...jobs, { ...newJob, id: Date.now() }]);
      toast.success("Trabajo añadido");
    }

    setNewJob({
      device_type: "",
      device_brand: "",
      device_model: "",
      device_serial: "",
      initial_problem: ""
    });
    setShowAddJob(false);
    setEditingIndex(null);
  };

  const handleEdit = (index) => {
    setNewJob(jobs[index]);
    setEditingIndex(index);
    setShowAddJob(true);
  };

  const handleRemove = (index) => {
    if (confirm("¿Eliminar este trabajo?")) {
      onJobsChange(jobs.filter((_, i) => i !== index));
      toast.success("Trabajo eliminado");
    }
  };

  const handleCancel = () => {
    setNewJob({
      device_type: "",
      device_brand: "",
      device_model: "",
      device_serial: "",
      initial_problem: ""
    });
    setShowAddJob(false);
    setEditingIndex(null);
  };

  return (
    <div className="apple-surface apple-type space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="apple-text-title3 apple-label-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-apple-purple" />
            </div>
            Trabajos para la Empresa
          </h3>
          <p className="apple-text-caption1 apple-label-tertiary mt-1">
            Añade múltiples equipos/trabajos que se procesarán juntos
          </p>
        </div>
        <Badge className="bg-apple-purple/15 text-apple-purple border-0 apple-text-caption1 tabular-nums">
          {jobs.length} {jobs.length === 1 ? "trabajo" : "trabajos"}
        </Badge>
      </div>

      {/* Lista de trabajos añadidos */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job, index) => (
            <Card key={job.id} className="apple-card rounded-apple-md border-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-apple-sm bg-apple-purple/15 grid place-items-center flex-shrink-0">
                    <span className="text-apple-purple font-semibold apple-text-subheadline tabular-nums">#{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="apple-text-subheadline apple-label-primary font-semibold">
                      {job.device_type} {job.device_brand} {job.device_model}
                    </p>
                    {job.device_serial && (
                      <p className="apple-text-caption1 apple-label-secondary font-mono tabular-nums mt-1">{job.device_serial}</p>
                    )}
                    <p className="apple-text-caption1 apple-label-secondary mt-2 line-clamp-2">{job.initial_problem}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(index)}
                    aria-label="Editar trabajo"
                    className="apple-btn apple-btn-plain h-8 w-8 text-apple-purple"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemove(index)}
                    aria-label="Eliminar trabajo"
                    className="apple-btn apple-btn-plain h-8 w-8 text-apple-red"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Formulario para añadir/editar trabajo */}
      {showAddJob ? (
        <Card className="apple-surface-secondary rounded-apple-md border-0 p-4 space-y-4">
          <h4 className="apple-text-headline text-apple-purple font-semibold flex items-center gap-2">
            {editingIndex !== null ? "Editar Trabajo" : "Nuevo Trabajo"}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="apple-text-caption1 apple-label-secondary mb-1.5 block">Tipo de Equipo *</label>
              <Input
                value={newJob.device_type}
                onChange={(e) => setNewJob({ ...newJob, device_type: e.target.value })}
                placeholder="iPhone, iPad, Laptop..."
                className="apple-input"
              />
            </div>

            <div>
              <label className="apple-text-caption1 apple-label-secondary mb-1.5 block">Marca</label>
              <Input
                value={newJob.device_brand}
                onChange={(e) => setNewJob({ ...newJob, device_brand: e.target.value })}
                placeholder="Apple, Samsung..."
                className="apple-input"
              />
            </div>

            <div>
              <label className="apple-text-caption1 apple-label-secondary mb-1.5 block">Modelo</label>
              <Input
                value={newJob.device_model}
                onChange={(e) => setNewJob({ ...newJob, device_model: e.target.value })}
                placeholder="iPhone 14 Pro..."
                className="apple-input"
              />
            </div>

            <div>
              <label className="apple-text-caption1 apple-label-secondary mb-1.5 block">Serial / IMEI</label>
              <Input
                value={newJob.device_serial}
                onChange={(e) => setNewJob({ ...newJob, device_serial: e.target.value })}
                placeholder="IMEI o Serial..."
                className="apple-input tabular-nums font-mono"
              />
            </div>
          </div>

          <div>
            <label className="apple-text-caption1 apple-label-secondary mb-1.5 block">Problema / Trabajo a Realizar *</label>
            <Textarea
              value={newJob.initial_problem}
              onChange={(e) => setNewJob({ ...newJob, initial_problem: e.target.value })}
              placeholder="Describe el problema o trabajo a realizar..."
              className="apple-input min-h-[80px]"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="apple-btn apple-btn-secondary flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddJob}
              className="apple-btn apple-btn-primary flex-1"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              {editingIndex !== null ? "Guardar Cambios" : "Añadir Trabajo"}
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          onClick={() => setShowAddJob(true)}
          className="apple-btn apple-btn-primary apple-btn-lg w-full"
        >
          <Plus className="w-5 h-5 mr-2" />
          Añadir Trabajo para esta Empresa
        </Button>
      )}

      {jobs.length === 0 && !showAddJob && (
        <div className="text-center py-6 rounded-apple-md apple-surface-secondary">
          <Smartphone className="w-10 h-10 text-apple-purple mx-auto mb-2 opacity-50" />
          <p className="apple-text-subheadline apple-label-secondary">
            Aún no hay trabajos añadidos
          </p>
          <p className="apple-text-caption1 apple-label-tertiary mt-1">
            Haz clic en "Añadir Trabajo" para comenzar
          </p>
        </div>
      )}
    </div>
  );
}
