import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function ClockWidget({ isMaximized }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center ${isMaximized ? 'h-full' : ''}`}>
      <div className={`font-light tracking-tight ${isMaximized ? 'text-8xl' : 'text-5xl'}`}>
        {format(time, 'HH:mm')}
      </div>
      <div className={`text-white/50 mt-2 ${isMaximized ? 'text-2xl' : 'text-sm'}`}>
        {format(time, 'EEEE, MMMM d')}
      </div>
      {isMaximized && (
        <div className="mt-8 flex gap-8">
          {['Tokyo', 'London', 'New York'].map((city, i) => {
            const offset = [9, 0, -5][i];
            const cityTime = new Date(time.getTime() + (offset - time.getTimezoneOffset() / 60) * 3600000);
            return (
              <div key={city} className="text-center">
                <div className="text-3xl font-light">{format(cityTime, 'HH:mm')}</div>
                <div className="text-white/40 text-sm mt-1">{city}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
