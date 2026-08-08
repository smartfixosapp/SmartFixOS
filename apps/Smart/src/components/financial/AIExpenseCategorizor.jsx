import React, { useState, useEffect } from 'react';
import { dataClient } from '@/components/api/dataClient';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTION_URL || "https://smartfixos.onrender.com";

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

      // Gemini (gratis), no OpenAI vía /ai/invoke — ver geminiCategorizeExpense.js
      const res = await fetch(`${FUNCTIONS_URL}/ai/categorize-expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: amount || 0,
          recentExpenses: expensePatterns,
        }),
      });
      const response = await res.json();
      if (!res.ok) throw new Error(response?.error || 'No se pudo categorizar el gasto');

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
