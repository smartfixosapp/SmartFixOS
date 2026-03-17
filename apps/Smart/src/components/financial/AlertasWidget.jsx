import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, TrendingUp, X, Settings, RefreshCw, DollarSign } from "lucide-react";
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
      <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl group">
        {/* Decorative Glow */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Bell className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Alertas Financieras
                {alerts.length > 0 && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/30 text-[10px] font-black text-red-100 border border-red-500/40 animate-pulse">
                    {alerts.length}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Monitoreo en Tiempo Real</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        <div className="relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 italic">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-amber-500/30" />
              <p className="text-xs font-bold uppercase tracking-widest text-white/20">Escaneando transacciones...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-10 px-6 rounded-[32px] bg-white/[0.02] border border-white/5 border-dashed">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🛡️</span>
              </div>
              <h4 className="text-emerald-400 font-black tracking-tight mb-1 uppercase text-sm">Estado Óptimo</h4>
              <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest">No se detectaron irregularidades</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`group relative overflow-hidden bg-white/5 border rounded-[28px] p-6 transition-all duration-300 hover:bg-white/[0.08] ${
                    alert.severity === 'urgent' ? 'border-red-500/30 shadow-[0_8px_32px_rgba(239,68,68,0.1)]' : 'border-amber-500/30 shadow-[0_8px_32px_rgba(245,158,11,0.1)]'
                  }`}
                >
                  {/* Internal Glow */}
                  <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-[30px] opacity-20 transition-opacity group-hover:opacity-40 ${
                    alert.severity === 'urgent' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner border ${
                          alert.severity === 'urgent' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'
                        }`}>
                          {getAlertIcon(alert.severity)}
                        </div>
                        <div>
                          <h4 className="text-white font-black tracking-tight uppercase text-sm">{alert.title}</h4>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                            alert.severity === 'urgent' ? 'text-red-400/60' : 'text-amber-400/60'
                          }`}>Prioridad {alert.severity === 'urgent' ? 'Crítica' : 'Media'}</span>
                        </div>
                      </div>
                      <p className="text-white/60 text-sm leading-relaxed mb-4">{alert.message}</p>
                      {alert.amount && (
                        <div className="flex items-center gap-2">
                          <DollarSign className={`w-4 h-4 ${alert.severity === 'urgent' ? 'text-red-400' : 'text-amber-400'}`} />
                          <p className={`text-2xl font-black tracking-tighter ${
                            alert.severity === 'urgent' ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {alert.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => dismissAlert(alert.id)}
                      className="w-10 h-10 rounded-xl text-white/20 hover:text-white hover:bg-white/10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


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
