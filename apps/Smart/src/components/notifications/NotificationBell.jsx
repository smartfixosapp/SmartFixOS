import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check, X, ExternalLink, Sunrise, Sunset, CheckCircle2, AlertCircle, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import NotificationService from "./NotificationService";

// ── Session start tracker ───────────────────────────────────────────────────
const SESSION_START_KEY = "smartfix_session_start";
const getOrSetSessionStart = () => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_START_KEY) || "null");
    if (stored?.date === today) return stored.time;
  } catch (_) {}
  const now = new Date().toISOString();
  localStorage.setItem(SESSION_START_KEY, JSON.stringify({ date: today, time: now }));
  return now;
};

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks"); // "tasks" | "notifications"
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      loadShiftTasks();

      const interval = setInterval(() => {
        loadNotifications();
        loadShiftTasks();
      }, 30000);

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

  // Auto-switch to tasks tab when there are pending tasks
  useEffect(() => {
    if (isOpen && pendingTasks.length === 0) setActiveTab("notifications");
    if (isOpen && pendingTasks.length > 0) setActiveTab("tasks");
  }, [isOpen]);

  const loadShiftTasks = async () => {
    if (!user?.id) return;
    try {
      const today = new Date().toISOString().slice(0, 10);

      // 1. Load all active tasks that apply to this user
      const allTasks = await base44.entities.ShiftTask.filter({ active: true }, "sort_order", 200);
      const userRole = user.role || "";
      const myTasks = (allTasks || []).filter(t =>
        !t.assigned_to_employee_id && !t.assigned_to_role // todos
        || t.assigned_to_employee_id === user.id          // específico
        || t.assigned_to_role === userRole                // por rol
      );

      // 2. Load today's completions for this user
      const logs = await base44.entities.ShiftTaskLog.filter(
        { employee_id: user.id, shift_date: today },
        "-completed_at",
        100
      );
      const completedIds = new Set((logs || []).map(l => l.task_id));

      // 3. Pending = tasks without a completion log today
      const pending = myTasks.filter(t => !completedIds.has(t.id));
      setPendingTasks(pending);
    } catch (e) {
      console.error("[NotificationBell] Error loading shift tasks:", e);
    }
  };

  const handleCompleteTask = async (task) => {
    if (completingTaskId) return;
    setCompletingTaskId(task.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      const sessionStart = getOrSetSessionStart();
      await base44.entities.ShiftTaskLog.create({
        task_id: task.id,
        task_title: task.title,
        task_type: task.type,
        employee_id: user.id,
        employee_name: user.full_name || user.name || "",
        shift_date: today,
        session_started_at: sessionStart,
        completed_at: now,
      });
      setPendingTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (e) {
      console.error("[NotificationBell] Error completing task:", e);
    } finally {
      setCompletingTaskId(null);
    }
  };

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

  const urgentPendingCount = pendingTasks.filter(t => t.priority === "urgent").length;
  const totalBadge = unreadCount + urgentPendingCount;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-white/10 transition-all theme-light:hover:bg-gray-100"
        style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
      >
        <Bell className="w-5 h-5 text-white/80 theme-light:text-gray-700" />
        {totalBadge > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0F0F12] border border-white/10 rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.5)] overflow-hidden z-[200] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-xl">

          {/* Tabs */}
          <div className="flex border-b border-white/10 theme-light:border-gray-200">
            <button
              onClick={() => setActiveTab("tasks")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === "tasks"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Tareas
              {pendingTasks.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  activeTab === "tasks" ? "bg-amber-400/20 text-amber-400" : "bg-white/10 text-white/40"
                }`}>{pendingTasks.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === "notifications"
                  ? "border-red-400 text-red-400"
                  : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Alertas
              {unreadCount > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  activeTab === "notifications" ? "bg-red-400/20 text-red-400" : "bg-white/10 text-white/40"
                }`}>{unreadCount}</span>
              )}
            </button>
          </div>

          {/* ── TAREAS TAB ── */}
          {activeTab === "tasks" && (
            <div className="max-h-[60vh] overflow-y-auto">
              {pendingTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/30" />
                  <p className="text-gray-400 text-sm">¡Sin tareas pendientes!</p>
                  <p className="text-gray-600 text-xs mt-1">Todas las tareas del turno están completas.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {pendingTasks.map(task => {
                    const isCompleting = completingTaskId === task.id;
                    const isOpening = task.type === "opening";
                    return (
                      <div key={task.id} className={`p-4 flex items-start gap-3 ${
                        task.priority === "urgent" ? "bg-red-500/5" : "bg-black/10"
                      }`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isOpening ? "bg-amber-500/10 border border-amber-500/20" : "bg-indigo-500/10 border border-indigo-500/20"
                        }`}>
                          {isOpening
                            ? <Sunrise className="w-3.5 h-3.5 text-amber-400" />
                            : <Sunset className="w-3.5 h-3.5 text-indigo-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-bold text-white truncate">{task.title}</p>
                            {task.priority === "urgent" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" /> Urgente
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                          <p className="text-[10px] text-white/25 mt-1">
                            {isOpening ? "Apertura" : "Cierre"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCompleteTask(task)}
                          disabled={isCompleting}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                            isCompleting
                              ? "bg-emerald-500/20 border-emerald-500/30 animate-pulse"
                              : "bg-white/5 border-white/15 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-400"
                          } text-white/30`}
                          title="Marcar como completada"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── NOTIFICACIONES TAB ── */}
          {activeTab === "notifications" && (
            <>
              {/* Header notificaciones */}
              {unreadCount > 0 && (
                <div className="px-4 py-2 flex items-center justify-end border-b border-white/[0.05]">
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
                </div>
              )}
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
              {notifications.length > 0 && (
                <div className="p-3 border-t border-white/10 theme-light:border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/15 text-white hover:bg-white/10 text-xs theme-light:border-gray-300 theme-light:text-gray-700 theme-light:hover:bg-gray-50"
                    onClick={() => setIsOpen(false)}
                  >
                    Ver todas
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
