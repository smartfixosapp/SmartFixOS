import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataClient } from '@/components/api/dataClient';
import { useTranslation } from '@/components/utils/i18n';
import {
  Sparkles, TrendingUp, TrendingDown, DollarSign, 
  Target, Lightbulb, BarChart3, AlertCircle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, subMonths } from 'date-fns';

export default function AIFinancialInsights({ sales = [], expenses = [], period = 'month' }) {
  const { t } = useTranslation();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    
    try {
      // Preparar datos para el análisis
      const now = new Date();
      const startDate = period === 'week' 
        ? subDays(now, 7) 
        : period === 'month' 
          ? subMonths(now, 1) 
          : subMonths(now, 3);

      const recentSales = sales.filter(s => new Date(s.created_date) >= startDate);
      const recentExpenses = expenses.filter(e => new Date(e.created_date) >= startDate);

      const totalRevenue = recentSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const totalExpenses = recentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      // Agrupar por categorías
      const expensesByCategory = {};
      recentExpenses.forEach(e => {
        const cat = e.category || 'other';
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (e.amount || 0);
      });

      // Calcular métricas históricas para predicción
      const historicalData = {
        dailyAvgRevenue: totalRevenue / recentSales.length || 0,
        dailyAvgExpenses: totalExpenses / recentExpenses.length || 0,
        profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0,
        topExpenseCategories: Object.entries(expensesByCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([cat, amount]) => ({ category: cat, amount }))
      };

      const prompt = `Eres un analista financiero experto. Analiza estos datos financieros y proporciona:

DATOS DEL PERÍODO (${period === 'week' ? 'última semana' : period === 'month' ? 'último mes' : 'últimos 3 meses'}):
- Ingresos totales: $${totalRevenue.toFixed(2)}
- Gastos totales: $${totalExpenses.toFixed(2)}
- Ganancia neta: $${netProfit.toFixed(2)}
- Margen de ganancia: ${historicalData.profitMargin}%
- Promedio diario ingresos: $${historicalData.dailyAvgRevenue.toFixed(2)}
- Promedio diario gastos: $${historicalData.dailyAvgExpenses.toFixed(2)}
- Top 3 categorías de gastos: ${JSON.stringify(historicalData.topExpenseCategories)}

Proporciona tu análisis en formato JSON con esta estructura exacta:
{
  "summary": "Resumen ejecutivo del desempeño financiero en 2-3 oraciones",
  "kpis": [
    {
      "name": "Nombre del KPI",
      "value": "Valor",
      "trend": "up/down/stable",
      "insight": "Breve explicación"
    }
  ],
  "predictions": {
    "nextMonthRevenue": "Estimado numérico",
    "nextMonthExpenses": "Estimado numérico",
    "confidence": "high/medium/low",
    "reasoning": "Explicación del pronóstico"
  },
  "recommendations": [
    {
      "type": "cost_reduction/revenue_growth",
      "priority": "high/medium/low",
      "title": "Título de la recomendación",
      "description": "Descripción detallada",
      "potentialImpact": "Impacto estimado en $"
    }
  ],
  "alerts": [
    {
      "severity": "warning/info/success",
      "message": "Mensaje de alerta"
    }
  ]
}`;

      const response = await dataClient.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            kpis: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                  trend: { type: "string" },
                  insight: { type: "string" }
                }
              }
            },
            predictions: {
              type: "object",
              properties: {
                nextMonthRevenue: { type: "string" },
                nextMonthExpenses: { type: "string" },
                confidence: { type: "string" },
                reasoning: { type: "string" }
              }
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  priority: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  potentialImpact: { type: "string" }
                }
              }
            },
            alerts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string" },
                  message: { type: "string" }
                }
              }
            }
          }
        }
      });

      setInsights(response);
      toast.success('✨ Análisis completado');
      
    } catch (error) {
      console.error('Error generating insights:', error);
      toast.error('Error generando análisis con IA');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <span className="w-4 h-4">→</span>;
  };

  const getPriorityColor = (priority) => {
    if (priority === 'high') return 'bg-red-600/20 text-red-300 border-red-500/30';
    if (priority === 'medium') return 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30';
    return 'bg-blue-600/20 text-blue-300 border-blue-500/30';
  };

  const getSeverityIcon = (severity) => {
    if (severity === 'warning') return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    if (severity === 'success') return <TrendingUp className="w-5 h-5 text-green-400" />;
    return <Sparkles className="w-5 h-5 text-blue-400" />;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-2 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-400" />
            {t('aiInsights')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-6">
            <Button 
              onClick={generateInsights} 
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t('generatingSummary')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('generateReport')}
                </>
              )}
            </Button>
          </div>

          {insights && (
            <div className="space-y-6">
              {/* Resumen Ejecutivo */}
              <div className="bg-black/30 rounded-xl p-4 border border-purple-500/20">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  {t('financialSummary')}
                </h3>
                <p className="text-gray-300 text-sm">{insights.summary}</p>
              </div>

              {/* Alertas */}
              {insights.alerts && insights.alerts.length > 0 && (
                <div className="space-y-2">
                  {insights.alerts.map((alert, idx) => (
                    <div key={idx} className="bg-black/30 rounded-lg p-3 border border-yellow-500/20 flex items-start gap-3">
                      {getSeverityIcon(alert.severity)}
                      <p className="text-gray-300 text-sm flex-1">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* KPIs */}
              <div>
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  {t('kpis')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insights.kpis?.map((kpi, idx) => (
                    <div key={idx} className="bg-black/30 rounded-lg p-4 border border-cyan-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">{kpi.name}</span>
                        {getTrendIcon(kpi.trend)}
                      </div>
                      <p className="text-2xl font-bold text-white mb-1">{kpi.value}</p>
                      <p className="text-xs text-gray-400">{kpi.insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Predicciones */}
              <div>
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  {t('predictiveAnalysis')}
                </h3>
                <div className="bg-black/30 rounded-xl p-4 border border-emerald-500/20 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Ingresos Proyectados</p>
                      <p className="text-2xl font-bold text-emerald-400">{insights.predictions?.nextMonthRevenue}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Gastos Proyectados</p>
                      <p className="text-2xl font-bold text-red-400">{insights.predictions?.nextMonthExpenses}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600/20 text-blue-300">
                      Confianza: {insights.predictions?.confidence}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-300">{insights.predictions?.reasoning}</p>
                </div>
              </div>

              {/* Recomendaciones */}
              <div>
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  {t('recommendations')}
                </h3>
                <div className="space-y-3">
                  {insights.recommendations?.map((rec, idx) => (
                    <div key={idx} className="bg-black/30 rounded-lg p-4 border border-yellow-500/20">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority}
                            </Badge>
                            <Badge className="bg-cyan-600/20 text-cyan-300">
                              {rec.type === 'cost_reduction' ? '💰 Reducción' : '📈 Crecimiento'}
                            </Badge>
                          </div>
                          <h4 className="text-white font-semibold mb-1">{rec.title}</h4>
                          <p className="text-gray-300 text-sm mb-2">{rec.description}</p>
                          <p className="text-emerald-400 text-sm font-semibold">
                            Impacto potencial: {rec.potentialImpact}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
