import React, { useState } from "react";
import { Activity, Camera, LockKeyhole } from "lucide-react";
import OrderSecurity from "@/components/workorder/sections/OrderSecurity";
import OrderMultimedia from "@/components/workorder/sections/OrderMultimedia";
import WorkOrderTimeline from "@/components/orders/workorder/WorkOrderTimeline";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "timeline", label: "Actividad", icon: Activity },
  { id: "photos", label: "Fotos", icon: Camera, feature: "orders_photos" },
  { id: "security", label: "Seguridad", icon: LockKeyhole },
];

export default function WOTabPanel({ order, onUpdate }) {
  const [activeTab, setActiveTab] = useState("timeline");
  const { can: canPlan } = usePlanLimits();

  const visibleTabs = TABS.filter(t => !t.feature || canPlan(t.feature));

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-white/[0.08] mb-3">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-cyan-500 text-white"
                : "border-transparent text-white/40 hover:text-white/70"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "timeline" && <WorkOrderTimeline order={order} onUpdate={onUpdate} />}
        {activeTab === "photos" && canPlan("orders_photos") && <OrderMultimedia order={order} onUpdate={onUpdate} />}
        {activeTab === "security" && <OrderSecurity order={order} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}
