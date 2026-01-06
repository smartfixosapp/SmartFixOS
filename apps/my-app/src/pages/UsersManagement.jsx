import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Edit, Trash2, Search, UserPlus, 
  Mail, Phone, Code, Lock, Eye, EyeOff, 
  Calendar, Activity, X, Check, DollarSign,
  Users, Zap, Star, AlertCircle, Clock,
  Building2, CreditCard, Wallet, BarChart3,
  Smartphone, FileText, Plus, Loader2, Sparkles,
  ExternalLink, Package
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import AdminAuthGate from "../components/users/AdminAuthGate";
import UserCard from "../components/users/UserCard";
import CreateUserModal from "../components/users/CreateUserModal";
import EditUserModal from "../components/users/EditUserModal";
import TimeTrackingModal from "../components/timetracking/TimeTrackingModal";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

const ROLES = [
  { value: "superadmin", label: "Super Admin", color: "from-yellow-500 to-orange-600", icon: Zap, badge: "bg-yellow-500" },
  { value: "admin", label: "Administrador", color: "from-red-600 to-red-800", icon: Shield, badge: "bg-red-500" },
  { value: "manager", label: "Manager", color: "from-purple-600 to-purple-800", icon: Star, badge: "bg-purple-500" },
  { value: "technician", label: "Técnico", color: "from-blue-600 to-blue-800", icon: Activity, badge: "bg-blue-500" },
  { value: "cashier", label: "Cajero", color: "from-green-600 to-green-800", icon: DollarSign, badge: "bg-green-500" },
];

