import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2, Phone, Clock, Lock,
  ChevronRight, ChevronLeft, Check, Upload,
  DollarSign, Wrench, Users, Package, BarChart3,
  AlertTriangle, Timer, Star, Bell, Loader2, CheckCircle2, XCircle
} from "lucide-react";
// ── All DB/Storage operations go through Vercel serverless endpoints (server-side service role key) ──

// ── Dashboard widgets config ──────────────────────────────────────────────────
const DASHBOARD_WIDGETS = [
  { key: 'revenue_today',     label: 'Ingresos del día',          icon: DollarSign,  desc: 'Ventas y pagos de hoy' },
  { key: 'active_orders',     label: 'Órdenes activas',           icon: Wrench,      desc: 'Reparaciones en progreso' },
  { key: 'total_customers',   label: 'Clientes totales',          icon: Users,       desc: 'Base de clientes' },
  { key: 'inventory_value',   label: 'Valor del inventario',      icon: Package,     desc: 'Stock en dinero' },
  { key: 'avg_repair_time',   label: 'Tiempo promedio reparación',icon: Timer,       desc: 'Eficiencia del taller' },
  { key: 'top_technicians',   label: 'Técnicos top',              icon: Star,        desc: 'Rendimiento del equipo' },
  { key: 'revenue_chart',     label: 'Gráfica de ingresos',       icon: BarChart3,   desc: 'Evolución por período' },
  { key: 'overdue_orders',    label: 'Órdenes vencidas / urgentes',icon: Bell,       desc: 'Alertas que necesitan atención' },
];

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DEFAULT_HOURS = { open: '09:00', close: '18:00', closed: false };

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

