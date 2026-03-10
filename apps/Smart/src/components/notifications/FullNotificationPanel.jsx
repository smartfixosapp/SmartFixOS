import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, CheckCircle2, Clock, AlertCircle, Info, Trash2, CheckCheck,
  DollarSign, ClipboardList, Package, Users, StickyNote, Gift, X, TrendingDown
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useI18n } from "@/components/utils/i18n";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

export default function FullNotificationPanel({ user, onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.userId && !user?.id) return;
    
    setLoading(true);
    try {
      const userId = user.userId || user.id;
      
      // Cargar notificaciones del sistema (últimos 7 días)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const notifs = await base44.entities.Notification.filter({
        user_id: userId
      }, "-created_date", 50);
      
      const recentNotifs = (notifs || []).filter(n => 
        new Date(n.created_date) >= sevenDaysAgo
      );
      
      setNotifications(recentNotifs);

      // No cargar anuncios (feature deshabilitado)
      setAnnouncements([]);

      // Cargar productos con stock bajo
      const products = await base44.entities.Product.list("-created_date", 100);
      const filtered = (products || [])
        .filter(p => p.type !== "service")
        .filter(p => {
          const stock = Number(p.stock || 0);
          const minStock = Number(p.min_stock || 5);
          return stock <= minStock;
        })
        .sort((a, b) => {
          const aStock = Number(a.stock || 0);
          const bStock = Number(b.stock || 0);
          return aStock - bStock;
        })
        .slice(0, 10);

      setLowStockItems(filtered);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await base44.entities.Notification.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      window.dispatchEvent(new Event('notification-read'));
      toast.success("Notificación eliminada");
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Borrar todas las notificaciones del sistema
      await Promise.all(
        notifications.map(n => base44.entities.Notification.delete(n.id))
      );
      
      // Limpiar todo inmediatamente
      setNotifications([]);
      setLowStockItems([]);
      
      // Disparar evento para actualizar contador
      window.dispatchEvent(new Event('notification-read'));
      
      toast.success("Todas las notificaciones eliminadas");
    } catch (error) {
      console.error("Error eliminando notificaciones:", error);
      toast.error("Error al eliminar notificaciones");
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await base44.entities.Notification.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      window.dispatchEvent(new Event('notification-read'));
      toast.success("Notificación eliminada");
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleNotificationAction = async (notification, action) => {
    try {
      switch (action.action_type) {
        case "navigate":
          if (action.action_data?.page) {
            navigate(createPageUrl(action.action_data.page));
            if (action.action_data.order_id) {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-order-panel', {
                  detail: { orderId: action.action_data.order_id }
                }));
              }, 500);
            }
          }
          break;
        
        case "dismiss":
          await handleDelete(notification.id);
          break;
        
        case "update_entity":
          if (action.action_data?.entity_type && action.action_data?.entity_id) {
            const entityClient = base44.entities[action.action_data.entity_type];
            if (entityClient) {
              await entityClient.update(
                action.action_data.entity_id,
                action.action_data.updates || {}
              );
              toast.success("Actualizado correctamente");
            }
          }
          break;
        
        default:
          console.warn("Unknown action type:", action.action_type);
      }
      
      if (!notification.is_read) {
        await handleMarkAsRead(notification.id);
      }
      
      onClose();
    } catch (error) {
      console.error("Error handling notification action:", error);
      toast.error("Error al ejecutar acción");
    }
  };



  const getCategoryIcon = (category) => {
    switch(category) {
      case "payment": return <DollarSign className="w-5 h-5 text-emerald-400" />;
      case "order": return <ClipboardList className="w-5 h-5 text-blue-400" />;
      case "inventory": return <Package className="w-5 h-5 text-purple-400" />;
      case "system": return <Info className="w-5 h-5 text-cyan-400" />;
      default: return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const getCategoryColor = (category) => {
    switch(category) {
      case "payment": return "bg-emerald-600/20 border-emerald-500/30";
      case "order": return "bg-blue-600/20 border-blue-500/30";
      case "inventory": return "bg-purple-600/20 border-purple-500/30";
      case "system": return "bg-cyan-600/20 border-cyan-500/30";
      default: return "bg-gray-600/20 border-gray-500/30";
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

  const groupedNotifications = {
    payment: notifications.filter(n => n.category === "payment"),
    order: notifications.filter(n => n.category === "order"),
    inventory: notifications.filter(n => n.category === "inventory"),
    system: notifications.filter(n => n.category === "system"),
    other: notifications.filter(n => !n.category || !["payment", "order", "inventory", "system"].includes(n.category))
  };

  const unreadCount = notifications.filter(n => !n.is_read).length + lowStockItems.length;

  const getStockStatus = (item) => {
    const stock = Number(item.stock || 0);
    if (stock === 0) {
      return { label: t('outOfStock'), color: "bg-red-600/20 text-red-300 border-red-600/30" };
    }
    return { label: t('lowStock'), color: "bg-amber-600/20 text-amber-300 border-amber-600/30" };
  };

  return (
    <Card className="bg-gradient-to-br from-black/90 to-slate-900/90 backdrop-blur-xl border border-amber-500/30 shadow-[0_24px_80px_rgba(251,146,60,0.7)] max-h-[calc(100vh-120px)] sm:max-h-[85vh] overflow-hidden flex flex-col">
      <CardHeader className="border-b border-amber-500/20 flex-shrink-0 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Bell className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">Avisos</p>
              <p className="text-sm text-amber-200 font-normal">
                {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
              </p>
            </div>
          </CardTitle>

          <div className="flex gap-2">
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
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="bg-black/60 border-b border-amber-500/20 p-2 flex-shrink-0 overflow-x-auto">
          <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600">
            Todas ({notifications.length + lowStockItems.length})
          </TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-green-600">
            💰 Pagos ({groupedNotifications.payment.length})
          </TabsTrigger>
          <TabsTrigger value="order" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600">
            📋 Órdenes ({groupedNotifications.order.length})
          </TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-yellow-600">
            📦 Inventario ({lowStockItems.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="all" className="space-y-3 mt-0">
            {loading ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3 animate-spin" />
                <p className="text-gray-400">Cargando...</p>
              </div>
            ) : (
              <>
                {/* Notificaciones del sistema */}
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`border rounded-xl p-4 transition-all ${
                      notification.is_read
                        ? "bg-black/20 border-white/10 opacity-60"
                        : `${getCategoryColor(notification.category)} border`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getCategoryIcon(notification.category)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm mb-1">
                          {notification.title}
                        </p>
                        <p className="text-gray-400 text-xs mb-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-white/10 text-gray-300 text-[10px]">
                            {format(new Date(notification.created_date), "dd MMM, HH:mm", { locale: es })}
                          </Badge>
                          
                          {notification.category && (
                            <Badge className={`${getCategoryColor(notification.category)} text-[10px]`}>
                              {notification.category}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {notification.actions && notification.actions.length > 0 ? (
                          <div className="flex gap-2">
                            {notification.actions.map((action, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleNotificationAction(notification, action)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                                  action.style === 'primary' 
                                    ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 hover:brightness-110 text-white'
                                    : action.style === 'danger'
                                    ? 'bg-red-600 hover:bg-red-500 text-white'
                                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                                }`}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : (
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
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Alertas de inventario */}
                {lowStockItems.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <div
                      key={`inventory-${item.id}`}
                      className={`border rounded-xl p-4 transition-all ${status.color} border`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center flex-shrink-0">
                          <TrendingDown className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm mb-1">{item.name}</p>
                          <p className="text-gray-400 text-xs mb-2">
                            {t('stock')}: <span className="font-semibold">{item.stock || 0}</span>
                            {item.min_stock && ` / ${t('minStock')}: ${item.min_stock}`}
                          </p>
                          <Badge className={`${status.color} text-xs`}>
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {notifications.length === 0 && lowStockItems.length === 0 && (
                  <div className="text-center py-12">
                    <Bell className="w-16 h-16 text-gray-600 mx-auto mb-3 opacity-30" />
                    <p className="text-gray-400">No hay notificaciones</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="payment" className="space-y-3 mt-0">
            {groupedNotifications.payment.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-3 opacity-30" />
                <p className="text-gray-400">No hay notificaciones de pagos</p>
              </div>
            ) : (
              groupedNotifications.payment.map(notification => (
                <div
                  key={notification.id}
                  className={`border rounded-xl p-4 transition-all ${
                    notification.is_read
                      ? "bg-black/20 border-white/10 opacity-60"
                      : "bg-emerald-600/20 border-emerald-500/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-emerald-400 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm mb-1">{notification.title}</p>
                      <p className="text-gray-400 text-xs mb-2">{notification.message}</p>
                      <Badge className="bg-white/10 text-gray-300 text-[10px]">
                        {format(new Date(notification.created_date), "dd MMM, HH:mm", { locale: es })}
                      </Badge>
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
          </TabsContent>

          <TabsContent value="order" className="space-y-3 mt-0">
            {groupedNotifications.order.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-gray-600 mx-auto mb-3 opacity-30" />
                <p className="text-gray-400">No hay notificaciones de órdenes</p>
              </div>
            ) : (
              groupedNotifications.order.map(notification => (
                <div
                  key={notification.id}
                  className={`border rounded-xl p-4 transition-all ${
                    notification.is_read
                      ? "bg-black/20 border-white/10 opacity-60"
                      : "bg-blue-600/20 border-blue-500/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ClipboardList className="w-5 h-5 text-blue-400 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm mb-1">{notification.title}</p>
                      <p className="text-gray-400 text-xs mb-2">{notification.message}</p>
                      <Badge className="bg-white/10 text-gray-300 text-[10px]">
                        {format(new Date(notification.created_date), "dd MMM, HH:mm", { locale: es })}
                      </Badge>
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
          </TabsContent>

          <TabsContent value="inventory" className="space-y-3 mt-0">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-600 mx-auto mb-3 opacity-30" />
                <p className="text-gray-400">No hay alertas de inventario</p>
              </div>
            ) : (
              lowStockItems.map((item) => {
                const status = getStockStatus(item);
                return (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-4 transition-all ${status.color} border`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm mb-1">{item.name}</p>
                        <p className="text-gray-400 text-xs mb-2">
                          {t('stock')}: <span className="font-semibold">{item.stock || 0}</span>
                          {item.min_stock && ` / ${t('minStock')}: ${item.min_stock}`}
                        </p>
                        <Badge className={`${status.color} text-xs`}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>


        </div>
      </Tabs>
    </Card>
  );
}
