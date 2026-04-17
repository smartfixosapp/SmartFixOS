import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, TrendingUp, X, Settings, RefreshCw } from "lucide-react";
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

    // Cada 10 min, solo si tab visible
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadAlerts();
    }, 10 * 60 * 1000);
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

  const getAlertIcon = (severity) => {
    if (severity === "urgent") return "🚨";
    return "⚠️";
  };

  // Estado óptimo — solo una barra compacta
  if (!loading && alerts.length === 0) {
    return (
      <>
        <div className="apple-type flex items-center justify-between px-4 py-2.5 rounded-apple-md bg-apple-green/12">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🛡️</span>
            <div>
              <p className="apple-text-caption1 font-semibold text-apple-green leading-none">Todo en orden</p>
              <p className="apple-text-caption2 apple-label-tertiary">Sin alertas financieras</p>
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="apple-press w-7 h-7 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
        {showSettings && (
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
              <div className="p-5">
                <DialogHeader><DialogTitle className="apple-label-primary apple-text-title3 flex items-center gap-2"><Settings className="w-5 h-5 text-apple-blue" />Configurar Alertas</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="apple-label-secondary apple-text-footnote">Umbral mensual de gastos ($)</Label>
                    <Input type="number" step="0.01" value={thresholdConfig.monthly_expense_threshold} onChange={(e) => setThresholdConfig({ ...thresholdConfig, monthly_expense_threshold: parseFloat(e.target.value) || 0 })} className="apple-input mt-1 tabular-nums" />
                  </div>
                  <div>
                    <Label className="apple-label-secondary apple-text-footnote">Días de anticipación para vencimientos</Label>
                    <Input type="number" min="1" max="30" value={thresholdConfig.days_before_due} onChange={(e) => setThresholdConfig({ ...thresholdConfig, days_before_due: parseInt(e.target.value) || 7 })} className="apple-input mt-1 tabular-nums" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setShowSettings(false)} className="apple-btn apple-btn-secondary flex-1">Cancelar</Button>
                    <Button onClick={saveSettings} className="apple-btn apple-btn-primary flex-1">Guardar</Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  return (
    <>
      <div className="apple-type apple-card rounded-apple-md p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-apple-yellow" />
            <p className="apple-text-caption2 font-semibold apple-label-tertiary">Alertas</p>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-apple-red/15 apple-text-caption2 font-semibold text-apple-red tabular-nums animate-pulse">
              {alerts.length}
            </span>
          </div>
          <button onClick={() => setShowSettings(true)} className="apple-press w-6 h-6 rounded-apple-xs bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary transition-colors">
            <Settings className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-2 apple-label-secondary">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <p className="apple-text-caption2 font-semibold">Escaneando…</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {alerts.map(alert => (
              <div key={alert.id} className={`flex items-start gap-2.5 p-2.5 rounded-apple-sm transition-all ${
                alert.severity === 'urgent' ? 'bg-apple-red/12' : 'bg-apple-yellow/12'
              }`}>
                <span className="text-sm shrink-0 mt-0.5">{getAlertIcon(alert.severity)}</span>
                <div className="flex-1 min-w-0">
                  <p className={`apple-text-caption1 font-semibold truncate ${alert.severity === 'urgent' ? 'text-apple-red' : 'text-apple-yellow'}`}>{alert.title}</p>
                  <p className="apple-text-caption2 apple-label-secondary tabular-nums leading-tight mt-0.5">{alert.message}</p>
                  {alert.amount && (
                    <p className={`apple-text-caption1 font-semibold tabular-nums mt-0.5 ${alert.severity === 'urgent' ? 'text-apple-red' : 'text-apple-yellow'}`}>
                      ${alert.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <button onClick={() => dismissAlert(alert.id)} className="apple-press w-5 h-5 rounded-apple-xs bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary transition-colors shrink-0">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Modal de Configuración */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
          <div className="p-5">
            <DialogHeader>
              <DialogTitle className="apple-label-primary apple-text-title3 flex items-center gap-2">
                <Settings className="w-5 h-5 text-apple-blue" />
                Configurar Alertas
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label className="apple-label-secondary apple-text-footnote">
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
                  className="apple-input mt-1 tabular-nums"
                />
                <p className="apple-text-caption2 apple-label-tertiary mt-1">
                  Recibirás una alerta si los gastos mensuales superan este monto
                </p>
              </div>

              <div>
                <Label className="apple-label-secondary apple-text-footnote">
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
                  className="apple-input mt-1 tabular-nums"
                />
                <p className="apple-text-caption2 apple-label-tertiary mt-1">
                  Te avisaremos con esta cantidad de días de anticipación
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                  className="apple-btn apple-btn-secondary flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={saveSettings}
                  className="apple-btn apple-btn-primary flex-1"
                >
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
