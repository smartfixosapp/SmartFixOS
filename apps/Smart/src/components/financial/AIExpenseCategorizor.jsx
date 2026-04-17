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
    high: 'bg-apple-green/15 text-apple-green border-0',
    medium: 'bg-apple-yellow/15 text-apple-yellow border-0',
    low: 'bg-apple-red/15 text-apple-red border-0'
  };

  const categoryLabels = {
    repair_payment: '🔧 Reparaciones',
    parts: '📦 Piezas',
    supplies: '📝 Suministros',
    other_expense: '💰 Otros',
    refund: '↩️ Reembolsos'
  };

  return (
    <div className="apple-type space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-apple-purple apple-text-footnote">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analizando gasto...</span>
        </div>
      ) : suggestion ? (
        <div className="apple-card bg-apple-purple/12 rounded-apple-md p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-apple-purple" />
            <span className="apple-text-footnote font-semibold text-apple-purple">Sugerencia de IA</span>
            <Badge className={confidenceColors[suggestion.confidence]}>
              {suggestion.confidence === 'high' ? '✓ Alta' :
               suggestion.confidence === 'medium' ? '~ Media' : '? Baja'} confianza
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="apple-text-footnote apple-label-secondary">Categoría sugerida:</span>
            <Badge className="bg-apple-blue/15 text-apple-blue border-0">
              {categoryLabels[suggestion.category] || suggestion.category}
            </Badge>
          </div>

          <p className="apple-text-caption1 apple-label-secondary">{suggestion.reasoning}</p>

          {suggestion.alternative_categories?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="apple-text-caption1 apple-label-tertiary">Alternativas:</span>
              {suggestion.alternative_categories.map((cat, idx) => (
                <Badge key={idx} variant="outline" className="apple-text-caption2 border-0 bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary">
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
