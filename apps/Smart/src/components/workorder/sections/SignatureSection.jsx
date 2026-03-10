import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenTool, Trash2, Check } from "lucide-react";

/* 👈 C7) Firma con DPR y miniatura debajo */
function SignaturePad({ onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    initCanvas();
    return () => {
      document.body.classList.remove("signing-mode");
    };
  }, []);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    setHasContent(false);
    setPreview(null);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const pt = e.touches?.[0] || e;
    
    return {
      x: pt.clientX - rect.left,
      y: pt.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    document.body.classList.add("signing-mode");

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, 2 * dpr / 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    setIsDrawing(true);
    setHasContent(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    setIsDrawing(false);
    document.body.classList.remove("signing-mode");
    
    const canvas = canvasRef.current;
    if (canvas && hasContent) {
      setPreview(canvas.toDataURL('image/png'));
    }
  };

  const handleClear = () => {
    initCanvas();
  };

  const handleSave = () => {
    if (!hasContent) {
      alert("Por favor firma antes de guardar");
      return;
    }

    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    onSave(dataURL);
  };

  return (
    <div className="space-y-4">
      <style>{`
        body.signing-mode {
          overflow: hidden !important;
          touch-action: none !important;
        }
      `}</style>

      <div className="border-2 border-gray-700 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full cursor-crosshair"
          style={{
            touchAction: 'none',
            height: '200px'
          }}
        />
      </div>

      {/* 👈 Miniatura DEBAJO del canvas */}
      {preview && (
        <div className="flex flex-col items-center gap-2 pt-4 border-t border-gray-800">
          <span className="text-xs text-gray-400">Vista previa:</span>
          <img 
            src={preview} 
            alt="Preview" 
            className="h-20 border border-gray-700 rounded bg-white max-w-full"
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleClear}
          className="flex-1 border-gray-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Limpiar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasContent}
          className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700"
        >
          <Check className="w-4 h-4 mr-2" />
          Guardar
        </Button>
      </div>
    </div>
  );
}

export default function SignatureSection({ order, onUpdate }) {
  const [showPad, setShowPad] = useState(false);

  const handleSave = async (dataURL) => {
    // Aquí iría la lógica para actualizar la orden
    // Por ahora solo mostramos la firma
    setShowPad(false);
    if (onUpdate) onUpdate();
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <PenTool className="w-5 h-5" />
          Firma del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.customer_signature ? (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-gray-700">
              <img
                src={order.customer_signature}
                alt="Customer signature"
                className="w-full h-auto"
              />
            </div>
            
            {order.terms_accepted && (
              <div className="text-sm text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Términos y condiciones aceptados
              </div>
            )}
          </div>
        ) : showPad ? (
          <SignaturePad onSave={handleSave} />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No hay firma registrada</p>
            <Button
              onClick={() => setShowPad(true)}
              variant="outline"
              className="border-gray-700"
            >
              <PenTool className="w-4 h-4 mr-2" />
              Capturar firma
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
