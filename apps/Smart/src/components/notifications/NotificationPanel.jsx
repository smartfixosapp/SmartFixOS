import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
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
      const me = await dataClient.auth.me();
      setUser(me || null);
    } catch (err) {
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
        const notifs = await dataClient.entities.CommunicationQueue.filter({
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
        const anns = await dataClient.entities.Announcement.filter({
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
      await dataClient.entities.CommunicationQueue.update(notification.id, {
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
      
      await dataClient.entities.Announcement.update(announcement.id, {
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
      await dataClient.entities.CommunicationQueue.delete(id);
      loadData();
      toast.success(t('delete'));
    } catch (error) {
      toast.error(t('errorSaving'));
    }
  };

  const getAnnouncementIcon = (type) => {
    switch (type) {
      case "offer": return <Gift className="w-5 h-5 text-apple-green" />;
      case "alert": return <AlertCircle className="w-5 h-5 text-apple-red" />;
      default: return <StickyNote className="w-5 h-5 text-apple-blue" />;
    }
  };

  const getAnnouncementColor = (type) => {
    switch (type) {
      case "offer": return "bg-apple-green/12";
      case "alert": return "bg-apple-red/12";
      default: return "bg-apple-blue/12";
    }
  };

  const unreadCount = notifications.filter(n => n.status === "pending").length +
                      announcements.filter(a => {
                        const myRecipient = a.recipients?.find(r => r.user_id === user?.id);
                        return myRecipient && !myRecipient.read;
                      }).length;

  if (loading) {
    return (
      <Card className="apple-type apple-card border-0">
        <CardContent className="py-8">
          <div className="text-center apple-label-secondary apple-text-subheadline">{t('loading')}</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="apple-type apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-label-primary apple-text-headline flex items-center gap-2">
            <Bell className="w-5 h-5 text-apple-red" />
            {t('notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Bell className="w-12 h-12 mx-auto mb-3 apple-label-tertiary opacity-50" />
            <p className="apple-label-secondary apple-text-subheadline">{t('couldNotLoadNotifications')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="apple-type apple-card border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="apple-label-primary apple-text-headline flex items-center gap-2">
            <Bell className="w-5 h-5 text-apple-red" />
            {t('notifications')}
          </CardTitle>
          {unreadCount > 0 && (
            <Badge className="bg-apple-red text-white rounded-apple-sm border-0 tabular-nums">
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
              className={`p-4 rounded-apple-md transition-all ${
                isRead
                  ? "apple-surface opacity-60"
                  : `${getAnnouncementColor(announcement.type)}`
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-apple-sm apple-surface">
                  {getAnnouncementIcon(announcement.type)}
                </div>
                <div className="flex-1 min-w-0">
                  {announcement.title && (
                    <h4 className="apple-label-primary apple-text-subheadline font-semibold mb-1">{announcement.title}</h4>
                  )}
                  <p className="apple-label-secondary apple-text-subheadline">{announcement.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="apple-text-caption1 apple-label-tertiary">
                      {t('from')}: {announcement.sent_by_name}
                    </p>
                    <span className="apple-label-tertiary">•</span>
                    <p className="apple-text-caption1 apple-label-tertiary tabular-nums">
                      {format(new Date(announcement.sent_at || announcement.created_date), "dd MMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
                {!isRead && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAnnouncementAsRead(announcement)}
                    className="apple-btn apple-btn-plain apple-label-primary"
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
              className={`p-4 rounded-apple-md transition-all ${
                isRead
                  ? "apple-surface opacity-60"
                  : "apple-surface"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="apple-label-primary apple-text-subheadline font-semibold mb-1">{notif.subject}</h4>
                  <div
                    className="apple-label-secondary apple-text-subheadline"
                    dangerouslySetInnerHTML={{ __html: notif.body_html }}
                  />
                  <p className="apple-text-caption1 apple-label-tertiary mt-2 tabular-nums">
                    {format(new Date(notif.created_date), "dd MMM, HH:mm", { locale: es })}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!isRead && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsRead(notif)}
                      className="apple-btn apple-btn-plain apple-label-primary"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteNotification(notif.id)}
                    className="apple-btn apple-btn-plain text-apple-red hover:bg-apple-red/12"
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
            <Bell className="w-12 h-12 mx-auto mb-3 apple-label-tertiary opacity-50" />
            <p className="apple-label-secondary apple-text-subheadline">{t('noNotifications')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
