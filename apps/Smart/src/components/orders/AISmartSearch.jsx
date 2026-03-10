import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataClient } from '@/components/api/dataClient';
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AISmartSearch({ orders, onSelectOrder }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState(null);

  const handleSearch = async () => {
    if (!query.trim() || searching) return;

    setSearching(true);
    try {
      // Búsqueda tradicional primero
      const lowerQuery = query.toLowerCase();
      const basicResults = orders.filter(o => 
        o.order_number?.toLowerCase().includes(lowerQuery) ||
        o.customer_name?.toLowerCase().includes(lowerQuery) ||
        o.customer_phone?.toLowerCase().includes(lowerQuery) ||
        o.device_type?.toLowerCase().includes(lowerQuery) ||
        o.device_model?.toLowerCase().includes(lowerQuery) ||
        o.initial_problem?.toLowerCase().includes(lowerQuery)
      );

      // Búsqueda semántica con IA
      const ordersSummary = orders.slice(0, 50).map(o => ({
        id: o.id,
        number: o.order_number,
        customer: o.customer_name,
        device: `${o.device_type} ${o.device_brand || ''} ${o.device_model || ''}`.trim(),
        problem: o.initial_problem || '',
        status: o.status
      }));

      const aiResponse = await dataClient.integrations.Core.InvokeLLM({
        prompt: `Analiza esta búsqueda de un usuario: "${query}"

Órdenes disponibles:
${JSON.stringify(ordersSummary, null, 2)}

Responde en JSON con:
- matching_orders: array de IDs de órdenes que mejor coinciden (máximo 5)
- interpretation: qué está buscando el usuario
- suggestions: array de sugerencias para refinar la búsqueda
- relevant_terms: términos clave detectados`,
        response_json_schema: {
          type: "object",
          properties: {
            matching_orders: {
              type: "array",
              items: { type: "string" }
            },
            interpretation: { type: "string" },
            suggestions: {
              type: "array",
              items: { type: "string" }
            },
            relevant_terms: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      // Combinar resultados
      const aiMatchedOrders = orders.filter(o => 
        aiResponse.matching_orders?.includes(o.id)
      );

      const combined = [...new Set([...aiMatchedOrders, ...basicResults])];
      
      setResults(combined);
      setAiSuggestions(aiResponse);

      if (combined.length === 0) {
        toast.info('No se encontraron resultados');
      }

    } catch (error) {
      console.error('Error in smart search:', error);
      toast.error('Error en búsqueda inteligente');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Busca por cliente, dispositivo, problema, número de orden..."
            className="pl-10 bg-black/40 border-cyan-500/20 text-white theme-light:bg-white"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </Button>
      </div>

      {aiSuggestions && (
        <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-4">
          <p className="text-purple-300 text-sm mb-2">
            <Sparkles className="w-4 h-4 inline mr-1" />
            {aiSuggestions.interpretation}
          </p>
          {aiSuggestions.relevant_terms?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {aiSuggestions.relevant_terms.map((term, idx) => (
                <Badge key={idx} className="bg-purple-600/20 text-purple-300">
                  {term}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
          </p>
          {results.slice(0, 10).map((order) => (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order)}
              className="p-4 bg-black/30 rounded-lg border border-cyan-500/10 hover:border-cyan-500/30 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-cyan-600/20 text-cyan-300 font-mono">
                      {order.order_number}
                    </Badge>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                  <p className="text-white font-semibold">{order.customer_name}</p>
                  <p className="text-sm text-gray-400">
                    {order.device_type} {order.device_brand} {order.device_model}
                  </p>
                  {order.initial_problem && (
                    <p className="text-xs text-gray-500 mt-1">{order.initial_problem}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
