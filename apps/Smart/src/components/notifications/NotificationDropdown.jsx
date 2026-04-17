import React, { useState, useEffect } from "react";
// 👈 MIGRACIÓN: Usar dataClient unificado
import { dataClient } from "@/components/api/dataClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Trash2, X, CheckCircle2, ExternalLink as ExternalLinkIcon,
  ClipboardList, Package, DollarSign, Clock, AlertCircle,
  Sparkles, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export default function NotificationDropdown({ user, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();

    let interval = null;
    const start = () => { if (!interval) interval = setInterval(loadNotifications, 60000); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const onVis = () => { document.hidden ? stop() : (start(), loadNotifications()); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [user?.id]);

  const loadNotifications = async () => {
    if (!user?.id) return;
    
    try {
      // ✅ SOLO CARGAR NOTIFICACIONES NO LEÍDAS
      // 👈 MIGRACIÓN: Usar dataClient
      const data = await dataClient.entities.Notification.filter(
        { 
          user_id: user.id,
          is_read: false
        },
        "-created_date",
        50
      );
      setNotifications(data || []);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notification) => {
    try {
      // 👈 MIGRACIÓN: Usar dataClient
      await dataClient.entities.Notification.update(notification.id, {
        is_read: true,
        read_at: new Date().toISOString()
      });
      
      // ✅ ELIMINAR DEL ESTADO LOCAL (desaparece de la lista)
      setNotifications(prev => prev.filter(n => n.id !== notification.id));

      // ✅ DISPARAR EVENTO PARA ACTUALIZAR BADGE
      window.dispatchEvent(new Event('notification-read'));

      if (notification.action_url) {
        navigate(notification.action_url);
        onClose?.();
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleDelete = async (notificationId, e) => {
    e.stopPropagation();
    
    try {
      // 👈 MIGRACIÓN: Usar dataClient
      await dataClient.entities.Notification.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // ✅ DISPARAR EVENTO PARA ACTUALIZAR BADGE
      window.dispatchEvent(new Event('notification-read'));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      
      for (const id of unreadIds) {
        // 👈 MIGRACIÓN: Usar dataClient
        await dataClient.entities.Notification.update(id, {
          is_read: true,
          read_at: new Date().toISOString()
        });
      }
      
      // ✅ LIMPIAR TODAS LAS NOTIFICACIONES (todas son no leídas en esta lista)
      setNotifications([]);
      
      // ✅ DISPARAR EVENTO PARA ACTUALIZAR BADGE
      window.dispatchEvent(new Event('notification-read'));
      
      // ✅ CERRAR MODAL AUTOMÁTICAMENTE
      setTimeout(() => {
        onClose?.();
      }, 300);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "new_order": return <ClipboardList className="w-4 h-4" />;
      case "status_change": return <Sparkles className="w-4 h-4" />;
      case "low_stock": return <Package className="w-4 h-4" />;
      case "order_ready": return <CheckCircle2 className="w-4 h-4" />;
      case "payment_received": return <DollarSign className="w-4 h-4" />;
      case "urgent_order": return <AlertCircle className="w-4 h-4" />;
      case "assignment": return <Clock className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent": return "bg-apple-red/12";
      case "high": return "bg-apple-orange/12";
      default: return "apple-surface";
    }
  };

  // unreadCount is no longer needed as `notifications.length` directly represents unread count in this component
  // const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 overflow-hidden">
      {/* Header */}
      <div className="p-4" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
              <Bell className="w-5 h-5 text-apple-blue" />
            </div>
            <div>
              <h3 className="apple-label-primary apple-text-headline">Notificaciones</h3>
              {notifications.length > 0 && (
                <p className="text-apple-blue apple-text-caption1 tabular-nums">
                  {notifications.length} sin leer
                </p>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Cerrar notificaciones"
            className="apple-btn apple-btn-plain apple-label-secondary hover:apple-label-primary"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {notifications.length > 0 && (
          <Button
            size="sm"
            onClick={handleMarkAllAsRead}
            className="apple-btn apple-btn-tinted apple-press w-full"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {/* Lista de notificaciones */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-apple-blue animate-spin mx-auto mb-3" />
            <p className="apple-label-secondary apple-text-subheadline">Cargando notificaciones...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-16 h-16 apple-label-tertiary mx-auto mb-4 opacity-30" />
            <p className="apple-label-secondary apple-text-subheadline">No tienes notificaciones pendientes</p>
            <p className="apple-label-tertiary apple-text-caption1 mt-2">¡Todo al día!</p>
          </div>
        ) : (
          <div className="apple-list">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleMarkAsRead(notification)}
                className={`apple-list-row apple-press p-4 transition-all cursor-pointer ${getPriorityColor(notification.priority)}`}
                style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-apple-sm flex items-center justify-center flex-shrink-0 bg-apple-blue/15 text-apple-blue">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="apple-text-subheadline font-semibold apple-label-primary">
                        {notification.title}
                      </h4>
                      {notification.priority === "urgent" && (
                        <Badge className="bg-apple-red/15 text-apple-red apple-text-caption1 animate-pulse rounded-apple-sm border-0">
                          Urgente
                        </Badge>
                      )}
                    </div>

                    <p className="apple-text-caption1 mb-2 line-clamp-2 apple-label-secondary">
                      {notification.body}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <span className="apple-text-caption1 apple-label-tertiary tabular-nums">
                        {format(new Date(notification.created_date), "dd MMM, HH:mm", { locale: es })}
                      </span>

                      <div className="flex items-center gap-2">
                        {notification.action_label && (
                          <span className="apple-text-caption1 text-apple-blue flex items-center gap-1">
                            {notification.action_label}
                            <ExternalLinkIcon className="w-3 h-3" />
                          </span>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(notification.id, e)}
                          aria-label="Eliminar notificación"
                          className="apple-btn apple-btn-plain h-7 w-7 apple-label-tertiary hover:text-apple-red"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 apple-surface" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <p className="text-center apple-text-caption1 apple-label-secondary tabular-nums">
            {notifications.length} sin leer
          </p>
        </div>
      )}
    </Card>
  );
}
