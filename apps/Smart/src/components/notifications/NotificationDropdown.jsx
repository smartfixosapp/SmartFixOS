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
    
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
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
      case "urgent": return "border-red-500/50 bg-red-600/10";
      case "high": return "border-orange-500/50 bg-orange-600/10";
      default: return "border-white/10 bg-black/20";
    }
  };

  // unreadCount is no longer needed as `notifications.length` directly represents unread count in this component
  // const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card className="bg-black/95 backdrop-blur-xl border-2 border-cyan-500/30 shadow-[0_24px_80px_rgba(0,168,232,0.4)] theme-light:bg-white theme-light:border-gray-300">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/20 theme-light:border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg theme-light:text-gray-900">Notificaciones</h3>
              {notifications.length > 0 && (
                <p className="text-cyan-300 text-xs theme-light:text-cyan-700">
                  {notifications.length} sin leer
                </p>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-gray-400 hover:text-white theme-light:text-gray-600 theme-light:hover:text-gray-900"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {notifications.length > 0 && (
          <Button
            size="sm"
            onClick={handleMarkAllAsRead}
            className="w-full bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 theme-light:bg-cyan-100 theme-light:border-cyan-300 theme-light:text-cyan-700 theme-light:hover:bg-cyan-200"
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
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm theme-light:text-gray-600">Cargando notificaciones...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-30" />
            <p className="text-gray-400 text-sm theme-light:text-gray-600">No tienes notificaciones pendientes</p>
            <p className="text-gray-500 text-xs mt-2 theme-light:text-gray-500">¡Todo al día! ✨</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10 theme-light:divide-gray-200">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleMarkAsRead(notification)}
                // All notifications in this list are guaranteed to be unread, so apply unread styling directly
                className={`p-4 transition-all cursor-pointer border-l-4 border-l-cyan-500 bg-cyan-600/5 hover:bg-cyan-600/10 theme-light:border-l-cyan-600 theme-light:bg-cyan-50 theme-light:hover:bg-cyan-100 ${getPriorityColor(notification.priority)}`}
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-cyan-500 to-emerald-500 text-white shadow-lg theme-light:bg-cyan-100 theme-light:text-cyan-700">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-sm text-white theme-light:text-gray-900">
                        {notification.title}
                      </h4>
                      {notification.priority === "urgent" && (
                        <Badge className="bg-red-600/30 text-red-300 border-red-600/50 text-xs animate-pulse theme-light:bg-red-100 theme-light:text-red-700 theme-light:border-red-300">
                          Urgente
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs mb-2 line-clamp-2 text-gray-200 theme-light:text-gray-700">
                      {notification.body}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 theme-light:text-gray-600">
                        {format(new Date(notification.created_date), "dd MMM, HH:mm", { locale: es })}
                      </span>

                      <div className="flex items-center gap-2">
                        {notification.action_label && (
                          <span className="text-xs text-cyan-400 flex items-center gap-1 theme-light:text-cyan-600">
                            {notification.action_label}
                            <ExternalLinkIcon className="w-3 h-3" />
                          </span>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(notification.id, e)}
                          className="h-7 w-7 text-gray-500 hover:text-red-400 theme-light:hover:text-red-600"
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
        <div className="p-3 border-t border-cyan-500/20 bg-black/40 theme-light:border-gray-200 theme-light:bg-gray-50">
          <p className="text-center text-xs text-gray-400 theme-light:text-gray-600">
            {notifications.length} sin leer
          </p>
        </div>
      )}
    </Card>
  );
}
