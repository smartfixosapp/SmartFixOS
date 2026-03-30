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
        className="bg-[#1a1a1a] border-gray-700 max-w-md p-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="text-white text-lg font-semibold">Definir patrón de desbloqueo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="w-full aspect-square bg-black rounded-lg border border-gray-800 p-2" style={{ touchAction: 'none' }}>
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

          <p className="text-sm text-gray-400 text-center py-2">
            Dibuja un patrón conectando al menos 4 puntos
          </p>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={initCanvas}
              className="flex-1 bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700 h-11"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-zinc-200 text-black border-zinc-300 hover:bg-zinc-300 h-11"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={pattern.length < 4}
              className="flex-1 bg-red-700 hover:bg-red-800 text-white h-11 disabled:opacity-50 disabled:cursor-not-allowed"
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
    { key: "face_id", label: "Face ID", icon: Fingerprint, color: "text-blue-400" },
    { key: "touch_id", label: "Touch ID", icon: Fingerprint, color: "text-emerald-400" },
    { key: "huella", label: "Huella", icon: Fingerprint, color: "text-orange-400" },
    { key: "face_unlock", label: "Face Unlock", icon: Smartphone, color: "text-purple-400" },
  ];

  const hasNoAccess = formData.security?.no_access;

  return (
    <Card className={cn(
      "bg-gradient-to-br transition-all duration-500 border-gray-800",
      hasNoAccess ? "from-gray-900 to-red-900/20" : "from-gray-900 to-black"
    )}>
      <CardHeader className="pb-3 border-b border-white/5 mb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Seguridad del Dispositivo
          </CardTitle>
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 shadow-inner">
            <ShieldAlert className={cn("w-4 h-4 transition-colors", hasNoAccess ? "text-red-500" : "text-gray-500")} />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Sin acceso</span>
            <Switch 
              checked={!!hasNoAccess} 
              onCheckedChange={toggleNoAccess}
              className="data-[state=checked]:bg-red-600"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!hasNoAccess ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* PIN */}
            <div className="space-y-2">
              <Label className="text-gray-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
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
                  className="bg-black/60 border-white/10 text-white h-11 pr-10 focus:border-cyan-500/50 transition-all font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 italic">Dejar vacío si no aplica</p>
            </div>

            {/* CONTRASEÑA */}
            <div className="space-y-2">
              <Label className="text-gray-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Contraseña Alfanumérica
              </Label>
              <div className="relative group">
                <Input
                  type={showPass ? "text" : "password"}
                  value={formData.security?.device_password || ""}
                  onChange={(e) => updateFormData("security", { ...formData.security, device_password: e.target.value })}
                  placeholder="Contraseña del equipo"
                  className="bg-black/60 border-white/10 text-white h-11 pr-10 focus:border-emerald-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 italic">Mayúsculas, minúsculas, símbolos...</p>
            </div>

            {/* CUENTAS CRÍTICAS */}
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/10">
                      <Apple className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Apple ID / iCloud</p>
                      <p className="text-[10px] text-gray-500">¿Está activo en el equipo?</p>
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
                    className="h-9 text-xs bg-black border-white/10"
                  />
                )}
              </div>

              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/10">
                      <Chrome className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Cuenta Google / FRP</p>
                      <p className="text-[10px] text-gray-500">¿Tiene cuenta vinculada?</p>
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
                    className="h-9 text-xs bg-black border-white/10"
                  />
                )}
              </div>
            </div>

            {/* BIOMETRÍA */}
            <div className="md:col-span-2 space-y-3">
              <Label className="text-gray-300 text-[10px] font-black uppercase tracking-widest">Atajos Biometría</Label>
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
                        "flex items-center gap-2 px-3 py-2 rounded-full border text-[11px] font-bold transition-all",
                        active 
                          ? "bg-white/10 border-white/20 text-white shadow-lg shadow-white/5 scale-105" 
                          : "bg-black/40 border-white/5 text-gray-500 hover:border-white/10"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", active ? bio.color : "text-gray-600")} />
                      {bio.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PATRÓN */}
            <div className="md:col-span-2 space-y-2 border-t border-white/5 pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                  <Grid3x3 className="w-4 h-4 text-purple-400" />
                  Patrón de Bloqueo
                </Label>
                {formData.security?.pattern_vector && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPatternCollapsed(!patternCollapsed)}
                    className="h-7 text-gray-500 hover:text-white"
                  >
                    {patternCollapsed ? <ChevronDown className="w-4 h-4 mr-1"/> : <ChevronUp className="w-4 h-4 mr-1"/>}
                    {patternCollapsed ? "Ver Detalle" : "Ocultar"}
                  </Button>
                )}
              </div>
              
              {formData.security?.pattern_vector ? (
                <div className={cn(
                  "bg-black/40 border border-purple-500/20 rounded-xl overflow-hidden transition-all duration-300",
                  patternCollapsed ? "p-3" : "p-4 space-y-4"
                )}>
                  {patternCollapsed ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                          <Grid3x3 className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-xs text-gray-300 font-medium">Patrón configurado</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setShowPattern(true)}
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-cyan-400 hover:bg-cyan-400/10"
                        >
                          Cambiar
                        </Button>
                        <Button
                          onClick={handleClearPattern}
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center bg-black/60 rounded-lg p-6 border border-white/5">
                        <PatternDisplay 
                          patternVector={formData.security.pattern_vector} 
                          size={180} 
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => setShowPattern(true)}
                          variant="outline"
                          className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 h-10"
                        >
                          Redibujar Patrón
                        </Button>
                        <Button
                          onClick={handleClearPattern}
                          variant="outline"
                          className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-10"
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
                  className="w-full border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-purple-500/30 h-12 transition-all group"
                >
                  <Grid3x3 className="w-4 h-4 mr-2 text-gray-500 group-hover:text-purple-400 transition-colors" />
                  <span className="text-gray-400 group-hover:text-white">Configurar Patrón (Android)</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 border-2 border-dashed border-red-500/20 rounded-2xl bg-red-500/[0.02] animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-white font-bold">Modo "Sin Acceso" Activo</h4>
              <p className="text-xs text-gray-500 max-w-[240px]">
                Se ha indicado que no se tiene acceso al equipo. Se omiten las credenciales de seguridad.
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => toggleNoAccess(false)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-9"
            >
              Habilitar acceso
            </Button>
          </div>
        )}

        {/* NOTAS */}
        <div className="space-y-2 border-t border-white/5 pt-4">
          <Label className="text-gray-300 text-xs font-bold uppercase tracking-wider">Notas Adicionales de Seguridad</Label>
          <Textarea
            value={formData.security?.security_notes || ""}
            onChange={(e) => updateFormData("security", { ...formData.security, security_notes: e.target.value })}
            placeholder="Ej: El cliente no conoce la clave de iCloud, Face ID está roto de fábrica..."
            className="bg-black/40 border-white/10 text-white min-h-[100px] focus:border-red-500/30 transition-all resize-none"
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
