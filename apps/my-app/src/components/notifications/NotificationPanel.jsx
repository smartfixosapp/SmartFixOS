import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2, StickyNote, Gift, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useI18n } from "@/components/utils/i18n";

export default function NotificationPanel() {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
      const interval = setInterval(loadData, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
    } catch (err) {
      console.error("Error loading user:", err);
      setError(true);
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!user) return;
    
    try {
      setError(false);
      
      // Cargar notificaciones
      try {
        const notifs = await base44.entities.CommunicationQueue.filter({
          user_id: user.id,
          type: "in_app"
        }, "-created_date", 20);
        setNotifications(notifs || []);
      } catch (err) {
        console.warn("No se pudieron cargar notificaciones:", err);
        setNotifications([]);
      }
      
      // Cargar anuncios
      try {
        const anns = await base44.entities.Announcement.filter({
          active: true
        }, "-sent_at", 10);
        
        const forMe = (anns || []).filter(a => {
          if (a.sent_to === "all") return true;
          if (a.sent_to === "specific") {
            return a.recipients?.some(r => r.user_id === user.id);
          }
          return false;
        });
        
        setAnnouncements(forMe);
      } catch (err) {
        console.warn("No se pudieron cargar anuncios:", err);
        setAnnouncements([]);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error general:", err);
      setError(true);
      setLoading(false);
    }
  };

  const markAsRead = async (notification) => {
    try {
      await base44.entities.CommunicationQueue.update(notification.id, {
        status: "read",
        read_at: new Date().toISOString()
      });
      loadData();
      toast.success(t('markAsRead'));
    } catch (error) {
      toast.error(t('errorSaving'));
    }
  };

  const markAnnouncementAsRead = async (announcement) => {
    try {
      const recipients = announcement.recipients || [];
      const updated = recipients.map(r => 
        r.user_id === user.id 
          ? { ...r, read: true, read_at: new Date().toISOString() }
          : r
      );
      
      await base44.entities.Announcement.update(announcement.id, {
        recipients: updated
      });
      
      loadData();
      toast.success(t('markAsRead'));
    } catch (error) {
      toast.error(t('errorSaving'));
    }
  };

  const deleteNotification = async (id) => {
    try {
      await base44.entities.CommunicationQueue.delete(id);
      loadData();
      toast.success(t('delete'));
    } catch (error) {
      toast.error(t('errorSaving'));
    }
  };

  const getAnnouncementIcon = (type) => {
    switch (type) {
      case "offer": return <Gift className="w-5 h-5 text-green-400" />;
      case "alert": return <AlertCircle className="w-5 h-5 text-red-400" />;
      default: return <StickyNote className="w-5 h-5 text-blue-400" />;
    }
  };

  const getAnnouncementColor = (type) => {
    switch (type) {
      case "offer": return "from-green-600/20 to-green-800/20 border-green-500/30";
      case "alert": return "from-red-600/20 to-red-800/20 border-red-500/30";
      default: return "from-blue-600/20 to-blue-800/20 border-blue-500/30";
    }
  };

  const unreadCount = notifications.filter(n => n.status === "pending").length +
                      announcements.filter(a => {
                        const myRecipient = a.recipients?.find(r => r.user_id === user?.id);
                        return myRecipient && !myRecipient.read;
                      }).length;

  if (loading) {
    return (
      <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <CardContent className="py-8">
          <div className="text-center text-gray-400">{t('loading')}</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-red-500" />
            {t('notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-600 opacity-50" />
            <p className="text-gray-400 text-sm">{t('couldNotLoadNotifications')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-red-500" />
            {t('notifications')}
          </CardTitle>
          {unreadCount > 0 && (
            <Badge className="bg-red-600 text-white">
              {unreadCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {announcements.map(announcement => {
          const myRecipient = announcement.recipients?.find(r => r.user_id === user?.id);
          const isRead = myRecipient?.read || false;
          
          return (
            <div
              key={announcement.id}
              className={`p-4 rounded-xl border backdrop-blur-sm transition-all ${
                isRead
                  ? "bg-black/20 border-white/10 opacity-60"
                  : `bg-gradient-to-br ${getAnnouncementColor(announcement.type)} border`
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-black/30">
                  {getAnnouncementIcon(announcement.type)}
                </div>
                <div className="flex-1 min-w-0">
                  {announcement.title && (
                    <h4 className="text-white font-bold mb-1">{announcement.title}</h4>
                  )}
                  <p className="text-gray-300 text-sm">{announcement.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs text-gray-400">
                      {t('from')}: {announcement.sent_by_name}
                    </p>
                    <span className="text-gray-600">•</span>
                    <p className="text-xs text-gray-400">
                      {format(new Date(announcement.sent_at || announcement.created_date), "dd MMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
                {!isRead && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAnnouncementAsRead(announcement)}
                    className="border-white/15 text-white hover:bg-white/10"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {notifications.map(notif => {
          const isRead = notif.status === "read";
          
          return (
            <div
              key={notif.id}
              className={`p-4 rounded-xl border backdrop-blur-sm transition-all ${
                isRead
                  ? "bg-black/20 border-white/10 opacity-60"
                  : "bg-black/30 border-white/15"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold mb-1">{notif.subject}</h4>
                  <div 
                    className="text-gray-300 text-sm"
                    dangerouslySetInnerHTML={{ __html: notif.body_html }}
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    {format(new Date(notif.created_date), "dd MMM, HH:mm", { locale: es })}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!isRead && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsRead(notif)}
                      className="border-white/15 text-white hover:bg-white/10"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteNotification(notif.id)}
                    className="border-red-600/50 text-red-400 hover:bg-red-600/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {notifications.length === 0 && announcements.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-600 opacity-50" />
            <p className="text-gray-400">{t('noNotifications')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
