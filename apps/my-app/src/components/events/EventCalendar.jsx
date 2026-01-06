import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

export default function EventCalendar({ events, clients, onEventClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Get first day of the calendar (start of week containing first day of month)
  const calendarStart = startOfWeek(monthStart);
  // Get last day of the calendar (end of week containing last day of month)
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (date) => {
    if (!date) return [];
    return events.filter(event => {
      try {
        return isSameDay(parseISO(event.date), date);
      } catch {
        return false;
      }
    });
  };

  const getClientName = (clientId) => {
    const client = clients?.find(c => c.id === clientId);
    return client?.name || "Unknown";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "upcoming": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "completed": return "bg-slate-100 text-slate-600 border-slate-200";
      case "cancelled": return "bg-red-100 text-red-600 border-red-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-semibold text-slate-900">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={handleToday}
          className="h-8 px-4 text-sm"
        >
          Today
        </Button>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0">
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentDay = isToday(day);
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <div
              key={index}
              className={`min-h-[120px] p-3 border border-slate-100 ${
                !isCurrentMonth ? "bg-slate-50/50" : "bg-white"
              }`}
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-center mb-2">
                  <span
                    className={`text-sm font-medium ${
                      isCurrentDay
                        ? "flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white"
                        : isCurrentMonth
                        ? "text-slate-700"
                        : "text-slate-400"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1 flex-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity font-medium ${
                        event.status === "upcoming"
                          ? "bg-emerald-100 text-emerald-700"
                          : event.status === "completed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}
                      onClick={() => onEventClick(event)}
                    >
                      <div className="truncate">{event.title}</div>
                    </motion.div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-slate-400 text-center">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
