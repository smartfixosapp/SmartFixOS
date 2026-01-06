import React, { useState, useEffect } from 'react';
import { dataClient } from '@/components/api/dataClient';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';

export default function AIExpenseCategorizor({ description, amount, onCategorySuggestion }) {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (description && description.length > 3) {
      const timer = setTimeout(() => {
        categorizeExpense();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [description]);

  const categorizeExpense = async () => {
    if (!description || loading) return;

    setLoading(true);
    try {
      // Cargar historial de gastos para aprender patrones
      const recentExpenses = await dataClient.entities.Transaction.filter(
        { type: 'expense' },
        '-created_date',
        50
      );

      const expensePatterns = recentExpenses.map(e => ({
        description: e.description,
        category: e.category,
        amount: e.amount
      }));

      const response = await dataClient.integrations.Core.InvokeLLM({
        prompt: `Categoriza este gasto basándote en el historial:

NUEVO GASTO:
Descripción: "${description}"
Monto: $${amount || 0}

HISTORIAL DE GASTOS PREVIOS:
${expensePatterns.slice(0, 20).map(e => 
  `"${e.description}" → ${e.category} ($${e.amount})`
).join('\n')}

CATEGORÍAS DISPONIBLES:
- repair_payment: Pagos de reparaciones
- parts: Piezas y componentes
- supplies: Suministros generales
- other_expense: Otros gastos
- refund: Reembolsos

Responde en JSON con:
- category: categoría sugerida
- confidence: high/medium/low
- reasoning: por qué elegiste esta categoría
- alternative_categories: array de categorías alternativas`,
        response_json_schema: {
          type: "object",
          properties: {
            category: { type: "string" },
            confidence: { type: "string" },
            reasoning: { type: "string" },
            alternative_categories: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setSuggestion(response);
      
      if (onCategorySuggestion && response.confidence === 'high') {
        onCategorySuggestion(response.category);
      }

    } catch (error) {
      console.error('Error categorizing expense:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!description || description.length < 3) return null;

  const confidenceColors = {
    high: 'bg-green-600/20 text-green-300 border-green-500/30',
    medium: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
    low: 'bg-red-600/20 text-red-300 border-red-500/30'
  };

  const categoryLabels = {
    repair_payment: '🔧 Reparaciones',
    parts: '📦 Piezas',
    supplies: '📝 Suministros',
    other_expense: '💰 Otros',
    refund: '↩️ Reembolsos'
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-purple-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analizando gasto...</span>
        </div>
      ) : suggestion ? (
        <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-purple-300">Sugerencia de IA</span>
            <Badge className={confidenceColors[suggestion.confidence]}>
              {suggestion.confidence === 'high' ? '✓ Alta' : 
               suggestion.confidence === 'medium' ? '~ Media' : '? Baja'} confianza
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Categoría sugerida:</span>
            <Badge className="bg-cyan-600/20 text-cyan-300">
              {categoryLabels[suggestion.category] || suggestion.category}
            </Badge>
          </div>

          <p className="text-xs text-gray-400">{suggestion.reasoning}</p>

          {suggestion.alternative_categories?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs text-gray-500">Alternativas:</span>
              {suggestion.alternative_categories.map((cat, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {categoryLabels[cat] || cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
