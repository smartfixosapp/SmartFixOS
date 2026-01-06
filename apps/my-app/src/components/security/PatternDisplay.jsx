import React, { useEffect, useRef } from "react";

export default function PatternDisplay({ patternVector, size = 200 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!patternVector || !canvasRef.current) return;

    // Parsear el patrón: "pattern:0-1-4-7" -> [0, 1, 4, 7]
    const pattern = patternVector.replace('pattern:', '').split('-').map(Number);
    
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cellSize = size / 3;

    // Dibujar grid 3x3
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = cellSize * j + cellSize / 2;
        const y = cellSize * i + cellSize / 2;
        const idx = i * 3 + j;
        
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 2 * Math.PI);
        ctx.fillStyle = pattern.includes(idx) ? '#ef4444' : '#6b7280';
        ctx.fill();
      }
    }

    // Dibujar líneas del patrón
    if (pattern.length > 1) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      
      for (let i = 0; i < pattern.length; i++) {
        const idx = pattern[i];
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
  }, [patternVector, size]);

  if (!patternVector) return null;

  return (
    <div className="inline-block">
      <canvas
        ref={canvasRef}
        className="rounded-lg bg-black border border-gray-800"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
