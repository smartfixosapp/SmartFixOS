import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, TrendingUp, X, Settings } from "lucide-react";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import NotificationService from "../notifications/NotificationService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AlertasWidget() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [thresholdConfig, setThresholdConfig] = useState({
    monthly_expense_threshold: 5000,
    days_before_due: 7
  });

  useEffect(() => {
    loadAlerts();
    loadSettings();
    
    const interval = setInterval(loadAlerts, 300000); // Cada 5 minutos
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const configs = await base44.entities.SystemConfig.filter({ key: "financial_alerts_config" });
      if (configs?.length > 0) {
        const saved = JSON.parse(configs[0].value || "{}");
        setThresholdConfig({
          monthly_expense_threshold: saved.monthly_expense_threshold || 5000,
          days_before_due: saved.days_before_due || 7
        });
      }
    } catch (error) {
      console.error("Error loading alert settings:", error);
    }
  };

  const saveSettings = async () => {
    try {
      const configs = await base44.entities.SystemConfig.filter({ key: "financial_alerts_config" });
      
      if (configs?.length > 0) {
        await base44.entities.SystemConfig.update(configs[0].id, {
          value: JSON.stringify(thresholdConfig)
        });
      } else {
        await base44.entities.SystemConfig.create({
          key: "financial_alerts_config",
          value: JSON.stringify(thresholdConfig),
          category: "financial"
        });
      }
      
      toast.success("✅ Configuración guardada");
      setShowSettings(false);
      loadAlerts();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error al guardar configuración");
    }
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const [fixedExpenses, transactions] = await Promise.all([
        base44.entities.FixedExpense.filter({ active: true }),
        base44.entities.Transaction.list("-created_date", 500)
      ]);

      const newAlerts = [];
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // ✅ ALERTA 1: Gastos fijos próximos a vencer
      fixedExpenses.forEach(expense => {
        if (expense.frequency === 'monthly' && expense.due_day) {
          const dueDate = new Date(currentYear, currentMonth, expense.due_day);
          const daysUntilDue = differenceInDays(dueDate, today);

          if (daysUntilDue >= 0 && daysUntilDue <= thresholdConfig.days_before_due) {
            newAlerts.push({
              id: `due-${expense.id}`,
              type: "due_soon",
              severity: daysUntilDue <= 2 ? "urgent" : "warning",
              title: `${expense.name} vence pronto`,
              message: `Vence en ${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''} (${format(dueDate, "dd MMM", { locale: es })})`,
              amount: expense.amount,
              expense: expense
            });
          }
        }
      });

      // ✅ ALERTA 2: Gastos mensuales superan umbral
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      const monthExpenses = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const txDate = new Date(t.created_date);
        return txDate >= monthStart && txDate <= monthEnd;
      });

      const totalMonthExpenses = monthExpenses.reduce((sum, t) => sum + (t.amount || 0), 0);

      if (totalMonthExpenses > thresholdConfig.monthly_expense_threshold) {
        newAlerts.push({
          id: "monthly-threshold",
          type: "threshold_exceeded",
          severity: "warning",
          title: "Gastos mensuales elevados",
          message: `Los gastos de ${format(today, "MMMM", { locale: es })} superan $${thresholdConfig.monthly_expense_threshold.toFixed(2)}`,
          amount: totalMonthExpenses
        });
      }

      setAlerts(newAlerts);

      // ✅ Enviar notificaciones automáticas
      if (newAlerts.length > 0) {
        await sendNotifications(newAlerts);
      }

    } catch (error) {
      console.error("Error loading alerts:", error);
    }
    setLoading(false);
  };

  const sendNotifications = async (alertsList) => {
    try {
      const user = await base44.auth.me();
      if (!user) return;

      // Verificar qué alertas ya fueron notificadas hoy
      const notifiedToday = JSON.parse(localStorage.getItem("alerts_notified_today") || "[]");
      const today = format(new Date(), "yyyy-MM-dd");

      for (const alert of alertsList) {
        const notifKey = `${today}-${alert.id}`;
        
        if (!notifiedToday.includes(notifKey)) {
          await NotificationService.createNotification({
            userId: user.id,
            userEmail: user.email,
            type: "financial_alert",
            title: alert.title,
            body: alert.message,
            priority: alert.severity === "urgent" ? "high" : "normal",
            actionUrl: "/Financial",
            actionLabel: "Ver Finanzas",
            metadata: {
              alert_type: alert.type,
              amount: alert.amount
            }
          });

          notifiedToday.push(notifKey);
        }
      }

      localStorage.setItem("alerts_notified_today", JSON.stringify(notifiedToday));
    } catch (error) {
      console.error("Error sending notifications:", error);
    }
  };

  const dismissAlert = (alertId) => {
    setAlerts(alerts.filter(a => a.id !== alertId));
  };

  const getAlertColor = (severity) => {
    if (severity === "urgent") return "from-red-600/20 to-red-800/20 border-red-500/40";
    return "from-amber-600/20 to-amber-800/20 border-amber-500/40";
  };

  const getAlertIcon = (severity) => {
    if (severity === "urgent") return "🚨";
    return "⚠️";
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-amber-500/20 theme-light:bg-white theme-light:border-gray-200">
        <CardHeader className="border-b border-amber-500/20 pb-4 theme-light:border-gray-200">
          <CardTitle className="text-white flex items-center justify-between theme-light:text-gray-900">
            <span className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              Alertas Financieras
              {alerts.length > 0 && (
                <Badge className="bg-red-600/30 text-red-200 border-red-500/40 animate-pulse theme-light:bg-red-100 theme-light:text-red-700 theme-light:border-red-300">
                  {alerts.length}
                </Badge>
              )}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSettings(true)}
              className="text-gray-400 hover:text-white theme-light:text-gray-600 theme-light:hover:text-gray-900"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-gray-400 theme-light:text-gray-600">
              <Bell className="w-12 h-12 animate-pulse mx-auto mb-2" />
              <p>Verificando alertas...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-600/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-3 theme-light:bg-emerald-100 theme-light:border-emerald-300">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-emerald-300 font-semibold theme-light:text-emerald-700">Todo bajo control</p>
              <p className="text-gray-500 text-sm mt-1 theme-light:text-gray-600">No hay alertas financieras</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`bg-gradient-to-br ${getAlertColor(alert.severity)} border rounded-xl p-4 theme-light:bg-white theme-light:border-gray-200`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getAlertIcon(alert.severity)}</span>
                        <h4 className="text-white font-bold theme-light:text-gray-900">{alert.title}</h4>
                      </div>
                      <p className="text-gray-300 text-sm mb-2 theme-light:text-gray-700">{alert.message}</p>
                      {alert.amount && (
                        <p className="text-amber-400 font-bold text-lg theme-light:text-amber-700">
                          ${alert.amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => dismissAlert(alert.id)}
                      className="text-gray-400 hover:text-white theme-light:text-gray-600 theme-light:hover:text-gray-900"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Configuración */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/30 theme-light:bg-white theme-light:border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Settings className="w-5 h-5 text-cyan-500" />
              Configurar Alertas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">
                Umbral mensual de gastos ($)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={thresholdConfig.monthly_expense_threshold}
                onChange={(e) => setThresholdConfig({
                  ...thresholdConfig,
                  monthly_expense_threshold: parseFloat(e.target.value) || 0
                })}
                className="bg-black/40 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1 theme-light:text-gray-600">
                Recibirás una alerta si los gastos mensuales superan este monto
              </p>
            </div>

            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">
                Días de anticipación para vencimientos
              </Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={thresholdConfig.days_before_due}
                onChange={(e) => setThresholdConfig({
                  ...thresholdConfig,
                  days_before_due: parseInt(e.target.value) || 7
                })}
                className="bg-black/40 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1 theme-light:text-gray-600">
                Te avisaremos con esta cantidad de días de anticipación
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1 border-white/15 theme-light:border-gray-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={saveSettings}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-700"
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
