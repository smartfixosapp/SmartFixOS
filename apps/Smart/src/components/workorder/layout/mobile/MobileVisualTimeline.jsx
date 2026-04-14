import React, { memo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DollarSign, MessageSquare, Wrench, Camera, AlertCircle,
  ArrowRight, Package, Shield, ClipboardCheck, FileText
} from "lucide-react";

const EVENT_STYLES = {
  status_change: { icon: ArrowRight, color: "bg-cyan-500", text: "text-cyan-400" },
  payment: { icon: DollarSign, color: "bg-emerald-500", text: "text-emerald-400" },
  item_added: { icon: Package, color: "bg-amber-500", text: "text-amber-400" },
  item_removed: { icon: Package, color: "bg-red-500", text: "text-red-400" },
  note: { icon: MessageSquare, color: "bg-blue-500", text: "text-blue-400" },
  note_added: { icon: MessageSquare, color: "bg-blue-500", text: "text-blue-400" },
  photo: { icon: Camera, color: "bg-violet-500", text: "text-violet-400" },
  attachment: { icon: Camera, color: "bg-violet-500", text: "text-violet-400" },
  diagnostic: { icon: ClipboardCheck, color: "bg-orange-500", text: "text-orange-400" },
  initial_problem: { icon: AlertCircle, color: "bg-red-500", text: "text-red-400" },
  security: { icon: Shield, color: "bg-purple-500", text: "text-purple-400" },
  create: { icon: FileText, color: "bg-cyan-500", text: "text-cyan-400" },
  repair: { icon: Wrench, color: "bg-emerald-500", text: "text-emerald-400" },
};

function getEventStyle(type) {
  return EVENT_STYLES[type] || EVENT_STYLES.note;
}

export default function MobileVisualTimeline({ events = [], emptyMessage = "Sin eventos" }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-white/30">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-white/[0.08]" />

      {events.map((event, i) => {
        const style = getEventStyle(event.event_type);
        const Icon = style.icon;
        const date = event.created_date || event.timestamp;
        const isImage = event.event_type === "attachment" && event.metadata?.url;

        return (
          <div key={event.id || i} className="relative pb-4">
            {/* Node circle */}
            <div className={cn(
              "absolute -left-6 top-1 w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 border-[#0D0D0F]",
              style.color
            )}>
              <Icon className="w-2.5 h-2.5 text-white" />
            </div>

            {/* Content */}
            <div className="ml-2 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className={cn("text-xs font-bold", style.text)}>
                  {event.user_name || "Sistema"}
                </span>
                {date && (
                  <span className="text-[10px] text-white/30 flex-shrink-0">
                    {format(new Date(date), "d MMM, h:mm a", { locale: es })}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                {event.description || event.metadata?.note_text || "—"}
              </p>
              {isImage && (
                <img
                  src={event.metadata.url}
                  alt=""
                  className="mt-2 rounded-lg w-full max-h-32 object-cover"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
