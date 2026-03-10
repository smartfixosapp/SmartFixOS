import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Award,
  Calendar,
  Bell,
  Settings,
  Plus,
  X,
  Upload,
  Clock
} from "lucide-react";

const SPECIALIZATIONS = [
  "iPhone", "Samsung", "Huawei", "Xiaomi",
  "Laptop", "Desktop", "Mac", "Gaming PC",
  "Tablet", "iPad", "Smartwatch", "Console"
];

const SKILL_LEVELS = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
  { value: "expert", label: "Experto" }
];

const DEFAULT_SCHEDULE = {
  monday: { enabled: true, start: "09:00", end: "18:00" },
  tuesday: { enabled: true, start: "09:00", end: "18:00" },
  wednesday: { enabled: true, start: "09:00", end: "18:00" },
  thursday: { enabled: true, start: "09:00", end: "18:00" },
  friday: { enabled: true, start: "09:00", end: "18:00" },
  saturday: { enabled: false, start: "09:00", end: "14:00" },
  sunday: { enabled: false, start: "09:00", end: "14:00" }
};

export default function TechnicianProfileDialog({ open, onClose, technician, users, onSaved }) {
  const isEdit = !!technician;

  const [formData, setFormData] = useState({
    user_id: "",
    full_name: "",
    email: "",
    phone: "",
    specializations: [],
    skills: [],
    certifications: [],
    availability: {
      status: "available",
      weekly_schedule: DEFAULT_SCHEDULE,
      max_capacity: 5
    },
    notification_preferences: {
      push_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      notify_on_assignment: true,
      notify_on_urgent: true,
      notify_on_message: true
    },
    active: true,
    hire_date: "",
    employee_number: ""
  });

  const [newSkill, setNewSkill] = useState({ skill_name: "", level: "intermediate", certified: false });
  const [newCert, setNewCert] = useState({ name: "", issuer: "", issued_date: "", expiry_date: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (technician) {
      setFormData({
        ...technician,
        availability: {
          ...DEFAULT_SCHEDULE,
          ...(technician.availability || {}),
          weekly_schedule: {
            ...DEFAULT_SCHEDULE,
            ...(technician.availability?.weekly_schedule || {})
          }
        }
      });
    } else {
      setFormData({
        user_id: "",
        full_name: "",
        email: "",
        phone: "",
        specializations: [],
        skills: [],
        certifications: [],
        availability: {
          status: "available",
          weekly_schedule: DEFAULT_SCHEDULE,
          max_capacity: 5
        },
        notification_preferences: {
          push_enabled: true,
          email_enabled: true,
          sms_enabled: false,
          notify_on_assignment: true,
          notify_on_urgent: true,
          notify_on_message: true
        },
        active: true,
        hire_date: "",
        employee_number: ""
      });
    }
  }, [technician, open]);

  const handleUserSelect = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setFormData({
        ...formData,
        user_id: userId,
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || ""
      });
    }
  };

  const toggleSpecialization = (spec) => {
    const current = formData.specializations || [];
    if (current.includes(spec)) {
      setFormData({
        ...formData,
        specializations: current.filter(s => s !== spec)
      });
    } else {
      setFormData({
        ...formData,
        specializations: [...current, spec]
      });
    }
  };

  const addSkill = () => {
    if (!newSkill.skill_name.trim()) return;
    setFormData({
      ...formData,
      skills: [...(formData.skills || []), { ...newSkill }]
    });
    setNewSkill({ skill_name: "", level: "intermediate", certified: false });
  };

  const removeSkill = (index) => {
    setFormData({
      ...formData,
      skills: (formData.skills || []).filter((_, i) => i !== index)
    });
  };

  const addCertification = () => {
    if (!newCert.name.trim()) return;
    setFormData({
      ...formData,
      certifications: [...(formData.certifications || []), { ...newCert, verified: false }]
    });
    setNewCert({ name: "", issuer: "", issued_date: "", expiry_date: "" });
  };

  const removeCertification = (index) => {
    setFormData({
      ...formData,
      certifications: (formData.certifications || []).filter((_, i) => i !== index)
    });
  };

  const updateSchedule = (day, field, value) => {
    setFormData({
      ...formData,
      availability: {
        ...formData.availability,
        weekly_schedule: {
          ...formData.availability.weekly_schedule,
          [day]: {
            ...formData.availability.weekly_schedule[day],
            [field]: value
          }
        }
      }
    });
  };

  const handleSave = async () => {
    if (!formData.user_id || !formData.full_name) {
      alert("Selecciona un usuario y completa el nombre");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await base44.entities.TechnicianProfile.update(technician.id, formData);
      } else {
        await base44.entities.TechnicianProfile.create(formData);
      }
      onSaved();
    } catch (error) {
      console.error("Error saving technician:", error);
      alert("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const days = [
    { key: "monday", label: "Lunes" },
    { key: "tuesday", label: "Martes" },
    { key: "wednesday", label: "Miércoles" },
    { key: "thursday", label: "Jueves" },
    { key: "friday", label: "Viernes" },
    { key: "saturday", label: "Sábado" },
    { key: "sunday", label: "Domingo" }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white flex items-center gap-2">
            <User className="w-6 h-6 text-red-600" />
            {isEdit ? "Editar Técnico" : "Nuevo Técnico"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-black/40">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="skills">Habilidades</TabsTrigger>
            <TabsTrigger value="schedule">Horario</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          </TabsList>

          {/* Tab: Información Básica */}
          <TabsContent value="basic" className="space-y-4">
            {!isEdit && (
              <div>
                <Label className="text-gray-300">Usuario *</Label>
                <select
                  value={formData.user_id}
                  onChange={(e) => handleUserSelect(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
                >
                  <option value="">Selecciona un usuario...</option>
                  {users.filter(u => u.role === "technician" || u.role === "admin").map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Nombre Completo *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="mt-1 bg-black/40 border-white/15 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300">Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 bg-black/40 border-white/15 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300">Teléfono</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 bg-black/40 border-white/15 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300">Capacidad Máxima</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.availability?.max_capacity || 5}
                  onChange={(e) => setFormData({
                    ...formData,
                    availability: { ...formData.availability, max_capacity: parseInt(e.target.value) || 5 }
                  })}
                  className="mt-1 bg-black/40 border-white/15 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Especializaciones</Label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((spec) => (
                  <Badge
                    key={spec}
                    onClick={() => toggleSpecialization(spec)}
                    className={`cursor-pointer transition-all ${
                      (formData.specializations || []).includes(spec)
                        ? "bg-red-600 text-white border-red-500"
                        : "bg-black/40 text-gray-400 border-white/15 hover:bg-white/10"
                    }`}
                  >
                    {spec}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-gray-300">Estado</Label>
              <select
                value={formData.availability?.status || "available"}
                onChange={(e) => setFormData({
                  ...formData,
                  availability: { ...formData.availability, status: e.target.value }
                })}
                className="w-full mt-1 px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
              >
                <option value="available">Disponible</option>
                <option value="busy">Ocupado</option>
                <option value="offline">Fuera de línea</option>
                <option value="on_break">En descanso</option>
              </select>
            </div>
          </TabsContent>

          {/* Tab: Habilidades y Certificaciones */}
          <TabsContent value="skills" className="space-y-4">
            <div>
              <Label className="text-gray-300 mb-2 block">Habilidades</Label>
              <div className="space-y-2">
                {(formData.skills || []).map((skill, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-black/40 rounded-lg border border-white/10">
                    <Award className="w-4 h-4 text-yellow-400" />
                    <span className="flex-1 text-white">{skill.skill_name}</span>
                    <Badge variant="outline" className="border-white/20">
                      {SKILL_LEVELS.find(l => l.value === skill.level)?.label}
                    </Badge>
                    {skill.certified && (
                      <Badge className="bg-green-600/20 text-green-300 border-green-600/30">
                        Certificado
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeSkill(idx)}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-3 bg-black/40 rounded-lg border border-white/10 space-y-2">
                <Input
                  placeholder="Nombre de la habilidad"
                  value={newSkill.skill_name}
                  onChange={(e) => setNewSkill({ ...newSkill, skill_name: e.target.value })}
                  className="bg-black/40 border-white/15 text-white"
                />
                <div className="flex gap-2">
                  <select
                    value={newSkill.level}
                    onChange={(e) => setNewSkill({ ...newSkill, level: e.target.value })}
                    className="flex-1 px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
                  >
                    {SKILL_LEVELS.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSkill.certified}
                      onChange={(e) => setNewSkill({ ...newSkill, certified: e.target.checked })}
                    />
                    Certificado
                  </label>
                  <Button onClick={addSkill} className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Certificaciones</Label>
              <div className="space-y-2">
                {(formData.certifications || []).map((cert, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-black/40 rounded-lg border border-white/10">
                    <Award className="w-4 h-4 text-blue-400" />
                    <div className="flex-1">
                      <p className="text-white font-medium">{cert.name}</p>
                      <p className="text-xs text-gray-400">{cert.issuer}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeCertification(idx)}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-3 bg-black/40 rounded-lg border border-white/10 space-y-2">
                <Input
                  placeholder="Nombre de la certificación"
                  value={newCert.name}
                  onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                  className="bg-black/40 border-white/15 text-white"
                />
                <Input
                  placeholder="Emisor"
                  value={newCert.issuer}
                  onChange={(e) => setNewCert({ ...newCert, issuer: e.target.value })}
                  className="bg-black/40 border-white/15 text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-400">Fecha emisión</Label>
                    <Input
                      type="date"
                      value={newCert.issued_date}
                      onChange={(e) => setNewCert({ ...newCert, issued_date: e.target.value })}
                      className="bg-black/40 border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Fecha expiración</Label>
                    <Input
                      type="date"
                      value={newCert.expiry_date}
                      onChange={(e) => setNewCert({ ...newCert, expiry_date: e.target.value })}
                      className="bg-black/40 border-white/15 text-white"
                    />
                  </div>
                </div>
                <Button onClick={addCertification} className="w-full bg-red-600 hover:bg-red-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Certificación
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Horario */}
          <TabsContent value="schedule" className="space-y-4">
            <Label className="text-gray-300 mb-2 block">Horario Semanal</Label>
            {days.map(({ key, label }) => {
              const schedule = formData.availability?.weekly_schedule?.[key] || DEFAULT_SCHEDULE[key];
              return (
                <div key={key} className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-white/10">
                  <label className="flex items-center gap-2 w-32">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={(e) => updateSchedule(key, "enabled", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-white">{label}</span>
                  </label>
                  {schedule.enabled && (
                    <>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <Input
                          type="time"
                          value={schedule.start}
                          onChange={(e) => updateSchedule(key, "start", e.target.value)}
                          className="w-32 bg-black/40 border-white/15 text-white"
                        />
                      </div>
                      <span className="text-gray-400">—</span>
                      <Input
                        type="time"
                        value={schedule.end}
                        onChange={(e) => updateSchedule(key, "end", e.target.value)}
                        className="w-32 bg-black/40 border-white/15 text-white"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* Tab: Notificaciones */}
          <TabsContent value="notifications" className="space-y-4">
            <Label className="text-gray-300 mb-2 block">Preferencias de Notificaciones</Label>
            <div className="space-y-3">
              {[
                { key: "push_enabled", label: "Notificaciones Push" },
                { key: "email_enabled", label: "Notificaciones por Email" },
                { key: "sms_enabled", label: "Notificaciones por SMS" },
                { key: "notify_on_assignment", label: "Notificar al asignar trabajo" },
                { key: "notify_on_urgent", label: "Notificar en casos urgentes" },
                { key: "notify_on_message", label: "Notificar nuevos mensajes" }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-white/10 cursor-pointer hover:bg-black/60">
                  <input
                    type="checkbox"
                    checked={formData.notification_preferences?.[key]}
                    onChange={(e) => setFormData({
                      ...formData,
                      notification_preferences: {
                        ...formData.notification_preferences,
                        [key]: e.target.checked
                      }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-white">{label}</span>
                </label>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
          <Button variant="outline" onClick={onClose} className="border-white/15">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
