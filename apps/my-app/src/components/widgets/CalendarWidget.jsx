import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

export default function CalendarWidget({ isMaximized }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const events = [
    { date: new Date(2024, new Date().getMonth(), 15), title: 'Team Meeting', color: 'bg-violet-500' },
    { date: new Date(2024, new Date().getMonth(), 20), title: 'Project Deadline', color: 'bg-rose-500' },
    { date: new Date(2024, new Date().getMonth(), 25), title: 'Launch Day', color: 'bg-emerald-500' },
  ];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startDay = monthStart.getDay();
  const paddingDays = Array(startDay).fill(null);

  const hasEvent = (date) => events.some(e => isSameDay(e.date, date));
  const getEventColor = (date) => events.find(e => isSameDay(e.date, date))?.color;

  return (
    <div className={cn("flex flex-col", isMaximized && "h-full")}>
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className={`font-medium ${isMaximized ? 'text-xl' : 'text-sm'}`}>
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <button 
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-center text-white/40 text-xs py-1">
            {day}
          </div>
        ))}
      </div>

      <div className={cn("grid grid-cols-7 gap-1", isMaximized && "flex-1")}>
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map(day => (
          <button
            key={day.toISOString()}
            onClick={() => setSelectedDate(day)}
            className={cn(
              "relative aspect-square rounded-lg text-sm transition-all",
              "hover:bg-white/10",
              isSameDay(day, selectedDate) && "bg-white/20 ring-1 ring-white/30",
              isSameDay(day, new Date()) && "text-amber-400 font-medium",
              isMaximized && "text-base"
            )}
          >
            {format(day, 'd')}
            {hasEvent(day) && (
              <span className={cn(
                "absolute bottom-1 left-1/2 -translate-x-1/2",
                "w-1 h-1 rounded-full",
                getEventColor(day)
              )} />
            )}
          </button>
        ))}
      </div>

      {isMaximized && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <h4 className="text-white/40 text-sm mb-3">Upcoming Events</h4>
          <div className="space-y-2">
            {events.map((event, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <div className={cn("w-2 h-2 rounded-full", event.color)} />
                <div>
                  <div className="text-sm font-medium">{event.title}</div>
                  <div className="text-xs text-white/40">{format(event.date, 'EEEE, MMM d')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
