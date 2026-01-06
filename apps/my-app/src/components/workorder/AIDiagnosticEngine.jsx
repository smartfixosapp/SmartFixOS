import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { dataClient } from '@/components/api/dataClient';
import { Brain, AlertCircle, Clock, DollarSign, Wrench } from 'lucide-react';
import { toast } from 'sonner';

export default function AIDiagnosticEngine({ 
  deviceType, 
  deviceBrand, 
  deviceModel, 
  problem, 
  customerHistory,
  onDiagnosisComplete 
}) {
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deviceType && problem) {
      runDiagnosis();
    }
  }, [deviceType, deviceBrand, deviceModel, problem]);

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      // Cargar datos históricos
      const [similarOrders, products, services] = await Promise.all([
        dataClient.entities.Order.filter({ device_type: deviceType }, '-created_date', 50),
        dataClient.entities.Product.filter({ active: true }),
        dataClient.entities.Service.filter({ active: true })
      ]);

      // Análisis de problemas comunes
      const problemFrequency = {};
      const solutionPatterns = {};
      const avgCosts = {};
      const avgTimes = {};

      similarOrders.forEach(order => {
        const prob = order.initial_problem?.toLowerCase() || '';
        problemFrequency[prob] = (problemFrequency[prob] || 0) + 1;

        if (order.status === 'completed' || order.status === 'picked_up') {
          const parts = order.parts_needed || [];
          const cost = order.cost_estimate || 0;
          
          parts.forEach(part => {
            const key = part.name || part.id;
            if (!solutionPatterns[key]) {
              solutionPatterns[key] = { count: 0, totalCost: 0 };
            }
            solutionPatterns[key].count++;
            solutionPatterns[key].totalCost += (part.price || 0);
          });

          if (cost > 0) {
            avgCosts[prob] = avgCosts[prob] || [];
            avgCosts[prob].push(cost);
          }
        }
      });

      const prompt = `Eres un técnico experto en reparación de dispositivos. Analiza este caso:

DISPOSITIVO:
- Tipo: ${deviceType}
- Marca: ${deviceBrand || 'No especificada'}
- Modelo: ${deviceModel || 'No especificado'}

PROBLEMA REPORTADO:
${problem}

HISTORIAL DEL CLIENTE:
${customerHistory?.total_orders > 0 ? `
- Órdenes previas: ${customerHistory.total_orders}
- Dispositivos reparados: ${customerHistory.devices || 'Varios'}
- Problemas anteriores: ${customerHistory.past_problems?.join(', ') || 'Primera vez'}
` : 'Cliente nuevo - primera orden'}

DATOS ESTADÍSTICOS DE CASOS SIMILARES:
- Total de casos similares: ${similarOrders.length}
- Problemas más comunes en ${deviceType}:
${Object.entries(problemFrequency).slice(0, 5).map(([p, c]) => `  * "${p}" (${c} casos)`).join('\n')}

- Soluciones más efectivas:
${Object.entries(solutionPatterns).slice(0, 8).map(([part, data]) => 
  `  * ${part} (usado ${data.count} veces, promedio $${(data.totalCost / data.count).toFixed(2)})`
).join('\n')}

INVENTARIO DISPONIBLE:
${products.slice(0, 20).map(p => `- ${p.name} ($${p.price}) [Stock: ${p.stock}]`).join('\n')}

SERVICIOS DISPONIBLES:
${services.slice(0, 10).map(s => `- ${s.name} ($${s.price}) [${s.duration_minutes}min]`).join('\n')}

Proporciona un diagnóstico completo en JSON:
{
  "primary_diagnosis": "diagnóstico principal",
  "confidence_level": "high/medium/low",
  "root_causes": ["causa1", "causa2"],
  "recommended_solution": {
    "description": "descripción de la solución",
    "parts_needed": [{"name": "parte", "priority": "high/medium/low", "reason": "por qué"}],
    "services_needed": [{"name": "servicio", "reason": "por qué"}],
    "estimated_cost": number,
    "estimated_time_minutes": number,
    "difficulty": "easy/medium/hard"
  },
  "alternative_solutions": [{"description": "alternativa", "cost": number, "pros": ["pro1"], "cons": ["con1"]}],
  "preventive_tips": ["tip1", "tip2"],
  "warranty_considerations": "notas sobre garantía si aplica",
  "urgency": "low/medium/high/critical",
  "success_rate": "porcentaje estimado de éxito basado en historial"
}`;

      const response = await dataClient.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            primary_diagnosis: { type: "string" },
            confidence_level: { type: "string" },
            root_causes: { type: "array", items: { type: "string" } },
            recommended_solution: {
              type: "object",
              properties: {
                description: { type: "string" },
                parts_needed: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      priority: { type: "string" },
                      reason: { type: "string" }
                    }
                  }
                },
                services_needed: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      reason: { type: "string" }
                    }
                  }
                },
                estimated_cost: { type: "number" },
                estimated_time_minutes: { type: "number" },
                difficulty: { type: "string" }
              }
            },
            alternative_solutions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  cost: { type: "number" },
                  pros: { type: "array", items: { type: "string" } },
                  cons: { type: "array", items: { type: "string" } }
                }
              }
            },
            preventive_tips: { type: "array", items: { type: "string" } },
            warranty_considerations: { type: "string" },
            urgency: { type: "string" },
            success_rate: { type: "string" }
          }
        }
      });

      setDiagnosis(response);
      
      if (onDiagnosisComplete) {
        onDiagnosisComplete(response);
      }

      toast.success('Diagnóstico completado');

    } catch (error) {
      console.error('Error running diagnosis:', error);
      toast.error('Error generando diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  if (!deviceType || !problem) return null;

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-2 border-blue-500/30">
        <CardContent className="p-8 text-center">
          <Brain className="w-12 h-12 animate-pulse mx-auto mb-4 text-blue-400" />
          <p className="text-gray-300 font-semibold mb-2">Analizando caso...</p>
          <p className="text-sm text-gray-400">Comparando con {deviceType} similares</p>
        </CardContent>
      </Card>
    );
  }

  if (!diagnosis) return null;

  const confidenceColors = {
    high: 'bg-green-600/20 text-green-300 border-green-500/30',
    medium: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
    low: 'bg-red-600/20 text-red-300 border-red-500/30'
  };

  const urgencyColors = {
    critical: 'bg-red-600/20 text-red-300',
    high: 'bg-orange-600/20 text-orange-300',
    medium: 'bg-yellow-600/20 text-yellow-300',
    low: 'bg-blue-600/20 text-blue-300'
  };

  return (
    <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-2 border-blue-500/40">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-400" />
          Diagnóstico Inteligente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Diagnóstico Principal */}
        <div className="bg-black/30 rounded-lg p-4 border-2 border-blue-500/30">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-white">Diagnóstico</span>
            </div>
            <div className="flex gap-2">
              <Badge className={confidenceColors[diagnosis.confidence_level]}>
                {diagnosis.confidence_level === 'high' ? '✓ Alta' : 
                 diagnosis.confidence_level === 'medium' ? '~ Media' : '? Baja'} confianza
              </Badge>
              <Badge className={urgencyColors[diagnosis.urgency] || urgencyColors.medium}>
                {diagnosis.urgency}
              </Badge>
            </div>
          </div>
          <p className="text-gray-300 text-lg font-semibold mb-2">{diagnosis.primary_diagnosis}</p>
          {diagnosis.success_rate && (
            <p className="text-sm text-emerald-400">✓ Tasa de éxito estimada: {diagnosis.success_rate}</p>
          )}
        </div>

        {/* Causas Raíz */}
        {diagnosis.root_causes?.length > 0 && (
          <div className="bg-black/20 rounded-lg p-3">
            <p className="text-sm font-semibold text-gray-400 mb-2">Causas Probables:</p>
            <ul className="space-y-1">
              {diagnosis.root_causes.map((cause, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  {cause}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Solución Recomendada */}
        {diagnosis.recommended_solution && (
          <div className="bg-gradient-to-br from-emerald-600/10 to-green-600/10 border border-emerald-500/30 rounded-lg p-4">
            <p className="font-semibold text-emerald-300 mb-2">✓ Solución Recomendada</p>
            <p className="text-sm text-gray-300 mb-3">{diagnosis.recommended_solution.description}</p>
            
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-black/30 rounded p-2 text-center">
                <DollarSign className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                <p className="text-xs text-gray-400">Costo</p>
                <p className="text-sm font-bold text-emerald-400">
                  ${diagnosis.recommended_solution.estimated_cost?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="bg-black/30 rounded p-2 text-center">
                <Clock className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                <p className="text-xs text-gray-400">Tiempo</p>
                <p className="text-sm font-bold text-blue-400">
                  {diagnosis.recommended_solution.estimated_time_minutes || 60}m
                </p>
              </div>
              <div className="bg-black/30 rounded p-2 text-center">
                <Wrench className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
                <p className="text-xs text-gray-400">Dificultad</p>
                <p className="text-sm font-bold text-yellow-400">
                  {diagnosis.recommended_solution.difficulty || 'medium'}
                </p>
              </div>
            </div>

            {diagnosis.recommended_solution.parts_needed?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400">Partes necesarias:</p>
                {diagnosis.recommended_solution.parts_needed.map((part, idx) => (
                  <div key={idx} className="bg-black/20 rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white font-semibold">{part.name}</span>
                      <Badge className={part.priority === 'high' ? 'bg-red-600/20 text-red-300' : 'bg-blue-600/20 text-blue-300'}>
                        {part.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{part.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tips Preventivos */}
        {diagnosis.preventive_tips?.length > 0 && (
          <div className="bg-blue-600/5 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-300 mb-2">💡 Recomendaciones Preventivas:</p>
            <ul className="space-y-1">
              {diagnosis.preventive_tips.map((tip, idx) => (
                <li key={idx} className="text-xs text-gray-400">{tip}</li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={runDiagnosis}
          variant="outline"
          className="w-full border-blue-500/30"
        >
          <Brain className="w-4 h-4 mr-2" />
          Actualizar Diagnóstico
        </Button>
      </CardContent>
    </Card>
  );
}
