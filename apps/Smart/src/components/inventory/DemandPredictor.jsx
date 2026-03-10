import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { dataClient } from '@/components/api/dataClient';
import { TrendingUp, Package, AlertTriangle, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function DemandPredictor() {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      // Cargar datos históricos
      const [products, orders, inventoryMovements] = await Promise.all([
        dataClient.entities.Product.list('-updated_date', 100),
        dataClient.entities.Order.list('-created_date', 200),
        dataClient.entities.InventoryMovement.list('-created_date', 500)
      ]);

      // Análisis de uso por producto
      const productUsage = {};
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const last90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      inventoryMovements.forEach(mov => {
        const movDate = new Date(mov.created_date);
        if (movDate >= last90Days) {
          const pid = mov.product_id;
          if (!productUsage[pid]) {
            productUsage[pid] = { 
              last30: 0, 
              last90: 0, 
              name: mov.product_name,
              movements: []
            };
          }
          
          productUsage[pid].movements.push({
            quantity: Math.abs(mov.quantity),
            date: movDate
          });

          if (movDate >= last30Days) {
            productUsage[pid].last30 += Math.abs(mov.quantity);
          }
          productUsage[pid].last90 += Math.abs(mov.quantity);
        }
      });

      // Tendencias de dispositivos
      const deviceTrends = {};
      orders.forEach(order => {
        const device = order.device_type;
        const orderDate = new Date(order.created_date);
        if (orderDate >= last30Days) {
          deviceTrends[device] = (deviceTrends[device] || 0) + 1;
        }
      });

      const prompt = `Analiza patrones de demanda y predice necesidades de inventario:

PRODUCTOS ACTUALES:
${products.slice(0, 30).map(p => 
  `- ${p.name}: Stock actual ${p.stock}, Mínimo ${p.min_stock || 5}, Precio $${p.price}`
).join('\n')}

HISTORIAL DE USO (últimos 90 días):
${Object.entries(productUsage).slice(0, 20).map(([id, data]) => 
  `- ${data.name}: ${data.last30} unidades (30d), ${data.last90} unidades (90d)`
).join('\n')}

TENDENCIAS DE DISPOSITIVOS (último mes):
${Object.entries(deviceTrends).slice(0, 10).map(([device, count]) => 
  `- ${device}: ${count} reparaciones`
).join('\n')}

Genera predicciones en JSON:
{
  "predictions": [
    {
      "product_id": "id",
      "product_name": "nombre",
      "current_stock": number,
      "predicted_demand_7days": number,
      "predicted_demand_30days": number,
      "reorder_recommendation": "urgent/soon/normal/not_needed",
      "suggested_quantity": number,
      "confidence": "high/medium/low",
      "reasoning": "explicación",
      "trend": "increasing/stable/decreasing"
    }
  ],
  "insights": {
    "top_movers": ["producto1", "producto2"],
    "slow_movers": ["producto3"],
    "seasonal_patterns": "análisis de estacionalidad",
    "upcoming_demands": "predicciones basadas en tendencias de dispositivos"
  },
  "recommendations": [
    {
      "action": "descripción de acción",
      "priority": "high/medium/low",
      "expected_impact": "impacto esperado"
    }
  ]
}`;

      const response = await dataClient.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            predictions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_id: { type: "string" },
                  product_name: { type: "string" },
                  current_stock: { type: "number" },
                  predicted_demand_7days: { type: "number" },
                  predicted_demand_30days: { type: "number" },
                  reorder_recommendation: { type: "string" },
                  suggested_quantity: { type: "number" },
                  confidence: { type: "string" },
                  reasoning: { type: "string" },
                  trend: { type: "string" }
                }
              }
            },
            insights: {
              type: "object",
              properties: {
                top_movers: { type: "array", items: { type: "string" } },
                slow_movers: { type: "array", items: { type: "string" } },
                seasonal_patterns: { type: "string" },
                upcoming_demands: { type: "string" }
              }
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  priority: { type: "string" },
                  expected_impact: { type: "string" }
                }
              }
            }
          }
        }
      });

      setPredictions(response);
      toast.success('Predicción actualizada');

    } catch (error) {
      console.error('Error predicting demand:', error);
      toast.error('Error generando predicción');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !predictions) {
    return (
      <Card className="bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-500/30">
        <CardContent className="p-8 text-center">
          <TrendingUp className="w-12 h-12 animate-pulse mx-auto mb-4 text-orange-400" />
          <p className="text-gray-300">Analizando demanda...</p>
        </CardContent>
      </Card>
    );
  }

  if (!predictions) return null;

  const priorityColors = {
    urgent: 'bg-red-600/20 text-red-300 border-red-500/30',
    soon: 'bg-orange-600/20 text-orange-300 border-orange-500/30',
    normal: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    not_needed: 'bg-gray-600/20 text-gray-400 border-gray-500/30'
  };

  const trendIcons = {
    increasing: '📈',
    stable: '➡️',
    decreasing: '📉'
  };

  return (
    <Card className="bg-gradient-to-br from-orange-600/10 to-red-600/10 border-2 border-orange-500/40">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-orange-400" />
          Predicción de Demanda con IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Insights Generales */}
        {predictions.insights && (
          <div className="bg-black/30 rounded-lg p-4 border border-orange-500/20">
            <p className="text-sm font-semibold text-orange-300 mb-3">📊 Insights del Mercado</p>
            <div className="space-y-2 text-sm text-gray-300">
              {predictions.insights.top_movers?.length > 0 && (
                <p>🔥 <span className="font-semibold">Más vendidos:</span> {predictions.insights.top_movers.join(', ')}</p>
              )}
              {predictions.insights.slow_movers?.length > 0 && (
                <p>🐌 <span className="font-semibold">Bajo movimiento:</span> {predictions.insights.slow_movers.join(', ')}</p>
              )}
              {predictions.insights.seasonal_patterns && (
                <p>📅 <span className="font-semibold">Patrones:</span> {predictions.insights.seasonal_patterns}</p>
              )}
              {predictions.insights.upcoming_demands && (
                <p>🔮 <span className="font-semibold">Próxima demanda:</span> {predictions.insights.upcoming_demands}</p>
              )}
            </div>
          </div>
        )}

        {/* Predicciones por Producto */}
        {predictions.predictions?.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-400">Predicciones de Productos:</p>
            {predictions.predictions
              .filter(p => p.reorder_recommendation !== 'not_needed')
              .slice(0, 8)
              .map((pred, idx) => (
              <div key={idx} className="bg-black/30 rounded-lg p-3 border border-orange-500/10">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-400" />
                    <span className="text-white font-semibold">{pred.product_name}</span>
                    <span className="text-lg">{trendIcons[pred.trend]}</span>
                  </div>
                  <Badge className={priorityColors[pred.reorder_recommendation]}>
                    {pred.reorder_recommendation}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-black/20 rounded p-2">
                    <p className="text-xs text-gray-400">Stock Actual</p>
                    <p className="text-lg font-bold text-white">{pred.current_stock}</p>
                  </div>
                  <div className="bg-black/20 rounded p-2">
                    <p className="text-xs text-gray-400">Demanda 7d</p>
                    <p className="text-lg font-bold text-orange-400">{pred.predicted_demand_7days}</p>
                  </div>
                  <div className="bg-black/20 rounded p-2">
                    <p className="text-xs text-gray-400">Ordenar</p>
                    <p className="text-lg font-bold text-emerald-400">{pred.suggested_quantity}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-400">{pred.reasoning}</p>
                <Badge className="mt-2 text-xs" variant="outline">
                  {pred.confidence} confidence
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Recomendaciones de Acción */}
        {predictions.recommendations?.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-600/10 to-green-600/10 border border-emerald-500/20 rounded-lg p-4">
            <p className="text-sm font-semibold text-emerald-300 mb-3">✅ Acciones Recomendadas</p>
            <div className="space-y-2">
              {predictions.recommendations.slice(0, 5).map((rec, idx) => (
                <div key={idx} className="bg-black/20 rounded p-3">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm text-white font-semibold">{rec.action}</span>
                    <Badge className={
                      rec.priority === 'high' ? 'bg-red-600/20 text-red-300' :
                      rec.priority === 'medium' ? 'bg-yellow-600/20 text-yellow-300' :
                      'bg-blue-600/20 text-blue-300'
                    }>
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">{rec.expected_impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={loadPredictions}
          disabled={loading}
          variant="outline"
          className="w-full border-orange-500/30"
        >
          <Calendar className="w-4 h-4 mr-2" />
          {loading ? 'Actualizando...' : 'Actualizar Predicción'}
        </Button>
      </CardContent>
    </Card>
  );
}