export default function UsersManagement() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [activeView, setActiveView] = useState(null); // null = selector, "users" = gestión usuarios, "time" = control tiempo
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [showTimeTracking, setShowTimeTracking] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [adminPanelButtons, setAdminPanelButtons] = useState([]);
  
  // Settings states
  const [appConfig, setAppConfig] = useState({
    business_name: "911 SmartFix",
    slogan: "Tu taller de confianza",
    business_phone: "",
    business_whatsapp: "",
    business_email: "",
    business_address: "",
    hours_weekdays: "",
    tax_rate: 11.5,
    currency: "USD",
    timezone: "America/Puerto_Rico",
    language: "es",
    google_review_link: ""
  });
  const [paymentMethods, setPaymentMethods] = useState({
    cash: true,
    card: true,
    ath_movil: true,
    bank_transfer: false,
    check: false
  });
  const [customPaymentMethods, setCustomPaymentMethods] = useState([]);
  const [newCustomMethod, setNewCustomMethod] = useState("");

  useEffect(() => {
    if (authorized) {
      loadUsers();
      loadPendingRequests();
      checkUrlActions();
      loadSettings();
      loadAdminPanelButtons();
    }

    const handleButtonsUpdate = () => {
      loadAdminPanelButtons();
    };

    window.addEventListener('admin-panel-buttons-updated', handleButtonsUpdate);
    return () => {
      window.removeEventListener('admin-panel-buttons-updated', handleButtonsUpdate);
    };
  }, [authorized]);

  const loadSettings = async () => {
    try {
      const [configRes, pmRes] = await Promise.all([
        dataClient.entities.AppSettings.filter({ slug: "app-main-settings" }),
        dataClient.entities.AppSettings.filter({ slug: "payment-methods" })
      ]);

      if (configRes?.length) {
        setAppConfig({ ...appConfig, ...configRes[0].payload });
      }
      if (pmRes?.length) {
        const saved = pmRes[0].payload;
        setPaymentMethods({ ...paymentMethods, ...saved });
        setCustomPaymentMethods(saved.custom_methods || []);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadAdminPanelButtons = async () => {
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "admin-panel-buttons" });
      
      if (configs?.length) {
        const savedButtons = configs[0].payload?.buttons || [];
        // Filtrar botones no deseados (Paga todo PR y Panel Administrativo redundante)
        const filteredButtons = savedButtons.filter(btn => 
          !btn.label.toLowerCase().includes("paga todo") && 
          btn.label !== "Panel Administrativo"
        );
        setAdminPanelButtons(filteredButtons.filter(btn => btn.enabled).sort((a, b) => a.order - b.order));
      } else {
        // Botones por defecto (sin "Paga todo PR")
        const defaultButtons = [
          { id: "users", label: "Gestión de Usuarios", icon: "Users", gradient: "from-cyan-600 to-blue-600", view: "users", type: "view", enabled: true, order: 0 },
          { id: "time", label: "Control de Tiempo", icon: "Clock", gradient: "from-emerald-600 to-green-600", view: "time", type: "view", enabled: true, order: 1 },
          { id: "business_info", label: "Info del Negocio", icon: "Building2", gradient: "from-orange-600 to-amber-600", view: "business_info", type: "view", enabled: true, order: 2 },
          { id: "payment_methods", label: "Métodos de Pago", icon: "CreditCard", gradient: "from-green-600 to-emerald-600", view: "payment_methods", type: "view", enabled: true, order: 3 },
          { id: "reports", label: "Reportes", icon: "BarChart3", gradient: "from-indigo-600 to-blue-600", action: "Reports", type: "navigate", enabled: true, order: 4 }
        ];
        setAdminPanelButtons(defaultButtons);
      }
    } catch (error) {
      console.error("Error loading admin panel buttons:", error);
      const defaultButtons = [
        { id: "users", label: "Gestionar Usuarios", icon: "Shield", gradient: "from-cyan-600 to-blue-600", view: "users", type: "view", enabled: true, order: 0 },
        { id: "time", label: "Control de Tiempo", icon: "Clock", gradient: "from-emerald-600 to-green-600", view: "time", enabled: true, order: 1 },
        { id: "business_info", label: "Info del Negocio", icon: "Building2", gradient: "from-orange-600 to-amber-600", view: "business_info", type: "view", enabled: true, order: 2 },
        { id: "payment_methods", label: "Métodos de Pago", icon: "CreditCard", gradient: "from-green-600 to-emerald-600", view: "payment_methods", type: "view", enabled: true, order: 3 },
        { id: "reports", label: "Reportes", icon: "BarChart3", gradient: "from-indigo-600 to-blue-600", action: "Reports", type: "navigate", enabled: true, order: 4 }
      ];
      setAdminPanelButtons(defaultButtons);
    }
  };

  const checkUrlActions = async () => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const id = params.get("id");

    if (action && id) {
      if (action === "approve") {
        await handleApproveRequest(id);
      } else if (action === "reject") {
        await handleRejectRequest(id);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const pending = await dataClient.entities.AppEmployee.filter({ status: "pending" });
      setPendingRequests(pending || []);
    } catch (error) {
      console.error("Error loading pending requests:", error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await dataClient.entities.User.list("-created_date");
      setUsers(allUsers || []);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      const existing = await dataClient.entities.User.filter({ 
        employee_code: userData.employee_code 
      });
      if (existing?.length) {
        toast.error("Ya existe un usuario con ese código");
        return;
      }

      // Preparar datos - role solo acepta 'admin' o 'user'
      const cleanData = {
        full_name: userData.full_name,
        email: userData.email,
        phone: userData.phone || "",
        role: (userData.customRole === 'admin' || userData.customRole === 'superadmin') ? 'admin' : 'user',
        position: userData.customRole, // Guardar el rol real aquí
        employee_code: userData.employee_code,
        pin: userData.pin,
        active: userData.active !== false
      };

      const newUser = await dataClient.entities.User.create(cleanData);
      toast.success("✅ Usuario creado exitosamente");
      
      await dataClient.entities.AuditLog.create({
        action: "create_user",
        entity_type: "user",
        entity_id: newUser.id,
        changes: { after: cleanData },
        severity: "info"
      }).catch(() => {}); // Ignorar errores del log

      setShowCreateModal(false);
      await loadUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Error al crear usuario: " + (error.message || "Intenta nuevamente"));
    }
  };

  const handleUpdateUser = async (userId, userData) => {
    try {
      // Preparar datos - role solo acepta 'admin' o 'user'
      const cleanData = {
        full_name: userData.full_name,
        email: userData.email,
        phone: userData.phone || "",
        role: (userData.customRole === 'admin' || userData.customRole === 'superadmin') ? 'admin' : 'user',
        position: userData.customRole,
        hourly_rate: parseFloat(userData.hourly_rate) || 0,
        active: userData.active !== false
      };
      
      // Solo agregar PIN si se proporcionó uno nuevo
      if (userData.pin?.trim()) {
        cleanData.pin = userData.pin;
      }
      
      await dataClient.entities.User.update(userId, cleanData);
      toast.success("✅ Usuario actualizado");
      
      await dataClient.entities.AuditLog.create({
        action: "update_user",
        entity_type: "user",
        entity_id: userId,
        changes: { after: cleanData },
        severity: "info"
      }).catch(() => {});

      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Error al actualizar: " + (error.message || "Intenta nuevamente"));
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`⚠️ ¿ELIMINAR PERMANENTEMENTE a ${user.full_name}?\n\nEsta acción NO se puede deshacer.`)) return;

    try {
      await dataClient.entities.User.delete(user.id);
      
      await dataClient.entities.AuditLog.create({
        action: "delete_user",
        entity_type: "user",
        entity_id: user.id,
        changes: {
          before: {
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            employee_code: user.employee_code
          }
        },
        severity: "warning"
      });

      toast.success("✅ Usuario eliminado");
      setUsers(users.filter(u => u.id !== user.id));
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Error al eliminar usuario");
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const currentUser = await dataClient.auth.me();
      const newActiveState = !user.active;
      
      if (currentUser?.id === user.id) {
        await dataClient.auth.updateMe({ active: newActiveState });
      } else {
        await dataClient.entities.User.update(user.id, { active: newActiveState });
      }
      
      toast.success(user.active ? "Usuario desactivado" : "Usuario activado");
      setUsers(users.map(u => u.id === user.id ? {...u, active: newActiveState} : u));
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Error al cambiar estado");
    }
  };

  const handleApproveRequest = async (employeeId) => {
    try {
      const employee = await dataClient.entities.AppEmployee.filter({ id: employeeId });
      if (!employee || employee.length === 0) {
        toast.error("Solicitud no encontrada");
        return;
      }

      const emp = employee[0];
      const token = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      await dataClient.entities.AppEmployee.update(employeeId, {
        status: "approved",
        activation_token: token,
        activation_expires_at: expiresAt
      });

      // Enviar email con link de activación
      await sendApprovalEmail(emp, token);

      toast.success(`✅ Solicitud de ${emp.full_name} aprobada`);
      await loadPendingRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("Error al aprobar solicitud");
    }
  };

  const handleRejectRequest = async (employeeId) => {
    if (!confirm("¿Rechazar esta solicitud de acceso?")) return;

    try {
      await dataClient.entities.AppEmployee.delete(employeeId);
      toast.success("Solicitud rechazada");
      await loadPendingRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Error al rechazar solicitud");
    }
  };

  const sendApprovalEmail = async (employee, token) => {
    const activationUrl = `${window.location.origin}/Activate?token=${token}`;
    const approvalDate = new Date().toLocaleDateString('es-PR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const emailBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 0; background: #ffffff;">
        <!-- Header con logo y estado -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 0;">
          <div style="background: white; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h1 style="color: white; font-size: 28px; margin: 0; font-weight: 600; letter-spacing: -0.5px;">Solicitud Aprobada</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Bienvenido a SmartFixOS</p>
        </div>

        <!-- Contenido principal -->
        <div style="padding: 40px 30px; background: white;">
          <h2 style="color: #1f2937; font-size: 22px; margin: 0 0 15px 0; font-weight: 600;">¡Hola ${employee.full_name}! 👋</h2>
          
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Nos complace informarte que tu solicitud de acceso al sistema <strong>ha sido aprobada</strong> por el administrador el día <strong>${approvalDate}</strong>.
          </p>

          <!-- Resumen de información -->
          <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px;">
            <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">📋 Resumen de tu Solicitud</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Nombre Completo:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.full_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Teléfono:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.phone}</td>
              </tr>
              ${employee.store_branch ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Sucursal:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.store_branch}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Código de Empleado:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.employee_code}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha de Aprobación:</td>
                <td style="padding: 8px 0; color: #10b981; font-size: 14px; font-weight: 600;">${approvalDate}</td>
              </tr>
            </table>
          </div>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 25px 0;">
            Para completar el proceso de registro, debes <strong>activar tu cuenta</strong> haciendo clic en el siguiente botón:
          </p>

          <!-- Botón de activación -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${activationUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 18px 45px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 16px rgba(16,185,129,0.3); transition: all 0.3s ease;">
              🚀 Activar Mi Cuenta Ahora
            </a>
          </div>

          <!-- Instrucciones alternativas -->
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">
              ℹ️ ¿No funciona el botón?
            </p>
            <p style="color: #92400e; font-size: 13px; margin: 0 0 10px 0;">
              Copia y pega el siguiente enlace en tu navegador:
            </p>
            <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #fcd34d; word-break: break-all;">
              <a href="${activationUrl}" style="color: #059669; font-size: 12px; text-decoration: none;">${activationUrl}</a>
            </div>
          </div>

          <!-- Aviso de expiración -->
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 25px 0; border-radius: 4px;">
            <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 500;">
              ⏰ <strong>Importante:</strong> Este enlace de activación expira en <strong>48 horas</strong>. Si no activas tu cuenta dentro de este período, deberás solicitar acceso nuevamente.
            </p>
          </div>

          <!-- Próximos pasos -->
          <div style="margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
            <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">📌 Próximos Pasos</h3>
            <ol style="color: #4b5563; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Haz clic en el botón "Activar Mi Cuenta Ahora"</li>
              <li style="margin-bottom: 10px;">Crea tu <strong>PIN de 4 dígitos</strong> para acceso rápido</li>
              <li style="margin-bottom: 10px;">Completa la configuración de tu perfil</li>
              <li>¡Comienza a usar SmartFixOS!</li>
            </ol>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
            Si no solicitaste este acceso, por favor ignora este mensaje o contacta al administrador del sistema.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0 0;">
            © ${new Date().getFullYear()} SmartFixOS • Sistema de Gestión de Reparaciones<br>
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      </div>
    `;

    await dataClient.mail.send({
      to: employee.email,
      from_name: "SmartFixOS - Sistema de Gestión",
      subject: "✅ Tu solicitud ha sido aprobada - Activa tu cuenta",
      body: emailBody
    });
  };

  const saveAppConfig = async () => {
    setLoading(true);
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload: appConfig });
      } else {
        await dataClient.entities.AppSettings.create({
          slug: "app-main-settings",
          payload: appConfig,
          description: "Configuración principal"
        });
      }
      toast.success("✅ Configuración guardada");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const savePaymentMethods = async () => {
    setLoading(true);
    try {
      const payload = {
        ...paymentMethods,
        custom_methods: customPaymentMethods
      };
      const configs = await dataClient.entities.AppSettings.filter({ slug: "payment-methods" });
      if (configs?.length) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await dataClient.entities.AppSettings.create({
          slug: "payment-methods",
          payload,
          description: "Métodos de pago"
        });
      }
      toast.success("✅ Métodos de pago actualizados");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const addCustomMethod = () => {
    const name = newCustomMethod.trim();
    if (!name) {
      toast.error("Escribe el nombre del método");
      return;
    }
    if (customPaymentMethods.some(m => m.toLowerCase() === name.toLowerCase())) {
      toast.error("Este método ya existe");
      return;
    }
    setCustomPaymentMethods([...customPaymentMethods, name]);
    setNewCustomMethod("");
    toast.success(`✅ ${name} añadido`);
  };

  const removeCustomMethod = (index) => {
    setCustomPaymentMethods(customPaymentMethods.filter((_, i) => i !== index));
  };

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    const userRole = user.position || user.role; // Usar position como rol principal
    const matchesSearch = (
      user.full_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.employee_code?.toLowerCase().includes(search) ||
      userRole?.toLowerCase().includes(search)
    );
    const matchesRole = filterRole === "all" || userRole === filterRole;
    return matchesSearch && matchesRole;
  });

  const activeUsers = users.filter(u => u.active !== false);
  const inactiveUsers = users.filter(u => u.active === false);

  const getRoleCounts = () => {
    const counts = {};
    ROLES.forEach(role => {
      counts[role.value] = users.filter(u => (u.position || u.role) === role.value).length;
    });
    return counts;
  };

  const roleCounts = getRoleCounts();

  if (!authorized) {
    return <AdminAuthGate onSuccess={() => setAuthorized(true)} />;
  }

  // Selector de vista
  if (activeView === null) {
    const ICON_MAP = {
      Shield, Clock, Building2, CreditCard, Wallet, BarChart3, 
      Users, ExternalLink, Smartphone, FileText, Package
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 to-purple-500 mx-auto mb-6 flex items-center justify-center shadow-[0_0_80px_rgba(168,85,247,0.6)]">
              <Users className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-3">
              Panel Administrativo
            </h1>
            <p className="text-purple-300/70 text-lg">
              Usuarios, finanzas, reportes y configuración del negocio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminPanelButtons.map((button) => {
              const IconComponent = ICON_MAP[button.icon] || Shield;

              const handleClick = () => {
                if (button.type === "view") {
                  setActiveView(button.view);
                } else if (button.type === "navigate") {
                  navigate(createPageUrl(button.action));
                } else if (button.type === "external") {
                  window.open(button.action, '_blank');
                }
              };

              return (
                <button
                  key={button.id}
                  onClick={handleClick}
                  className={`group relative overflow-hidden bg-gradient-to-br ${button.gradient}/10 backdrop-blur-xl border-2 border-${button.gradient.split('-')[1]}-500/30 hover:border-${button.gradient.split('-')[1]}-400/60 rounded-3xl p-8 transition-all hover:scale-105 active:scale-95 shadow-[0_8px_32px_rgba(168,85,247,0.3)] hover:shadow-[0_16px_64px_rgba(168,85,247,0.5)]`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${button.gradient}/0 group-hover:${button.gradient}/20 transition-all duration-500`} />

                  <div className="relative">
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${button.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                      <IconComponent className="w-10 h-10 text-white" />
                    </div>

                    <h3 className="text-white font-black text-2xl mb-3">
                      {button.label}
                    </h3>
                    <p className="text-cyan-300/70 text-sm mb-6">
                      {button.type === "view" ? `Vista: ${button.view}` : button.type === "external" ? "Enlace externo" : `Ir a ${button.action}`}
                    </p>

                    <div className="flex items-center gap-2 text-cyan-400 font-medium group-hover:gap-4 transition-all">
                      <span>Abrir</span>
                      <Check className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => window.history.back()}
            className="mt-8 mx-auto block px-6 py-3 text-gray-400 hover:text-white transition-colors"
          >
            ← Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Vista de Control de Tiempo
  if (activeView === "time") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 theme-light:bg-gradient-to-br theme-light:from-gray-50 theme-light:to-emerald-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-end mb-6">
            <Button
              onClick={() => setActiveView(null)}
              size="icon"
              variant="ghost"
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/10 theme-light:text-emerald-600"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
          
          <TimeTrackingModal 
            open={true} 
            onClose={() => setActiveView(null)} 
          />
        </div>
      </div>
    );
  }

  // Vista de Información del Negocio
  if (activeView === "business_info") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-900 theme-light:bg-gradient-to-br theme-light:from-gray-50 theme-light:to-orange-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-end mb-6">
            <Button
              onClick={() => setActiveView(null)}
              size="icon"
              variant="ghost"
              className="text-orange-400 hover:text-orange-300 hover:bg-orange-600/10 theme-light:text-orange-600"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-orange-600/10 to-amber-600/10 backdrop-blur-xl border border-orange-500/20 rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(251,146,60,0.4)] theme-light:bg-white theme-light:border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                  <Building2 className="w-9 h-9 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white theme-light:text-gray-900">Información del Negocio</h1>
                  <p className="text-orange-200/80 theme-light:text-gray-600">Datos básicos de tu empresa</p>
                </div>
              </div>
            </div>

            <div className="bg-black/40 border border-orange-500/20 p-6 rounded-2xl theme-light:bg-white theme-light:border-gray-200">
              <div className="space-y-4">
                <div>
                  <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Nombre del Negocio *</label>
                  <Input 
                    value={appConfig.business_name} 
                    onChange={(e) => setAppConfig({...appConfig, business_name: e.target.value})} 
                    placeholder="911 SmartFix"
                    className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                  />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Eslogan</label>
                  <Input 
                    value={appConfig.slogan} 
                    onChange={(e) => setAppConfig({...appConfig, slogan: e.target.value})} 
                    placeholder="Tu taller de confianza"
                    className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                  />
                </div>
                
                <div className="border-t border-white/10 pt-4 theme-light:border-gray-200">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2 theme-light:text-gray-900">
                    <Smartphone className="w-5 h-5 text-orange-400" />
                    Contacto
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Teléfono Principal *</label>
                      <Input 
                        value={appConfig.business_phone} 
                        onChange={(e) => setAppConfig({...appConfig, business_phone: e.target.value})} 
                        placeholder="(787) 555-1234" 
                        className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                      />
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700 flex items-center gap-2">
                        💬 WhatsApp
                        <Badge className="bg-green-500/20 text-green-300 text-xs theme-light:bg-green-100 theme-light:text-green-700">
                          Para Emails
                        </Badge>
                      </label>
                      <Input 
                        value={appConfig.business_whatsapp} 
                        onChange={(e) => setAppConfig({...appConfig, business_whatsapp: e.target.value})} 
                        placeholder="+17875551234 o 7875551234" 
                        className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                      />
                      <p className="text-xs text-gray-400 mt-2 theme-light:text-gray-600">
                        💡 Aparecerá como botón de contacto en todos los emails
                      </p>
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Email Principal *</label>
                      <Input 
                        value={appConfig.business_email} 
                        onChange={(e) => setAppConfig({...appConfig, business_email: e.target.value})} 
                        placeholder="contacto@911smartfix.com"
                        className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 theme-light:border-gray-200">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2 theme-light:text-gray-900">
                    <Building2 className="w-5 h-5 text-orange-400" />
                    Ubicación y Horarios
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Dirección Física</label>
                      <Input 
                        value={appConfig.business_address} 
                        onChange={(e) => setAppConfig({...appConfig, business_address: e.target.value})} 
                        placeholder="123 Calle Principal, San Juan, PR 00901"
                        className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                      />
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Horario de Atención</label>
                      <Input 
                        value={appConfig.hours_weekdays} 
                        onChange={(e) => setAppConfig({...appConfig, hours_weekdays: e.target.value})} 
                        placeholder="Lun-Vie: 9:00 AM - 6:00 PM"
                        className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                      />
                      <p className="text-xs text-gray-400 mt-2 theme-light:text-gray-600">
                        💡 Se mostrará en emails de orden lista para recoger
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-white/10 pt-4 theme-light:border-gray-200">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2 theme-light:text-gray-900">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Reseñas y Reputación
                  </h4>
                  <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700 flex items-center gap-2">
                    ⭐ Link de Reseñas de Google
                    <Badge className="bg-amber-500/20 text-amber-300 text-xs theme-light:bg-amber-100 theme-light:text-amber-700">
                      Opcional
                    </Badge>
                  </label>
                  <Input 
                    value={appConfig.google_review_link} 
                    onChange={(e) => setAppConfig({...appConfig, google_review_link: e.target.value})} 
                    placeholder="https://g.page/r/..." 
                    className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                  />
                  <p className="text-xs text-gray-400 mt-2 theme-light:text-gray-600">
                    💡 Botón de reseña en emails cuando la orden sea entregada
                  </p>
                </div>
              </div>
            </div>
            
            <Button onClick={saveAppConfig} disabled={loading} className="w-full bg-gradient-to-r from-orange-600 to-amber-600 h-14 text-lg font-bold shadow-lg">
              {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando...</> : <>Guardar Cambios</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Vista de Métodos de Pago
  if (activeView === "payment_methods") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950 to-slate-900 theme-light:bg-gradient-to-br theme-light:from-gray-50 theme-light:to-green-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-end mb-6">
            <Button
              onClick={() => setActiveView(null)}
              size="icon"
              variant="ghost"
              className="text-green-400 hover:text-green-300 hover:bg-green-600/10 theme-light:text-green-600"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(34,197,94,0.4)] theme-light:bg-white theme-light:border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <CreditCard className="w-9 h-9 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white theme-light:text-gray-900">Métodos de Pago</h1>
                  <p className="text-green-200/80 theme-light:text-gray-600">Configurar formas de pago</p>
                </div>
              </div>
            </div>

            {/* Métodos predefinidos */}
            <div className="bg-black/40 border border-green-500/20 p-6 rounded-2xl theme-light:bg-white theme-light:border-gray-200">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Métodos de Pago Predefinidos
              </h3>
              <div className="space-y-3">
                {[
                  {key: "cash", label: "Efectivo", icon: Wallet, color: "emerald"},
                  {key: "card", label: "Tarjeta de Crédito/Débito", icon: CreditCard, color: "blue"},
                  {key: "ath_movil", label: "ATH Móvil", icon: Smartphone, color: "orange"},
                  {key: "bank_transfer", label: "Transferencia Bancaria", icon: Building2, color: "purple"},
                  {key: "check", label: "Cheque", icon: FileText, color: "gray"}
                ].map((method) => {
                  const Icon = method.icon;
                  return (
                    <label key={method.key} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethods[method.key] ? "bg-gradient-to-r from-emerald-600/20 to-green-600/20 border-emerald-500/40 shadow-lg" : "bg-black/20 border-white/10 hover:bg-white/5"} theme-light:bg-gray-50 theme-light:border-gray-200`}>
                      <input type="checkbox" checked={paymentMethods[method.key]} onChange={(e) => setPaymentMethods({...paymentMethods, [method.key]: e.target.checked})} className="hidden" />
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${paymentMethods[method.key] ? "bg-emerald-600 border-emerald-600" : "border-gray-500"}`}>
                        {paymentMethods[method.key] && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <Icon className="w-6 h-6 text-gray-400" />
                      <span className="text-white font-medium flex-1 theme-light:text-gray-900">{method.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Métodos personalizados */}
            <div className="bg-black/40 border border-green-500/20 p-6 rounded-2xl theme-light:bg-white theme-light:border-gray-200">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
                <Plus className="w-5 h-5 text-green-400" />
                Métodos Personalizados
              </h3>
              <p className="text-xs text-gray-400 mb-4 theme-light:text-gray-600">
                Agrega métodos de pago adicionales como PayPal, Zelle, Venmo, etc.
              </p>

              {/* Input para agregar */}
              <div className="flex gap-2 mb-4">
                <Input
                  value={newCustomMethod}
                  onChange={(e) => setNewCustomMethod(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomMethod()}
                  placeholder="Ej: PayPal, Zelle, Venmo..."
                  className="flex-1 bg-black/30 border-white/10 text-white theme-light:bg-white theme-light:border-gray-300"
                />
                <Button
                  onClick={addCustomMethod}
                  className="bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar
                </Button>
              </div>

              {/* Lista de métodos personalizados */}
              {customPaymentMethods.length > 0 && (
                <div className="space-y-2">
                  {customPaymentMethods.map((method, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/40 rounded-xl shadow-lg theme-light:bg-green-50 theme-light:border-green-300"
                    >
                      <div className="w-6 h-6 rounded-lg bg-green-600 border-2 border-green-600 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <DollarSign className="w-5 h-5 text-green-400" />
                      <span className="text-white font-medium flex-1 theme-light:text-gray-900">
                        {method}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomMethod(index)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {customPaymentMethods.length === 0 && (
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4 text-center theme-light:bg-blue-50 theme-light:border-blue-300">
                  <p className="text-blue-300 text-sm theme-light:text-blue-700">
                    No hay métodos personalizados aún
                  </p>
                </div>
              )}
            </div>

            <Button onClick={savePaymentMethods} disabled={loading} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 h-14 text-lg font-bold shadow-lg">
              {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando...</> : <>Guardar Métodos de Pago</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 theme-light:bg-gradient-to-br theme-light:from-gray-50 theme-light:to-blue-50 p-3 sm:p-6 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Botón Cerrar */}
        <div className="flex justify-end mb-6">
          <Button
            onClick={() => setActiveView(null)}
            size="icon"
            variant="ghost"
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/10 theme-light:text-cyan-600"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Grid de Usuarios */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-900/40 border border-cyan-500/10 rounded-2xl p-6 animate-pulse backdrop-blur-xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800" />
                  <div className="flex-1">
                    <div className="h-5 bg-slate-800 rounded w-32 mb-2" />
                    <div className="h-4 bg-slate-800/60 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-slate-900/40 border border-cyan-500/20 rounded-3xl p-16 text-center backdrop-blur-xl theme-light:bg-white">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/10 to-purple-500/10 mx-auto mb-6 flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-cyan-400/60" />
            </div>
            <p className="text-cyan-300/60 text-lg font-semibold theme-light:text-gray-600">
              {searchTerm ? "No se encontraron usuarios" : "No hay usuarios creados"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                roles={ROLES}
                onEdit={() => setEditingUser(user)}
                onDelete={() => handleDeleteUser(user)}
                onToggleActive={() => handleToggleActive(user)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUser}
          roles={ROLES}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdate={handleUpdateUser}
          roles={ROLES}
        />
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  );
}
