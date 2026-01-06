// ⭐️ AI CHATBOT PARA DASHBOARD - Asistente inteligente
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useI18n } from "@/components/utils/i18n";

export default function AIChatbot() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      // Obtener contexto del negocio
      const [customers, orders, products] = await Promise.all([
        base44.entities.Customer.list("-updated_date", 10).catch(() => []),
        base44.entities.Order.list("-updated_date", 10).catch(() => []),
        base44.entities.Product.list("-updated_date", 10).catch(() => [])
      ]);

      const context = `
Eres un asistente inteligente de SmartFixOS, un sistema de gestión para talleres de reparación de dispositivos.

Datos del negocio:
- Clientes recientes: ${customers.length}
- Órdenes activas: ${orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length}
- Productos en inventario: ${products.length}

Responde de forma concisa y útil en español. Puedes:
- Ayudar a navegar el sistema
- Sugerir acciones basadas en el contexto
- Responder preguntas sobre órdenes, clientes o inventario
- Dar tips de productividad

Pregunta del usuario: ${userMessage}
      `.trim();

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: context,
        add_context_from_internet: false
      });

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      console.error("Error AI:", err);
      toast.error("Error al procesar tu mensaje");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Lo siento, ocurrió un error. ¿Puedes intentarlo nuevamente?" 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "¿Cómo crear una orden rápida?",
    "¿Qué órdenes tengo pendientes?",
    "¿Cómo mejoro mi inventario?",
    "Dame tips de productividad"
  ];

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform animate-pulse"
        >
          <Sparkles className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Chatbot Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[80vh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Asistente IA</h3>
                <p className="text-xs text-purple-100">SmartFixOS</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Sparkles className="w-12 h-12 mx-auto text-purple-400 mb-3" />
                <p className="text-gray-400 text-sm mb-4">
                  ¡Hola! Soy tu asistente IA. ¿En qué puedo ayudarte?
                </p>
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(s)}
                      className="w-full text-left px-3 py-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 rounded-lg text-xs text-gray-300 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-slate-800 text-gray-200 border border-purple-500/20"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-purple-500/20 px-4 py-2 rounded-2xl">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-purple-500/30 bg-slate-900/50">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe tu mensaje..."
                className="flex-1 bg-slate-800 border-purple-500/30 text-white placeholder:text-gray-500"
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
