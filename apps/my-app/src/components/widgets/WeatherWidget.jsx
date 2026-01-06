import React from 'react';
import { Cloud, Sun, CloudRain, Wind, Droplets } from 'lucide-react';

export default function WeatherWidget({ isMaximized }) {
  const weather = {
    temp: 24,
    condition: 'Partly Cloudy',
    humidity: 65,
    wind: 12,
    forecast: [
      { day: 'Mon', high: 26, low: 18, icon: Sun },
      { day: 'Tue', high: 24, low: 17, icon: Cloud },
      { day: 'Wed', high: 22, low: 16, icon: CloudRain },
      { day: 'Thu', high: 25, low: 18, icon: Sun },
      { day: 'Fri', high: 27, low: 19, icon: Sun },
    ]
  };

  return (
    <div className={`${isMaximized ? 'h-full flex flex-col' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className={`font-light ${isMaximized ? 'text-7xl' : 'text-4xl'}`}>
            {weather.temp}°
          </div>
          <div className="text-white/60 mt-1">{weather.condition}</div>
        </div>
        <Cloud className={`text-white/40 ${isMaximized ? 'w-20 h-20' : 'w-12 h-12'}`} />
      </div>

      <div className={`flex gap-4 mt-4 ${isMaximized ? 'text-lg' : 'text-sm'}`}>
        <div className="flex items-center gap-2 text-white/60">
          <Droplets className="w-4 h-4" />
          {weather.humidity}%
        </div>
        <div className="flex items-center gap-2 text-white/60">
          <Wind className="w-4 h-4" />
          {weather.wind} km/h
        </div>
      </div>

      {isMaximized && (
        <div className="mt-8 flex-1">
          <h3 className="text-white/40 text-sm uppercase tracking-wider mb-4">5-Day Forecast</h3>
          <div className="grid grid-cols-5 gap-4">
            {weather.forecast.map((day) => (
              <div key={day.day} className="text-center p-4 rounded-xl bg-white/5">
                <div className="text-white/60 text-sm">{day.day}</div>
                <day.icon className="w-8 h-8 mx-auto my-3 text-white/70" />
                <div className="text-lg font-medium">{day.high}°</div>
                <div className="text-white/40 text-sm">{day.low}°</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
