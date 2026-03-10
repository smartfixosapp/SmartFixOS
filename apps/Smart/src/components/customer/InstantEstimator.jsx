import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { dataClient } from '@/components/api/dataClient';
import { Calculator, Clock, DollarSign, Zap, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function InstantEstimator() {
  const [formData, setFormData] = useState({
    deviceType: '',
    brand: '',
    model: '',
    problem: '',
    urgency: 'normal'
  });
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const deviceTypes = ['Smartphone', 'Tablet', 'Laptop', 'Desktop', 'Smartwatch', 'Console', 'Otro'];
  const urgencyLevels = {
    normal: { label: 'Normal (3-5 días)', multiplier: 1 },
    express: { label: 'Express (1-2 días)', multiplier: 1.3 },
    urgent: { label: 'Urgente (mismo día)', multiplier: 1.6 }
  };

  const handleEstimate = async () => {
    if (!formData.deviceType || !formData.problem) {
      toast.error('Completa al menos el tipo de dispositivo y el problema');
      return;
    }

    setLoading(true);
    try {
      // Cargar datos históricos
      const [products, services, orders] = await Promise.all([
        dataClient.entities.Product.filter({ active: true }),
        dataClient.entities.Service.filter({ active: true }),
        dataClient.entities.Order.filter({ device_type: formData.deviceType }, '-created_date', 50)
      ]);

      // Análisis de casos similares
      const similarCases = orders.filter(o => {
        const problemMatch = o.initial_problem?.toLowerCase().includes(formData.problem.toLowerCase());
        const brandMatch = !formData.brand || o.device_brand?.toLowerCase() === formData.brand.toLowerCase();
        return problemMatch || brandMatch;
      });

      const avgCost = similarCases.length > 0
        ? similarCases.reduce((sum, o) => sum + (o.cost_estimate || 0), 0) / similarCases.length
        : 0;

      const prompt = `Genera una estimación instantánea de reparación:

DISPOSITIVO:
- Tipo: ${formData.deviceType}
- Marca: ${formData.brand || 'No especificada'}
- Modelo: ${formData.model || 'No especificado'}

PROBLEMA:
${formData.problem}

URGENCIA: ${formData.urgency} (multiplicador: ${urgencyLevels[formData.urgency].multiplier}x)

CASOS SIMILARES:
- Total encontrados: ${similarCases.length}
- Costo promedio histórico: $${avgCost.toFixed(2)}
- Rango de costos: $${Math.min(...similarCases.map(o => o.cost_estimate || 0))} - $${Math.max(...similarCases.map(o => o.cost_estimate || 0))}

PRODUCTOS DISPONIBLES:
${products.slice(0, 30).map(p => `- ${p.name}: $${p.price}`).join('\n')}

SERVICIOS DISPONIBLES:
${services.slice(0, 20).map(s => `- ${s.name}: $${s.price} (${s.duration_minutes}min)`).join('\n')}

Genera estimación en JSON:
{
  "base_cost": number (costo base sin urgencia),
  "urgency_surcharge": number,
  "total_cost": number,
  "cost_range": {"min": number, "max": number},
  "estimated_time_hours": number,
  "confidence": "high/medium/low",
  "breakdown": [
    {"item": "nombre", "cost": number, "description": "descripción"}
  ],
  "what_includes": ["incluye1", "incluye2"],
  "not_included": ["no incluye1"],
  "conditions": ["condición1"],
  "warranty": "descripción de garantía",
  "next_steps": ["paso1", "paso2"],
  "savings_tips": ["tip1"],
  "alternative_options": [
    {"description": "alternativa", "cost": number, "pros": ["pro1"], "cons": ["con1"]}
  ]
}`;

      const response = await dataClient.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            base_cost: { type: "number" },
            urgency_surcharge: { type: "number" },
            total_cost: { type: "number" },
            cost_range: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" }
              }
            },
            estimated_time_hours: { type: "number" },
            confidence: { type: "string" },
            breakdown: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  cost: { type: "number" },
                  description: { type: "string" }
                }
              }
            },
            what_includes: { type: "array", items: { type: "string" } },
            not_included: { type: "array", items: { type: "string" } },
            conditions: { type: "array", items: { type: "string" } },
            warranty: { type: "string" },
            next_steps: { type: "array", items: { type: "string" } },
            savings_tips: { type: "array", items: { type: "string" } },
            alternative_options: {
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
            }
          }
        }
      });

      setEstimate(response);
      toast.success('Estimación generada');

    } catch (error) {
      console.error('Error generating estimate:', error);
      toast.error('Error generando estimación');
    } finally {
      setLoading(false);
    }
  };

  const confidenceColors = {
    high: 'bg-green-600/20 text-green-300',
    medium: 'bg-yellow-600/20 text-yellow-300',
    low: 'bg-red-600/20 text-red-300'
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-cyan-600/10 to-blue-600/10 border-2 border-cyan-500/40">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calculator className="w-6 h-6 text-cyan-400" />
            Estimación Instantánea con IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Tipo de Dispositivo *</Label>
              <Select value={formData.deviceType} onValueChange={(v) => setFormData({...formData, deviceType: v})}>
                <SelectTrigger className="bg-black/40 border-cyan-500/30 text-white">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300">Urgencia</Label>
              <Select value={formData.urgency} onValueChange={(v) => setFormData({...formData, urgency: v})}>
                <SelectTrigger className="bg-black/40 border-cyan-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(urgencyLevels).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300">Marca (opcional)</Label>
              <Input
                value={formData.brand}
                onChange={(e) => setFormData({...formData, brand: e.target.value})}
                placeholder="Ej: Apple, Samsung..."
                className="bg-black/40 border-cyan-500/30 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-300">Modelo (opcional)</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                placeholder="Ej: iPhone 14, Galaxy S23..."
                className="bg-black/40 border-cyan-500/30 text-white"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-300">Describe el Problema *</Label>
            <Textarea
              value={formData.problem}
              onChange={(e) => setFormData({...formData, problem: e.target.value})}
              placeholder="Ej: Pantalla rota, no enciende, batería no carga..."
              className="bg-black/40 border-cyan-500/30 text-white"
              rows={3}
            />
          </div>

          <Button
            onClick={handleEstimate}
            disabled={loading || !formData.deviceType || !formData.problem}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600"
          >
            {loading ? 'Calculando...' : 'Generar Estimación'}
          </Button>
        </CardContent>
      </Card>

      {estimate && (
        <Card className="bg-gradient-to-br from-emerald-600/10 to-green-600/10 border-2 border-emerald-500/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-emerald-400" />
                Tu Estimación
              </CardTitle>
              <Badge className={confidenceColors[estimate.confidence]}>
                {estimate.confidence} confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Costo Total */}
            <div className="bg-gradient-to-br from-emerald-600/20 to-green-600/20 border-2 border-emerald-500/40 rounded-xl p-6 text-center">
              <p className="text-gray-300 text-sm mb-2">Costo Estimado</p>
              <p className="text-5xl font-black text-emerald-400 mb-2">
                ${estimate.total_cost?.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400">
                Rango: ${estimate.cost_range?.min?.toFixed(2)} - ${estimate.cost_range?.max?.toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 rounded-lg p-3 border border-emerald-500/20">
                <DollarSign className="w-4 h-4 mb-1 text-emerald-400" />
                <p className="text-xs text-gray-400">Costo Base</p>
                <p className="text-lg font-bold text-white">${estimate.base_cost?.toFixed(2)}</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 border border-orange-500/20">
                <TrendingUp className="w-4 h-4 mb-1 text-orange-400" />
                <p className="text-xs text-gray-400">Cargo Urgencia</p>
                <p className="text-lg font-bold text-orange-400">+${estimate.urgency_surcharge?.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-black/30 rounded-lg p-3 border border-blue-500/20">
              <Clock className="w-4 h-4 mb-1 text-blue-400 inline" />
              <span className="text-sm text-gray-300 ml-2">
                Tiempo estimado: <span className="font-bold text-blue-400">{estimate.estimated_time_hours}h</span>
              </span>
            </div>

            {/* Desglose */}
            {estimate.breakdown?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-400">Desglose:</p>
                {estimate.breakdown.map((item, idx) => (
                  <div key={idx} className="bg-black/20 rounded p-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-semibold text-sm">{item.item}</p>
                        <p className="text-xs text-gray-400">{item.description}</p>
                      </div>
                      <p className="text-emerald-400 font-bold">${item.cost?.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Incluye / No Incluye */}
            <div className="grid grid-cols-2 gap-3">
              {estimate.what_includes?.length > 0 && (
                <div className="bg-green-600/10 rounded-lg p-3 border border-green-500/20">
                  <p className="text-xs font-semibold text-green-300 mb-2">✓ Incluye:</p>
                  <ul className="space-y-1">
                    {estimate.what_includes.map((item, idx) => (
                      <li key={idx} className="text-xs text-gray-300">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {estimate.not_included?.length > 0 && (
                <div className="bg-red-600/10 rounded-lg p-3 border border-red-500/20">
                  <p className="text-xs font-semibold text-red-300 mb-2">✗ No incluye:</p>
                  <ul className="space-y-1">
                    {estimate.not_included.map((item, idx) => (
                      <li key={idx} className="text-xs text-gray-300">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Próximos Pasos */}
            {estimate.next_steps?.length > 0 && (
              <div className="bg-blue-600/10 rounded-lg p-3 border border-blue-500/20">
                <p className="text-sm font-semibold text-blue-300 mb-2">📋 Próximos Pasos:</p>
                <ol className="space-y-1 list-decimal list-inside">
                  {estimate.next_steps.map((step, idx) => (
                    <li key={idx} className="text-xs text-gray-300">{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tips de Ahorro */}
            {estimate.savings_tips?.length > 0 && (
              <div className="bg-yellow-600/10 rounded-lg p-3 border border-yellow-500/20">
                <p className="text-sm font-semibold text-yellow-300 mb-2">💡 Tips de Ahorro:</p>
                <ul className="space-y-1">
                  {estimate.savings_tips.map((tip, idx) => (
                    <li key={idx} className="text-xs text-gray-300">{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              * Estimación preliminar. El costo final puede variar según diagnóstico.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
