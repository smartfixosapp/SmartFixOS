import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { dataClient } from '@/components/api/dataClient';
import { Sparkles, Star, TrendingUp, Gift, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

export default function SmartRecommendations({ customerId }) {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadRecommendations();
    }
  }, [customerId]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      // Cargar perfil completo del cliente
      const [customer, orders, products, services] = await Promise.all([
        dataClient.entities.Customer.get(customerId),
        dataClient.entities.Order.filter({ customer_id: customerId }, '-created_date', 20),
        dataClient.entities.Product.filter({ active: true }),
        dataClient.entities.Service.filter({ active: true })
      ]);

      // Analizar patrones del cliente
      const deviceHistory = {};
      const problemHistory = {};
      const partsUsed = {};
      let totalSpent = 0;

      orders.forEach(order => {
        // Dispositivos
        const device = order.device_type;
        deviceHistory[device] = (deviceHistory[device] || 0) + 1;

        // Problemas
        if (order.initial_problem) {
          const problem = order.initial_problem.toLowerCase();
          problemHistory[problem] = (problemHistory[problem] || 0) + 1;
        }

        // Partes
        (order.parts_needed || []).forEach(part => {
          partsUsed[part.name] = (partsUsed[part.name] || 0) + 1;
        });

        totalSpent += (order.cost_estimate || 0);
      });

      // Cargar otros clientes similares para análisis colaborativo
      const similarCustomers = await dataClient.entities.Customer.filter({
        loyalty_tier: customer.loyalty_tier
      }, '-total_spent', 30);

      const prompt = `Genera recomendaciones personalizadas inteligentes para este cliente:

PERFIL DEL CLIENTE:
- Nombre: ${customer.name}
- Órdenes totales: ${customer.total_orders || 0}
- Gasto total: $${customer.total_spent || 0}
- Puntos lealtad: ${customer.loyalty_points || 0}
- Nivel: ${customer.loyalty_tier || 'bronze'}

HISTORIAL DE DISPOSITIVOS:
${Object.entries(deviceHistory).map(([device, count]) => `- ${device}: ${count} reparaciones`).join('\n') || 'Sin historial'}

PROBLEMAS RECURRENTES:
${Object.entries(problemHistory).slice(0, 5).map(([prob, count]) => `- "${prob}": ${count} veces`).join('\n') || 'Sin patrones'}

PARTES MÁS USADAS:
${Object.entries(partsUsed).slice(0, 5).map(([part, count]) => `- ${part}: ${count} veces`).join('\n') || 'Ninguna'}

PRODUCTOS DISPONIBLES:
${products.slice(0, 30).map(p => `- ${p.name} ($${p.price}): ${p.description || ''}`).join('\n')}

SERVICIOS DISPONIBLES:
${services.slice(0, 20).map(s => `- ${s.name} ($${s.price}): ${s.description || ''}`).join('\n')}

COMPORTAMIENTO DE CLIENTES SIMILARES (${customer.loyalty_tier}):
${similarCustomers.slice(0, 10).map(c => `- ${c.total_orders} órdenes, $${c.total_spent} gastado`).join('\n')}

Genera recomendaciones en JSON:
{
  "personalized_products": [
    {
      "product_name": "nombre",
      "reason": "por qué es relevante para este cliente",
      "price": number,
      "priority": "high/medium/low",
      "discount_potential": "posible descuento",
      "expected_value": "valor que aporta"
    }
  ],
  "preventive_services": [
    {
      "service_name": "nombre",
      "reason": "por qué lo necesita",
      "timing": "cuándo hacerlo",
      "price": number,
      "prevents": "qué previene"
    }
  ],
  "maintenance_tips": [
    {
      "device": "dispositivo",
      "tip": "consejo específico",
      "frequency": "cada cuánto",
      "impact": "impacto esperado"
    }
  ],
  "loyalty_opportunities": {
    "points_to_next_tier": number,
    "tier_benefits": ["beneficio1"],
    "recommended_actions": ["acción1"]
  },
  "cross_sell": [
    {
      "bundle_name": "nombre del paquete",
      "items": ["item1", "item2"],
      "combined_price": number,
      "savings": number,
      "reason": "por qué este paquete"
    }
  ],
  "risk_alerts": [
    {
      "concern": "preocupación",
      "recommendation": "qué hacer",
      "urgency": "high/medium/low"
    }
  ]
}`;

      const response = await dataClient.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            personalized_products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_name: { type: "string" },
                  reason: { type: "string" },
                  price: { type: "number" },
                  priority: { type: "string" },
                  discount_potential: { type: "string" },
                  expected_value: { type: "string" }
                }
              }
            },
            preventive_services: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  service_name: { type: "string" },
                  reason: { type: "string" },
                  timing: { type: "string" },
                  price: { type: "number" },
                  prevents: { type: "string" }
                }
              }
            },
            maintenance_tips: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  device: { type: "string" },
                  tip: { type: "string" },
                  frequency: { type: "string" },
                  impact: { type: "string" }
                }
              }
            },
            loyalty_opportunities: {
              type: "object",
              properties: {
                points_to_next_tier: { type: "number" },
                tier_benefits: { type: "array", items: { type: "string" } },
                recommended_actions: { type: "array", items: { type: "string" } }
              }
            },
            cross_sell: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  bundle_name: { type: "string" },
                  items: { type: "array", items: { type: "string" } },
                  combined_price: { type: "number" },
                  savings: { type: "number" },
                  reason: { type: "string" }
                }
              }
            },
            risk_alerts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  concern: { type: "string" },
                  recommendation: { type: "string" },
                  urgency: { type: "string" }
                }
              }
            }
          }
        }
      });

      setRecommendations(response);

    } catch (error) {
      console.error('Error loading recommendations:', error);
      toast.error('Error cargando recomendaciones');
    } finally {
      setLoading(false);
    }
  };

  if (!customerId) return null;

  if (loading && !recommendations) {
    return (
      <Card className="bg-gradient-to-br from-pink-600/10 to-purple-600/10 border-pink-500/30">
        <CardContent className="p-8 text-center">
          <Sparkles className="w-12 h-12 animate-pulse mx-auto mb-4 text-pink-400" />
          <p className="text-gray-300">Generando recomendaciones...</p>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations) return null;

  const priorityColors = {
    high: 'bg-red-600/20 text-red-300',
    medium: 'bg-yellow-600/20 text-yellow-300',
    low: 'bg-blue-600/20 text-blue-300'
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-pink-600/10 to-purple-600/10 border-2 border-pink-500/40">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-pink-400" />
            Recomendaciones Personalizadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Productos Personalizados */}
          {recommendations.personalized_products?.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-pink-300 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Productos Para Ti
              </p>
              {recommendations.personalized_products.slice(0, 5).map((prod, idx) => (
                <div key={idx} className="bg-black/30 rounded-lg p-3 border border-pink-500/20">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-semibold">{prod.product_name}</p>
                      <p className="text-sm text-gray-400 mt-1">{prod.reason}</p>
                    </div>
                    <Badge className={priorityColors[prod.priority]}>
                      {prod.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-emerald-400 font-bold">${prod.price?.toFixed(2)}</p>
                    {prod.discount_potential && (
                      <Badge className="bg-orange-600/20 text-orange-300">
                        {prod.discount_potential}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-blue-300 mt-2">✓ {prod.expected_value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Servicios Preventivos */}
          {recommendations.preventive_services?.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-green-300 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Mantenimiento Preventivo
              </p>
              {recommendations.preventive_services.slice(0, 4).map((service, idx) => (
                <div key={idx} className="bg-green-600/10 rounded-lg p-3 border border-green-500/20">
                  <p className="text-white font-semibold mb-1">{service.service_name}</p>
                  <p className="text-sm text-gray-300 mb-2">{service.reason}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">⏰ {service.timing}</span>
                    <span className="text-green-400 font-bold">${service.price?.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-green-300 mt-2">🛡️ Previene: {service.prevents}</p>
                </div>
              ))}
            </div>
          )}

          {/* Oportunidades de Lealtad */}
          {recommendations.loyalty_opportunities && (
            <div className="bg-gradient-to-br from-yellow-600/10 to-orange-600/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Programa de Lealtad
              </p>
              <p className="text-white mb-2">
                Te faltan <span className="font-bold text-yellow-400">{recommendations.loyalty_opportunities.points_to_next_tier}</span> puntos para el siguiente nivel
              </p>
              {recommendations.loyalty_opportunities.tier_benefits?.length > 0 && (
                <div className="space-y-1 mt-3">
                  <p className="text-xs text-gray-400">Beneficios del siguiente nivel:</p>
                  {recommendations.loyalty_opportunities.tier_benefits.map((benefit, idx) => (
                    <p key={idx} className="text-xs text-yellow-300">✓ {benefit}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paquetes */}
          {recommendations.cross_sell?.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Paquetes Especiales
              </p>
              {recommendations.cross_sell.slice(0, 3).map((bundle, idx) => (
                <div key={idx} className="bg-purple-600/10 rounded-lg p-3 border border-purple-500/20">
                  <p className="text-white font-semibold mb-1">{bundle.bundle_name}</p>
                  <p className="text-sm text-gray-400 mb-2">{bundle.reason}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {bundle.items?.map((item, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{item}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-400 font-bold">${bundle.combined_price?.toFixed(2)}</p>
                      <p className="text-xs text-green-300">Ahorras ${bundle.savings?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={loadRecommendations}
            disabled={loading}
            variant="outline"
            className="w-full border-pink-500/30"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Actualizar Recomendaciones
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
