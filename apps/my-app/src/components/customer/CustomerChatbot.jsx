import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client'; // audit fix: use base44 instead of dataClient
import { MessageCircle, Send, Loader2, Bot, User, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerChatbot({ customerId, orderContext }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
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
      const [products, services, orders, customer] = await Promise.all([
        base44.entities.Product.filter({ active: true }),
        base44.entities.Service.filter({ active: true }),
        customerId ? base44.entities.Order.filter({ customer_id: customerId }, '-created_date', 10) : Promise.resolve([]),
        customerId ? base44.entities.Customer.get(customerId) : Promise.resolve(null)
      ]);

      const prompt = `Eres un asistente virtual de un negocio de reparación de dispositivos. Responde de forma amigable y profesional.

PREGUNTA DEL CLIENTE:
${input}

CONTEXTO DEL CLIENTE:
${customer ? `
- Nombre: ${customer.name}
- Órdenes previas: ${customer.total_orders || 0}
- Puntos de lealtad: ${customer.loyalty_points || 0}
- Nivel: ${customer.loyalty_tier || 'bronze'}
` : 'Cliente nuevo o sin identificar'}

${orderContext ? `
ORDEN ACTUAL EN CONTEXTO:
- Número: ${orderContext.order_number}
- Dispositivo: ${orderContext.device_type} ${orderContext.device_brand || ''} ${orderContext.device_model || ''}
- Estado: ${orderContext.status}
- Problema: ${orderContext.initial_problem || 'No especificado'}
` : ''}

ÓRDENES RECIENTES DEL CLIENTE:
${orders.slice(0, 3).map(o => `- #${o.order_number}: ${o.device_type}, ${o.status}`).join('\n') || 'Sin órdenes previas'}

SERVICIOS DISPONIBLES:
${services.slice(0, 15).map(s => `- ${s.name}: $${s.price} (${s.duration_minutes || 60}min)`).join('\n')}

PRODUCTOS DISPONIBLES:
${products.slice(0, 20).map(p => `- ${p.name}: $${p.price} (Stock: ${p.stock})`).join('\n')}

CAPACIDADES:
- Consultar precios y disponibilidad
- Revisar estado de órdenes
- Estimar costos de reparación
- Explicar procesos y tiempos
- Responder preguntas generales
- Recomendar servicios

Responde de forma:
1. Clara y concisa (máximo 3-4 párrafos)
2. Amigable y profesional
3. Con información específica cuando sea posible
4. Sugiere próximos pasos si es relevante

Si no tienes información suficiente, pide más detalles al cliente.`;

      // audit fix: use base44 consistently
      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      const assistantMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error in chatbot:', error);
      toast.error('Error al procesar tu mensaje');
      
      const errorMessage = {
        role: 'assistant',
        content: 'Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo?',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: '¿Cuánto cuesta reparar una pantalla?', action: '¿Cuánto cuesta reparar una pantalla?' },
    { label: 'Estado de mi orden', action: '¿Cuál es el estado de mi orden?' },
    { label: 'Horarios de atención', action: '¿Cuál es el horario de atención?' },
    { label: 'Garantías', action: '¿Qué garantía tienen las reparaciones?' }
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg hover:shadow-xl z-50"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[600px] flex flex-col bg-black/95 border-2 border-purple-500/40 shadow-2xl z-50">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white flex flex-row items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <CardTitle className="text-lg">Asistente Virtual</CardTitle>
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
            <div
              key={idx}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
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
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {msg.timestamp.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
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
            <p className="text-xs text-gray-400 mb-2">Preguntas frecuentes:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((qa, idx) => (
                <Badge
                  key={idx}
                  className="cursor-pointer bg-purple-600/20 text-purple-300 hover:bg-purple-600/30"
                  onClick={() => setInput(qa.action)}
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
              placeholder="Escribe tu pregunta..."
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
