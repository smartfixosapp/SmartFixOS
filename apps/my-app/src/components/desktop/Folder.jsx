import React, { useState, useRef, useEffect } from 'react';
import { Folder as FolderIcon, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Folder({ 
  id,
  name, 
  widgets, 
  position, 
  onPositionChange,
  onWidgetClick,
  isOpen,
  onToggle,
  isDropTarget,
  onGetBounds
}) {
  // Register bounds for drop detection
  const getBounds = () => {
    if (folderRef.current) {
      return folderRef.current.getBoundingClientRect();
    }
    return null;
  };

  useEffect(() => {
    if (onGetBounds) {
      onGetBounds(id, getBounds);
    }
  }, [id, onGetBounds, position]);

  // Close folder when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e) => {
      if (folderRef.current && !folderRef.current.contains(e.target)) {
        onToggle(id);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, id, onToggle]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const folderRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.folder-content')) return;
    setIsDragging(true);
    const rect = folderRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 150));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 150));
      onPositionChange(id, { x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, id, onPositionChange]);

  return (
    <motion.div
      ref={folderRef}
      className={cn(
        "absolute z-20 cursor-grab",
        isDragging && "cursor-grabbing"
      )}
      style={{ left: position?.x || 50, top: position?.y || 50 }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onMouseDown={handleMouseDown}
    >
      {/* Folder Icon */}
      <div 
        className="flex flex-col items-center group"
        onDoubleClick={() => onToggle(id)}
      >
        <div className={cn(
          "relative p-4 rounded-2xl transition-all duration-300",
          "bg-gradient-to-br from-amber-500/30 to-orange-500/30",
          "backdrop-blur-xl border border-white/10",
          "hover:from-amber-500/40 hover:to-orange-500/40",
          "shadow-lg hover:shadow-xl hover:scale-105",
          isOpen && "from-amber-500/50 to-orange-500/50",
          isDropTarget && "ring-2 ring-amber-400 scale-110 from-amber-500/50 to-orange-500/50"
        )}>
          <FolderIcon className="w-10 h-10 text-amber-300" />
          {widgets.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-medium">
              {widgets.length}
            </span>
          )}
        </div>
        <span className="mt-2 text-sm text-white/80 font-medium text-center max-w-[100px] truncate">
          {name}
        </span>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={cn(
              "folder-content absolute top-full left-1/2 -translate-x-1/2 mt-3",
              "min-w-[200px] p-3 rounded-xl",
              "bg-slate-900/90 backdrop-blur-2xl border border-white/10",
              "shadow-2xl"
            )}
          >
            <div className="flex flex-col gap-2">
              {widgets.map((widget) => {
                const Icon = widget.icon;
                return (
                  <button
                    key={widget.id}
                    onClick={() => onWidgetClick(widget.id)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "bg-white/5 hover:bg-white/10 transition-all",
                      "text-left group"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg bg-gradient-to-br",
                      widget.color
                    )}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm text-white/80 group-hover:text-white">
                      {widget.title}
                    </span>
                  </button>
                );
              })}
              {widgets.length === 0 && (
                <p className="text-sm text-white/40 text-center py-2">
                  Empty folder
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
