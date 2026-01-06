import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Grid3x3, Trash2, Check, Hash } from "lucide-react";
import PatternDisplay from "@/components/security/PatternDisplay";

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

  const handlePatternSave = ({ imageData, patternVector }) => {
    updateFormData("security", {
      ...formData.security,
      pattern_image: imageData,
      pattern_vector: patternVector
    });
  };

  const handleClearPattern = () => {
    updateFormData("security", {
      ...formData.security,
      pattern_image: null,
      pattern_vector: null
    });
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Seguridad del Dispositivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PIN */}
        <div className="space-y-2">
          <Label className="text-gray-300 flex items-center gap-2">
            <Hash className="w-4 h-4 text-cyan-400" />
            PIN Numérico
          </Label>
          <Input
            type="text"
            value={formData.security?.device_pin || ""}
            onChange={(e) => updateFormData("security", { 
              ...formData.security, 
              device_pin: e.target.value.replace(/\D/g, '').slice(0, 6)
            })}
            placeholder="Ingresa PIN..."
            className="bg-black border-gray-700 text-white"
          />
          <p className="text-xs text-gray-500">4-6 dígitos numéricos</p>
        </div>

        {/* CONTRASEÑA */}
        <div className="space-y-2">
          <Label className="text-gray-300 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            Contraseña
          </Label>
          <Input
            type="text"
            value={formData.security?.device_password || ""}
            onChange={(e) => updateFormData("security", { ...formData.security, device_password: e.target.value })}
            placeholder="Ingresa contraseña..."
            className="bg-black border-gray-700 text-white"
          />
        </div>

        {/* PATRÓN */}
        <div className="space-y-2">
          <Label className="text-gray-300 flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-purple-400" />
            Patrón de Bloqueo (Android)
          </Label>
          
          {formData.security?.pattern_vector ? (
            <div className="bg-black/40 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center justify-center mb-3">
                <PatternDisplay 
                  patternVector={formData.security.pattern_vector} 
                  size={180} 
                />
              </div>
              <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-lg p-2 mb-3">
                <p className="text-xs text-cyan-300 font-mono text-center">
                  {formData.security.pattern_vector}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowPattern(true)}
                  variant="outline"
                  className="flex-1 border-white/15"
                >
                  Cambiar Patrón
                </Button>
                <Button
                  onClick={handleClearPattern}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-600/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowPattern(true)}
              variant="outline"
              className="w-full border-white/15 hover:border-purple-500/50"
            >
              <Grid3x3 className="w-4 h-4 mr-2" />
              Configurar Patrón
            </Button>
          )}
        </div>

        {/* NOTAS */}
        <div className="space-y-2">
          <Label className="text-gray-300">Notas Adicionales</Label>
          <Textarea
            value={formData.security?.security_notes || ""}
            onChange={(e) => updateFormData("security", { ...formData.security, security_notes: e.target.value })}
            placeholder="Ej: Face ID deshabilitado, patrón alternativo..."
            className="bg-black/40 border-white/15 text-white min-h-[80px]"
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
