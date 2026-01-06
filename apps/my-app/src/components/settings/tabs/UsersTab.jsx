import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { clearPermissionsCache } from "@/components/utils/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Shield, RefreshCw, Trash2, Key, UserCheck, UserX } from "lucide-react";

export default function UsersTab({ user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        base44.entities.User.list("-created_date", 100),
        base44.entities.Role.filter({ active: true }),
      ]);
      setUsers(usersData || []);
      setRoles(rolesData || []);
    } catch (e) {
      console.error("Error loading users/roles:", e);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPIN = (length = 4) => {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
  };

  const hashPIN = async (pin) => {
    // En producción usar bcrypt o similar
    // Por ahora simulamos con base64
    return btoa(pin);
  };

  const handleSaveUser = async (userData) => {
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}

      if (editingUser) {
        // Actualizar usuario existente
        await base44.entities.User.update(editingUser.id, userData);
        
        await base44.entities.AuditLog.create({
          action: "user_update",
          entity_type: "user",
          entity_id: editingUser.id,
          user_id: me?.id || null,
          user_name: me?.full_name || me?.email || "Sistema",
          user_role: me?.role || "system",
          changes: userData
        });
      } else {
        // NUEVO: Crear usuario con PIN temporal
        const pin = generateRandomPIN(4);
        const pin_hash = await hashPIN(pin);
        
        const newUser = await base44.entities.User.create({
          ...userData,
          pin: pin_hash,
          must_change_pin: true,
          active: true,
        });

        // Enviar email con PIN
        const emailBody = `
          <h2>Bienvenido a 911 SmartFix</h2>
          <p>Hola ${userData.full_name},</p>
          <p>Se ha creado tu cuenta con rol: <strong>${userData.role}</strong></p>
          <p>Tu PIN temporal es: <strong>${pin}</strong></p>
          <p>Por seguridad, deberás cambiar tu PIN en tu primer inicio de sesión.</p>
          <p>Usa este PIN para acceder al sistema desde el Dashboard.</p>
          <br>
          <p>Saludos,<br>El equipo de 911 SmartFix</p>
        `;

        await base44.integrations.Core.SendEmail({
          to: userData.email,
          subject: "Tu cuenta ha sido creada - 911 SmartFix",
          body: emailBody
        });

        await base44.entities.AuditLog.create({
          action: "user_create",
          entity_type: "user",
          entity_id: newUser.id,
          user_id: me?.id || null,
          user_name: me?.full_name || me?.email || "Sistema",
          user_role: me?.role || "system",
          changes: { ...userData, pin_sent: true }
        });
      }

      clearPermissionsCache();
      loadData();
      setShowUserDialog(false);
      setEditingUser(null);
    } catch (e) {
      console.error("Error saving user:", e);
      alert("Error al guardar usuario: " + (e.message || "Error desconocido"));
    }
  };

  const handleResetPIN = async (userId) => {
    if (!confirm("¿Generar nuevo PIN temporal para este usuario?")) return;

    try {
      const pin = generateRandomPIN(4);
      const pin_hash = await hashPIN(pin);

      await base44.entities.User.update(userId, {
        pin: pin_hash,
        must_change_pin: true
      });

      const targetUser = users.find(u => u.id === userId);
      
      const emailBody = `
        <h2>PIN Restablecido - 911 SmartFix</h2>
        <p>Hola ${targetUser.full_name},</p>
        <p>Tu PIN ha sido restablecido.</p>
        <p>Tu nuevo PIN temporal es: <strong>${pin}</strong></p>
        <p>Deberás cambiarlo en tu próximo inicio de sesión.</p>
        <br>
        <p>Saludos,<br>El equipo de 911 SmartFix</p>
      `;

      await base44.integrations.Core.SendEmail({
        to: targetUser.email,
        subject: "PIN Restablecido - 911 SmartFix",
        body: emailBody
      });

      let me = null;
      try { me = await base44.auth.me(); } catch {}

      await base44.entities.AuditLog.create({
        action: "user_reset_pin",
        entity_type: "user",
        entity_id: userId,
        user_id: me?.id || null,
        user_name: me?.full_name || me?.email || "Sistema",
        user_role: me?.role || "system",
        changes: { reset_by: me?.id }
      });

      clearPermissionsCache();
      alert("PIN restablecido y enviado por email");
    } catch (e) {
      alert("Error al restablecer PIN: " + e.message);
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    try {
      await base44.entities.User.update(userId, { active: !currentActive });
      
      let me = null;
      try { me = await base44.auth.me(); } catch {}

      await base44.entities.AuditLog.create({
        action: currentActive ? "user_deactivate" : "user_activate",
        entity_type: "user",
        entity_id: userId,
        user_id: me?.id || null,
        user_name: me?.full_name || me?.email || "Sistema",
        user_role: me?.role || "system",
        changes: { active: !currentActive }
      });

      clearPermissionsCache();
      loadData();
    } catch (e) {
      alert("Error al cambiar estado: " + e.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="text-gray-400">Cargando usuarios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black border-gray-700 text-white"
          />
        </div>
        <Button
          onClick={() => {
            setEditingUser(null);
            setShowUserDialog(true);
          }}
          className="bg-gradient-to-r from-red-600 to-red-800"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(u => (
          <UserCard
            key={u.id}
            user={u}
            onEdit={() => {
              setEditingUser(u);
              setShowUserDialog(true);
            }}
            onResetPIN={() => handleResetPIN(u.id)}
            onToggleActive={() => handleToggleActive(u.id, u.active)}
          />
        ))}
      </div>

      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Roles del Sistema</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditingRole(null);
                setShowRoleDialog(true);
              }}
              className="bg-gradient-to-r from-red-600 to-red-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Rol
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map(r => (
              <RoleCard
                key={r.id}
                role={r}
                onEdit={() => {
                  setEditingRole(r);
                  setShowRoleDialog(true);
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {showUserDialog && (
        <UserDialog
          open={showUserDialog}
          user={editingUser}
          roles={roles}
          onClose={() => {
            setShowUserDialog(false);
            setEditingUser(null);
          }}
          onSave={handleSaveUser}
        />
      )}

      {showRoleDialog && (
        <RoleDialog
          open={showRoleDialog}
          role={editingRole}
          onClose={() => {
            setShowRoleDialog(false);
            setEditingRole(null);
          }}
          onSave={async (roleData) => {
            try {
              if (editingRole) {
                await base44.entities.Role.update(editingRole.id, roleData);
              } else {
                await base44.entities.Role.create(roleData);
              }
              clearPermissionsCache();
              loadData();
              setShowRoleDialog(false);
              setEditingRole(null);
            } catch (e) {
              alert("Error al guardar rol: " + e.message);
            }
          }}
        />
      )}
    </div>
  );
}

function UserCard({ user, onEdit, onResetPIN, onToggleActive }) {
  const roleColors = {
    admin: "bg-red-600/20 text-red-300 border-red-600/30",
    manager: "bg-purple-600/20 text-purple-300 border-purple-600/30",
    technician: "bg-blue-600/20 text-blue-300 border-blue-600/30",
    frontdesk: "bg-green-600/20 text-green-300 border-green-600/30",
    viewer: "bg-gray-600/20 text-gray-300 border-gray-600/30",
  };

  return (
    <Card className="bg-black/30 border-white/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{user.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            {user.phone && <p className="text-xs text-gray-500">{user.phone}</p>}
          </div>
          {user.active ? (
            <UserCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
          ) : (
            <UserX className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
        </div>

        <Badge className={roleColors[user.role] || roleColors.viewer}>
          {user.role}
        </Badge>

        {user.must_change_pin && (
          <Badge className="bg-amber-600/20 text-amber-300 border-amber-600/30">
            PIN temporal
          </Badge>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 border-gray-700">
            Editar
          </Button>
          <Button size="sm" variant="outline" onClick={onResetPIN} className="border-gray-700">
            <Key className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleActive}
            className={user.active ? "border-gray-700" : "border-green-700"}
          >
            {user.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RoleCard({ role, onEdit }) {
  return (
    <Card className="bg-black/30 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-white">{role.name}</span>
          </div>
          {role.is_system && (
            <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/30 text-xs">
              Sistema
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">{role.description}</p>
        {!role.is_system && (
          <Button size="sm" variant="outline" onClick={onEdit} className="w-full border-gray-700">
            Editar permisos
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function UserDialog({ open, user, roles, onClose, onSave }) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "technician",
    active: true
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "technician",
        active: user.active !== false
      });
    } else {
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "technician",
        active: true
      });
    }
  }, [user, open]);

  const handleSubmit = () => {
    if (!formData.full_name || !formData.email) {
      alert("Nombre y email son requeridos");
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>{user ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="bg-black border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-black border-gray-700 text-white"
              disabled={!!user}
            />
            {user && <p className="text-xs text-gray-500">El email no se puede cambiar</p>}
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="bg-black border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label>Rol *</Label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full h-10 px-3 rounded-md bg-black border border-gray-700 text-white"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="technician">Técnico</option>
              <option value="frontdesk">Recepción</option>
              <option value="viewer">Visualizador</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-gradient-to-r from-red-600 to-red-800">
            {user ? "Guardar" : "Crear y Enviar PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({ open, role, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: []
  });

  const availablePermissions = [
    { code: "orders.read", label: "Ver órdenes" },
    { code: "orders.create", label: "Crear órdenes" },
    { code: "orders.update", label: "Editar órdenes" },
    { code: "orders.delete", label: "Eliminar órdenes" },
    { code: "inventory.read", label: "Ver inventario" },
    { code: "inventory.update", label: "Editar inventario" },
    { code: "users.read", label: "Ver usuarios" },
    { code: "users.manage", label: "Gestionar usuarios" },
    { code: "finance.read", label: "Ver finanzas" },
    { code: "finance.manage", label: "Gestionar finanzas" },
    { code: "settings.read", label: "Ver configuración" },
    { code: "settings.manage", label: "Gestionar configuración" },
    { code: "dashboard.note.send_all", label: "Enviar nota a todos" },
    { code: "dashboard.note.send_user", label: "Enviar nota a usuarios" },
  ];

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || "",
        description: role.description || "",
        permissions: role.permissions || []
      });
    } else {
      setFormData({
        name: "",
        description: "",
        permissions: []
      });
    }
  }, [role, open]);

  const togglePermission = (code) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(code)
        ? prev.permissions.filter(p => p !== code)
        : [...prev.permissions, code]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? "Editar Rol" : "Nuevo Rol"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre del rol *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-black border-gray-700 text-white"
              disabled={role?.is_system}
            />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-black border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label>Permisos</Label>
            <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-lg p-3 space-y-2">
              {availablePermissions.map(perm => (
                <label key={perm.code} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(perm.code)}
                    onChange={() => togglePermission(perm.code)}
                    disabled={role?.is_system}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{perm.label}</span>
                  <span className="text-xs text-gray-500 ml-auto">{perm.code}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700">
            Cancelar
          </Button>
          <Button 
            onClick={() => onSave(formData)} 
            className="bg-gradient-to-r from-red-600 to-red-800"
            disabled={role?.is_system}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
