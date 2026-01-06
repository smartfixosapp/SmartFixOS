import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TimerWidget({ isMaximized }) {
  const [time, setTime] = useState(25 * 60); // 25 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('focus'); // focus, break
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning && time > 0) {
      intervalRef.current = setInterval(() => {
        setTime(t => t - 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, time]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setIsRunning(false);
    setTime(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const toggleMode = (newMode) => {
    setMode(newMode);
    setIsRunning(false);
    setTime(newMode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const progress = mode === 'focus' 
    ? ((25 * 60 - time) / (25 * 60)) * 100
    : ((5 * 60 - time) / (5 * 60)) * 100;

  return (
    <div className={cn("flex flex-col items-center", isMaximized && "h-full justify-center")}>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => toggleMode('focus')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm transition-all",
            mode === 'focus' ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
          )}
        >
          Focus
        </button>
        <button
          onClick={() => toggleMode('break')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm transition-all",
            mode === 'break' ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
          )}
        >
          Break
        </button>
      </div>

      <div className="relative">
        <svg className={cn("transform -rotate-90", isMaximized ? "w-64 h-64" : "w-40 h-40")}>
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
          />
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke={mode === 'focus' ? '#f59e0b' : '#10b981'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className={cn(
          "absolute inset-0 flex flex-col items-center justify-center",
          isMaximized ? "text-6xl" : "text-3xl"
        )}>
          <span className="font-light">{formatTime(time)}</span>
          <span className={cn(
            "text-white/40 capitalize",
            isMaximized ? "text-lg" : "text-xs"
          )}>
            {mode}
          </span>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={cn(
            "p-4 rounded-full transition-all",
            isRunning 
              ? "bg-rose-500/30 hover:bg-rose-500/40" 
              : "bg-emerald-500/30 hover:bg-emerald-500/40"
          )}
        >
          {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button
          onClick={reset}
          className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
