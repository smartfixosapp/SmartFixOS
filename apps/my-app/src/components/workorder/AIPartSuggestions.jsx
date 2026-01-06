import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataClient } from '@/components/api/dataClient';
import { Sparkles, Plus, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function AIPartSuggestions({ deviceType, deviceBrand, deviceModel, problem, onAddPart }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deviceType && problem) {
      generateSuggestions();
    }
  }, [deviceType, deviceBrand, deviceModel, problem]);

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      // Cargar productos disponibles
      const products = await dataClient.entities.Product.filter({ active: true });
      
      // Cargar historial de órdenes similares
      const similarOrders = await dataClient.entities.Order.filter(
        { device_type: deviceType },
        '-created_date',
        20
      );

      const partsUsed = {};
      similarOrders.forEach(order => {
        (order.parts_needed || []).forEach(part => {
          const key = part.name || part.id;
          partsUsed[key] = (partsUsed[key] || 0) + 1;
        });
      });

      const prompt = `Eres un experto en reparación de dispositivos. Analiza y sugiere partes necesarias:

DISPOSITIVO:
- Tipo: ${deviceType}
- Marca: ${deviceBrand || 'No especificada'}
- Modelo: ${deviceModel || 'No especificado'}

PROBLEMA REPORTADO:
${problem}

PRODUCTOS DISPONIBLES EN INVENTARIO:
${products.slice(0, 30).map(p => `- ${p.name} ($${p.price}) [Stock: ${p.stock}]`).join('\n')}

HISTORIAL DE PARTES MÁS USADAS PARA ${deviceType}:
${Object.entries(partsUsed).slice(0, 10).map(([part, count]) => `- ${part} (usado ${count} veces)`).join('\n')}

Responde en JSON con:
- parts: array de objetos con {name, reason, priority (high/medium/low), estimated_cost}
- diagnostic_notes: notas del diagnóstico
- estimated_time: tiempo estimado de reparación en minutos
- difficulty: easy/medium/hard`;

      const response = await dataClient.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            parts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  reason: { type: "string" },
                  priority: { type: "string" },
                  estimated_cost: { type: "string" }
                }
              }
            },
            diagnostic_notes: { type: "string" },
            estimated_time: { type: "number" },
            difficulty: { type: "string" }
          }
        }
      });

      setSuggestions(response);

    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Error generando sugerencias');
    } finally {
      setLoading(false);
    }
  };

  if (!deviceType || !problem) return null;

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-purple-600/10 to-blue-600/10 border-purple-500/20">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-8 h-8 animate-pulse mx-auto mb-2 text-purple-400" />
          <p className="text-gray-400 text-sm">Analizando y generando sugerencias...</p>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions) return null;

  const priorityColors = {
    high: 'bg-red-600/20 text-red-300 border-red-500/30',
    medium: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
    low: 'bg-blue-600/20 text-blue-300 border-blue-500/30'
  };

  const difficultyLabels = {
    easy: '✅ Fácil',
    medium: '⚠️ Intermedio',
    hard: '🔥 Difícil'
  };

  return (
    <Card className="bg-gradient-to-br from-purple-600/10 to-blue-600/10 border-2 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          Sugerencias de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Diagnóstico y Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20">
            <p className="text-xs text-gray-400 mb-1">Tiempo Estimado</p>
            <p className="text-lg font-bold text-purple-400">
              {suggestions.estimated_time || 60} min
            </p>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20">
            <p className="text-xs text-gray-400 mb-1">Dificultad</p>
            <p className="text-lg font-bold text-purple-400">
              {difficultyLabels[suggestions.difficulty] || suggestions.difficulty}
            </p>
          </div>
        </div>

        {suggestions.diagnostic_notes && (
          <div className="bg-black/30 rounded-lg p-3 border border-blue-500/20">
            <p className="text-xs text-blue-300 font-semibold mb-1">📋 Notas de Diagnóstico</p>
            <p className="text-sm text-gray-300">{suggestions.diagnostic_notes}</p>
          </div>
        )}

        {/* Partes Sugeridas */}
        {suggestions.parts && suggestions.parts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-purple-300">Partes Recomendadas:</p>
            {suggestions.parts.map((part, idx) => (
              <div key={idx} className="bg-black/30 rounded-lg p-3 border border-purple-500/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold">{part.name}</p>
                      <Badge className={priorityColors[part.priority] || priorityColors.medium}>
                        {part.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{part.reason}</p>
                    <p className="text-emerald-400 text-sm font-semibold">
                      ~{part.estimated_cost}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onAddPart && onAddPart(part)}
                    className="bg-gradient-to-r from-purple-600 to-blue-600"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={generateSuggestions}
          variant="outline"
          className="w-full border-purple-500/30"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Actualizar Sugerencias
        </Button>
      </CardContent>
    </Card>
  );
}
