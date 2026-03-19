import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft, Delete, Check, ExternalLink, Shield, Zap, UserPlus, Smartphone, Box, Receipt, Users, BarChart3, Globe, Sparkles, MessageCircle, Clock, Database, Cloud, Mail, Building2, CheckCircle, Star, Phone, Wrench, Camera, Eye, EyeOff, KeyRound } from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { triggerRealtimeNotification, NOTIFICATION_TYPES } from "@/components/notifications/RealtimeNotifications";
import { ensureAdminBootstrap, ensureTenantAdminUser } from "@/components/utils/adminBootstrap";
import { getUserPermissions } from "@/components/utils/rolePermissions";
import RequestAccessModal from "../components/auth/RequestAccessModal";
// registerTenant now handled by /api/register (Vercel serverless)

export default function PinAccess() {
  const MASTER_PIN = "3407";
  const MASTER_OWNER_EMAIL  = "911smartfix@gmail.com";
  const SUPER_ADMIN_EMAIL   = "smartfixosapp@gmail.com";   // SaaS owner — va al panel de plataforma
  const SUPER_SESSION_KEY   = "smartfix_saas_session";
  const LOCAL_USERS_STORAGE_KEY = "smartfix_local_users";
  const SYSTEM_USER_EMAILS = new Set([
    "admin@smartfixos.com",
    "smartfixosapp@gmail.com"
    // NOTE: 911smartfix@gmail.com was removed — it's a valid tenant owner email
  ]);
  const STORE_EMAIL_KEY = "smartfix_store_email";
  const BIOMETRIC_LOGIN_KEY = "smartfix_biometric_login";
  const DEFAULT_STORE_EMAIL = "911smartfix@gmail.com";
  const ADMIN_PERMISSIONS = {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: true,
    can_delete_orders: true,
    can_view_all_orders: true,
    can_view_customers: true,
    can_edit_customers: true,
    can_delete_customers: true,
    can_access_pos: true,
    can_void_sales: true,
    can_apply_discounts: true,
    can_view_financial: true,
    can_open_close_drawer: true,
    can_view_inventory: true,
    can_manage_inventory: true,
    can_view_reports: true,
    can_export_data: true,
    can_manage_users: true,
    can_access_settings: true,
    can_manage_catalog: true
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState("welcome");
  const [pin, setPin] = useState("");
  const [storeEmail, setStoreEmail] = useState(
    () => localStorage.getItem(STORE_EMAIL_KEY) || DEFAULT_STORE_EMAIL
  );
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [masterAccessOpen, setMasterAccessOpen] = useState(false);
  const [masterEmail, setMasterEmail] = useState(MASTER_OWNER_EMAIL);
  const [masterPin, setMasterPin] = useState("");
  const [masterValidated, setMasterValidated] = useState(false);
  const [masterLoading, setMasterLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessBurst, setShowSuccessBurst] = useState(false);
  const [error, setError] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [adminPin, setAdminPin] = useState("");
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [otpSessionId, setOtpSessionId] = useState(null);
  const hasCheckedSession = useRef(false);
  const usersSectionRef = useRef(null);
  const pinSectionRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [checkingUsers, setCheckingUsers] = useState(true);
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [showBypass, setShowBypass] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [signupStep, setSignupStep] = useState("form"); // 'form' | 'success'
  const [signupResult, setSignupResult] = useState(null);
  const [storePassword, setStorePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [tenantId, setTenantId] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    plan: "basic"   // basic | pro | enterprise
  });
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricProfile, setBiometricProfile] = useState(null);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // ── First User Setup (shown when no employees exist after login) ──────────
  const [firstUserForm, setFirstUserForm]       = useState({ full_name: '', phone: '' });
  const [firstUserPin, setFirstUserPin]         = useState('');
  const [firstUserPinConfirm, setFirstUserPinConfirm] = useState('');
  const [firstUserPinStage, setFirstUserPinStage] = useState('form'); // 'form' | 'pin' | 'confirm'
  const [firstUserSaving, setFirstUserSaving]   = useState(false);
  const [firstUserPinError, setFirstUserPinError] = useState('');

  // ── Auto-save / Auto-login ────────────────────────────────────────────────
  const SAVED_CREDS_KEY = "smartfix_saved_creds";
  const [storeAuthenticated, setStoreAuthenticated] = useState(false);
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [slideDir, setSlideDir] = useState(1); // 1 = adelante, -1 = atrás

  const loadSavedCreds = () => {
    try {
      const raw = localStorage.getItem(SAVED_CREDS_KEY);
      return raw ? JSON.parse(atob(raw)) : null;
    } catch { return null; }
  };
  const saveCreds = (email, pwd) => {
    try { localStorage.setItem(SAVED_CREDS_KEY, btoa(JSON.stringify({ email, pwd }))); } catch {}
  };
  const clearSavedCreds = () => localStorage.removeItem(SAVED_CREDS_KEY);

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };

  const base64ToUint8Array = (value) => {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  };

  const createChallenge = () => {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    return challenge;
  };

  const loadBiometricProfile = () => {
    try {
      const raw = localStorage.getItem(BIOMETRIC_LOGIN_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.credentialId ? parsed : null;
    } catch {
      return null;
    }
  };

  const saveBiometricProfile = (profile) => {
    localStorage.setItem(BIOMETRIC_LOGIN_KEY, JSON.stringify(profile));
    setBiometricProfile(profile);
  };

  const clearBiometricProfile = () => {
    localStorage.removeItem(BIOMETRIC_LOGIN_KEY);
    setBiometricProfile(null);
  };

  // PIN pad numbers (definido aquí para que los early returns lo puedan usar)
  const numbers = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [null, 0, "⌫"]];

  const getMasterFallbackUser = () => ({
    id: "__master__",
    full_name: "Admin Maestro",
    email: MASTER_OWNER_EMAIL,
    role: "admin",
    position: "admin",
    active: true,
    pin: MASTER_PIN
  });

  const readLocalUsers = () => {
    try {
      const raw = localStorage.getItem(LOCAL_USERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];

      const effectiveTenantId =
        tenantId ||
        localStorage.getItem("smartfix_tenant_id") ||
        localStorage.getItem("current_tenant_id");

      return parsed.filter((user) => {
        if (!user || user.active === false) return false;
        if (!effectiveTenantId) return true;
        return !user.tenant_id || String(user.tenant_id) === String(effectiveTenantId);
      });
    } catch {
      return [];
    }
  };

  const isSystemUserLike = (candidate) => {
    const fullName = String(candidate?.full_name || candidate?.name || "").trim().toLowerCase();
    const role = String(candidate?.role || candidate?.position || "").trim().toLowerCase();
    const email = String(candidate?.email || "").trim().toLowerCase();

    if (SYSTEM_USER_EMAILS.has(email)) return true;
    if (role === "super_admin" || role === "saas_owner" || role === "superadmin") return true;
    if (fullName.includes("smartfixos")) return true;
    if (fullName.includes("super admin")) return true;
    return false;
  };

  const getUserIdentityKeys = (user) => {
    const keys = [];
    if (user?.id) keys.push(`id:${String(user.id).toLowerCase()}`);
    if (user?.auth_id) keys.push(`auth:${String(user.auth_id).toLowerCase()}`);
    if (user?.email) keys.push(`email:${String(user.email).trim().toLowerCase()}`);
    if (user?.employee_code) keys.push(`code:${String(user.employee_code).trim().toLowerCase()}`);
    return keys;
  };

  const normalizeRole = (user) => {
    const rawRole = user?.position || user?.role || "user";
    const role = String(rawRole).toLowerCase();
    const validRoles = ["admin", "manager", "technician", "cashier", "service", "user"];
    return validRoles.includes(role) ? role : "user";
  };

  const isBiometricAvailableForSelectedUser =
    biometricSupported &&
    selectedUser &&
    biometricProfile?.userId === selectedUser.id &&
    (!biometricProfile?.tenantId || biometricProfile?.tenantId === (selectedUser.tenant_id || tenantId || null));

  const getMergedActiveUsers = async (tId = null) => {
    let remoteUsers = [];
    try {
      let usersQuery = supabase
        .from("users")
        .select("id, email, full_name, role, position, employee_code, pin, active, permissions, tenant_id, auth_id")
        .eq("active", true);
      if (tId) usersQuery = usersQuery.eq("tenant_id", tId);

      let employeesQuery = supabase
        .from("app_employee")
        .select("id, email, full_name, role, position, employee_code, pin, active, permissions, tenant_id")
        .eq("active", true);
      if (tId) employeesQuery = employeesQuery.eq("tenant_id", tId);

      const [{ data: userRows, error: userError }, { data: employeeRows, error: employeeError }] = await Promise.all([
        usersQuery,
        employeesQuery,
      ]);

      if (userError) throw userError;
      if (employeeError) throw employeeError;

      const mergedRemote = [];
      const keyToIndex = new Map();
      for (const candidate of [...(userRows || []), ...(employeeRows || [])]) {
        if (!candidate || candidate.active === false || isSystemUserLike(candidate)) continue;

        const keys = getUserIdentityKeys(candidate);
        const existingIndex = keys.map((key) => keyToIndex.get(key)).find((idx) => Number.isInteger(idx));

        if (Number.isInteger(existingIndex)) {
          mergedRemote[existingIndex] = {
            ...candidate,
            ...mergedRemote[existingIndex],
            position: mergedRemote[existingIndex]?.position || candidate.position,
            employee_code: mergedRemote[existingIndex]?.employee_code || candidate.employee_code,
            pin: mergedRemote[existingIndex]?.pin || candidate.pin,
            permissions: mergedRemote[existingIndex]?.permissions || candidate.permissions,
            tenant_id: mergedRemote[existingIndex]?.tenant_id || candidate.tenant_id,
          };
          getUserIdentityKeys(mergedRemote[existingIndex]).forEach((key) => keyToIndex.set(key, existingIndex));
          continue;
        }

        const nextIndex = mergedRemote.length;
        mergedRemote.push(candidate);
        keys.forEach((key) => keyToIndex.set(key, nextIndex));
      }

      remoteUsers = mergedRemote;
    } catch (e) {
      console.warn("No se pudieron cargar usuarios remotos, usando respaldo local.", e);
    }

    const localUsers = readLocalUsers().filter((u) => !isSystemUserLike(u));
    const mergedUsers = [];
    const keyToIndex = new Map();

    for (const candidate of [...(remoteUsers || []), ...localUsers]) {
      if (!candidate || candidate.active === false || isSystemUserLike(candidate)) continue;

      const keys = getUserIdentityKeys(candidate);
      const existingIndex = keys.map((key) => keyToIndex.get(key)).find((idx) => Number.isInteger(idx));

      if (Number.isInteger(existingIndex)) {
        mergedUsers[existingIndex] = {
          ...candidate,
          ...mergedUsers[existingIndex],
          position: mergedUsers[existingIndex]?.position || candidate.position,
          employee_code: mergedUsers[existingIndex]?.employee_code || candidate.employee_code,
          pin: mergedUsers[existingIndex]?.pin || candidate.pin,
          permissions: mergedUsers[existingIndex]?.permissions || candidate.permissions,
          tenant_id: mergedUsers[existingIndex]?.tenant_id || candidate.tenant_id,
        };
        getUserIdentityKeys(mergedUsers[existingIndex]).forEach((key) => keyToIndex.set(key, existingIndex));
        continue;
      }

      const nextIndex = mergedUsers.length;
      mergedUsers.push(candidate);
      keys.forEach((key) => keyToIndex.set(key, nextIndex));
    }

    return mergedUsers
      .filter((u) => u && u.active !== false)
      .sort((a, b) => {
        const aRole = normalizeRole(a);
        const bRole = normalizeRole(b);
        if (aRole === "admin" && bRole !== "admin") return -1;
        if (bRole === "admin" && aRole !== "admin") return 1;
        return String(a.full_name || a.email || "").localeCompare(String(b.full_name || b.email || ""));
      });
  };

  // Core auth — acepta email/password directamente (usado también por auto-login)
  const performStoreAuth = async (email, password) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const isMasterOwnerLogin = normalizedEmail === MASTER_OWNER_EMAIL.toLowerCase();
    setUsersLoading(true);
    setMasterValidated(false);
    setError("");
    setPin("");
    // Limpiar tenant_id viejo para que no contamine las queries de este login
    localStorage.removeItem("smartfix_tenant_id");
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        toast.error("Email o contraseña incorrecta");
        clearSavedCreds();
        return false;
      }

      const authUserId = authData?.user?.id || null;
      if (authUserId) {
        try {
          await supabase
            .from("users")
            .update({ auth_id: authUserId })
            .eq("email", email)
            .is("auth_id", null);
        } catch (authIdError) {
          console.warn("No se pudo sincronizar auth_id del usuario:", authIdError?.message || authIdError);
        }
      }

      // ── Super Admin: verificar OTP o trusted device ──────────────────────
      if (normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
        saveCreds(email, password);

        // Verificar si el dispositivo ya fue aprobado (token válido ≤ 30 días)
        try {
          const trusted = JSON.parse(localStorage.getItem("sa_trusted_device") || "null");
          if (trusted?.token && trusted?.expiry && Date.now() < trusted.expiry) {
            const superSession = { email, role: "saas_owner", loginTime: new Date().toISOString() };
            localStorage.setItem(SUPER_SESSION_KEY, JSON.stringify(superSession));
            navigate("/SuperAdmin", { replace: true });
            return true;
          }
        } catch { /* fallback to OTP */ }

        // Dispositivo no confiable → generar y enviar OTP desde el servidor
        try {
          const otpRes = await fetch(`/api/admin-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "send",
              email: SUPER_ADMIN_EMAIL,
            }),
          });
          const otpData = await otpRes.json().catch(() => ({}));
          if (!otpData.success) {
            throw new Error(otpData.error || "No se pudo enviar el código");
          }
          setOtpSessionId(otpData.sessionId || null);
        } catch (emailErr) {
          console.warn("OTP email failed:", emailErr.message);
          toast.error("No se pudo enviar el código de acceso");
          return false;
        }

        setStep("otp");
        toast.success("📧 Código enviado a tu email", { duration: 4000 });
        return "otp"; // señal especial
      }

      localStorage.setItem(STORE_EMAIL_KEY, email);

      let resolvedTenantId = null;
      try {
        // Usar supabase directo para evitar que tenantScoped() inyecte el tenant_id viejo
        const { data: userRows } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("email", email)
          .not("tenant_id", "is", null)
          .limit(1);
        resolvedTenantId = userRows?.[0]?.tenant_id || null;

        // Fallback: buscar en app_employee si users no tiene registro
        if (!resolvedTenantId) {
          const { data: empRows } = await supabase
            .from("app_employee")
            .select("tenant_id")
            .eq("email", email)
            .limit(1);
          resolvedTenantId = empRows?.[0]?.tenant_id || null;
        }

        if (resolvedTenantId) {
          setTenantId(resolvedTenantId);
          localStorage.setItem("smartfix_tenant_id", resolvedTenantId);
          console.log("🏪 Tenant resolved:", resolvedTenantId);
        }
      } catch (e) {
        console.warn("Could not resolve tenant_id:", e.message);
      }

      // ── Verificar que el tenant no esté suspendido (via supabase directo) ──
      if (resolvedTenantId) {
        try {
          await ensureTenantAdminUser(supabase, resolvedTenantId, {
            id: authUserId,
            auth_id: authUserId,
            email,
            userEmail: email,
            userName: authData?.user?.user_metadata?.full_name || email,
            full_name: authData?.user?.user_metadata?.full_name || email,
          });

          const { data: tenantRecord } = await supabase
            .from("tenant")
            .select("status")
            .eq("id", resolvedTenantId)
            .single();
          if (tenantRecord?.status === "suspended" || tenantRecord?.status === "cancelled") {
            toast.error("⛔ Esta cuenta está suspendida. Contacta a soporte en smartfixos.com", { duration: 6000 });
            await supabase.auth.signOut();
            clearSavedCreds();
            return false;
          }
        } catch (e) {
          // Si falla la query, intentar con la tabla "Tenant" en minúsculas alternativa
          try {
            const { data: t2 } = await supabase
              .from("Tenant")
              .select("status")
              .eq("id", resolvedTenantId)
              .single();
            if (t2?.status === "suspended" || t2?.status === "cancelled") {
              toast.error("⛔ Esta cuenta está suspendida. Contacta a soporte en smartfixos.com", { duration: 6000 });
              await supabase.auth.signOut();
              clearSavedCreds();
              return false;
            }
          } catch {
            console.warn("No se pudo verificar estado del tenant:", e.message);
          }
        }
      }

      const users = await getMergedActiveUsers(resolvedTenantId);
      if (!users.length) {
        // No employees found → show first user setup wizard
        setFirstUserForm({ full_name: '', phone: '' });
        setFirstUserPin('');
        setFirstUserPinConfirm('');
        setFirstUserPinStage('form');
        setFirstUserPinError('');
        setStep("first_user_setup");
      } else {
        setAvailableUsers(users);
        setSelectedUser(null);
        setStep("user");
      }

      saveCreds(email, password);
      setStoreAuthenticated(true);
      return true;
    } catch (e) {
      console.error("Error en login:", e);
      toast.error("Error al conectar. Verifica tu conexión.");
      return false;
    } finally {
      setUsersLoading(false);
    }
  };

  const handleStoreContinue = async () => {
    const trimmedEmail = storeEmail.trim();
    if (!trimmedEmail) { toast.error("Ingresa el email de la cuenta"); return; }
    if (!storePassword)  { toast.error("Ingresa tu contraseña"); return; }
    await performStoreAuth(trimmedEmail, storePassword);
  };

  // SuperAdmin: enviar OTP vía servidor (seguro, sin contraseña)
  const handleSendAdminOtpDirect = async () => {
    setUsersLoading(true);
    try {
      // ¿Dispositivo ya confiable?
      const trusted = JSON.parse(localStorage.getItem("sa_trusted_device") || "null");
      if (trusted?.token && trusted?.expiry && Date.now() < trusted.expiry) {
        const superSession = { email: SUPER_ADMIN_EMAIL, role: "saas_owner", loginTime: new Date().toISOString() };
        localStorage.setItem(SUPER_SESSION_KEY, JSON.stringify(superSession));
        navigate("/SuperAdmin", { replace: true });
        return;
      }
      // Pedir al servidor que genere y envíe el OTP (Vercel endpoint)
      const res = await fetch(`/api/admin-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: SUPER_ADMIN_EMAIL }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "No se pudo enviar el código.");
        return;
      }
      // Guardar sessionId para la verificación
      setOtpSessionId(data.sessionId || null);
      setOtpInput("");
      setAdminPin("");
      setStep("otp");
      toast.success("📧 Código enviado a tu email", { duration: 4000 });
    } catch (err) {
      console.error("OTP send error:", err);
      toast.error("Error de conexión. Verifica tu internet e intenta nuevamente.");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = storeEmail.trim();
    if (!trimmedEmail) {
      toast.error("Ingresa tu email primero");
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/PinAccess`,
      });
      if (error) throw error;
      toast.success(`📧 Enlace de recuperación enviado a ${trimmedEmail}`);
    } catch (e) {
      toast.error(e?.message || "Error al enviar email de recuperación");
    } finally {
      setSendingReset(false);
    }
  };

  // ── Google OAuth ───────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/PinAccess`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) {
        toast.error("Error al iniciar con Google: " + error.message);
        setLoading(false);
      }
      // On success, browser redirects to Google — loading stays true
    } catch (e) {
      toast.error("No se pudo conectar con Google");
      setLoading(false);
    }
  };

  // After Google OAuth redirect, load the tenant users and proceed
  const performOAuthAuth = async (oauthUser) => {
    const email = oauthUser.email;
    const googleName = oauthUser.user_metadata?.full_name || oauthUser.user_metadata?.name || '';
    setUsersLoading(true);
    setError("");
    setPin("");
    localStorage.removeItem("smartfix_tenant_id");
    try {
      let resolvedTenantId = null;
      const { data: userRows } = await supabase
        .from("users").select("tenant_id").eq("email", email).not("tenant_id", "is", null).limit(1);
      resolvedTenantId = userRows?.[0]?.tenant_id || null;
      if (!resolvedTenantId) {
        const { data: empRows } = await supabase
          .from("app_employee").select("tenant_id").eq("email", email).limit(1);
        resolvedTenantId = empRows?.[0]?.tenant_id || null;
      }
      if (resolvedTenantId) {
        setTenantId(resolvedTenantId);
        localStorage.setItem("smartfix_tenant_id", resolvedTenantId);
        localStorage.setItem("smartfix_store_email", email);
      }
      // storeEmail is used in handleCreateFirstUser — set it now
      setStoreEmail(email);

      const users = await getMergedActiveUsers(resolvedTenantId);
      if (!users.length) {
        // ── Primer usuario: configurar perfil + PIN ──
        setFirstUserForm({ full_name: googleName, phone: '' });
        setFirstUserPin('');
        setFirstUserPinConfirm('');
        setFirstUserPinStage(googleName ? 'pin' : 'form'); // saltar form si ya tenemos el nombre
        setFirstUserPinError('');
        setStoreAuthenticated(true);
        setStep("first_user_setup");
      } else {
        setAvailableUsers(users);
        setStoreAuthenticated(true);
        // ── Opción B: si el email de Google coincide con un empleado, ir directo a su PIN ──
        const matched = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (matched) {
          setSelectedUser(matched);
          setPin("");
          setError("");
          setStep("pin");
          toast.success(`¡Hola, ${matched.full_name || matched.email}! Ingresa tu PIN`, { duration: 2500 });
        } else {
          setSelectedUser(null);
          setStep("user");
        }
      }
    } catch (e) {
      console.error("OAuth auth error:", e);
      toast.error("Error al procesar tu sesión de Google.");
    } finally {
      setUsersLoading(false);
    }
  };

  // ── Biometric early login (before user selection) ─────────────────────────
  const handleEarlyBiometricLogin = async () => {
    if (!biometricSupported || !biometricProfile?.credentialId || !biometricProfile?.session) return;
    setBiometricLoading(true);
    setError("");
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: createChallenge(),
          allowCredentials: [{ id: base64ToUint8Array(biometricProfile.credentialId), type: "public-key" }],
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (!assertion?.rawId) throw new Error("No se pudo validar la biometría");
      const rawId = arrayBufferToBase64(assertion.rawId);
      if (rawId !== biometricProfile.credentialId) throw new Error("Credencial biométrica inválida");
      const session = biometricProfile.session;
      if (!session?.id) throw new Error("Sesión biométrica expirada — inicia sesión manualmente");
      saveBiometricProfile({ ...biometricProfile, updatedAt: new Date().toISOString() });
      await completeLogin(session);
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        toast.error("Autenticación cancelada");
      } else {
        toast.error(error?.message || "No se pudo validar la biometría");
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSelectUser = (user) => {
    setSlideDir(1);
    setSelectedUser(user);
    setPin("");
    setError("");
    setStep("pin");
  };

  const buildSessionFromUser = (user) => {
    const role = normalizeRole(user);
    const permissions = role === "admin"
      ? ADMIN_PERMISSIONS
      : getUserPermissions({ role, permissions: user.permissions });

    return {
      id: user.id,
      userId: user.id,
      userEmail: user.email,
      userName: user.full_name || user.email,
      userRole: role,
      employee_code: user.employee_code || "",
      full_name: user.full_name || "Usuario",
      email: user.email,
      role,
      position: user.position || role,
      permissions,
      permissions_list: role === "admin" ? ["all"] : [],
      // Fase 4: tenant isolation
      tenant_id: user.tenant_id || tenantId || null,
      auth_id: user.auth_id || null,
      loginTime: new Date().toISOString()
    };
  };

  // ── First User Setup handler ───────────────────────────────────────────────
  const handleCreateFirstUser = async () => {
    const trimmedName = firstUserForm.full_name.trim();
    if (!trimmedName) { toast.error("Ingresa tu nombre completo"); return; }
    if (firstUserPin.length !== 4) { setFirstUserPinError("El PIN debe tener 4 dígitos"); return; }
    if (firstUserPin !== firstUserPinConfirm) { setFirstUserPinError("Los PINs no coinciden"); setFirstUserPinConfirm(""); return; }

    const resolvedTenantId = tenantId || localStorage.getItem("smartfix_tenant_id");
    if (!resolvedTenantId) { toast.error("No se encontró el ID del taller. Intenta iniciar sesión de nuevo."); return; }

    setFirstUserSaving(true);
    try {
      const res = await fetch('/api/manage-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: resolvedTenantId,
          action: 'create_first_user',
          email: storeEmail.trim().toLowerCase(),
          full_name: trimmedName,
          phone: firstUserForm.phone.trim(),
          pin: firstUserPin,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'No se pudo crear el usuario');

      const emp = data.employee;
      const session = buildSessionFromUser({
        id: emp.id,
        full_name: emp.full_name,
        email: emp.email,
        role: 'admin',
        position: 'admin',
        active: true,
        pin: firstUserPin,
        tenant_id: resolvedTenantId,
        permissions: ADMIN_PERMISSIONS,
      });

      await completeLogin(session);
    } catch (e) {
      console.error("handleCreateFirstUser error:", e);
      toast.error("Error al crear el usuario: " + e.message);
    } finally {
      setFirstUserSaving(false);
    }
  };

  const canUseBiometricLogin = async () => {
    if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  };

  const handleBiometricLogin = async () => {
    if (!isBiometricAvailableForSelectedUser || !biometricProfile?.credentialId) return;

    setBiometricLoading(true);
    setError("");
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: createChallenge(),
          allowCredentials: [
            {
              id: base64ToUint8Array(biometricProfile.credentialId),
              type: "public-key",
            },
          ],
          userVerification: "required",
          timeout: 60000,
        },
      });

      if (!assertion?.rawId) {
        throw new Error("No se pudo validar la huella");
      }

      const rawId = arrayBufferToBase64(assertion.rawId);
      if (rawId !== biometricProfile.credentialId) {
        throw new Error("Credencial biométrica inválida");
      }

      const session = biometricProfile.session;
      if (!session?.id) {
        throw new Error("No se encontró una sesión biométrica válida");
      }

      saveBiometricProfile({
        ...biometricProfile,
        updatedAt: new Date().toISOString(),
      });

      await completeLogin(session);
    } catch (error) {
      console.error("Biometric login error:", error);
      if (error?.name === "NotAllowedError") {
        toast.error("Autenticación biométrica cancelada");
      } else {
        toast.error(error?.message || "No se pudo entrar con huella");
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const completeLogin = async (session) => {
    localStorage.setItem("employee_session", JSON.stringify(session));
    sessionStorage.setItem("911-session", JSON.stringify(session));

    if (session.role === "admin") {
      await ensureAdminBootstrap(dataClient);
    }

    if (navigator.vibrate) {
      navigator.vibrate([50, 100, 50]);
    }

    try {
      await triggerRealtimeNotification(NOTIFICATION_TYPES.EMPLOYEE_LOGIN, {
        userId: session.id,
        userName: session.full_name,
        userRole: session.role,
        ipAddress: 'local'
      });
    } catch (notifyError) {
      console.warn("PIN login: notificación no disponible (continuando login).", notifyError);
    }

    toast.success(`¡Bienvenido, ${session.userName}!`, {
      duration: 2000
    });

    setShowSuccessBurst(true);
    setTimeout(() => {
      setShowSuccessBurst(false);
      navigate("/Dashboard", { replace: true });
    }, 850);
  };

  const handleMasterValidate = async () => {
    const emailOk = String(masterEmail || "").trim().toLowerCase() === MASTER_OWNER_EMAIL.toLowerCase();
    const pinOk = String(masterPin || "") === MASTER_PIN;

    if (!emailOk || !pinOk) {
      toast.error("Credenciales maestras inválidas");
      return;
    }

    setMasterLoading(true);
    try {
      let resolvedUsers = availableUsers;
      if (!availableUsers.length) {
        resolvedUsers = await getMergedActiveUsers();
      }
      const safeUsers = (resolvedUsers && resolvedUsers.length)
        ? resolvedUsers
        : [getMasterFallbackUser()];
      setAvailableUsers(safeUsers);
      setMasterValidated(true);
      setStep("user");
      toast.success("Acceso maestro habilitado");
    } catch (e) {
      console.error("Error habilitando acceso maestro:", e);
      toast.error("No se pudo habilitar acceso maestro");
    } finally {
      setMasterLoading(false);
    }
  };

  const handleMasterLoginAs = async (user) => {
    if (!masterValidated) return;
    try {
      const session = buildSessionFromUser(user);
      await completeLogin(session);
    } catch (e) {
      console.error("Error en login maestro:", e);
      toast.error("No se pudo entrar como usuario");
    }
  };

  // ✅ Verificar si ya hay sesión activa Y si es primera vez - SOLO UNA VEZ
  useEffect(() => {
    if (hasCheckedSession.current) return;
    hasCheckedSession.current = true;

    (async () => {
      // 🔧 Modo testing: forzar Setup con ?setup=true
      const params = new URLSearchParams(window.location.search);
      if (params.get("setup") === "true") {
        console.log("🔧 Modo testing - forzando Setup");
        navigate("/Setup", { replace: true });
        return;
      }
      if (params.get("step") === "pin") {
        setStep("store");
      }

      // 0a. Mostrar toast si viene de activación exitosa
      if (location.state?.activated) {
        toast.success("¡Cuenta activada! Ingresa con tu email y el PIN que creaste", { duration: 5000 });
        navigate(location.pathname, { replace: true, state: {} });
      }

      // 0b. Mostrar mensaje si fue expulsado por suspensión
      const kickReason = sessionStorage.getItem("smartfix_kicked_reason");
      if (kickReason) {
        sessionStorage.removeItem("smartfix_kicked_reason");
        const msg = kickReason === "cancelled"
          ? "Tu suscripción fue cancelada. Contacta soporte para reactivar."
          : "Tu cuenta ha sido suspendida. Contacta soporte en smartfixos.com";
        setTimeout(() => toast.error("⛔ " + msg, { duration: 8000 }), 500);
      }

      // 0b. Verificar sesión Super Admin guardada
      const superRaw = localStorage.getItem(SUPER_SESSION_KEY);
      if (superRaw) {
        try {
          const superSess = JSON.parse(superRaw);
          if (superSess?.role === "saas_owner") {
            navigate("/SuperAdmin", { replace: true });
            return;
          }
        } catch {
          localStorage.removeItem(SUPER_SESSION_KEY);
        }
      }

      // 1. Verificar sesión activa — con check de suspensión antes de redirigir
      const session = localStorage.getItem("employee_session");
      if (session) {
        try {
          const parsed = JSON.parse(session);
          if (parsed && parsed.id) {
            // Verificar que el tenant NO esté suspendido antes de dejar entrar
            const sessionTenantId = parsed.tenant_id || localStorage.getItem("smartfix_tenant_id");
            if (sessionTenantId) {
              try {
                const { data: tenantCheck } = await supabase
                  .from("tenant")
                  .select("status")
                  .eq("id", sessionTenantId)
                  .single();
                if (tenantCheck?.status === "suspended" || tenantCheck?.status === "cancelled") {
                  console.log("⛔ Sesión existente bloqueada — tenant suspendido");
                  localStorage.removeItem("employee_session");
                  sessionStorage.removeItem("911-session");
                  clearSavedCreds();
                  localStorage.removeItem("smartfix_tenant_id");
                  setTimeout(() => toast.error("⛔ Esta cuenta está suspendida. Contacta soporte en smartfixos.com", { duration: 8000 }), 300);
                  // No redirigir — mostrar PinAccess con el mensaje
                  setCheckingUsers(false);
                  setIsReady(true);
                  return;
                }
              } catch { /* Si falla la query, dejar pasar */ }
            }
            console.log("✅ PinAccess: Sesión detectada, redirigiendo a Dashboard");
            navigate("/Dashboard", { replace: true });
            return;
          }
        } catch (e) {
          console.log("⚠️ PinAccess: Sesión corrupta, limpiando");
          localStorage.removeItem("employee_session");
          sessionStorage.removeItem("911-session");
        }
      }

      // 2. Detectar retorno de Google OAuth (access_token en URL hash o sesión activa)
      try {
        const { data: { session: oauthSess } } = await supabase.auth.getSession();
        if (oauthSess?.user && oauthSess.user.app_metadata?.provider === "google" && !oauthSess.user.email?.endsWith("smartfixos.com")) {
          console.log("🟢 Google OAuth session detected:", oauthSess.user.email);
          setCheckingUsers(true);
          await performOAuthAuth(oauthSess.user);
          setCheckingUsers(false);
          setIsReady(true);
          return;
        }
      } catch (oauthErr) {
        console.warn("Google session check failed:", oauthErr);
      }

      // 3. Auto-login con credenciales guardadas
      const saved = loadSavedCreds();
      if (saved?.email && saved?.pwd) {
        console.log("🔑 Auto-login:", saved.email);
        setIsAutoLogging(true);
        setStoreEmail(saved.email);
        setStorePassword(saved.pwd);
        const ok = await performStoreAuth(saved.email, saved.pwd);
        setIsAutoLogging(false);
        setCheckingUsers(false);
        setIsReady(true);
        if (!ok) console.warn("Auto-login falló — mostrando formulario");
        return;
      }

      // 3. Verificar usuarios (para bypass detection)
      try {
        await supabase.from("users").select("id", { head: true, count: "exact" }).limit(1);
        setShowBypass(true);
      } catch {
        setShowBypass(true);
      }

      setCheckingUsers(false);
      setIsReady(true);
    })();
  }, [navigate]);

  useEffect(() => {
    canUseBiometricLogin().then(setBiometricSupported).catch(() => setBiometricSupported(false));
    setBiometricProfile(loadBiometricProfile());
  }, []);

  const handleNumberClick = (num) => {
    if (pin.length < 4) {
      setPin(pin + num);
      setError("");

      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  };

  // ── OTP Verify (server-side: OTP hash + PIN secreto) ─────────────────────
  const handleOtpVerify = async () => {
    if (!otpInput || otpInput.length !== 6) {
      toast.error("Ingresa el código de 6 dígitos");
      return;
    }
    if (!adminPin || adminPin.length < 4) {
      toast.error("Ingresa tu PIN secreto de administrador");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch(`/api/admin-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          sessionId: otpSessionId,
          otp: otpInput.trim(),
          adminPin: adminPin.trim(),
        }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Verificación fallida.");
        setOtpInput("");
        // No limpiar adminPin para no obligar al usuario a reescribirlo en caso de OTP incorrecto
        return;
      }

      // ✅ Verificado — guardar sesión y navegar
      if (trustDevice) {
        localStorage.setItem("sa_trusted_device", JSON.stringify({
          token: crypto.randomUUID(),
          expiry: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 días
        }));
      }
      const superSession = {
        email: SUPER_ADMIN_EMAIL,
        role: "saas_owner",
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem(SUPER_SESSION_KEY, JSON.stringify(superSession));
      navigate("/SuperAdmin", { replace: true });
    } catch (err) {
      console.error("OTP verify error:", err);
      toast.error("Error de conexión. Intenta nuevamente.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");

    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  const handleSubmit = async () => {
    if (pin.length !== 4) return; // Silent return for auto-submit

    setLoading(true);
    setError("");

    try {
      if (!selectedUser) {
        setStep("user");
        toast.error("Selecciona un usuario primero");
        return;
      }

      const isMasterUser = selectedUser.id === "__master__";
      const isValidPin = isMasterUser
        ? pin === MASTER_PIN
        : String(selectedUser?.pin || "") === pin;

      if (!isValidPin) {
        setError("PIN incorrecto");
        toast.error("PIN incorrecto");
        setPin("");

        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100, 50, 100]);
        }
        return;
      }

      // ── 2ª verificación de suspensión justo antes de completar login ────────
      if (!isMasterUser) {
        const savedTenantId = localStorage.getItem("smartfix_tenant_id");
        if (savedTenantId) {
          try {
            const { data: tenantCheck } = await supabase
              .from("tenant")
              .select("status")
              .eq("id", savedTenantId)
              .single();
            if (tenantCheck?.status === "suspended" || tenantCheck?.status === "cancelled") {
              toast.error("⛔ Esta cuenta está suspendida. Contacta a soporte en smartfixos.com", { duration: 6000 });
              clearSavedCreds();
              await supabase.auth.signOut();
              setPin("");
              setStep("store");
              setStoreAuthenticated(false);
              return;
            }
          } catch { /* si falla, dejar pasar — Layout.jsx tiene el tercer chequeo */ }
        }
      }

      const session = !isMasterUser ? buildSessionFromUser(selectedUser) : {
        id: "local-admin",
        userId: "local-admin",
        userEmail: "local@smartfix",
        userName: "Admin Local",
        userRole: "admin",
        employee_code: "LOCAL",
        full_name: "Admin Local",
        email: "local@smartfix",
        role: "admin",
        position: "admin",
        permissions: ADMIN_PERMISSIONS,
        permissions_list: ["all"],
        loginTime: new Date().toISOString()
      };

      await completeLogin(session);

    } catch (error) {
      console.error("Error validating PIN:", error);
      setError("Error al validar PIN");
      toast.error("Error al validar PIN. Intenta nuevamente.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== "pin") return;

    const handleKeyPress = (e) => {
      if (e.key === "Enter" && pin.length === 4) {
        handleSubmit();
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key >= "0" && e.key <= "9") {
        handleNumberClick(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [step, pin]);

  useEffect(() => {
    if (step === "user" && usersSectionRef.current) {
      usersSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (step === "pin" && pinSectionRef.current) {
      pinSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step, selectedUser?.id]);

  if (!isReady || checkingUsers) {
    return (
      <div className="pinaccess-fullscreen-container">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>);
  }

  // ── OTP SuperAdmin ────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <div className="pinaccess-fullscreen-container">
        <div className="w-full max-w-sm mx-auto px-6">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
              alt="SmartFixOS" className="h-12 w-auto object-contain mx-auto mb-5 drop-shadow-[0_4px_16px_rgba(0,168,232,0.7)]"
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Verificación de seguridad</h2>
            <p className="text-sm text-white/50 mt-2">
              Enviamos un código de 6 dígitos a<br/>
              <span className="text-cyan-400 font-medium">{SUPER_ADMIN_EMAIL}</span>
            </p>
          </div>

          {/* OTP Input */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5">
            <label className="text-xs text-white/50 uppercase tracking-widest mb-3 block">Código de verificación</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpInput}
              onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && otpInput.length === 6 && handleOtpVerify()}
              placeholder="000000"
              className="w-full bg-transparent border-b-2 border-cyan-500/40 focus:border-cyan-400 outline-none text-center text-4xl font-mono font-bold text-white tracking-[0.4em] pb-2 placeholder:text-white/20 transition-colors"
              autoFocus
            />
          </div>

          {/* PIN secreto de administrador */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
            <label className="text-xs text-white/50 uppercase tracking-widest mb-3 block">
              PIN secreto de administrador
            </label>
            <div className="relative">
              <input
                type={showAdminPin ? "text" : "password"}
                value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                onKeyDown={e => e.key === "Enter" && otpInput.length === 6 && adminPin.length >= 4 && handleOtpVerify()}
                placeholder="Tu PIN secreto"
                className="w-full bg-transparent border-b-2 border-cyan-500/40 focus:border-cyan-400 outline-none text-white text-lg font-mono pb-2 pr-10 placeholder:text-white/20 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowAdminPin(v => !v)}
                className="absolute right-0 top-0 text-gray-400 hover:text-white transition-colors"
              >
                {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-white/30 mt-2">Este PIN lo configuraste en los ajustes del servidor (ADMIN_SECRET_PIN)</p>
          </div>

          {/* Trust device */}
          <label className="flex items-center gap-3 cursor-pointer mb-5 px-1">
            <div
              onClick={() => setTrustDevice(t => !t)}
              className={`w-11 h-6 rounded-full transition-colors relative ${trustDevice ? "bg-cyan-600" : "bg-white/10"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${trustDevice ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-white/70">Recordar este dispositivo por 30 días</span>
          </label>

          {/* Verify button */}
          <button
            onClick={handleOtpVerify}
            disabled={otpInput.length !== 6 || adminPin.length < 4 || otpLoading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-all"
          >
            {otpLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verificando...
              </span>
            ) : "🔐 Verificar y entrar →"}
          </button>

          <button
            onClick={() => { setStep("store"); setOtpInput(""); setAdminPin(""); setOtpSessionId(null); }}
            className="w-full mt-3 py-3 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            ← Volver al login
          </button>
        </div>
      </div>
    );
  }

  // ── Auto-login cargando ───────────────────────────────────────────────────
  if (isAutoLogging) {
    return (
      <div className="pinaccess-fullscreen-container">
        <div className="text-center">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
            alt="SmartFixOS"
            className="h-16 w-auto object-contain mx-auto mb-8 drop-shadow-[0_4px_16px_rgba(0,168,232,0.8)]"
          />
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Conectando tu tienda...</p>
        </div>
      </div>
    );
  }

  // ── First User Setup ─────────────────────────────────────────────────────
  if (storeAuthenticated && step === "first_user_setup") {
    const isFormStage   = firstUserPinStage === "form";
    const isPinStage    = firstUserPinStage === "pin";
    const isConfirmStage = firstUserPinStage === "confirm";

    const handleNumPress = (n) => {
      if (n === "⌫") {
        if (isPinStage)    setFirstUserPin(p => p.slice(0, -1));
        if (isConfirmStage) setFirstUserPinConfirm(p => p.slice(0, -1));
        return;
      }
      if (n === null) return;
      if (isPinStage) {
        if (firstUserPin.length >= 4) return;
        const next = firstUserPin + String(n);
        setFirstUserPin(next);
        if (next.length === 4) setFirstUserPinStage("confirm");
        return;
      }
      if (isConfirmStage) {
        if (firstUserPinConfirm.length >= 4) return;
        const next = firstUserPinConfirm + String(n);
        setFirstUserPinConfirm(next);
        if (next.length === 4) {
          if (next !== firstUserPin) {
            setFirstUserPinError("Los PINs no coinciden");
            setFirstUserPinConfirm("");
          } else {
            setFirstUserPinError("");
            handleCreateFirstUser();
          }
        }
      }
    };

    return (
      <div className="pinaccess-fullscreen-container">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm mx-auto px-6 py-8">
          {/* Logo */}
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
            alt="SmartFixOS"
            className="h-12 w-auto object-contain mb-6 drop-shadow-[0_4px_16px_rgba(0,168,232,0.8)]"
          />

          {/* Stage: form */}
          {isFormStage && (
            <div className="w-full">
              <h2 className="text-white text-2xl font-bold text-center mb-1">Configura tu perfil</h2>
              <p className="text-gray-400 text-sm text-center mb-6">Ingresa tus datos para crear tu usuario</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Nombre completo *</label>
                  <input
                    type="text"
                    placeholder="Ej: Juan Pérez"
                    value={firstUserForm.full_name}
                    onChange={e => setFirstUserForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="Ej: 555-123-4567"
                    value={firstUserForm.phone}
                    onChange={e => setFirstUserForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 text-sm"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  if (!firstUserForm.full_name.trim()) { toast.error("Ingresa tu nombre completo"); return; }
                  setFirstUserPinStage("pin");
                }}
                className="mt-6 w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold py-3.5 rounded-xl hover:from-cyan-400 hover:to-cyan-500 transition-all duration-200 text-sm"
              >
                Continuar →
              </button>

              <button
                onClick={() => { setStoreAuthenticated(false); setStep("store"); }}
                className="mt-3 w-full text-gray-500 text-xs py-2 hover:text-gray-400 transition-colors"
              >
                ← Volver al inicio
              </button>
            </div>
          )}

          {/* Stage: pin or confirm */}
          {(isPinStage || isConfirmStage) && (
            <div className="w-full flex flex-col items-center">
              <h2 className="text-white text-xl font-bold text-center mb-1">
                {isPinStage ? "Elige tu PIN de acceso" : "Confirma tu PIN"}
              </h2>
              <p className="text-gray-400 text-xs text-center mb-6">
                {isPinStage
                  ? "Este PIN lo usarás cada vez que abras la app"
                  : "Ingresa el mismo PIN nuevamente"}
              </p>

              {/* Puntos */}
              <div className="flex gap-4 mb-6">
                {[0, 1, 2, 3].map(i => {
                  const filled = isPinStage ? i < firstUserPin.length : i < firstUserPinConfirm.length;
                  return (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        filled ? "bg-cyan-400 border-cyan-400 scale-110" : "bg-transparent border-gray-600"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Error */}
              {firstUserPinError && (
                <p className="text-red-400 text-xs mb-4 text-center">{firstUserPinError}</p>
              )}

              {/* Loading */}
              {firstUserSaving ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-500 border-t-transparent" />
                  <p className="text-gray-400 text-sm">Creando tu usuario...</p>
                </div>
              ) : (
                /* Teclado numérico */
                <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
                  {numbers.flat().map((n, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleNumPress(n)}
                      disabled={n === null}
                      className={`
                        h-16 rounded-2xl text-lg font-semibold transition-all duration-150 select-none
                        ${n === null ? "invisible" : ""}
                        ${n === "⌫"
                          ? "bg-white/5 text-gray-400 hover:bg-white/10 active:scale-95"
                          : "bg-white/8 text-white hover:bg-white/15 active:scale-95 active:bg-cyan-500/20 border border-white/5"}
                      `}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  if (isConfirmStage) { setFirstUserPinStage("pin"); setFirstUserPinConfirm(""); setFirstUserPinError(""); }
                  else { setFirstUserPinStage("form"); setFirstUserPin(""); }
                }}
                className="mt-5 text-gray-500 text-xs hover:text-gray-400 transition-colors"
              >
                ← Volver
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Kiosk full-screen: user grid + PIN con slide horizontal ───────────────
  if (storeAuthenticated && (step === "user" || step === "pin")) {
    const hSlide = {
      enter: (d) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
      center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
      exit:  (d) => ({ x: d < 0 ? "100%" : "-100%", opacity: 0, transition: { duration: 0.22, ease: [0.55, 0, 1, 0.45] } }),
    };

    return (
      <div className="pinaccess-fullscreen-container overflow-hidden">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
        </div>

        {/* Barra superior */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3 bg-black/50 backdrop-blur-md border-b border-white/5"
          style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
        >
          <div className="flex items-center gap-3">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
              alt="SmartFixOS"
              className="h-7 w-auto object-contain"
            />
            <span className="text-xs text-gray-600 hidden sm:block truncate max-w-[200px]">{storeEmail}</span>
          </div>
          <button
            onClick={() => {
              clearSavedCreds();
              setStoreAuthenticated(false);
              setStep("store");
              setAvailableUsers([]);
              setSelectedUser(null);
              setPin("");
              setError("");
              setStorePassword("");
            }}
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-full border border-white/10 hover:border-cyan-500/30 active:scale-95"
          >
            Cambiar cuenta
          </button>
        </div>

        {/* Panel deslizante */}
        <div className="absolute inset-0" style={{ paddingTop: "52px" }}>
          <AnimatePresence mode="wait" custom={slideDir}>

            {/* ─── Grilla de usuarios ─── */}
            {step === "user" && (
              <motion.div
                key="user-panel"
                custom={slideDir}
                variants={hSlide}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0 overflow-y-auto"
              >
                <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-8">
                  <div className="w-full max-w-lg">
                    <h2 className="text-2xl sm:text-3xl font-black text-white mb-1 text-center">¿Quién eres?</h2>
                    <p className="text-gray-500 text-sm text-center mb-8">Selecciona tu perfil para continuar</p>
                    <motion.div
                      className="grid grid-cols-2 sm:grid-cols-3 gap-4"
                      initial="hidden"
                      animate="show"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
                    >
                      {availableUsers.map((user) => (
                        <motion.button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          variants={{ hidden: { opacity: 0, y: 16, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1 } }}
                          whileHover={{ scale: 1.04, y: -3 }}
                          whileTap={{ scale: 0.96 }}
                          className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/40 p-5 flex flex-col items-center gap-3 min-h-[140px] transition-all shadow-lg hover:shadow-cyan-500/10"
                        >
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-cyan-500/25">
                            {(user.full_name || user.email || "?")[0].toUpperCase()}
                          </div>
                          <p className="text-white font-bold text-sm leading-tight text-center">
                            {user.full_name || user.email || "Usuario"}
                          </p>
                          {(user.position || user.role) && (
                            <span className="text-xs text-gray-500 capitalize">{user.position || user.role}</span>
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── PIN pad ─── */}
            {step === "pin" && selectedUser && (
              <motion.div
                key="pin-panel"
                custom={slideDir}
                variants={hSlide}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0 overflow-y-auto"
              >
                <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-6">
                  <div className="w-full max-w-xs">

                    {/* Botón volver */}
                    <button
                      onClick={() => { setSlideDir(-1); setStep("user"); setPin(""); setError(""); }}
                      className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors text-sm active:scale-95"
                    >
                      <ArrowLeft className="w-4 h-4" /> Seleccionar otro usuario
                    </button>

                    {/* Avatar + nombre */}
                    <div className="text-center mb-8">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center font-black text-white text-3xl mx-auto mb-4 shadow-[0_0_40px_rgba(6,182,212,0.4)]">
                        {(selectedUser.full_name || selectedUser.email || "?")[0].toUpperCase()}
                      </div>
                      <h2 className="text-2xl font-black text-white">{selectedUser.full_name || selectedUser.email}</h2>
                      <p className="text-gray-500 text-sm mt-1">Ingresa tu PIN de 4 dígitos</p>
                    </div>

                    {/* Indicadores PIN */}
                    <div className="flex justify-center gap-5 mb-8">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pin.length > i ? "bg-white border-white shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-110" : "bg-transparent border-white/30"}`} />
                      ))}
                    </div>

                    {error && <p className="text-red-400 text-sm font-medium text-center mb-4 animate-pulse">{error}</p>}

                    {/* Teclado numérico */}
                    <div className="space-y-3">
                      {numbers.map((row, ri) => (
                        <div key={ri} className="grid grid-cols-3 gap-3">
                          {row.map((num, ci) => {
                            if (num === null) return <div key={`e${ci}`} />;
                            if (num === "⌫") return (
                              <button key="bs" onClick={handleBackspace} disabled={pin.length === 0 || loading}
                                className="h-16 w-full rounded-2xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 shadow-lg">
                                <Delete className="w-6 h-6 text-red-300" />
                              </button>
                            );
                            return (
                              <button key={num} onClick={() => handleNumberClick(String(num))} disabled={loading || pin.length >= 4}
                                className="h-16 w-full rounded-2xl bg-white/10 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/40 text-white text-2xl font-semibold transition-all active:scale-95 disabled:opacity-30 shadow-lg hover:shadow-cyan-500/20">
                                {num}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    {loading && <p className="text-cyan-400 font-bold text-center mt-6 animate-pulse">⚡ Validando...</p>}

                    {isBiometricAvailableForSelectedUser && (
                      <>
                        <button
                          onClick={handleBiometricLogin}
                          disabled={loading || biometricLoading}
                          className="w-full mt-4 h-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 font-semibold transition-all active:scale-95 disabled:opacity-40"
                        >
                          {biometricLoading ? "Validando huella..." : `Entrar con huella`}
                        </button>
                        <button
                          onClick={clearBiometricProfile}
                          disabled={loading || biometricLoading}
                          className="w-full mt-2 text-xs text-white/45 hover:text-white/70 transition-colors"
                        >
                          Quitar huella de este dispositivo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Burst de éxito */}
        <AnimatePresence>
          {showSuccessBurst && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.7 }} animate={{ scale: 1, transition: { type: "spring", stiffness: 200 } }}
                className="text-center"
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_60px_rgba(6,182,212,0.6)]">
                  <Check className="w-12 h-12 text-white" />
                </div>
                <p className="text-white text-2xl font-black">¡Bienvenido!</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!formData.first_name || !formData.email) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (formData.plan === "enterprise") {
      window.location.href = "mailto:smartfixosapp@gmail.com?subject=Consulta%20Enterprise";
      return;
    }

    setSubmitting(true);
    try {
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: fullName,
          email: formData.email,
          password: formData.password,
          businessName: fullName, // temporal — wizard lo actualiza después
          plan: formData.plan,
          country: 'US',
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setSignupResult(data);
        setSignupStep("success");
      } else {
        const msg = data?.error || "Error al crear la cuenta";
        toast.error(msg);
        console.error("Signup backend error:", msg, data);
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(error?.message || "Error de conexión. Verifica tu internet e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const BentoItem = ({ children, className, delay = 0 }) =>
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay, type: "spring", stiffness: 100 }}
    className={`relative overflow-hidden rounded-[2rem] bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] hover:bg-white/[0.06] transition-colors p-6 sm:p-8 flex flex-col ${className}`}>

      {children}
    </motion.div>;


  const photos = [
  {
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/99a8d3676_DSC_0343.jpg",
    alt: "Técnico trabajando"
  },
  {
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e3c08101c_DSC_0326.jpg",
    alt: "Reparando MacBook"
  },
  {
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/d6d0ace0f_DSC_0330.jpg",
    alt: "Trabajo con placa madre"
  },
  {
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/c1fb487ef_DSC_0222.jpg",
    alt: "Reparación detallada"
  }];


  if (step === "welcome") {
    return (
      <div
        className="min-h-screen bg-[#000000] text-white overflow-y-auto selection:bg-cyan-500/30 font-sans"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 0px)"
        }}
      >
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                alt="SmartFixOS"
                className="h-8 w-auto object-contain" />

              <span className="text-lg font-semibold tracking-tight">SmartFixOS</span>
            </div>
            <Button
              onClick={() => setStep("store")}
              className="bg-white text-black hover:bg-gray-200 rounded-full px-6 font-medium text-sm h-9 shadow-lg shadow-white/10 transition-transform active:scale-95">
              Iniciar Sesión
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
          
          <div className="text-center mb-12 flex flex-col items-center gap-4">
            <Button
              onClick={() => setShowSignup(true)}
              variant="outline"
              className="border-cyan-500/40 bg-transparent text-cyan-300 hover:bg-cyan-500/10 rounded-full px-5 font-medium text-sm h-9">

              <UserPlus className="w-4 h-4 mr-2" />
              Solicitar Demo
            </Button>
          </div>

          <div className="text-center mb-16 space-y-6">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl sm:text-7xl font-bold tracking-tighter bg-gradient-to-br from-white via-gray-200 to-gray-500 bg-clip-text text-transparent">

              Potencia tu Taller.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl sm:text-2xl text-gray-400 font-medium max-w-2xl mx-auto">

              La plataforma definitiva para gestión de reparaciones y ventas.
            </motion.p>
          </div>

          {/* Story Section with Photos */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-slate-900/60 to-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-12 mb-16">

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Photos Gallery */}
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, idx) =>
                <div
                  key={idx}
                  className="relative rounded-2xl overflow-hidden shadow-2xl h-64 group">

                    <img
                    src={photo.url}
                    alt={photo.alt}
                    className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500" />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>

              {/* Story */}
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-2">
                  <Star className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-300 text-sm font-bold">Historia del Creador</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                  Creado por un técnico,<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                    para técnicos
                  </span>
                </h2>

                <div className="space-y-4 text-gray-300 leading-relaxed">
                  <p>
                    Como técnico de reparación con años de experiencia, probé decenas de sistemas de gestión para talleres. 
                    <span className="text-white font-semibold"> Ninguno cumplía con mis expectativas.</span>
                  </p>
                  
                  <p>
                    Los sistemas existentes eran lentos, complicados, o simplemente no estaban diseñados 
                    para el ritmo real de un taller de reparación. Perdía más tiempo navegando menús que reparando dispositivos.
                  </p>

                  <p className="text-cyan-300 font-semibold">
                    Por eso creé SmartFixOS.
                  </p>

                  <p>
                    Un sistema diseñado desde cero para <span className="text-emerald-400 font-bold">lograr facilitar a los talleres 
                    de reparación un flujo de trabajo mas natural y de facil manejo</span>, con flujos de trabajo optimizados, interfaz intuitiva, 
                    y todas las herramientas que realmente necesitas.
                  </p>

                  <div className="bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border-l-4 border-cyan-500 rounded-lg p-4 mt-6">
                    <p className="text-white font-bold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      Compromiso Continuo
                    </p>
                    <p className="text-sm text-gray-300 mt-2">
                      Actualizaciones constantes, nuevas funcionalidades, y mejoras basadas en las 
                      necesidades reales de talleres como el tuyo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-16">
            
            {/* 1. Gestión de Órdenes */}
            <BentoItem className="col-span-1 sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 !border-blue-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center shadow-xl shadow-blue-500/20">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Gestión de Órdenes</h3>
                  <p className="text-sm text-blue-200/70">Simplificado al máximo</p>
                </div>
              </div>
              <p className="text-sm text-gray-300">Crea órdenes de trabajo en segundos. Flujo intuitivo desde el intake hasta la entrega. Todo lo que necesitas, nada de lo que no.</p>
            </BentoItem>

            {/* 2. POS Llevadero */}
            <BentoItem delay={0.1} className="col-span-1 bg-gradient-to-br from-purple-600/10 to-pink-600/10 !border-purple-500/20">
              <Receipt className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="text-lg font-bold mb-1">Punto de Venta</h3>
              <p className="text-sm text-gray-400">Ultra rápido y llevadero. Factura en menos de 10 segundos.</p>
            </BentoItem>

            {/* 3. Ponche de Empleados */}
            <BentoItem delay={0.2} className="col-span-1 bg-gradient-to-br from-emerald-600/10 to-teal-600/10 !border-emerald-500/20">
              <Clock className="w-8 h-8 text-emerald-400 mb-3" />
              <h3 className="text-lg font-bold mb-1">Ponche de Tiempo</h3>
              <p className="text-sm text-gray-400">Control de asistencia y horas trabajadas automático.</p>
            </BentoItem>

            {/* 4. Finanzas */}
            <BentoItem delay={0.3} className="col-span-1 sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-green-600/10 to-emerald-600/10 !border-green-500/20">
              <BarChart3 className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="text-lg font-bold mb-1">Panel Financiero</h3>
              <p className="text-sm text-gray-400">Reportes detallados, ganancias, gastos e impuestos.</p>
            </BentoItem>

            {/* 5. Inventario Detallado */}
            <BentoItem delay={0.4} className="col-span-1 sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-orange-600/10 to-amber-600/10 !border-orange-500/20">
              <div className="flex items-center gap-3 mb-4">
                <Box className="w-10 h-10 text-orange-400" />
                <div>
                  <h3 className="text-2xl font-bold">Inventario Completo</h3>
                  <p className="text-sm text-orange-200/70">Control total de stock</p>
                </div>
              </div>
              <p className="text-sm text-gray-300">Manejo de piezas, productos y servicios. Alertas de bajo inventario, órdenes de compra y reportes detallados.</p>
            </BentoItem>

            {/* 6. Panel Admin */}
            <BentoItem delay={0.5} className="col-span-1 bg-gradient-to-br from-red-600/10 to-pink-600/10 !border-red-500/20">
              <Shield className="w-8 h-8 text-red-400 mb-3" />
              <h3 className="text-lg font-bold mb-1">Panel Admin</h3>
              <p className="text-sm text-gray-400">Control total del negocio con permisos y roles.</p>
            </BentoItem>

            {/* 7. Reviews */}
            <BentoItem delay={0.6} className="col-span-1 bg-gradient-to-br from-yellow-600/10 to-orange-600/10 !border-yellow-500/20">
              <Star className="w-8 h-8 text-yellow-400 mb-3" />
              <h3 className="text-lg font-bold mb-1">Links de Reviews</h3>
              <p className="text-sm text-gray-400">Genera reseñas fácilmente con enlaces directos.</p>
            </BentoItem>

            {/* 8. Fotos de Trabajos */}
            <BentoItem delay={0.7} className="col-span-1 sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 !border-indigo-500/20">
              <Camera className="w-8 h-8 text-indigo-400 mb-3" />
              <h3 className="text-lg font-bold mb-1">Galería de Fotos</h3>
              <p className="text-sm text-gray-400">Almacena fotos de trabajos realizados por orden.</p>
            </BentoItem>

            {/* 9. CRM Clientes */}
            <BentoItem delay={0.8} className="col-span-1 bg-gradient-to-br from-cyan-600/10 to-blue-600/10 !border-cyan-500/20">
              <Users className="w-8 h-8 text-cyan-400 mb-3" />
              <h3 className="text-lg font-bold mb-1">CRM Clientes</h3>
              <p className="text-sm text-gray-400">Historial completo y comunicación directa.</p>
            </BentoItem>

            {/* 10. Calculadora de Precios */}
            <BentoItem delay={0.9} className="col-span-1 bg-gradient-to-br from-lime-600/10 to-green-600/10 !border-lime-500/20">
              <Zap className="w-8 h-8 text-lime-400 mb-3" />
              <h3 className="text-lg font-bold mb-1">Calculadora de Precios</h3>
              <p className="text-sm text-gray-400">Cotizaciones al instante con impuestos.</p>
            </BentoItem>

            {/* 11. Datos en Vivo */}
            <BentoItem delay={1.0} className="col-span-1 bg-black/40 text-center flex flex-col items-center justify-center">
              <Database className="w-10 h-10 text-sky-400 mb-2" />
              <h3 className="font-bold text-base">Sincronización</h3>
              <p className="text-xs text-gray-500">Datos en tiempo real</p>
            </BentoItem>

          </div>

          {/* Pricing Section — 3 planes */}
          <div className="mt-16 mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-3">
              Planes y <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">Precios</span>
            </h2>
            <p className="text-center text-gray-400 text-sm mb-10">Sin contratos. Cancela cuando quieras. 15 días de prueba gratis.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

              {/* ── Basic ── */}
              <div className="relative flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Basic</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">$55</span>
                  <span className="text-gray-500 text-sm mb-1">/mes</span>
                </div>
                <p className="text-xs text-gray-500 mb-5">1 usuario · Para talleres individuales</p>
                <ul className="space-y-2 flex-1">
                  {["Órdenes de reparación ilimitadas","Clientes y historial","Inventario","POS integrado","Panel financiero","Soporte por email"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowSignup(true)}
                  className="mt-6 w-full py-2.5 rounded-xl border border-white/15 text-white text-sm font-semibold hover:bg-white/10 transition-all"
                >
                  Empezar gratis →
                </button>
              </div>

              {/* ── Pro — featured ── */}
              <div className="relative flex flex-col bg-gradient-to-b from-cyan-950/60 to-blue-950/60 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.15)] hover:shadow-[0_0_60px_rgba(6,182,212,0.25)] transition-all">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                    Más popular
                  </span>
                </div>
                <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">Pro</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">$85</span>
                  <span className="text-gray-400 text-sm mb-1">/mes</span>
                </div>
                <p className="text-xs text-gray-400 mb-5">Hasta 3 usuarios · Para equipos pequeños</p>
                <ul className="space-y-2 flex-1">
                  {["Todo lo del plan Basic","Hasta 3 técnicos","Control de tiempo (ponche)","Galería de fotos por orden","Descuentos y códigos promo","Soporte prioritario"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-200">
                      <CheckCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowSignup(true)}
                  className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg"
                >
                  Empezar gratis →
                </button>
              </div>

              {/* ── Enterprise ── */}
              <div className="relative flex flex-col bg-gradient-to-b from-purple-950/40 to-black border border-purple-500/30 rounded-2xl p-6 hover:border-purple-400/50 transition-all">
                <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">Enterprise</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-black text-white">Consultoría</span>
                </div>
                <p className="text-xs text-gray-500 mb-5">Usuarios ilimitados · Cadenas y franquicias</p>
                <ul className="space-y-2 flex-1">
                  {["Todo lo del plan Pro","Usuarios y locales ilimitados","Multi-sede centralizada","Integraciones personalizadas","Onboarding dedicado","SLA garantizado · Soporte 24/7"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:smartfixosapp@gmail.com?subject=Enterprise%20SmartFixOS"
                  className="mt-6 block text-center w-full py-2.5 rounded-xl border border-purple-500/40 text-purple-300 text-sm font-semibold hover:bg-purple-500/10 transition-all"
                >
                  Contactar ventas →
                </a>
              </div>

            </div>
          </div>

          {/* Banner adicional */}
          <div className="bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10 border-2 border-orange-500/30 rounded-2xl p-6 text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Smartphone className="w-6 h-6 text-orange-400" />
              <h3 className="text-xl font-bold text-white">Hecho en Puerto Rico 🇵🇷</h3>
            </div>
            <p className="text-gray-300">
              Por técnicos, para técnicos. Diseñado y probado en talleres reales.
            </p>
          </div>

          <div className="mt-12 text-center space-y-3">
            <p className="text-sm text-gray-400">
              ¿Necesitas ayuda? Escríbenos a{" "}
              <a href="mailto:smartfixosapp@gmail.com" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                smartfixosapp@gmail.com
              </a>
            </p>
            <div className="flex justify-center gap-6 text-xs text-gray-600">
              <span>SmartFixOS © 2026</span>
              <span>•</span>
              <span>v3.5.0 (Build 2026)</span>
              <span>•</span>
              <span>San Juan, PR</span>
            </div>
          </div>

        </div>

        {/* Signup Modal */}
        {showSignup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="relative w-full max-w-md">
              <div className="bg-gradient-to-br from-slate-900 to-black border-2 border-cyan-500/30 p-8 rounded-3xl">

                {signupStep === "success" ? (
                  /* Pantalla de éxito */
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(16,185,129,0.4)]">
                      <CheckCircle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">¡Registro exitoso!</h2>
                    <p className="text-gray-400 text-sm mb-6">
                      Tu negocio <span className="text-white font-semibold">{signupResult?.tenantName}</span> fue creado
                    </p>

                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-5 mb-6 text-left space-y-3">
                      <div className="flex items-start gap-3">
                        <Mail className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-white font-semibold text-sm">Revisa tu email</p>
                          <p className="text-gray-400 text-xs">Enviamos un link de activación a <span className="text-cyan-300">{formData.email}</span></p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <KeyRound className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-white font-semibold text-sm">Activa tu cuenta y elige tu PIN</p>
                          <p className="text-gray-400 text-xs">El link te llevará a configurar tu taller y crear tu PIN de acceso</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-white font-semibold text-sm">15 días gratis</p>
                          <p className="text-gray-400 text-xs">Trial activo hasta el {signupResult?.trialEndDate ? new Date(signupResult.trialEndDate).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : '...'}</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        setShowSignup(false);
                        setSignupStep("form");
                        setFormData({ full_name: "", email: "", password: "", plan: "basic" });
                        setSignupResult(null);
                        setStep("store");
                      }}
                      className="w-full h-12 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 font-bold"
                    >
                      Entendido, revisar email →
                    </Button>
                  </div>
                ) : (
                  /* Formulario de registro */
                  <>
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(6,182,212,0.5)]">
                        <UserPlus className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-2xl font-black text-white mb-1">Crea tu cuenta gratis</h2>
                      <p className="text-gray-400 text-sm">15 días de prueba · Sin tarjeta de crédito</p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">

                      {/* Nombre + Apellido */}
                      <div>
                        <label className="text-white mb-2 flex items-center gap-2 text-sm font-semibold">
                          <UserPlus className="w-4 h-4 text-cyan-400" /> Nombre y Apellido *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                            placeholder="Nombre"
                            className="w-full bg-black/40 border border-cyan-500/30 text-white h-12 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            required />
                          <input value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                            placeholder="Apellido"
                            className="w-full bg-black/40 border border-cyan-500/30 text-white h-12 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <label className="text-white mb-2 flex items-center gap-2 text-sm font-semibold">
                          <Mail className="w-4 h-4 text-cyan-400" /> Email *
                        </label>
                        <input type="email" value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="tu@email.com"
                          className="w-full bg-black/40 border border-cyan-500/30 text-white h-12 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                          required />
                      </div>

                      {/* Contraseña */}
                      <div>
                        <label className="text-white mb-2 flex items-center gap-2 text-sm font-semibold">
                          <KeyRound className="w-4 h-4 text-cyan-400" /> Contraseña *
                        </label>
                        <div className="relative">
                          <input type={showSignupPassword ? "text" : "password"} value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full bg-black/40 border border-cyan-500/30 text-white h-12 rounded-xl px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            required />
                          <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                            {showSignupPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Plan selector */}
                      <div>
                        <label className="text-white mb-3 flex items-center gap-2 text-sm font-semibold">
                          <Zap className="w-4 h-4 text-cyan-400" /> Selecciona tu plan
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "basic",      label: "Basic",      price: "$55",         sub: "1 usuario",     color: "cyan"    },
                            { id: "pro",        label: "Pro",         price: "$85",         sub: "3 usuarios",    color: "emerald", popular: true },
                            { id: "enterprise", label: "Enterprise",  price: "Consultoría", sub: "Ilimitado",     color: "purple"  },
                          ].map(p => (
                            <button key={p.id} type="button"
                              onClick={() => setFormData({ ...formData, plan: p.id })}
                              className={`relative rounded-xl border-2 p-3 text-center transition-all ${
                                formData.plan === p.id
                                  ? p.color === "cyan"    ? "border-cyan-500 bg-cyan-500/15"
                                  : p.color === "emerald" ? "border-emerald-500 bg-emerald-500/15"
                                  :                        "border-purple-500 bg-purple-500/15"
                                  : "border-white/10 bg-white/5 hover:border-white/20"
                              }`}>
                              {p.popular && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">POPULAR</span>}
                              <div className={`text-xs font-bold mb-0.5 ${formData.plan === p.id ? (p.color === "cyan" ? "text-cyan-400" : p.color === "emerald" ? "text-emerald-400" : "text-purple-400") : "text-white/70"}`}>{p.label}</div>
                              <div className="text-white font-black text-sm leading-none">{p.price}</div>
                              <div className="text-white/40 text-[10px] mt-0.5">{p.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                        <p className="text-sm text-emerald-300 flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Recibirás un link por email para activar tu cuenta y elegir tu PIN de acceso.</span>
                        </p>
                      </div>

                      <div className="flex gap-3 pt-1">
                        <Button type="button" variant="outline"
                          className="flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-100 h-12"
                          onClick={() => setShowSignup(false)} disabled={submitting}>
                          Cancelar
                        </Button>
                        <Button type="submit"
                          className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 font-bold h-12"
                          disabled={submitting}>
                          {submitting ? "Creando cuenta..." : formData.plan === "enterprise" ? "Contactar ventas →" : "Crear cuenta gratis"}
                        </Button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>);

  }



  return (
    <>
      <div className="pinaccess-fullscreen-container">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/5 rounded-full blur-[150px] animate-pulse delay-500"></div>
        </div>

        <div
          className="absolute left-4 sm:left-6 z-10"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <button
            onClick={() => {
              if (step === "pin") {
                setStep("user");
              } else if (step === "user") {
                setStep("store");
              } else if (step === "store") {
                setStep("welcome");
              } else {
                setStep("welcome");
              }
              setPin("");
              setError("");
            }}
            className="
              flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-3
              bg-slate-800/60 hover:bg-slate-800/80
              backdrop-blur-xl
              border-2 border-white/10 hover:border-cyan-500/40
              rounded-xl
              text-white text-sm sm:text-base font-semibold
              transition-all duration-200
              active:scale-95
            ">










            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Volver
          </button>
        </div>

        <div className="relative w-full h-full p-4 sm:p-6 pt-24 sm:pt-6 overflow-y-auto">
          <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-5">

            <div className="text-center mb-6 sm:mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-emerald-500/30 blur-2xl animate-pulse"></div>
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                  alt="SmartFixOS"
                  className="relative h-16 sm:h-20 w-auto object-contain mx-auto drop-shadow-[0_4px_16px_rgba(0,168,232,0.8)]" />

              </div>
            </div>

            <div className="text-center mb-8 animate-fade-in-up">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-emerald-500 to-lime-500 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.6)] animate-pulse-fast">
                  <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-lg" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-400 bg-clip-text text-transparent animate-gradient-x">
                  Acceso Seguro
                </h1>
              </div>
            </div>

            {/* ── Biometric Quick Login (si hay perfil guardado) ── */}
            {biometricSupported && biometricProfile?.session && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.07] p-5 backdrop-blur-xl flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">{/iphone|ipad|mac/i.test(navigator.userAgent) ? "🔐" : "👆"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm">Acceso rápido</p>
                  <p className="text-emerald-300/70 text-xs truncate">{biometricProfile.session?.userName || "Usuario guardado"}</p>
                </div>
                <button
                  onClick={handleEarlyBiometricLogin}
                  disabled={biometricLoading}
                  className="h-11 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                >
                  {biometricLoading ? "..." : /iphone|ipad|mac/i.test(navigator.userAgent) ? "Face ID" : "Huella"}
                </button>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/40 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-black text-white">Iniciar Sesión</h2>
              </div>

              {/* ── Botón Google ── */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading || usersLoading}
                className="w-full h-12 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3 mb-4 disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                {loading ? "Conectando..." : "Continuar con Google"}
              </button>

              {/* ── Divisor ── */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/30 font-semibold">o con email</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <p className="text-gray-400 text-sm mb-3">Email y contraseña de la cuenta administradora.</p>
              <div className="space-y-3">
                <input
                  value={storeEmail}
                  onChange={(e) => setStoreEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-black/40 border border-cyan-500/30 text-white h-12 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  type="email"
                  onKeyDown={(e) => {
                    const isSA = storeEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                    if (e.key === "Enter") isSA ? handleSendAdminOtpDirect() : document.getElementById("store-password-input")?.focus();
                  }}
                />
                {storeEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? (
                  /* ── SuperAdmin: sin contraseña, solo OTP ── */
                  <>
                    <div className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-3">
                      <Shield className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                      <p className="text-cyan-300 text-sm">
                        Panel de administración — recibirás un código de 6 dígitos en tu email.
                      </p>
                    </div>
                    <Button
                      onClick={handleSendAdminOtpDirect}
                      disabled={usersLoading}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 font-bold h-12"
                    >
                      {usersLoading ? "Enviando código..." : "📧 Enviar código de acceso"}
                    </Button>
                  </>
                ) : (
                  /* ── Tenant normal: email + contraseña ── */
                  <>
                    <div className="relative">
                      <input
                        id="store-password-input"
                        value={storePassword}
                        onChange={(e) => setStorePassword(e.target.value)}
                        placeholder="Contraseña"
                        type={showPassword ? "text" : "password"}
                        className="w-full bg-black/40 border border-cyan-500/30 text-white h-12 rounded-xl px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        onKeyDown={(e) => e.key === "Enter" && handleStoreContinue()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <Button
                      onClick={handleStoreContinue}
                      disabled={usersLoading}
                      className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 font-bold h-12"
                    >
                      {usersLoading ? "Verificando..." : "Iniciar Sesión →"}
                    </Button>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={sendingReset}
                      className="w-full text-xs text-gray-500 hover:text-cyan-400 transition-colors py-1"
                    >
                      {sendingReset ? "Enviando..." : "¿Olvidaste la contraseña? Enviar enlace de recuperación"}
                    </button>
                  </>
                )}
              </div>

            </motion.div>

            <AnimatePresence>
              {(step === "user" || step === "pin") && (
                <motion.div
                  ref={usersSectionRef}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="bg-black/35 border border-white/15 rounded-3xl p-5 sm:p-6 backdrop-blur-xl"
                >
                  <h2 className="text-xl font-black text-white mb-2">2. Selecciona usuario</h2>
                  <p className="text-gray-300 text-sm mb-4">Elige tu perfil para continuar al pinpad.</p>
                  <motion.div
                    className="grid grid-cols-2 sm:grid-cols-3 gap-4"
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: {},
                      show: {
                        transition: { staggerChildren: 0.05 }
                      }
                    }}
                  >
                    {availableUsers.map((user, idx) => {
                      const active = selectedUser?.id === user.id;
                      return (
                        <motion.button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          variants={{
                            hidden: { opacity: 0, y: 12, scale: 0.97 },
                            show: { opacity: 1, y: 0, scale: 1 }
                          }}
                          transition={{ duration: 0.2, delay: idx * 0.01 }}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className={`rounded-xl border p-4 transition-all min-h-[120px] sm:min-h-[140px] flex items-center justify-center text-center ${active ? "border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.2)]" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-white font-bold text-base sm:text-lg leading-tight">
                              {user.full_name || user.email || "Usuario"}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {step === "pin" && selectedUser && (
                <motion.div
                  ref={pinSectionRef}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28 }}
                  className="bg-black/30 border border-white/15 rounded-3xl p-5 sm:p-6 backdrop-blur-xl"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-xl sm:text-2xl font-black text-white">3. PIN del usuario</h2>
                    <p className="text-cyan-300 text-sm mt-1">{selectedUser.full_name || selectedUser.email}</p>
                  </div>

                  <div className="flex justify-center gap-6 mb-6">
                    {[0, 1, 2, 3].map((index) =>
                      <div
                        key={index}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pin.length > index ? "bg-white border-white shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-110" : "bg-transparent border-white/30"}`}
                      />
                    )}
                  </div>

                  {error && (
                    <div className="text-center mb-5">
                      <p className="text-red-400 text-sm font-medium animate-pulse">{error}</p>
                    </div>
                  )}

                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0.7 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    {numbers.map((row, rowIndex) =>
                      <div key={rowIndex} className="grid grid-cols-3 gap-3">
                        {row.map((num, colIndex) => {
                          const isBackspace = num === "⌫";
                          const isEmpty = num === null;
                          if (isEmpty) return <div key={`empty-${colIndex}`}></div>;
                          if (isBackspace) {
                            return (
                              <button
                                key="backspace"
                                onClick={handleBackspace}
                                disabled={pin.length === 0 || loading}
                                className="h-14 w-full rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 hover:from-red-500/30 hover:to-red-600/20 backdrop-blur-md border border-red-500/30 hover:border-red-500/50 flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-30 shadow-lg shadow-red-500/10"
                              >
                                <Delete className="w-6 h-6 text-red-300" />
                              </button>
                            );
                          }
                          return (
                            <button
                              key={num}
                              onClick={() => handleNumberClick(String(num))}
                              disabled={loading || pin.length >= 4}
                              className="h-14 w-full rounded-2xl bg-gradient-to-br from-white/10 to-white/5 hover:from-cyan-500/20 hover:to-emerald-500/10 backdrop-blur-md border border-white/10 hover:border-cyan-500/40 text-white text-2xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-30 shadow-lg hover:shadow-cyan-500/20"
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>

                  <div className="h-8 text-center mt-4">
                    {loading && <div className="text-cyan-400 font-bold animate-pulse">⚡ Validando...</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.05); }
        }

        @keyframes pulse-fast {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes glitch {
          0%, 90%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          60% { transform: translate(-2px, -2px); }
          80% { transform: translate(2px, 2px); }
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-border {
          0%, 100% { border-color: rgba(255,255,255,0.2); }
          50% { border-color: rgba(255,255,255,0.5); }
        }

        .animate-float { animation: float 5s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-spin-slow-reverse { animation: spin-slow-reverse 15s linear infinite; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        .animate-pulse-fast { animation: pulse-fast 1.5s ease-in-out infinite; }
        .animate-gradient-x { 
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        .animate-shimmer { animation: shimmer 3s ease-in-out infinite; }
        .animate-glitch { animation: glitch 2s ease-in-out infinite; }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
        .animate-pulse-border { animation: pulse-border 2s ease-in-out infinite; }

        .delay-500 { animation-delay: 500ms; }
        .delay-1000 { animation-delay: 1000ms; }

        .pinaccess-fullscreen-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          min-height: 100vh;
          min-height: 100dvh;
          margin: 0;
          padding-top: max(env(safe-area-inset-top), 0px);
          padding-bottom: max(env(safe-area-inset-bottom), 0px);
          box-sizing: border-box;
          overflow: hidden;
          background: radial-gradient(circle at top, #0f172a 0%, #020617 45%, #000 90%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
        }

        body {
          overscroll-behavior: none;
          -webkit-overflow-scrolling: touch;
        }

        #root {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }

        .active\\:scale-98:active,
        .active\\:scale-95:active {
          transform: scale(0.95);
        }

        button {
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        input, select, textarea {
          font-size: 16px !important;
        }

        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>

      <RequestAccessModal
        open={showRequestAccess}
        onClose={() => setShowRequestAccess(false)} />

      <AnimatePresence>
        {showSuccessBurst && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.12, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative"
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-400/30 blur-2xl"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1.4, opacity: 1 }}
                exit={{ scale: 1.7, opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
              <div className="relative w-20 h-20 rounded-full border border-emerald-300/50 bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-10 h-10 text-emerald-300" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>);

}
