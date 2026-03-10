import React, { useRef, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eraser, Save, RotateCcw } from "lucide-react";

export default function LockPatternDrawer({ onSave, initialImage }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [points, setPoints] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      setCtx(context);
      
      // Draw grid of dots
      drawGrid(context);
      
      if (initialImage) {
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = initialImage;
      }
    }
  }, []);

  const drawGrid = (context) => {
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, 400, 400);
    
    // Draw 3x3 grid of dots
    const spacing = 100;
    const offset = 50;
    
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = offset + col * spacing;
        const y = offset + row * spacing;
        
        // Draw outer circle
        context.beginPath();
        context.arc(x, y, 20, 0, 2 * Math.PI);
        context.fillStyle = '#e2e8f0';
        context.fill();
        
        // Draw inner circle
        context.beginPath();
        context.arc(x, y, 12, 0, 2 * Math.PI);
        context.fillStyle = '#cbd5e1';
        context.fill();
      }
    }
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    setIsDrawing(true);
    setPoints([{x, y}]);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !ctx) return;
    
    const { x, y } = getCoordinates(e);
    const newPoints = [...points, {x, y}];
    setPoints(newPoints);
    
    // Redraw everything
    drawGrid(ctx);
    
    if (newPoints.length > 1) {
      // Draw line segments with arrows
      ctx.strokeStyle = '#0891b2';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      for (let i = 0; i < newPoints.length - 1; i++) {
        const p1 = newPoints[i];
        const p2 = newPoints[i + 1];
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        // Draw arrowhead at midpoint
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        
        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fillStyle = '#0891b2';
        ctx.fill();
        ctx.restore();
      }
      
      // Highlight start point (green)
      const start = newPoints[0];
      ctx.beginPath();
      ctx.arc(start.x, start.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      
      // Highlight end point (red)
      const end = newPoints[newPoints.length - 1];
      ctx.beginPath();
      ctx.arc(end.x, end.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    setPoints([]);
    drawGrid(ctx);
  };

  const savePattern = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium text-slate-700">Draw Lock Pattern</div>
        <div className="text-xs text-slate-500">Draw from start (green) to end (red). Arrows show direction.</div>
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="border-2 border-slate-300 rounded-lg cursor-crosshair touch-none w-full"
          style={{ maxWidth: '400px', aspectRatio: '1/1' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={savePattern}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Pattern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
