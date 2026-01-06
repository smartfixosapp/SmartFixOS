import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import NotificationService from "./NotificationService";

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      
      const interval = setInterval(loadNotifications, 30000); // Poll every 30s
      
      // Listen to custom events
      const handleNew = () => loadNotifications();
      const handleRead = () => loadNotifications();
      
      window.addEventListener("new-notification", handleNew);
      window.addEventListener("notification-read", handleRead);
      window.addEventListener("all-notifications-read", handleRead);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener("new-notification", handleNew);
        window.removeEventListener("notification-read", handleRead);
        window.removeEventListener("all-notifications-read", handleRead);
      };
    }
  }, [user?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    try {
      const allNotifications = await base44.entities.Notification.filter(
        { user_id: user.id },
        "-created_date",
        50
      );
      
      setNotifications(allNotifications || []);
      setUnreadCount((allNotifications || []).filter(n => !n.is_read).length);
    } catch (error) {
      console.error("[NotificationBell] Error loading:", error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await NotificationService.markAsRead(notification.id);
    }

    // Navigate to action URL
    if (notification.action_url) {
      setIsOpen(false);
      
      // Handle internal navigation
      if (notification.action_url.startsWith("/") || notification.action_url.startsWith("?")) {
        navigate(notification.action_url);
      } else {
        window.location.href = notification.action_url;
      }
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    await NotificationService.markAllAsRead(user.id);
    setLoading(false);
  };

  const handleDelete = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await base44.entities.Notification.delete(notificationId);
      loadNotifications();
    } catch (error) {
      console.error("[NotificationBell] Error deleting:", error);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      new_order: "📋",
      status_change: "🔄",
      low_stock: "📦",
      order_ready: "✅",
      payment_received: "💰",
      urgent_order: "🚨",
      assignment: "👤"
    };
    return icons[type] || "🔔";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "text-gray-400 theme-light:text-gray-600",
      normal: "text-blue-400 theme-light:text-blue-600",
      high: "text-amber-400 theme-light:text-amber-600",
      urgent: "text-red-400 theme-light:text-red-600"
    };
    return colors[priority] || colors.normal;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-white/10 transition-all theme-light:hover:bg-gray-100"
        style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
      >
        <Bell className="w-5 h-5 text-white/80 theme-light:text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0F0F12] border border-white/10 rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.5)] overflow-hidden z-[200] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-xl">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between theme-light:border-gray-200">
            <h3 className="text-white font-bold flex items-center gap-2 theme-light:text-gray-900">
              <Bell className="w-5 h-5 text-red-500" />
              Notificaciones
              {unreadCount > 0 && (
                <Badge className="bg-red-600/20 text-red-300 border-red-600/30 theme-light:bg-red-100 theme-light:text-red-700 theme-light:border-red-300">
                  {unreadCount}
                </Badge>
              )}
            </h3>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-gray-400 hover:text-white theme-light:text-gray-600 theme-light:hover:text-gray-900"
              >
                <Check className="w-3 h-3 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-600 opacity-30" />
                <p className="text-gray-400 text-sm theme-light:text-gray-600">No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10 theme-light:divide-gray-200">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 cursor-pointer transition-all ${
                      notif.is_read
                        ? "bg-black/20 hover:bg-black/30 theme-light:bg-gray-50 theme-light:hover:bg-gray-100"
                        : "bg-red-600/10 hover:bg-red-600/20 theme-light:bg-red-50 theme-light:hover:bg-red-100"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notif.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`font-semibold text-sm truncate ${
                            notif.is_read 
                              ? "text-gray-300 theme-light:text-gray-700" 
                              : "text-white theme-light:text-gray-900"
                          }`}>
                            {notif.title}
                          </p>
                          <button
                            onClick={(e) => handleDelete(notif.id, e)}
                            className="text-gray-400 hover:text-red-400 flex-shrink-0 theme-light:text-gray-500 theme-light:hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mb-2 line-clamp-2 theme-light:text-gray-600">
                          {notif.body}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-gray-500 theme-light:text-gray-500">
                            {notif.created_date && format(new Date(notif.created_date), "dd MMM, HH:mm", { locale: es })}
                          </span>
                          {notif.action_label && (
                            <span className={`text-[10px] font-medium ${getPriorityColor(notif.priority)}`}>
                              {notif.action_label} →
                            </span>
                          )}
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
            <div className="p-3 border-t border-white/10 theme-light:border-gray-200">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-white/15 text-white hover:bg-white/10 text-xs theme-light:border-gray-300 theme-light:text-gray-700 theme-light:hover:bg-gray-50"
                onClick={() => {
                  setIsOpen(false);
                  // Could navigate to a full notifications page if you create one
                }}
              >
                Ver todas
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
