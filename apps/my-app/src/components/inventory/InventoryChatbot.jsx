import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Bot, User, X, Send, Loader2, Package, Wrench } from 'lucide-react';
import { toast } from 'sonner';

export default function InventoryChatbot({ products = [], services = [], onSelectItem }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '🤖 Hola! Soy tu asistente de inventario. Puedo ayudarte a:\n• Encontrar piezas por modelo de dispositivo\n• Buscar servicios compatibles\n• Verificar stock disponible\n• Sugerir alternativas\n\n¿Qué necesitas?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const lowStock = products.filter(p => p.stock <= (p.min_stock || 5));
      const activeOffers = products.filter(p => p.discount_active && p.discount_percentage > 0);

      const prompt = `Eres un asistente de inventario para una tienda de reparaciones. Ayuda a encontrar piezas y servicios rápidamente.

PREGUNTA DEL TÉCNICO:
${input}

PRODUCTOS DISPONIBLES (${products.length}):
${products.slice(0, 30).map(p => `
- ${p.name}
  Categoría: ${p.device_category || 'N/A'} | Tipo: ${p.part_type || 'N/A'}
  Precio: $${p.price} | Costo: $${p.cost || 0} | Stock: ${p.stock || 0}
  ${p.compatibility_models?.length ? `Compatible: ${p.compatibility_models.slice(0, 3).join(', ')}` : ''}
  ${p.discount_active ? `OFERTA: -${p.discount_percentage}%` : ''}
`).join('\n')}

SERVICIOS (${services.length}):
${services.map(s => `
- ${s.name} | $${s.price} | ${s.category || 'N/A'}
  ${s.compatibility ? `Compatible: ${s.compatibility}` : ''}
`).join('\n')}

STOCK BAJO (${lowStock.length}):
${lowStock.slice(0, 5).map(p => `- ${p.name}: ${p.stock} unidades`).join('\n')}

OFERTAS ACTIVAS (${activeOffers.length}):
${activeOffers.slice(0, 5).map(p => `- ${p.name}: -${p.discount_percentage}% | ${p.discount_label || ''}`).join('\n')}

INSTRUCCIONES:
1. Si buscan pieza para un modelo: sugiere hasta 3 opciones compatibles con stock
2. Si piden servicio: muestra opciones con precios
3. Si preguntan stock: da números exactos
4. Si hay ofertas relevantes: menciónalo
5. Sé conciso - máximo 5 líneas
6. Si encuentras productos/servicios exactos, sugiérelos con: [PRODUCTO: id] o [SERVICIO: id]

Responde en español, técnico y directo.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      // Detectar productos/servicios sugeridos
      const productMatches = response.match(/\[PRODUCTO:\s*([^\]]+)\]/gi);
      const serviceMatches = response.match(/\[SERVICIO:\s*([^\]]+)\]/gi);
      const suggestedItems = [];

      let processedResponse = response;

      if (productMatches) {
        for (const match of productMatches) {
          const productId = match.replace(/\[PRODUCTO:\s*|\]/gi, '').trim();
          const product = products.find(p => p.id === productId || p.name.toLowerCase().includes(productId.toLowerCase()));
          if (product) {
            suggestedItems.push({ ...product, type: 'product' });
            processedResponse = processedResponse.replace(match, `✅ ${product.name}`);
          }
        }
      }

      if (serviceMatches) {
        for (const match of serviceMatches) {
          const serviceId = match.replace(/\[SERVICIO:\s*|\]/gi, '').trim();
          const service = services.find(s => s.id === serviceId || s.name.toLowerCase().includes(serviceId.toLowerCase()));
          if (service) {
            suggestedItems.push({ ...service, type: 'service' });
            processedResponse = processedResponse.replace(match, `✅ ${service.name}`);
          }
        }
      }

      const assistantMessage = {
        role: 'assistant',
        content: processedResponse,
        timestamp: new Date(),
        suggestedItems
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error in Inventory chatbot:', error);
      toast.error('Error al procesar tu consulta');
      
      const errorMessage = {
        role: 'assistant',
        content: 'Error procesando la consulta. Intenta de nuevo.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const quickQueries = [
    { label: '🔍 Pantalla iPhone 13', query: 'Buscar pantalla compatible con iPhone 13' },
    { label: '🔋 Baterías Samsung', query: 'Mostrar baterías Samsung disponibles' },
    { label: '📦 Stock bajo', query: 'Qué productos tienen stock bajo' },
    { label: '🏷️ Ofertas activas', query: 'Mostrar ofertas activas' }
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-lime-600 shadow-lg hover:shadow-xl z-40 animate-pulse"
        title="Asistente de Inventario"
      >
        <Bot className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[95vw] max-w-[420px] h-[90vh] max-h-[650px] flex flex-col bg-black/95 border-2 border-emerald-500/40 shadow-2xl z-50">
      <CardHeader className="bg-gradient-to-r from-emerald-600 to-lime-600 text-white flex flex-row items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <CardTitle className="text-base sm:text-lg">🤖 Asistente Inventario</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-white/20 h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx}>
              <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-cyan-600' 
                    : 'bg-emerald-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[75%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-cyan-600/20 text-white'
                    : 'bg-emerald-600/10 text-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.timestamp.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Suggested items */}
              {msg.suggestedItems && msg.suggestedItems.length > 0 && (
                <div className="mt-2 ml-10 space-y-2">
                  <p className="text-xs text-emerald-300 font-bold">💡 Items sugeridos:</p>
                  {msg.suggestedItems.map((item, itemIdx) => (
                    <button
                      key={itemIdx}
                      onClick={() => {
                        if (onSelectItem) {
                          onSelectItem(item);
                          toast.success(`${item.name} seleccionado`);
                        }
                      }}
                      className="w-full flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-emerald-600/20 to-lime-600/20 border border-emerald-500/30 rounded-lg hover:border-emerald-500/60 transition-all"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.type === 'product' ? (
                          <Package className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Wrench className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        )}
                        <div className="text-left min-w-0">
                          <p className="text-white text-sm font-bold truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">
                            {item.type === 'product' && `Stock: ${item.stock || 0} • `}
                            ${item.price}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0 text-xs"
                      >
                        Ver
                      </Button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-emerald-600/10 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="p-3 border-t border-emerald-500/20">
            <p className="text-xs text-gray-400 mb-2">Consultas rápidas:</p>
            <div className="grid grid-cols-2 gap-2">
              {quickQueries.map((qa, idx) => (
                <Badge
                  key={idx}
                  className="cursor-pointer bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 justify-center py-2 text-[10px]"
                  onClick={() => setInput(qa.query)}
                >
                  {qa.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-emerald-500/20">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Buscar piezas o servicios..."
              className="bg-black/40 border-emerald-500/30 text-white text-sm"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-emerald-600 to-lime-600 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
