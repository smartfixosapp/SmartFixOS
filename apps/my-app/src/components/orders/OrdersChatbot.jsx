import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Bot, User, X, Send, Loader2, ClipboardList, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OrdersChatbot({ orders = [], onOpenOrder }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '🤖 Hola! Soy tu asistente de órdenes. Puedo ayudarte a:\n• Consultar estado de órdenes\n• Buscar por cliente o empresa\n• Filtrar por dispositivo o problema\n• Resumir órdenes pendientes\n\n¿Qué necesitas saber?',
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
      const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes((o.status || '').toLowerCase()));
      const b2bOrders = orders.filter(o => o.company_id || o.company_name);

      const prompt = `Eres un asistente de gestión de órdenes de trabajo. Ayuda al equipo a encontrar información rápidamente.

PREGUNTA DEL USUARIO:
${input}

ÓRDENES ACTIVAS (${activeOrders.length}):
${activeOrders.slice(0, 20).map(o => `
#${o.order_number}:
- Cliente: ${o.customer_name}${o.company_name ? ` (Empresa: ${o.company_name})` : ''}
- Teléfono: ${o.customer_phone || 'N/A'}
- Dispositivo: ${o.device_type || ''} ${o.device_brand || ''} ${o.device_model || ''}
- Serial/IMEI: ${o.device_serial || 'N/A'}
- Problema: ${o.initial_problem || 'N/A'}
- Estado: ${o.status}
- Prioridad: ${o.priority || 'normal'}
- Balance: $${o.balance_due || 0}
- Asignado a: ${o.assigned_to_name || 'No asignado'}
- Fecha: ${o.created_date ? new Date(o.created_date).toLocaleDateString('es-PR') : 'N/A'}
`).join('\n')}

ÓRDENES B2B (${b2bOrders.length}):
${b2bOrders.slice(0, 10).map(o => `
#${o.order_number}: ${o.company_name} - ${o.device_model} - ${o.status}
`).join('\n')}

INSTRUCCIONES:
1. Si buscan por cliente/empresa: muestra órdenes coincidentes con #orden
2. Si preguntan por estado: lista órdenes en ese estado
3. Si piden resumen: da estadísticas (pendientes, en progreso, listas)
4. Si mencionan un #orden específico: da detalles completos
5. Sé conciso - máximo 5 líneas
6. Si encuentras una orden específica, sugiérela con formato: [ORDEN: order_id]

Responde en español, directo y profesional.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      // Detectar órdenes sugeridas
      const orderMatches = response.match(/\[ORDEN:\s*([^\]]+)\]/gi);
      const suggestedOrders = [];

      let processedResponse = response;

      if (orderMatches && onOpenOrder) {
        for (const match of orderMatches) {
          const orderId = match.replace(/\[ORDEN:\s*|\]/gi, '').trim();
          const order = orders.find(o => o.id === orderId || o.order_number === orderId);
          if (order) {
            suggestedOrders.push(order);
            processedResponse = processedResponse.replace(match, `✅ #${order.order_number}`);
          }
        }
      }

      const assistantMessage = {
        role: 'assistant',
        content: processedResponse,
        timestamp: new Date(),
        suggestedOrders
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error in Orders chatbot:', error);
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
    { label: '📋 Órdenes pendientes', query: 'Cuántas órdenes están pendientes de diagnóstico' },
    { label: '🏢 B2B activas', query: 'Mostrar órdenes de empresas activas' },
    { label: '⚡ Alta prioridad', query: 'Órdenes urgentes o de alta prioridad' },
    { label: '💰 Balance total', query: 'Cuánto balance pendiente hay en total' }
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="orders-chatbot-trigger fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg hover:shadow-xl z-40 animate-pulse"
        title="Asistente de Órdenes"
      >
        <Bot className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[95vw] max-w-[420px] h-[90vh] max-h-[650px] flex flex-col bg-black/95 border-2 border-blue-500/40 shadow-2xl z-50">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex flex-row items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <CardTitle className="text-base sm:text-lg">🤖 Asistente Órdenes</CardTitle>
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
                    : 'bg-blue-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[75%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-cyan-600/20 text-white'
                    : 'bg-blue-600/10 text-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.timestamp.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Suggested orders to open */}
              {msg.suggestedOrders && msg.suggestedOrders.length > 0 && (
                <div className="mt-2 ml-10 space-y-2">
                  <p className="text-xs text-blue-300 font-bold">💡 Abrir orden:</p>
                  {msg.suggestedOrders.map((order, orderIdx) => (
                    <button
                      key={orderIdx}
                      onClick={() => {
                        if (onOpenOrder) {
                          onOpenOrder(order.id);
                          toast.success(`Abriendo orden #${order.order_number}`);
                          setIsOpen(false);
                        }
                      }}
                      className="w-full flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg hover:border-cyan-500/60 transition-all"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {order.company_name ? (
                          <Building2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        ) : (
                          <ClipboardList className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        )}
                        <div className="text-left min-w-0">
                          <p className="text-white text-sm font-bold truncate">#{order.order_number}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {order.customer_name} • {order.device_model}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-cyan-600 hover:bg-cyan-700 flex-shrink-0"
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
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-blue-600/10 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="p-3 border-t border-blue-500/20">
            <p className="text-xs text-gray-400 mb-2">Consultas rápidas:</p>
            <div className="grid grid-cols-2 gap-2">
              {quickQueries.map((qa, idx) => (
                <Badge
                  key={idx}
                  className="cursor-pointer bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 justify-center py-2"
                  onClick={() => setInput(qa.query)}
                >
                  {qa.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-blue-500/20">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pregunta sobre órdenes..."
              className="bg-black/40 border-blue-500/30 text-white text-sm"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
