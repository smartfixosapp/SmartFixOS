import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  Plus,
  User,
  DollarSign,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  Mail,
  Paperclip,
  Wallet,
  Package,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

const activityIcons = {
  create: { icon: Plus, color: "text-green-400" },
  assign: { icon: User, color: "text-blue-400" },
  reassign: { icon: RefreshCw, color: "text-blue-400" },
  payment: { icon: DollarSign, color: "text-purple-400" },
  status_change: { icon: RefreshCw, color: "text-orange-400" },
  note: { icon: MessageSquare, color: "text-yellow-400" },
  checklist: { icon: CheckCircle2, color: "text-red-400" },
  email_sent: { icon: Mail, color: "text-gray-400" },
  attachment: { icon: Paperclip, color: "text-brown-400" },
  cash_open: { icon: Wallet, color: "text-green-400" },
  cash_close: { icon: Wallet, color: "text-red-400" },
  product_edit: { icon: Package, color: "text-cyan-400" }
};

export default function ActivityLog() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadActivities();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadActivities();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadActivities = async () => {
    try {
      // Load work order events and audit logs
      const [woEvents, auditLogs] = await Promise.all([
        base44.entities.WorkOrderEvent.list("-created_date", 20),
        base44.entities.AuditLog.list("-created_date", 20)
      ]);

      // Combine and sort by date
      const combined = [
        ...woEvents.map(e => ({
          ...e,
          source: 'work_order',
          timestamp: new Date(e.created_date)
        })),
        ...auditLogs.map(l => ({
          ...l,
          source: 'audit',
          timestamp: new Date(l.created_date)
        }))
      ].sort((a, b) => b.timestamp - a.timestamp);

      setActivities(combined.slice(0, 15));
    } catch (error) {
      console.error("Error loading activities:", error);
    }
    setLoading(false);
  };

  const handleActivityClick = (activity) => {
    if (activity.source === 'work_order' && activity.order_id) {
      navigate(createPageUrl(`Orders?order=${activity.order_id}`));
    } else if (activity.source === 'audit') {
      if (activity.entity_type === 'order' && activity.entity_id) {
        navigate(createPageUrl(`Orders?order=${activity.entity_id}`));
      } else if (activity.entity_type === 'cash_register') {
        navigate(createPageUrl("CashDrawer"));
      } else if (activity.entity_type === 'product') {
        navigate(createPageUrl("Inventory"));
      }
    }
  };

  const getActivityIcon = (activity) => {
    if (activity.source === 'work_order') {
      const config = activityIcons[activity.event_type];
      return config || activityIcons.note;
    }
    
    // Map audit actions to icons
    if (activity.action.includes('cash')) return activityIcons.cash_open;
    if (activity.action.includes('create')) return activityIcons.create;
    if (activity.action.includes('assign')) return activityIcons.assign;
    if (activity.action.includes('payment')) return activityIcons.payment;
    if (activity.action.includes('product')) return activityIcons.product_edit;
    
    return { icon: Activity, color: "text-gray-400" };
  };

  const getActivityText = (activity) => {
    if (activity.source === 'work_order') {
      return activity.description;
    }
    
    // Format audit log text
    const action = activity.action.replace(/_/g, ' ');
    return `${action} ${activity.entity_number || ''}`;
  };

  const displayActivities = showAll ? activities : activities.slice(0, 8);

  return (
    <>
      <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <CardHeader className="border-b border-red-900/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#FF0000]" />
              Actividades Recientes
            </CardTitle>
            <Button
              onClick={() => setShowAll(true)}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-[#FF0000]"
            >
              Ver todas <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay actividades recientes</div>
          ) : (
            <div className="space-y-2">
              {displayActivities.map((activity, index) => {
                const IconConfig = getActivityIcon(activity);
                const Icon = IconConfig.icon;

                return (
                  <div
                    key={index}
                    onClick={() => handleActivityClick(activity)}
                    className="flex items-start gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-[#FF0000]/50 transition-all cursor-pointer"
                  >
                    <div className="p-2 rounded-full bg-gray-800">
                      <Icon className={`w-4 h-4 ${IconConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white line-clamp-2">
                        <span className="font-semibold">{activity.user_name}</span>
                        {' '}
                        {getActivityText(activity)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(activity.timestamp, "HH:mm a · dd MMM", { locale: es })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Activities Dialog */}
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
          <DialogHeader>
            <DialogTitle className="text-white">Todas las Actividades</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto max-h-[60vh] custom-scrollbar pr-2">
            {activities.map((activity, index) => {
              const IconConfig = getActivityIcon(activity);
              const Icon = IconConfig.icon;

              return (
                <div
                  key={index}
                  onClick={() => {
                    handleActivityClick(activity);
                    setShowAll(false);
                  }}
                  className="flex items-start gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-[#FF0000]/50 transition-all cursor-pointer"
                >
                  <div className="p-2 rounded-full bg-gray-800">
                    <Icon className={`w-4 h-4 ${IconConfig.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          <span className="font-semibold">{activity.user_name}</span>
                          {' '}
                          {getActivityText(activity)}
                        </p>
                        {activity.user_role && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {activity.user_role}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {format(activity.timestamp, "HH:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
