import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, Trash2, Check } from "lucide-react";

export default function PatternLock({ open, onClose, onSave }) {
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
        ctx.arc(x, y, currentPattern.includes(idx) ? 15 : 10, 0, 2 * Math.PI);
        ctx.fillStyle = currentPattern.includes(idx) ? '#ef4444' : '#6b7280';
        ctx.fill();
      }
    }

    // Dibujar líneas del patrón
    if (currentPattern.length > 1) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(3, 3 * dpr / 2);
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

    // Detectar punto más cercano
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
    onSave(dataURL);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        style={{ zIndex: 9999 }}
        className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-white">Definir patrón de desbloqueo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="w-full aspect-square" style={{ touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={() => setDrawing(true)}
              onMouseUp={() => setDrawing(false)}
              onMouseMove={(e) => drawing && handleCanvasInteraction(e)}
              onTouchStart={() => setDrawing(true)}
              onTouchEnd={() => setDrawing(false)}
              onTouchMove={(e) => drawing && handleCanvasInteraction(e)}
              className="border-2 border-gray-700 rounded-lg bg-black cursor-crosshair w-full"
              style={{ 
                touchAction: 'none',
                width: '100%',
                height: '100%'
              }}
            />
          </div>

          <div className="text-sm text-gray-400 text-center">
            {pattern.length === 0 && "Dibuja un patrón conectando al menos 4 puntos"}
            {pattern.length > 0 && pattern.length < 4 && `${pattern.length} puntos seleccionados (mínimo 4)`}
            {pattern.length >= 4 && `✓ Patrón válido (${pattern.length} puntos)`}
          </div>

          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={initCanvas}
              className="flex-1 border-gray-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={pattern.length < 4}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700"
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
