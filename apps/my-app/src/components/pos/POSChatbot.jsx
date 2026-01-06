import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client'; // audit fix: use base44 instead of dataClient
import { Bot, User, X, Send, Loader2, Package, DollarSign } from 'lucide-react'; // audit fix: removed unused MessageCircle, Search
import { toast } from 'sonner';

export default function POSChatbot({ currentCustomer, onAddToCart }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '🤖 Hola! Soy tu asistente del POS. Puedo ayudarte a:\n• Buscar productos y servicios\n• Estimar costos de reparación\n• Consultar órdenes de clientes\n\n¿Qué necesitas?',
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
      // audit fix: use base44 consistently
      const [products, services, orders] = await Promise.all([
        base44.entities.Product.filter({ active: true }),
        base44.entities.Service.filter({ active: true }),
        currentCustomer ? base44.entities.Order.filter({ customer_id: currentCustomer.id }, '-created_date', 5) : Promise.resolve([])
      ]);

      const prompt = `Eres un asistente de punto de venta para técnicos. Ayúdalos a trabajar rápido y eficientemente.

PREGUNTA DEL TÉCNICO:
${input}

${currentCustomer ? `
CLIENTE ACTUAL EN POS:
- Nombre: ${currentCustomer.name}
- Teléfono: ${currentCustomer.phone}
- Órdenes previas: ${currentCustomer.total_orders || 0}
- Total gastado: $${currentCustomer.total_spent || 0}

ÓRDENES RECIENTES DE ESTE CLIENTE:
${orders.slice(0, 5).map(o => `
  #${o.order_number}:
  - Estado: ${o.status}
  - Dispositivo: ${o.device_type} ${o.device_brand || ''} ${o.device_model || ''}
  - Problema: ${o.initial_problem || 'N/A'}
  - Total: $${o.cost_estimate || 0}
  - Balance: $${o.balance_due || 0}
`).join('\n') || 'Sin órdenes previas'}
` : 'SIN CLIENTE SELECCIONADO'}

INVENTARIO COMPLETO:

PRODUCTOS (${products.length} items):
${products.map(p => `- ${p.name} | $${p.price} | Stock: ${p.stock || 0}${p.category ? ` | Cat: ${p.category}` : ''}`).join('\n')}

SERVICIOS (${services.length} items):
${services.map(s => `- ${s.name} | $${s.price}${s.category ? ` | ${s.category}` : ''}`).join('\n')}

INSTRUCCIONES:
1. Si buscan un producto/servicio: lista hasta 5 opciones relevantes con precio y stock
2. Si piden estimación: calcula costo total basado en productos/servicios necesarios
3. Si consultan orden del cliente: muestra detalles de órdenes recientes
4. Sé directo y conciso - los técnicos están ocupados
5. Si encuentras productos/servicios perfectos, sugiérelos con formato: [PRODUCTO: ID] o [SERVICIO: ID]
6. Si no hay cliente seleccionado y preguntan por órdenes, pídeles que seleccionen uno

Responde en máximo 4 líneas, directo al grano.`;

      // audit fix: use base44 consistently
      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      // Detectar si la IA sugirió productos específicos
      const productMatches = response.match(/\[PRODUCTO:\s*([^\]]+)\]/gi);
      const serviceMatches = response.match(/\[SERVICIO:\s*([^\]]+)\]/gi);

      let processedResponse = response;
      const suggestedItems = [];

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
      console.error('Error in POS chatbot:', error);
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
    { label: '🔍 Buscar pantalla iPhone 12', query: 'Buscar pantalla para iPhone 12' },
    { label: '💰 Estimar reparación', query: 'Estimar costo de cambio de batería' },
    { label: '📋 Órdenes del cliente', query: 'Consultar órdenes del cliente actual' },
    { label: '⚡ Servicios más vendidos', query: 'Cuáles son los servicios más comunes' }
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg hover:shadow-xl z-40 animate-pulse"
        title="Asistente POS"
      >
        <Bot className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[420px] h-[650px] flex flex-col bg-black/95 border-2 border-purple-500/40 shadow-2xl z-50">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white flex flex-row items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <CardTitle className="text-lg">🤖 Asistente POS</CardTitle>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx}>
              <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-cyan-600' 
                    : 'bg-purple-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[75%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-cyan-600/20 text-white'
                    : 'bg-purple-600/10 text-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.timestamp.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Suggested items to add to cart */}
              {msg.suggestedItems && msg.suggestedItems.length > 0 && (
                <div className="mt-2 ml-10 space-y-2">
                  <p className="text-xs text-purple-300 font-bold">💡 Añadir al carrito:</p>
                  {msg.suggestedItems.map((item, itemIdx) => (
                    <button
                      key={itemIdx}
                      onClick={() => {
                        if (onAddToCart) {
                          onAddToCart(item, item.type);
                          toast.success(`${item.name} añadido al carrito`);
                        }
                      }}
                      className="w-full flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border border-emerald-500/30 rounded-lg hover:border-emerald-500/60 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        {item.type === 'product' ? (
                          <Package className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <DollarSign className="w-4 h-4 text-blue-400" />
                        )}
                        <div className="text-left">
                          <p className="text-white text-sm font-bold">{item.name}</p>
                          <p className="text-xs text-gray-400">
                            {item.type === 'product' && `Stock: ${item.stock || 0} • `}
                            ${item.price}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        + Añadir
                      </Button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-purple-600/10 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="p-3 border-t border-purple-500/20">
            <p className="text-xs text-gray-400 mb-2">Consultas rápidas:</p>
            <div className="flex flex-wrap gap-2">
              {quickQueries.map((qa, idx) => (
                <Badge
                  key={idx}
                  className="cursor-pointer bg-purple-600/20 text-purple-300 hover:bg-purple-600/30"
                  onClick={() => setInput(qa.query)}
                >
                  {qa.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-purple-500/20">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Escribe tu consulta..."
              className="bg-black/40 border-purple-500/30 text-white"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
