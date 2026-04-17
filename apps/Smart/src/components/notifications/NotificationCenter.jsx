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
      const employeeSessionRaw =
        localStorage.getItem("employee_session") ||
        sessionStorage.getItem("911-session");
      if (employeeSessionRaw) {
        const parsed = JSON.parse(employeeSessionRaw);
        if (parsed?.userId || parsed?.id) {
          setUser({
            id: parsed.userId || parsed.id,
            email: parsed.userEmail || parsed.email || ""
          });
          return;
        }
      }
      const currentUser = await dataClient.auth.me();
      setUser(currentUser || null);
    } catch (error) {
      setUser(null);
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
      case "success": return <CheckCircle2 className="w-5 h-5 text-apple-green" />;
      case "warning": return <AlertCircle className="w-5 h-5 text-apple-orange" />;
      case "error": return <AlertCircle className="w-5 h-5 text-apple-red" />;
      default: return <Info className="w-5 h-5 text-apple-blue" />;
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case "success": return "bg-apple-green/12";
      case "warning": return "bg-apple-orange/12";
      case "error": return "bg-apple-red/12";
      default: return "bg-apple-blue/12";
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card className="apple-type apple-card border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="apple-label-primary flex items-center gap-3">
            <div className="w-12 h-12 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
              <Bell className="w-7 h-7 text-apple-blue" />
            </div>
            <div>
              <p className="apple-text-title2">Centro de Notificaciones</p>
              <p className="apple-text-subheadline apple-label-secondary tabular-nums">
                {unreadCount} sin leer
              </p>
            </div>
          </CardTitle>

          {unreadCount > 0 && (
            <Button
              size="sm"
              onClick={handleMarkAllAsRead}
              className="apple-btn apple-btn-primary apple-press"
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
            className={filter === "all" ? "apple-btn apple-btn-primary" : "apple-btn apple-btn-secondary"}
          >
            Todas
          </Button>
          <Button
            size="sm"
            variant={filter === "unread" ? "default" : "outline"}
            onClick={() => setFilter("unread")}
            className={filter === "unread" ? "apple-btn apple-btn-primary" : "apple-btn apple-btn-secondary"}
          >
            Sin leer ({unreadCount})
          </Button>
          <Button
            size="sm"
            variant={filter === "read" ? "default" : "outline"}
            onClick={() => setFilter("read")}
            className={filter === "read" ? "apple-btn apple-btn-primary" : "apple-btn apple-btn-secondary"}
          >
            Leídas
          </Button>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 apple-label-tertiary mx-auto mb-3 animate-spin" />
              <p className="apple-label-secondary apple-text-subheadline">Cargando...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 apple-label-tertiary mx-auto mb-3 opacity-30" />
              <p className="apple-label-secondary apple-text-subheadline">No hay notificaciones</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-apple-md p-4 transition-all ${
                  notification.is_read
                    ? "apple-surface opacity-60"
                    : `${getTypeColor(notification.type)}`
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getTypeIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="apple-label-primary apple-text-subheadline font-semibold mb-1">
                      {notification.title}
                    </p>
                    <p className="apple-label-secondary apple-text-caption1 mb-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary apple-text-caption2 rounded-apple-sm border-0 tabular-nums">
                        {format(new Date(notification.created_date), "dd MMM, HH:mm", { locale: es })}
                      </Badge>

                      {notification.category && (
                        <Badge className="bg-apple-blue/15 text-apple-blue apple-text-caption2 rounded-apple-sm border-0">
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
                        aria-label="Marcar como leído"
                        className="apple-btn apple-btn-plain h-8 w-8 text-apple-green hover:bg-apple-green/12"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(notification.id)}
                      aria-label="Eliminar notificación"
                      className="apple-btn apple-btn-plain h-8 w-8 text-apple-red hover:bg-apple-red/12"
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