// ── Main component ────────────────────────────────────────────────────────────
export default function TenantActivate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');

  // Dev/test shortcut — visible when ?skip=1 or running in dev mode
  const skipMode = searchParams.get('skip') === '1' || import.meta.env.DEV;

  const [status, setStatus] = useState('validating'); // validating | valid | invalid | saving | done
  const [employeeId, setEmployeeId] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [tenantEmail, setTenantEmail] = useState(emailParam || '');

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const TOTAL_STEPS = 4;

  // Step 1 — Identidad
  const [businessName, setBusinessName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0891b2');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  // Step 2 — Contacto
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [website, setWebsite] = useState('');

  // Step 3 — Políticas
  const [warrantyDays, setWarrantyDays] = useState(90);
  const [retentionDays, setRetentionDays] = useState(30);
  const [receiptNote, setReceiptNote] = useState('');
  const [schedule, setSchedule] = useState(() =>
    Object.fromEntries(DAYS.map(d => [d, { ...DEFAULT_HOURS }]))
  );

  // Widgets — all enabled by default (no longer a wizard step)
  const widgets = Object.fromEntries(DASHBOARD_WIDGETS.map(w => [w.key, true]));

  // Step 4 — PIN
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState('set'); // set | confirm
  const [pinError, setPinError] = useState('');

  const numbers = [[1,2,3],[4,5,6],[7,8,9],[null,0,'⌫']];

  // ── Dev shortcut: fill all steps with dummy data and jump to PIN ────────────
  const fillTestData = () => {
    setBusinessName(prev => prev || 'Taller Test Dev');
    setSlogan('Reparamos todo rápido');
    setPrimaryColor('#0891b2');
    setPhone('787-555-0001');
    setWhatsapp('787-555-0001');
    setAddress('Calle Test #1');
    setCity('San Juan');
    setState('PR');
    setZip('00901');
    setWebsite('https://testaller.com');
    setWarrantyDays(90);
    setRetentionDays(30);
    setReceiptNote('No nos hacemos responsables por equipos dejados más de 30 días.');
    setDir(1);
    setStep(3);
    setPinStep('set');
    setPin('');
    setConfirmPin('');
    setPinError('');
    toast.success('⚡ Datos de prueba cargados — ahora elige tu PIN');
  };

  // ── Validate token on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const res = await fetch(`/api/validate-token?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (data.alreadyActive) { setStatus('done'); return; }
      if (!data.valid) { setStatus('invalid'); return; }

      setEmployeeId(data.employeeId);
      setTenantId(data.tenantId);
      setTenantEmail(data.email || emailParam || '');
      setBusinessName(data.tenantName || '');
      setPhone(data.adminPhone || '');
      setStatus('valid');
    } catch (e) {
      console.error('Token validation error:', e);
      setStatus('invalid');
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goNext = () => {
    if (step === 3 && pinStep === 'set') {
      if (pin.length !== 4) { setPinError('El PIN debe tener 4 dígitos'); return; }
      setPinStep('confirm');
      setConfirmPin('');
      return;
    }
    setDir(1);
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    if (step === 3 && pinStep === 'confirm') {
      setPinStep('set');
      setConfirmPin('');
      return;
    }
    setDir(-1);
    setStep(s => Math.max(s - 1, 0));
  };

  // ── PIN pad handlers ────────────────────────────────────────────────────────
  const currentPin = pinStep === 'set' ? pin : confirmPin;
  const setCurrentPin = pinStep === 'set' ? setPin : setConfirmPin;

  const handlePinNumber = (n) => {
    if (currentPin.length >= 4) return;
    setPinError('');
    const next = currentPin + String(n);
    setCurrentPin(next);
    if (next.length === 4 && pinStep === 'confirm') {
      // auto-validate on 4th digit
      setTimeout(() => validateConfirmPin(next), 100);
    }
  };

  const handlePinBackspace = () => {
    setCurrentPin(p => p.slice(0, -1));
    setPinError('');
  };

  useEffect(() => {
    if (step !== 3 || status === 'saving') return;

    const handleKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        handlePinNumber(event.key);
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        handlePinBackspace();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (pinStep === 'set') {
          if (pin.length === 4) goNext();
        } else if (confirmPin.length === 4) {
          handleActivate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, status, pinStep, pin, confirmPin]);

  const validateConfirmPin = (value = confirmPin) => {
    if (value !== pin) {
      setPinError('Los PINs no coinciden. Intenta de nuevo.');
      setConfirmPin('');
      return false;
    }
    return true;
  };

  // ── Logo upload — via /api/upload-logo (server-side base64, bypasses Storage RLS) ──
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('El logo debe ser menor a 2MB'); return; }
    setLogoUploading(true);
    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const ext = file.name.split('.').pop() || 'png';
      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, tenantId: tenantId || 'unknown', ext, mimeType: file.type }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setLogoUrl(data.url);
      toast.success('Logo subido correctamente');
    } catch (e) {
      toast.error('Error al subir el logo: ' + e.message);
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Final submit ────────────────────────────────────────────────────────────
  const handleActivate = async () => {
    if (!validateConfirmPin()) return;

    setStatus('saving');
    try {
      const res = await fetch('/api/activate-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          employeeId,
          tenantId,
          email: tenantEmail,
          // Step 1
          businessName, slogan, logoUrl, primaryColor,
          // Step 2
          phone, whatsapp, address, city, state, zip, website,
          // Step 3
          warrantyDays, retentionDays, receiptNote, schedule,
          // Step 4
          widgets,
          // Step 5
          pin,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al activar');

      console.log('✅ Activación completada');
      setStatus('done');
    } catch (e) {
      console.error('Activation error:', e);
      toast.error('Error al activar: ' + e.message);
      setStatus('valid');
    }
  };

  // ── Schedule helpers ────────────────────────────────────────────────────────
  const updateSchedule = (day, field, value) => {
    setSchedule(s => ({ ...s, [day]: { ...s[day], [field]: value } }));
  };

  // ── Render states ─────────────────────────────────────────────────────────
  if (status === 'validating') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Validando tu enlace de activación…</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-10">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">Enlace inválido o expirado</h2>
            <p className="text-gray-400 mb-6">Este enlace de activación ya fue usado o expiró (válido 24 horas).</p>
            <p className="text-gray-500 text-sm mb-6">¿Necesitas ayuda?</p>
            <a href="mailto:smartfixosapp@gmail.com"
              className="inline-block bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
              Contactar soporte
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-br from-[#0c1a2e] to-[#0a1520] border border-green-500/30 rounded-2xl p-10"
          >
            <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-4" />
            <h2 className="text-3xl font-extrabold text-white mb-3">¡Cuenta activada!</h2>
            <p className="text-gray-300 mb-8">Tu taller está listo. Ingresa con tu email y el PIN que acabas de crear.</p>
            <button
              onClick={() => navigate('/PinAccess', { state: { activated: true } })}
              className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold py-4 rounded-2xl text-lg transition-all"
            >
              Ingresar al sistema →
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (status === 'saving') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold text-lg mb-1">Activando tu cuenta…</p>
          <p className="text-gray-400 text-sm">Guardando tu configuración</p>
        </div>
      </div>
    );
  }

  // ── Wizard UI ─────────────────────────────────────────────────────────────
  const stepTitles = ['Identidad', 'Contacto', 'Políticas', 'Tu PIN'];
  const stepIcons  = [Building2, Phone, Clock, Lock];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-start py-8 px-4">
      {/* Header */}
      <div className="w-full max-w-2xl mb-6">
        <div className="text-center mb-6">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
            alt="SmartFixOS" className="h-10 mx-auto mb-4"
          />
          <h1 className="text-2xl font-extrabold text-white">Configura tu taller</h1>
          <p className="text-gray-400 text-sm mt-1">Paso {step + 1} de {TOTAL_STEPS}</p>
          {skipMode && (
            <button
              onClick={fillTestData}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold hover:bg-yellow-500/20 transition-colors"
              title="Solo visible en modo desarrollo o ?skip=1"
            >
              ⚡ Saltar al PIN (modo prueba)
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-2">
          {stepTitles.map((title, i) => {
            const Icon = stepIcons[i];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-cyan-500' : 'bg-white/10'
                }`} />
                <span className={`text-xs hidden sm:block transition-colors ${
                  i === step ? 'text-cyan-400 font-semibold' : i < step ? 'text-gray-500' : 'text-gray-600'
                }`}>{title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step card */}
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step + '-' + pinStep}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="bg-gradient-to-br from-[#0c1a2e] to-[#0a1520] border border-[#1e3a5f] rounded-2xl p-6 sm:p-8"
          >
            {/* ── Step 0: Identidad ── */}
            {step === 0 && (
              <div className="space-y-5">
                <StepHeader icon={Building2} title="Identidad del negocio" subtitle="¿Cómo se llama tu taller?" />
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nombre del negocio *</label>
                  <input
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Ej: Reparaciones ProTech"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Slogan (opcional)</label>
                  <input
                    value={slogan}
                    onChange={e => setSlogan(e.target.value)}
                    placeholder="Ej: Reparamos lo que otros no pueden"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Color principal</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                        className="w-12 h-12 rounded-lg border-0 cursor-pointer bg-transparent" />
                      <span className="text-gray-400 text-sm font-mono">{primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Logo</label>
                    <label className="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-xl px-3 py-3 transition-colors">
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      {logoUploading ? (
                        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                      ) : logoUrl ? (
                        <img src={logoUrl} alt="logo" className="w-8 h-8 object-contain rounded" />
                      ) : (
                        <Upload className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-xs text-gray-400">{logoUrl ? 'Cambiar' : 'Subir logo'}</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1: Contacto ── */}
            {step === 1 && (
              <div className="space-y-5">
                <StepHeader icon={Phone} title="Información de contacto" subtitle="¿Cómo te contactan tus clientes?" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Teléfono principal" value={phone} onChange={setPhone} placeholder="787-000-0000" />
                  <Field label="WhatsApp (opcional)" value={whatsapp} onChange={setWhatsapp} placeholder="787-000-0000" />
                </div>
                <Field label="Dirección" value={address} onChange={setAddress} placeholder="Calle Principal #123" />
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Ciudad" value={city} onChange={setCity} placeholder="San Juan" />
                  <Field label="Estado/PR" value={state} onChange={setState} placeholder="PR" />
                  <Field label="Zip" value={zip} onChange={setZip} placeholder="00901" />
                </div>
                <Field label="Sitio web (opcional)" value={website} onChange={setWebsite} placeholder="https://mitaller.com" />
              </div>
            )}

            {/* ── Step 2: Políticas y horario ── */}
            {step === 2 && (
              <div className="space-y-5">
                <StepHeader icon={Clock} title="Políticas y horario" subtitle="Define las reglas de tu taller" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Días de garantía</label>
                    <select value={warrantyDays} onChange={e => setWarrantyDays(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500">
                      {[30,60,90,180,365].map(d => <option key={d} value={d}>{d} días</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Días máx. retención</label>
                    <select value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500">
                      {[15,30,45,60,90].map(d => <option key={d} value={d}>{d} días</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nota en recibo / Términos</label>
                  <textarea value={receiptNote} onChange={e => setReceiptNote(e.target.value)}
                    placeholder="Ej: No nos hacemos responsables de equipos dejados por más de 30 días."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none" />
                </div>
                {/* Schedule grid */}
                <div>
                  <label className="block text-sm text-gray-400 mb-3">Horario de atención</label>
                  <div className="space-y-2">
                    {DAYS.map(day => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="w-8 text-xs text-gray-400 font-medium">{day}</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox"
                            checked={!schedule[day].closed}
                            onChange={e => updateSchedule(day, 'closed', !e.target.checked)}
                            className="w-4 h-4 rounded accent-cyan-500" />
                          <span className="text-xs text-gray-400">Abierto</span>
                        </label>
                        {!schedule[day].closed && (
                          <div className="flex items-center gap-2 ml-2">
                            <input type="time" value={schedule[day].open}
                              onChange={e => updateSchedule(day, 'open', e.target.value)}
                              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500" />
                            <span className="text-gray-500 text-xs">–</span>
                            <input type="time" value={schedule[day].close}
                              onChange={e => updateSchedule(day, 'close', e.target.value)}
                              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500" />
                          </div>
                        )}
                        {schedule[day].closed && <span className="text-xs text-gray-600 ml-2">Cerrado</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: PIN ── */}
            {step === 3 && (
              <div className="space-y-5">
                <StepHeader
                  icon={Lock}
                  title={pinStep === 'set' ? 'Elige tu PIN de acceso' : 'Confirma tu PIN'}
                  subtitle={pinStep === 'set'
                    ? 'Este PIN lo usarás cada vez que abras la app'
                    : 'Ingresa el mismo PIN para confirmar'}
                />

                {/* PIN dots display */}
                <div className="flex justify-center gap-4 my-4">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all ${
                      currentPin.length > i
                        ? 'bg-cyan-400 border-cyan-400 scale-110'
                        : 'border-gray-600'
                    }`} />
                  ))}
                </div>

                {pinError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{pinError}</p>
                  </div>
                )}

                {/* Number pad */}
                <div className="max-w-xs mx-auto space-y-3">
                  {numbers.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-3 gap-3">
                      {row.map((num, ci) => {
                        if (num === null) return <div key={`e${ci}`} />;
                        if (num === '⌫') return (
                          <button key="bs"
                            onClick={handlePinBackspace}
                            disabled={currentPin.length === 0}
                            className="h-16 rounded-2xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                          >
                            <span className="text-red-300 text-xl">⌫</span>
                          </button>
                        );
                        return (
                          <button key={num}
                            onClick={() => handlePinNumber(num)}
                            disabled={currentPin.length >= 4}
                            className="h-16 rounded-2xl bg-white/10 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/40 text-white text-2xl font-semibold transition-all active:scale-95 disabled:opacity-30"
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {pinStep === 'confirm' && confirmPin.length === 4 && (
                  <button
                    onClick={handleActivate}
                    className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold py-4 rounded-2xl text-lg transition-all mt-2"
                  >
                    ¡Activar mi cuenta! 🚀
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-5">
          {step > 0 && (
            <button onClick={goBack}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium transition-all">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          )}
          {step < TOTAL_STEPS - 1 && (
            <button onClick={goNext}
              disabled={step === 0 && !businessName.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {step === 3 && pinStep === 'set' && pin.length === 4 && (
            <button onClick={goNext}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold transition-all">
              Confirmar PIN <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StepHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mt-0.5">
        <Icon className="w-5 h-5 text-cyan-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLength, inputMode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
      />
    </div>
  );
}
