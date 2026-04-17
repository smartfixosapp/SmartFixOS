import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Lock, Grid3x3, Trash2, Check, Hash,
  Eye, EyeOff, ShieldAlert, Fingerprint,
  Smartphone, Apple, Chrome, ChevronDown, ChevronUp
} from "lucide-react";
import PatternDisplay from "@/components/security/PatternDisplay";
import { cn } from "@/lib/utils";

function PatternDrawer({ open, onClose, onSave }) {
  const canvasRef = useRef(null);
  const [pattern, setPattern] = useState([]);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      initCanvas();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const initCanvas = () => {
    setPattern([]);
    setDrawing(false);
    renderPattern([]);
  };

  useEffect(() => {
    if (open) {
      renderPattern(pattern);
    }
  }, [pattern, open]);

  const renderPattern = (currentPattern) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const cellSize = rect.width / 3;

    // Dibujar grid 3x3
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = cellSize * j + cellSize / 2;
        const y = cellSize * i + cellSize / 2;
        const idx = i * 3 + j;

        ctx.beginPath();
        ctx.arc(x, y, 14, 0, 2 * Math.PI);
        ctx.fillStyle = currentPattern.includes(idx) ? '#ef4444' : '#6b7280';
        ctx.fill();
      }
    }

    // Dibujar líneas del patrón
    if (currentPattern.length > 1) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < currentPattern.length; i++) {
        const idx = currentPattern[i];
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const x = cellSize * col + cellSize / 2;
        const y = cellSize * row + cellSize / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const pt = e.touches?.[0] ?? e;

    return {
      x: pt.clientX - rect.left,
      y: pt.clientY - rect.top
    };
  };

  const handleCanvasInteraction = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cellSize = rect.width / 3;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const px = cellSize * j + cellSize / 2;
        const py = cellSize * i + cellSize / 2;
        const dist = Math.sqrt((coords.x - px) ** 2 + (coords.y - py) ** 2);

        if (dist < cellSize / 3) {
          const idx = i * 3 + j;
          if (!pattern.includes(idx)) {
            setPattern(prev => [...prev, idx]);
          }
          return;
        }
      }
    }
  };

  const handleConfirm = () => {
    if (pattern.length < 4) {
      alert("El patrón debe tener al menos 4 puntos");
      return;
    }

    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    const patternVector = `pattern:${pattern.join('-')}`;
    onSave({ imageData: dataURL, patternVector });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        style={{ zIndex: 9999 }}
        className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader
          className="px-6 pt-6 pb-4"
          style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
        >
          <DialogTitle className="apple-text-headline apple-label-primary">Definir patrón de desbloqueo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 p-6">
          <div className="w-full aspect-square bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-2" style={{ touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={() => setDrawing(true)}
              onMouseUp={() => setDrawing(false)}
              onMouseMove={(e) => drawing && handleCanvasInteraction(e)}
              onTouchStart={() => setDrawing(true)}
              onTouchEnd={() => setDrawing(false)}
              onTouchMove={(e) => drawing && handleCanvasInteraction(e)}
              className="w-full h-full cursor-crosshair"
              style={{
                touchAction: 'none'
              }}
            />
          </div>

          <p className="apple-text-subheadline apple-label-secondary text-center py-2">
            Dibuja un patrón conectando al menos 4 puntos
          </p>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={initCanvas}
              className="apple-btn apple-btn-secondary flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="apple-btn apple-btn-secondary flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={pattern.length < 4}
              className="apple-btn apple-btn-primary flex-1"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SecurityStep({ formData, updateFormData }) {
  const [showPattern, setShowPattern] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [patternCollapsed, setPatternCollapsed] = useState(true);

  const handlePatternSave = ({ imageData, patternVector }) => {
    updateFormData("security", {
      ...formData.security,
      pattern_image: imageData,
      pattern_vector: patternVector
    });
    setPatternCollapsed(false);
  };

  const handleClearPattern = () => {
    updateFormData("security", {
      ...formData.security,
      pattern_image: null,
      pattern_vector: null
    });
  };

  const toggleNoAccess = (checked) => {
    updateFormData("security", {
      ...formData.security,
      no_access: checked,
      // Si no hay acceso, limpiamos los campos sensibles por seguridad
      ...(checked ? { device_pin: "", device_password: "", pattern_vector: null, pattern_image: null } : {})
    });
  };

  const toggleBiometric = (key) => {
    const current = formData.security?.biometrics || [];
    const updated = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];

    updateFormData("security", {
      ...formData.security,
      biometrics: updated
    });
  };

  const BIOMETRICS = [
    { key: "face_id", label: "Face ID", icon: Fingerprint, color: "text-apple-blue" },
    { key: "touch_id", label: "Touch ID", icon: Fingerprint, color: "text-apple-green" },
    { key: "huella", label: "Huella", icon: Fingerprint, color: "text-apple-orange" },
    { key: "face_unlock", label: "Face Unlock", icon: Smartphone, color: "text-apple-purple" },
  ];

  const hasNoAccess = formData.security?.no_access;

  return (
    <Card className="apple-surface apple-type apple-card rounded-apple-lg border-0">
      <CardHeader
        className="pb-3 mb-4"
        style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Seguridad del Dispositivo
          </CardTitle>
          <div className="flex items-center gap-2 apple-surface-secondary px-3 py-1.5 rounded-full">
            <ShieldAlert className={cn("w-4 h-4 transition-colors", hasNoAccess ? "text-apple-red" : "apple-label-tertiary")} />
            <span className="apple-text-caption2 font-semibold apple-label-secondary">Sin acceso</span>
            <Switch
              checked={!!hasNoAccess}
              onCheckedChange={toggleNoAccess}
              className="data-[state=checked]:bg-apple-red"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!hasNoAccess ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* PIN */}
            <div className="space-y-2">
              <Label className="apple-text-footnote apple-label-secondary font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                  <Hash className="w-3.5 h-3.5 text-apple-blue" />
                </div>
                PIN Numérico
              </Label>
              <div className="relative group">
                <Input
                  type={showPin ? "text" : "password"}
                  value={formData.security?.device_pin || ""}
                  onChange={(e) => updateFormData("security", {
                    ...formData.security,
                    device_pin: e.target.value.replace(/\D/g, '').slice(0, 8)
                  })}
                  placeholder="PIN del equipo"
                  className="apple-input pr-10 font-mono tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 apple-label-tertiary hover:apple-label-primary transition-colors"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="apple-text-caption2 apple-label-tertiary">Dejar vacío si no aplica</p>
            </div>

            {/* CONTRASEÑA */}
            <div className="space-y-2">
              <Label className="apple-text-footnote apple-label-secondary font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                  <Lock className="w-3.5 h-3.5 text-apple-green" />
                </div>
                Contraseña Alfanumérica
              </Label>
              <div className="relative group">
                <Input
                  type={showPass ? "text" : "password"}
                  value={formData.security?.device_password || ""}
                  onChange={(e) => updateFormData("security", { ...formData.security, device_password: e.target.value })}
                  placeholder="Contraseña del equipo"
                  className="apple-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 apple-label-tertiary hover:apple-label-primary transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="apple-text-caption2 apple-label-tertiary">Mayúsculas, minúsculas, símbolos...</p>
            </div>

            {/* CUENTAS CRÍTICAS */}
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="apple-surface-secondary rounded-apple-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-apple-sm bg-apple-indigo/15 flex items-center justify-center">
                      <Apple className="w-4 h-4 text-apple-indigo" />
                    </div>
                    <div>
                      <p className="apple-text-subheadline font-semibold apple-label-primary">Apple ID / iCloud</p>
                      <p className="apple-text-caption2 apple-label-tertiary">¿Está activo en el equipo?</p>
                    </div>
                  </div>
                  <Switch
                    checked={!!formData.security?.icloud_active}
                    onCheckedChange={(v) => updateFormData("security", { ...formData.security, icloud_active: v })}
                  />
                </div>
                {formData.security?.icloud_active && (
                  <Input
                    value={formData.security?.icloud_email || ""}
                    onChange={(e) => updateFormData("security", { ...formData.security, icloud_email: e.target.value })}
                    placeholder="Email de iCloud (Opcional)"
                    className="apple-input h-9 text-xs"
                  />
                )}
              </div>

              <div className="apple-surface-secondary rounded-apple-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center">
                      <Chrome className="w-4 h-4 text-apple-orange" />
                    </div>
                    <div>
                      <p className="apple-text-subheadline font-semibold apple-label-primary">Cuenta Google / FRP</p>
                      <p className="apple-text-caption2 apple-label-tertiary">¿Tiene cuenta vinculada?</p>
                    </div>
                  </div>
                  <Switch
                    checked={!!formData.security?.google_active}
                    onCheckedChange={(v) => updateFormData("security", { ...formData.security, google_active: v })}
                  />
                </div>
                {formData.security?.google_active && (
                  <Input
                    value={formData.security?.google_email || ""}
                    onChange={(e) => updateFormData("security", { ...formData.security, google_email: e.target.value })}
                    placeholder="Cuenta Google (Opcional)"
                    className="apple-input h-9 text-xs"
                  />
                )}
              </div>
            </div>

            {/* BIOMETRÍA */}
            <div className="md:col-span-2 space-y-3">
              <Label className="apple-text-footnote apple-label-secondary font-semibold">Atajos Biometría</Label>
              <div className="flex flex-wrap gap-2">
                {BIOMETRICS.map(bio => {
                  const active = formData.security?.biometrics?.includes(bio.key);
                  const Icon = bio.icon;
                  return (
                    <button
                      key={bio.key}
                      type="button"
                      onClick={() => toggleBiometric(bio.key)}
                      className={cn(
                        "apple-press flex items-center gap-2 px-3 py-2 rounded-full apple-text-caption1 font-medium transition-all",
                        active
                          ? "bg-apple-blue/15 text-apple-blue"
                          : "apple-surface-secondary apple-label-secondary"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", active ? bio.color : "apple-label-tertiary")} />
                      {bio.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PATRÓN */}
            <div
              className="md:col-span-2 space-y-2 pt-4"
              style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
            >
              <div className="flex items-center justify-between">
                <Label className="apple-text-footnote apple-label-secondary font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
                    <Grid3x3 className="w-3.5 h-3.5 text-apple-purple" />
                  </div>
                  Patrón de Bloqueo
                </Label>
                {formData.security?.pattern_vector && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPatternCollapsed(!patternCollapsed)}
                    className="apple-btn apple-btn-plain h-7"
                  >
                    {patternCollapsed ? <ChevronDown className="w-4 h-4 mr-1"/> : <ChevronUp className="w-4 h-4 mr-1"/>}
                    {patternCollapsed ? "Ver Detalle" : "Ocultar"}
                  </Button>
                )}
              </div>

              {formData.security?.pattern_vector ? (
                <div className={cn(
                  "apple-surface-secondary rounded-apple-md overflow-hidden transition-all duration-300",
                  patternCollapsed ? "p-3" : "p-4 space-y-4"
                )}>
                  {patternCollapsed ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
                          <Grid3x3 className="w-4 h-4 text-apple-purple" />
                        </div>
                        <span className="apple-text-subheadline apple-label-primary font-medium">Patrón configurado</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setShowPattern(true)}
                          variant="ghost"
                          size="sm"
                          className="apple-btn apple-btn-plain text-apple-blue h-8"
                        >
                          Cambiar
                        </Button>
                        <Button
                          onClick={handleClearPattern}
                          variant="ghost"
                          size="sm"
                          className="apple-btn apple-btn-plain text-apple-red h-8"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center apple-surface rounded-apple-md p-6">
                        <PatternDisplay
                          patternVector={formData.security.pattern_vector}
                          size={180}
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => setShowPattern(true)}
                          variant="outline"
                          className="apple-btn apple-btn-secondary flex-1"
                        >
                          Redibujar Patrón
                        </Button>
                        <Button
                          onClick={handleClearPattern}
                          variant="outline"
                          className="apple-btn apple-btn-tinted text-apple-red bg-apple-red/12"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Button
                  onClick={() => setShowPattern(true)}
                  variant="outline"
                  className="apple-btn apple-btn-secondary w-full apple-btn-lg border-dashed"
                >
                  <Grid3x3 className="w-4 h-4 mr-2 apple-label-tertiary" />
                  <span className="apple-label-secondary">Configurar Patrón (Android)</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 rounded-apple-lg bg-apple-red/12 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-apple-red/15 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-apple-red" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="apple-text-headline apple-label-primary">Modo "Sin Acceso" Activo</h4>
              <p className="apple-text-caption1 apple-label-tertiary max-w-[240px]">
                Se ha indicado que no se tiene acceso al equipo. Se omiten las credenciales de seguridad.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => toggleNoAccess(false)}
              className="apple-btn apple-btn-tinted text-apple-red bg-apple-red/12"
            >
              Habilitar acceso
            </Button>
          </div>
        )}

        {/* NOTAS */}
        <div
          className="space-y-2 pt-4"
          style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
        >
          <Label className="apple-text-footnote apple-label-secondary font-semibold">Notas Adicionales de Seguridad</Label>
          <Textarea
            value={formData.security?.security_notes || ""}
            onChange={(e) => updateFormData("security", { ...formData.security, security_notes: e.target.value })}
            placeholder="Ej: El cliente no conoce la clave de iCloud, Face ID está roto de fábrica..."
            className="apple-input min-h-[100px] resize-none"
          />
        </div>
      </CardContent>

      <PatternDrawer
        open={showPattern}
        onClose={() => setShowPattern(false)}
        onSave={handlePatternSave}
      />
    </Card>
  );
}
