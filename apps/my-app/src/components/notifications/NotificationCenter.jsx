import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, CheckCircle2, Clock, AlertCircle, Info,
  Trash2, CheckCheck, Filter
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user, filter]);

  const loadUser = async () => {
    try {
      const currentUser = await dataClient.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      let query = { user_id: user.id };
      
      if (filter === "unread") {
        query.is_read = false;
      } else if (filter === "read") {
        query.is_read = true;
      }

      const data = await dataClient.entities.Notification.filter(query, "-created_date", 100);
      setNotifications(data || []);
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast.error("Error cargando notificaciones");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await dataClient.entities.Notification.update(notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });
      loadNotifications();
      window.dispatchEvent(new Event('notification-read'));
    } catch (error) {
      console.error("Error marking as read:", error);
      toast.error("Error al marcar como leída");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(
        unread.map(n => dataClient.entities.Notification.update(n.id, {
          is_read: true,
          read_at: new Date().toISOString()
        }))
      );
      toast.success("Todas marcadas como leídas");
      loadNotifications();
      window.dispatchEvent(new Event('notification-read'));
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await dataClient.entities.Notification.delete(notificationId);
      toast.success("Notificación eliminada");
      loadNotifications();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar");
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case "success": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "warning": return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case "error": return <AlertCircle className="w-5 h-5 text-red-400" />;
      default: return <Info className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case "success": return "bg-emerald-600/20 border-emerald-500/30 theme-light:bg-emerald-50";
      case "warning": return "bg-amber-600/20 border-amber-500/30 theme-light:bg-amber-50";
      case "error": return "bg-red-600/20 border-red-500/30 theme-light:bg-red-50";
      default: return "bg-cyan-600/20 border-cyan-500/30 theme-light:bg-cyan-50";
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 theme-light:bg-white theme-light:border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-3 theme-light:text-gray-900">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <Bell className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">Centro de Notificaciones</p>
              <p className="text-sm text-cyan-200 font-normal theme-light:text-gray-600">
                {unreadCount} sin leer
              </p>
            </div>
          </CardTitle>

          {unreadCount > 0 && (
            <Button
              size="sm"
              onClick={handleMarkAllAsRead}
              className="bg-gradient-to-r from-emerald-600 to-green-600"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Marcar todas
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-white/15"}
          >
            Todas
          </Button>
          <Button
            size="sm"
            variant={filter === "unread" ? "default" : "outline"}
            onClick={() => setFilter("unread")}
            className={filter === "unread" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-white/15"}
          >
            Sin leer ({unreadCount})
          </Button>
          <Button
            size="sm"
            variant={filter === "read" ? "default" : "outline"}
            onClick={() => setFilter("read")}
            className={filter === "read" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-white/15"}
          >
            Leídas
          </Button>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3 animate-spin" />
              <p className="text-gray-400">Cargando...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-600 mx-auto mb-3 opacity-30" />
              <p className="text-gray-400">No hay notificaciones</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`border rounded-xl p-4 transition-all ${
                  notification.is_read
                    ? "bg-black/20 border-white/10 opacity-60 theme-light:bg-gray-50 theme-light:border-gray-200"
                    : `${getTypeColor(notification.type)} border`
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getTypeIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm mb-1 theme-light:text-gray-900">
                      {notification.title}
                    </p>
                    <p className="text-gray-400 text-xs mb-2 theme-light:text-gray-600">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-white/10 text-gray-300 text-[10px] theme-light:bg-gray-200 theme-light:text-gray-700">
                        {format(new Date(notification.created_date), "dd MMM, HH:mm", { locale: es })}
                      </Badge>
                      
                      {notification.category && (
                        <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 text-[10px] theme-light:bg-cyan-100 theme-light:text-cyan-700">
                          {notification.category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!notification.is_read && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="h-8 w-8 text-emerald-400 hover:bg-emerald-600/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(notification.id)}
                      className="h-8 w-8 text-red-400 hover:bg-red-600/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
