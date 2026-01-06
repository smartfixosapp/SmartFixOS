import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, Phone, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

export default function CustomerActivityWidget() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 180000);
    return () => clearInterval(interval);
  }, []);

  const loadActivities = async () => {
    try {
      setError(false);
      
      const [orders, customers] = await Promise.all([
        base44.entities.Order.list("-created_date", 10).catch(() => []),
        base44.entities.Customer.list("-created_date", 5).catch(() => [])
      ]);

      const orderActivities = (orders || []).map(o => ({
        id: o.id,
        type: "order",
        customer: o.customer_name,
        customerId: o.customer_id,
        description: `Nueva orden ${o.order_number}`,
        device: `${o.device_brand || ''} ${o.device_model || ''}`.trim(),
        timestamp: new Date(o.created_date),
        status: o.status
      }));

      const customerActivities = (customers || []).map(c => ({
        id: c.id,
        type: "customer",
        customer: c.name,
        customerId: c.id,
        description: "Cliente nuevo",
        phone: c.phone,
        timestamp: new Date(c.created_date)
      }));

      const allActivities = [...orderActivities, ...customerActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 6);

      setActivities(allActivities);
      setLoading(false);
    } catch (err) {
      console.error("Error loading activities:", err);
      setError(true);
      setLoading(false);
      setActivities([]);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 shadow-xl">
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 mx-auto border-4 border-red-600 border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-600 opacity-50" />
            <p className="text-gray-400 text-sm">No se pudo cargar la actividad</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-red-600" />
          Actividad Reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-gray-600/50 mb-2" />
            <p className="text-sm text-gray-400">No hay actividad reciente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={`${activity.type}-${activity.id}`}
                onClick={() => {
                  if (activity.type === "order") {
                    navigate(createPageUrl(`Orders?order=${activity.id}`));
                  } else {
                    navigate(createPageUrl("Customers"));
                  }
                }}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                  {activity.type === "order" ? (
                    <Phone className="w-4 h-4 text-red-400" />
                  ) : (
                    <Mail className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {activity.customer}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {activity.description}
                      </p>
                      {activity.device && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {activity.device}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
