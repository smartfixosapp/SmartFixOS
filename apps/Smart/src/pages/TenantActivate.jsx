import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { apiUrl } from "@/lib/apiUrl";
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
    toast.success('Datos de prueba cargados — ahora elige tu PIN');
  };

  // ── Validate token on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const res = await fetch(apiUrl(`/api/validate-token?token=${encodeURIComponent(token)}`));
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
      const res = await fetch(apiUrl('/api/upload-logo'), {
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
      const res = await fetch(apiUrl('/api/activate-complete'), {
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

      console.log('Activación completada');
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
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-apple-blue animate-spin mx-auto mb-4" />
          <p className="apple-text-body apple-label-secondary">Validando tu enlace de activación…</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="apple-card rounded-apple-xl p-10 shadow-apple-lg">
            <div className="w-20 h-20 rounded-apple-sm bg-apple-red/15 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-12 h-12 text-apple-red" />
            </div>
            <h2 className="apple-text-title2 apple-label-primary mb-3">Enlace inválido o expirado</h2>
            <p className="apple-text-body apple-label-secondary mb-6">Este enlace de activación ya fue usado o expiró (válido 24 horas).</p>
            <p className="apple-text-footnote apple-label-tertiary mb-6">¿Necesitas ayuda?</p>
            <a href="mailto:smartfixosapp@gmail.com"
              className="apple-btn apple-btn-primary apple-btn-lg inline-block">
              Contactar soporte
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="apple-card rounded-apple-xl p-10 shadow-apple-lg"
          >
            <div className="w-24 h-24 rounded-apple-sm bg-apple-green/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-14 h-14 text-apple-green" />
            </div>
            <h2 className="apple-text-title1 apple-label-primary mb-3">¡Cuenta activada!</h2>
            <p className="apple-text-body apple-label-secondary mb-8">Tu taller está listo. Ingresa con tu email y el PIN que acabas de crear.</p>
            <button
              onClick={() => navigate('/PinAccess', { state: { activated: true } })}
              className="apple-btn apple-btn-primary apple-btn-lg w-full"
            >
              Ingresar al sistema
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (status === 'saving') {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-apple-blue animate-spin mx-auto mb-4" />
          <p className="apple-text-headline apple-label-primary mb-1">Activando tu cuenta…</p>
          <p className="apple-text-footnote apple-label-secondary">Guardando tu configuración</p>
        </div>
      </div>
    );
  }

  // ── Wizard UI ─────────────────────────────────────────────────────────────
  const stepTitles = ['Identidad', 'Contacto', 'Políticas', 'Tu PIN'];
  const stepIcons  = [Building2, Phone, Clock, Lock];

  return (
    <div className="min-h-dvh apple-surface apple-type flex flex-col items-center justify-start py-8 px-4">
      {/* Header */}
      <div className="w-full max-w-2xl mx-auto mb-6">
        <div className="text-center mb-6">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
            alt="SmartFixOS" className="h-10 mx-auto mb-4"
          />
          <h1 className="apple-text-title1 apple-label-primary">Configura tu taller</h1>
          <p className="apple-text-footnote apple-label-secondary mt-1 tabular-nums">Paso {step + 1} de {TOTAL_STEPS}</p>
          {skipMode && (
            <button
              onClick={fillTestData}
              className="apple-btn apple-btn-tinted mt-3 text-apple-yellow bg-apple-yellow/12"
              title="Solo visible en modo desarrollo o ?skip=1"
            >
              Saltar al PIN (modo prueba)
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-2">
          {stepTitles.map((title, i) => {
            const Icon = stepIcons[i];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-apple-xs transition-all duration-300 ${
                  i <= step ? 'bg-apple-blue' : 'bg-gray-sys6 dark:bg-gray-sys5'
                }`} />
                <span className={`apple-text-caption2 hidden sm:block transition-colors ${
                  i === step ? 'text-apple-blue font-semibold' : i < step ? 'apple-label-tertiary' : 'apple-label-tertiary'
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
            className="apple-card rounded-apple-xl p-6 sm:p-8 shadow-apple-md"
          >
            {/* ── Step 0: Identidad ── */}
            {step === 0 && (
              <div className="space-y-5">
                <StepHeader icon={Building2} title="Identidad del negocio" subtitle="¿Cómo se llama tu taller?" />
                <div>
                  <label className="apple-text-footnote apple-label-secondary block mb-1">Nombre del negocio *</label>
                  <input
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Ej: Reparaciones ProTech"
                    className="apple-input w-full"
                  />
                </div>
                <div>
                  <label className="apple-text-footnote apple-label-secondary block mb-1">Slogan (opcional)</label>
                  <input
                    value={slogan}
                    onChange={e => setSlogan(e.target.value)}
                    placeholder="Ej: Reparamos lo que otros no pueden"
                    className="apple-input w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="apple-text-footnote apple-label-secondary block mb-1">Color principal</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                        className="w-12 h-12 rounded-apple-sm border-0 cursor-pointer bg-transparent" />
                      <span className="apple-text-footnote apple-label-secondary font-mono tabular-nums">{primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="apple-text-footnote apple-label-secondary block mb-1">Logo</label>
                    <label className="flex items-center gap-2 cursor-pointer apple-surface-secondary rounded-apple-md px-3 py-3 apple-press" style={{ border: '0.5px dashed rgb(var(--separator) / 0.29)' }}>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      {logoUploading ? (
                        <Loader2 className="w-4 h-4 text-apple-blue animate-spin" />
                      ) : logoUrl ? (
                        <img src={logoUrl} alt="logo" className="w-8 h-8 object-contain rounded-apple-xs" />
                      ) : (
                        <Upload className="w-4 h-4 apple-label-tertiary" />
                      )}
                      <span className="apple-text-caption1 apple-label-secondary">{logoUrl ? 'Cambiar' : 'Subir logo'}</span>
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
                  <Field label="Teléfono principal" value={phone} onChange={setPhone} placeholder="787-000-0000" maxLength={15} inputMode="tel" type="tel" tabularNums />
                  <Field label="WhatsApp (opcional)" value={whatsapp} onChange={setWhatsapp} placeholder="787-000-0000" maxLength={15} inputMode="tel" type="tel" tabularNums />
                </div>
                <Field label="Dirección" value={address} onChange={setAddress} placeholder="Calle Principal #123" />
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Ciudad" value={city} onChange={setCity} placeholder="San Juan" />
                  <Field label="Estado/PR" value={state} onChange={setState} placeholder="PR" />
                  <Field label="Zip" value={zip} onChange={setZip} placeholder="00901" tabularNums />
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
                    <label className="apple-text-footnote apple-label-secondary block mb-1">Días de garantía</label>
                    <select value={warrantyDays} onChange={e => setWarrantyDays(Number(e.target.value))}
                      className="apple-input w-full">
                      {[30,60,90,180,365].map(d => <option key={d} value={d}>{d} días</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="apple-text-footnote apple-label-secondary block mb-1">Días máx. retención</label>
                    <select value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                      className="apple-input w-full">
                      {[15,30,45,60,90].map(d => <option key={d} value={d}>{d} días</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="apple-text-footnote apple-label-secondary block mb-1">Nota en recibo / Términos</label>
                  <textarea value={receiptNote} onChange={e => setReceiptNote(e.target.value)}
                    placeholder="Ej: No nos hacemos responsables de equipos dejados por más de 30 días."
                    rows={2}
                    className="apple-input w-full resize-none" />
                </div>
                {/* Schedule grid — responsive */}
                <div>
                  <label className="apple-text-footnote apple-label-secondary block mb-3">Horario de atención</label>
                  <div className="space-y-2 overflow-x-auto">
                    {DAYS.map(day => (
                      <div key={day} className="flex flex-wrap items-center gap-2 min-w-0 py-1" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="w-8 apple-text-caption1 apple-label-secondary font-medium">{day}</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox"
                              checked={!schedule[day].closed}
                              onChange={e => updateSchedule(day, 'closed', !e.target.checked)}
                              className="w-4 h-4 rounded-apple-xs accent-apple-blue" />
                            <span className="apple-text-caption2 apple-label-secondary">Abierto</span>
                          </label>
                        </div>
                        {!schedule[day].closed && (
                          <div className="flex items-center gap-1.5">
                            <input type="time" value={schedule[day].open}
                              onChange={e => updateSchedule(day, 'open', e.target.value)}
                              className="apple-input tabular-nums w-[90px]" style={{ padding: '4px 8px', fontSize: '11px' }} />
                            <span className="apple-label-tertiary apple-text-caption1">-</span>
                            <input type="time" value={schedule[day].close}
                              onChange={e => updateSchedule(day, 'close', e.target.value)}
                              className="apple-input tabular-nums w-[90px]" style={{ padding: '4px 8px', fontSize: '11px' }} />
                          </div>
                        )}
                        {schedule[day].closed && <span className="apple-text-caption2 apple-label-tertiary">Cerrado</span>}
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
                        ? 'bg-apple-blue border-apple-blue scale-110'
                        : 'border-gray-sys4 dark:border-gray-sys3'
                    }`} />
                  ))}
                </div>

                {pinError && (
                  <div className="flex items-center gap-2 bg-apple-red/12 rounded-apple-md px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-apple-red flex-shrink-0" />
                    <p className="apple-text-footnote text-apple-red">{pinError}</p>
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
                            className="h-16 rounded-apple-lg bg-apple-red/12 apple-press flex items-center justify-center transition-all disabled:opacity-30"
                          >
                            <span className="text-apple-red apple-text-title3">⌫</span>
                          </button>
                        );
                        return (
                          <button key={num}
                            onClick={() => handlePinNumber(num)}
                            disabled={currentPin.length >= 4}
                            className="h-16 rounded-apple-lg apple-surface-secondary apple-press apple-label-primary apple-text-title2 font-semibold tabular-nums transition-all disabled:opacity-30"
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
                    className="apple-btn apple-btn-primary apple-btn-lg w-full mt-2"
                  >
                    ¡Activar mi cuenta!
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
              className="apple-btn apple-btn-secondary apple-btn-lg flex-1 flex items-center justify-center gap-2">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          )}
          {step < TOTAL_STEPS - 1 && (
            <button onClick={goNext}
              disabled={step === 0 && !businessName.trim()}
              className="apple-btn apple-btn-primary apple-btn-lg flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {step === 3 && pinStep === 'set' && pin.length === 4 && (
            <button onClick={goNext}
              className="apple-btn apple-btn-primary apple-btn-lg flex-1 flex items-center justify-center gap-2">
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
      <div className="p-2.5 rounded-apple-sm bg-apple-blue/15 mt-0.5">
        <Icon className="w-5 h-5 text-apple-blue" />
      </div>
      <div>
        <h2 className="apple-text-title3 apple-label-primary">{title}</h2>
        {subtitle && <p className="apple-text-footnote apple-label-secondary mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLength, inputMode, tabularNums }) {
  return (
    <div>
      <label className="apple-text-footnote apple-label-secondary block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        className={`apple-input w-full ${tabularNums ? 'tabular-nums' : ''}`}
      />
    </div>
  );
}
