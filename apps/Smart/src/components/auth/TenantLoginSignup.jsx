import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Building2, Globe, DollarSign, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function TenantLoginSignup() {
  const [mode, setMode] = useState("login"); // login | signup
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginData, setLoginData] = useState({ email: "", password: "" });

  // Signup state
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
    country: "Puerto Rico",
    currency: "USD"
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast.error("Email y contraseña son obligatorios");
      return;
    }

    setLoading(true);
    try {
      // Buscar tenant por email
      const tenants = await base44.entities.Tenant.filter({ email: loginData.email });
      
      if (!tenants || tenants.length === 0) {
        toast.error("Email no registrado");
        setLoading(false);
        return;
      }

      const tenant = tenants[0];
      
      // Aquí iría validación de password (en producción usar backend)
      if (tenant.status !== "active") {
        toast.error("Tienda no activa");
        setLoading(false);
        return;
      }

      // Guardar sesión de tenant
      localStorage.setItem("tenant_session", JSON.stringify({
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        loginTime: new Date().toISOString()
      }));

      toast.success(`¡Bienvenido, ${tenant.name}!`);
      
      // Redirigir al PIN (mantener flujo actual)
      setTimeout(() => {
        window.location.href = "/PinAccess?step=pin";
      }, 500);

    } catch (error) {
      console.error("Login error:", error);
      toast.error("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (!signupData.name || !signupData.email || !signupData.password) {
      toast.error("Nombre, email y contraseña son obligatorios");
      return;
    }

    setLoading(true);
    try {
      // Verificar si email existe
      const existing = await base44.entities.Tenant.filter({ email: signupData.email });
      if (existing && existing.length > 0) {
        toast.error("Email ya registrado");
        setLoading(false);
        return;
      }

      // Crear tenant
      await base44.entities.Tenant.create({
        name: signupData.name,
        email: signupData.email,
        password_hash: signupData.password, // En producción: usar bcrypt
        country: signupData.country,
        currency: signupData.currency,
        status: "active", // O "pending" si requiere aprobación
        plan: "smartfixos",
        monthly_cost: 65,
        admin_name: signupData.name
      });

      toast.success("¡Tienda registrada! Iniciando sesión...");
      
      // Auto-login después del registro
      localStorage.setItem("tenant_session", JSON.stringify({
        email: signupData.email,
        name: signupData.name,
        loginTime: new Date().toISOString()
      }));

      setTimeout(() => {
        window.location.href = "/PinAccess?step=pin";
      }, 500);

    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Error al registrar tienda");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="apple-type min-h-dvh apple-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="apple-surface-elevated rounded-apple-lg shadow-apple-xl p-8"
        >
          {/* Toggle */}
          <div className="flex gap-2 mb-8 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-1">
            <button
              onClick={() => setMode("login")}
              className={`apple-press flex-1 py-2 rounded-apple-sm apple-text-subheadline font-semibold transition-all ${
                mode === "login"
                  ? "bg-apple-blue text-white"
                  : "apple-label-secondary"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`apple-press flex-1 py-2 rounded-apple-sm apple-text-subheadline font-semibold transition-all ${
                mode === "signup"
                  ? "bg-apple-blue text-white"
                  : "apple-label-secondary"
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="apple-label-primary apple-text-subheadline font-semibold flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-apple-blue" />
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  className="apple-input"
                />
              </div>

              <div>
                <label className="apple-label-primary apple-text-subheadline font-semibold flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-apple-blue" />
                  Contraseña
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="apple-input"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="apple-btn apple-btn-primary w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    Iniciar Sesión
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Signup Form */}
          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="apple-label-primary apple-text-subheadline font-semibold flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-apple-blue" />
                  Nombre del Negocio
                </label>
                <Input
                  placeholder="Mi Taller"
                  value={signupData.name}
                  onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                  className="apple-input"
                />
              </div>

              <div>
                <label className="apple-label-primary apple-text-subheadline font-semibold flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-apple-blue" />
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  className="apple-input"
                />
              </div>

              <div>
                <label className="apple-label-primary apple-text-subheadline font-semibold flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-apple-blue" />
                  Contraseña
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  className="apple-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="apple-label-primary apple-text-subheadline font-semibold flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-apple-blue" />
                    País
                  </label>
                  <select
                    value={signupData.country}
                    onChange={(e) => setSignupData({ ...signupData, country: e.target.value })}
                    className="apple-input w-full h-11 rounded-apple-md px-3"
                  >
                    <option value="Puerto Rico">Puerto Rico</option>
                    <option value="USA">USA</option>
                    <option value="Mexico">Mexico</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Argentina">Argentina</option>
                  </select>
                </div>

                <div>
                  <label className="apple-label-primary apple-text-subheadline font-semibold flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-apple-blue" />
                    Moneda
                  </label>
                  <select
                    value={signupData.currency}
                    onChange={(e) => setSignupData({ ...signupData, currency: e.target.value })}
                    className="apple-input w-full h-11 rounded-apple-md px-3"
                  >
                    <option value="USD">USD</option>
                    <option value="MXN">MXN</option>
                    <option value="COP">COP</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
              </div>

              <div className="bg-apple-blue/12 rounded-apple-md p-3">
                <p className="apple-text-subheadline text-apple-blue flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="tabular-nums">$65 USD/mes • Acceso completo • Sin contratos</span>
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="apple-btn apple-btn-primary w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    Crear Mi Tienda
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
