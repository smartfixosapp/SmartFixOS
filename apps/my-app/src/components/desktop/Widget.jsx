import React, { useState, useRef, useEffect } from 'react';
import { Minus, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Widget({ 
  id,
  title, 
  icon: Icon,
  children, 
  isMinimized, 
  isMaximized,
  onMinimize, 
  onMaximize,
  position,
  onPositionChange,
  size,
  onSizeChange,
  onDragEnd,
  color = 'from-violet-500/20 to-purple-500/20',
  accentColor = 'violet'
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });
  const [initialMouse, setInitialMouse] = useState({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  const handleMouseDown = (e) => {
    if (isMaximized) return;
    setIsDragging(true);
    const rect = widgetRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleResizeStart = (e, direction) => {
    if (isMaximized) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setInitialSize({ width: size?.width || 280, height: size?.height || 200 });
    setInitialPos({ x: position?.x || 100, y: position?.y || 100 });
    setInitialMouse({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 200));
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 150));
        onPositionChange(id, { x: newX, y: newY });
      }
      
      if (isResizing && resizeDirection) {
        const deltaX = e.clientX - initialMouse.x;
        const deltaY = e.clientY - initialMouse.y;
        
        let newWidth = initialSize.width;
        let newHeight = initialSize.height;
        let newX = initialPos.x;
        let newY = initialPos.y;
        
        // Handle horizontal resizing
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(200, initialSize.width + deltaX);
        }
        if (resizeDirection.includes('w')) {
          const widthDelta = Math.min(deltaX, initialSize.width - 200);
          newWidth = Math.max(200, initialSize.width - deltaX);
          newX = initialPos.x + (initialSize.width - newWidth);
        }
        
        // Handle vertical resizing
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(150, initialSize.height + deltaY);
        }
        if (resizeDirection.includes('n')) {
          const heightDelta = Math.min(deltaY, initialSize.height - 150);
          newHeight = Math.max(150, initialSize.height - deltaY);
          newY = initialPos.y + (initialSize.height - newHeight);
        }
        
        onSizeChange(id, { width: newWidth, height: newHeight });
        if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
          onPositionChange(id, { x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = (e) => {
      if (isDragging && onDragEnd) {
        onDragEnd(id, { x: e.clientX, y: e.clientY });
      }
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, id, onPositionChange, onSizeChange, resizeDirection, initialSize, initialPos, initialMouse]);

  if (isMinimized) return null;

  const resizeHandleClass = "absolute bg-transparent hover:bg-white/20 transition-colors z-10";

  return (
    <div
      ref={widgetRef}
      className={cn(
        "absolute rounded-2xl overflow-hidden transition-shadow duration-300",
        "backdrop-blur-xl border border-white/10 shadow-2xl",
        `bg-gradient-to-br ${color}`,
        isMaximized ? "!inset-4 !w-auto !h-auto z-50" : "z-10",
        (isDragging || isResizing) && "shadow-3xl",
        isDragging && "cursor-grabbing"
      )}
      style={!isMaximized ? { 
        left: position?.x || 100, 
        top: position?.y || 100,
        width: size?.width || 280,
        height: size?.height || 'auto',
        minWidth: '200px',
        minHeight: '150px'
      } : {}}
    >
      {/* Resize Handles */}
      {!isMaximized && (
        <>
          {/* Corners */}
          <div 
            className={cn(resizeHandleClass, "top-0 left-0 w-4 h-4 cursor-nw-resize rounded-tl-2xl")}
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          <div 
            className={cn(resizeHandleClass, "top-0 right-0 w-4 h-4 cursor-ne-resize rounded-tr-2xl")}
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div 
            className={cn(resizeHandleClass, "bottom-0 left-0 w-4 h-4 cursor-sw-resize rounded-bl-2xl")}
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div 
            className={cn(resizeHandleClass, "bottom-0 right-0 w-4 h-4 cursor-se-resize rounded-br-2xl")}
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
          
          {/* Edges */}
          <div 
            className={cn(resizeHandleClass, "top-0 left-4 right-4 h-2 cursor-n-resize")}
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />
          <div 
            className={cn(resizeHandleClass, "bottom-0 left-4 right-4 h-2 cursor-s-resize")}
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div 
            className={cn(resizeHandleClass, "left-0 top-4 bottom-4 w-2 cursor-w-resize")}
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div 
            className={cn(resizeHandleClass, "right-0 top-4 bottom-4 w-2 cursor-e-resize")}
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
        </>
      )}
      {/* Header */}
      <div 
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-grab",
          "bg-gradient-to-r from-white/5 to-transparent border-b border-white/5",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 text-${accentColor}-400`} />}
          <span className="text-sm font-medium text-white/90">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMinimize(id)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors group"
          >
            <Minus className="w-3.5 h-3.5 text-white/50 group-hover:text-amber-400 transition-colors" />
          </button>
          <button
            onClick={() => onMaximize(id)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors group"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5 text-white/50 group-hover:text-emerald-400 transition-colors" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-white/50 group-hover:text-emerald-400 transition-colors" />
            )}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className={cn(
        "p-4 text-white/90 overflow-auto",
        isMaximized ? "h-[calc(100%-52px)]" : "h-[calc(100%-52px)]"
      )}>
        {children}
      </div>
    </div>
  );
}
