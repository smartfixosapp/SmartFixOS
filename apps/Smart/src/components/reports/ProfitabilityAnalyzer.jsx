import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { dataClient } from '@/components/api/dataClient';
import { DollarSign, TrendingUp, Users, Award, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfitabilityAnalyzer({ period = 30 }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runAnalysis();
  }, [period]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const cutoffDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

      // Cargar datos
      const [orders, sales, transactions, products, services, users] = await Promise.all([
        dataClient.entities.Order.filter({}, '-created_date', 500),
        dataClient.entities.Sale.filter({}, '-created_date', 500),
        dataClient.entities.Transaction.filter({}, '-created_date', 500),
        dataClient.entities.Product.list('-updated_date', 200),
        dataClient.entities.Service.list('-updated_date', 100),
        dataClient.entities.User.list('-created_date', 50)
      ]);

      // Filtrar por período
      const recentOrders = orders.filter(o => new Date(o.created_date) >= cutoffDate);
      const recentSales = sales.filter(s => new Date(s.created_date) >= cutoffDate);
      const recentTransactions = transactions.filter(t => new Date(t.created_date) >= cutoffDate);

      // Análisis por servicio
      const serviceStats = {};
      recentOrders.forEach(order => {
        (order.repair_tasks || []).forEach(task => {
          const serviceName = task.description || 'Servicio General';
          if (!serviceStats[serviceName]) {
            serviceStats[serviceName] = {
              count: 0,
              totalRevenue: 0,
              totalCost: 0,
              avgTime: []
            };
          }
          serviceStats[serviceName].count++;
          serviceStats[serviceName].totalRevenue += (task.cost || 0);
        });

        (order.parts_needed || []).forEach(part => {
          serviceStats[order.device_type] = serviceStats[order.device_type] || {
            count: 0,
            totalRevenue: 0,
            totalCost: 0
          };
          serviceStats[order.device_type].totalRevenue += (part.price || 0) * (part.quantity || 1);
          
          const product = products.find(p => p.name === part.name);
          if (product) {
            serviceStats[order.device_type].totalCost += (product.cost || 0) * (part.quantity || 1);
          }
        });
      });

      // Análisis por técnico
      const technicianStats = {};
      recentOrders.forEach(order => {
        const tech = order.assigned_to_name || order.created_by_name || 'No asignado';
        if (!technicianStats[tech]) {
          technicianStats[tech] = {
            orders: 0,
            completed: 0,
            revenue: 0,
            avgTime: []
          };
        }
        technicianStats[tech].orders++;
        if (order.status === 'completed' || order.status === 'picked_up') {
          technicianStats[tech].completed++;
          technicianStats[tech].revenue += (order.cost_estimate || 0);
        }
      });

      const prompt = `Analiza la rentabilidad del negocio en los últimos ${period} días:

RESUMEN FINANCIERO:
- Total órdenes: ${recentOrders.length}
- Total ventas POS: ${recentSales.length}
- Ingresos órdenes: $${recentOrders.reduce((s, o) => s + (o.cost_estimate || 0), 0).toFixed(2)}
- Ingresos ventas: $${recentSales.reduce((s, v) => s + (v.total || 0), 0).toFixed(2)}
- Gastos: $${recentTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0).toFixed(2)}

RENTABILIDAD POR SERVICIO/TIPO:
${Object.entries(serviceStats).slice(0, 15).map(([name, data]) => 
  `- ${name}: ${data.count} trabajos, $${data.totalRevenue.toFixed(2)} ingresos, $${data.totalCost.toFixed(2)} costos`
).join('\n')}

DESEMPEÑO POR TÉCNICO:
${Object.entries(technicianStats).slice(0, 10).map(([name, data]) => 
  `- ${name}: ${data.orders} órdenes, ${data.completed} completadas, $${data.revenue.toFixed(2)} generados`
).join('\n')}

PRODUCTOS/SERVICIOS DISPONIBLES:
${products.slice(0, 20).map(p => `- ${p.name}: Precio $${p.price}, Costo $${p.cost || 0}`).join('\n')}
${services.slice(0, 10).map(s => `- ${s.name}: $${s.price}`).join('\n')}

Genera análisis de rentabilidad en JSON:
{
  "summary": {
    "total_revenue": number,
    "total_costs": number,
    "gross_profit": number,
    "profit_margin_percentage": number,
    "average_ticket": number
  },
  "by_service": [
    {
      "service_name": "nombre",
      "revenue": number,
      "cost": number,
      "profit": number,
      "margin_percentage": number,
      "volume": number,
      "profitability_score": "high/medium/low",
      "recommendation": "acción sugerida"
    }
  ],
  "by_technician": [
    {
      "name": "nombre",
      "orders_count": number,
      "completion_rate": number,
      "revenue_generated": number,
      "efficiency_score": "high/medium/low",
      "strengths": ["fortaleza1"],
      "areas_improvement": ["área1"]
    }
  ],
  "insights": {
    "most_profitable_services": ["servicio1"],
    "least_profitable_services": ["servicio2"],
    "top_performers": ["técnico1"],
    "optimization_opportunities": ["oportunidad1"],
    "pricing_recommendations": ["recomendación1"]
  },
  "forecasts": {
    "projected_monthly_revenue": number,
    "growth_trend": "increasing/stable/decreasing",
    "risk_factors": ["riesgo1"]
  }
}`;

      const response = await dataClient.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: {
              type: "object",
              properties: {
                total_revenue: { type: "number" },
                total_costs: { type: "number" },
                gross_profit: { type: "number" },
                profit_margin_percentage: { type: "number" },
                average_ticket: { type: "number" }
              }
            },
            by_service: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  service_name: { type: "string" },
                  revenue: { type: "number" },
                  cost: { type: "number" },
                  profit: { type: "number" },
                  margin_percentage: { type: "number" },
                  volume: { type: "number" },
                  profitability_score: { type: "string" },
                  recommendation: { type: "string" }
                }
              }
            },
            by_technician: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  orders_count: { type: "number" },
                  completion_rate: { type: "number" },
                  revenue_generated: { type: "number" },
                  efficiency_score: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  areas_improvement: { type: "array", items: { type: "string" } }
                }
              }
            },
            insights: {
              type: "object",
              properties: {
                most_profitable_services: { type: "array", items: { type: "string" } },
                least_profitable_services: { type: "array", items: { type: "string" } },
                top_performers: { type: "array", items: { type: "string" } },
                optimization_opportunities: { type: "array", items: { type: "string" } },
                pricing_recommendations: { type: "array", items: { type: "string" } }
              }
            },
            forecasts: {
              type: "object",
              properties: {
                projected_monthly_revenue: { type: "number" },
                growth_trend: { type: "string" },
                risk_factors: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      });

      setAnalysis(response);
      toast.success('Análisis completado');

    } catch (error) {
      console.error('Error analyzing profitability:', error);
      toast.error('Error en análisis de rentabilidad');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !analysis) {
    return (
      <Card className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 border-green-500/30">
        <CardContent className="p-8 text-center">
          <BarChart3 className="w-12 h-12 animate-pulse mx-auto mb-4 text-green-400" />
          <p className="text-gray-300">Analizando rentabilidad...</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const scoreColors = {
    high: 'bg-green-600/20 text-green-300 border-green-500/30',
    medium: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
    low: 'bg-red-600/20 text-red-300 border-red-500/30'
  };

  return (
    <Card className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 border-2 border-green-500/40">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-green-400" />
          Análisis de Rentabilidad con IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Resumen Financiero */}
        {analysis.summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-black/30 rounded-lg p-3 border border-green-500/20">
              <DollarSign className="w-4 h-4 mb-1 text-green-400" />
              <p className="text-xs text-gray-400">Ingresos</p>
              <p className="text-lg font-bold text-green-400">
                ${analysis.summary.total_revenue?.toFixed(0)}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-red-500/20">
              <TrendingUp className="w-4 h-4 mb-1 text-red-400" />
              <p className="text-xs text-gray-400">Costos</p>
              <p className="text-lg font-bold text-red-400">
                ${analysis.summary.total_costs?.toFixed(0)}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-emerald-500/20">
              <DollarSign className="w-4 h-4 mb-1 text-emerald-400" />
              <p className="text-xs text-gray-400">Utilidad</p>
              <p className="text-lg font-bold text-emerald-400">
                ${analysis.summary.gross_profit?.toFixed(0)}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-blue-500/20">
              <BarChart3 className="w-4 h-4 mb-1 text-blue-400" />
              <p className="text-xs text-gray-400">Margen</p>
              <p className="text-lg font-bold text-blue-400">
                {analysis.summary.profit_margin_percentage?.toFixed(1)}%
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20">
              <Award className="w-4 h-4 mb-1 text-purple-400" />
              <p className="text-xs text-gray-400">Ticket Prom.</p>
              <p className="text-lg font-bold text-purple-400">
                ${analysis.summary.average_ticket?.toFixed(0)}
              </p>
            </div>
          </div>
        )}

        {/* Rentabilidad por Servicio */}
        {analysis.by_service?.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-400">Por Servicio/Tipo:</p>
            {analysis.by_service.slice(0, 8).map((service, idx) => (
              <div key={idx} className="bg-black/30 rounded-lg p-3 border border-green-500/10">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{service.service_name}</span>
                      <Badge className={scoreColors[service.profitability_score]}>
                        {service.profitability_score}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Ventas</p>
                        <p className="text-white font-semibold">{service.volume}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Ingresos</p>
                        <p className="text-green-400">${service.revenue?.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Costos</p>
                        <p className="text-red-400">${service.cost?.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Margen</p>
                        <p className="text-blue-400">{service.margin_percentage?.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
                {service.recommendation && (
                  <p className="text-xs text-gray-400 mt-2">💡 {service.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Desempeño por Técnico */}
        {analysis.by_technician?.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-400">Por Técnico:</p>
            {analysis.by_technician.slice(0, 6).map((tech, idx) => (
              <div key={idx} className="bg-black/30 rounded-lg p-3 border border-blue-500/10">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-white font-semibold">{tech.name}</span>
                  </div>
                  <Badge className={scoreColors[tech.efficiency_score]}>
                    {tech.efficiency_score}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div>
                    <p className="text-gray-500">Órdenes</p>
                    <p className="text-white font-semibold">{tech.orders_count}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tasa Éxito</p>
                    <p className="text-green-400">{tech.completion_rate?.toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ingresos</p>
                    <p className="text-emerald-400">${tech.revenue_generated?.toFixed(0)}</p>
                  </div>
                </div>
                {tech.strengths?.length > 0 && (
                  <p className="text-xs text-green-400">✓ {tech.strengths[0]}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Insights y Proyecciones */}
        {analysis.insights && (
          <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-lg p-4">
            <p className="text-sm font-semibold text-purple-300 mb-3">🎯 Insights Clave</p>
            <div className="space-y-2 text-sm text-gray-300">
              {analysis.insights.most_profitable_services?.length > 0 && (
                <p>🏆 <span className="font-semibold">Más rentables:</span> {analysis.insights.most_profitable_services.join(', ')}</p>
              )}
              {analysis.insights.top_performers?.length > 0 && (
                <p>⭐ <span className="font-semibold">Top performers:</span> {analysis.insights.top_performers.join(', ')}</p>
              )}
              {analysis.insights.optimization_opportunities?.length > 0 && (
                <div>
                  <p className="font-semibold text-orange-300 mb-1">💡 Oportunidades:</p>
                  <ul className="space-y-1 ml-4">
                    {analysis.insights.optimization_opportunities.map((opp, idx) => (
                      <li key={idx} className="text-xs">{opp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {analysis.forecasts && (
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-300 mb-2">📈 Proyección</p>
            <p className="text-xs text-gray-300">
              Ingresos proyectados: <span className="font-bold text-blue-400">${analysis.forecasts.projected_monthly_revenue?.toFixed(0)}/mes</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Tendencia: {analysis.forecasts.growth_trend}</p>
          </div>
        )}

        <Button
          onClick={runAnalysis}
          disabled={loading}
          variant="outline"
          className="w-full border-green-500/30"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          {loading ? 'Actualizando...' : 'Actualizar Análisis'}
        </Button>
      </CardContent>
    </Card>
  );
}
