import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Loader2, MessageCircle, TrendingUp, AlertTriangle, Users, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

export default function InventoryAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initializeChat = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: "inventoryAssistant",
        metadata: {
          name: "Consulta de Inventario",
          description: "Chat con asistente de inventario"
        }
      });
      setConversationId(conv.id);
    } catch (err) {
      console.error("Error inicializando chat:", err);
    }
  };

  useEffect(() => {
    if (isOpen && !conversationId) {
      initializeChat();
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      setMessages(data.messages || []);
    });

    return () => unsubscribe?.();
  }, [conversationId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !conversationId || loading) return;

    setLoading(true);
    const userMessage = input;
    setInput("");

    try {
      // Detectar acciones rápidas
      const lowerInput = userMessage.toLowerCase();
      let analyticsData = null;

      if (lowerInput.includes('stock bajo') || lowerInput.includes('low stock')) {
        analyticsData = await base44.functions.invoke('aiAnalytics', {
          action: 'lowStock',
          limit: 5
        });
      } else if (lowerInput.includes('productos') && (lowerInput.includes('venta') || lowerInput.includes('vendidos'))) {
        analyticsData = await base44.functions.invoke('aiAnalytics', {
          action: 'topProducts',
          limit: 5
        });
      } else if (lowerInput.includes('rentabilidad') || lowerInput.includes('margen')) {
        analyticsData = await base44.functions.invoke('aiAnalytics', {
          action: 'profitability',
          limit: 5
        });
      } else if (lowerInput.includes('inactivos') || lowerInput.includes('clientes inactivos')) {
        analyticsData = await base44.functions.invoke('aiAnalytics', {
          action: 'inactiveCustomers',
          limit: 5
        });
      }

      const conv = await base44.agents.getConversation(conversationId);
      const messageContent = analyticsData
        ? `${userMessage}\n\n[Datos adjuntos: ${JSON.stringify(analyticsData, null, 2)}]`
        : userMessage;

      await base44.agents.addMessage(conv, {
        role: "user",
        content: messageContent
      });
    } catch (err) {
      console.error("Error enviando mensaje:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="apple-type apple-press fixed bottom-6 right-6 z-40 bg-apple-blue text-white rounded-full p-4 shadow-apple-lg flex items-center justify-center"
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="apple-type fixed bottom-6 right-6 z-40 w-96 max-h-96 apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-apple-blue/12 flex justify-between items-center" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <h3 className="apple-text-subheadline font-semibold apple-label-primary">Asistente de Inventario</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="apple-label-secondary hover:apple-label-primary text-xl"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
          {messages.length === 0 && (
            <div className="text-center apple-label-tertiary apple-text-footnote py-8">
              <p>👋 Pregúntame sobre productos, stock o búsquedas.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-apple-md ${
                  msg.role === "user"
                    ? "bg-apple-blue text-white"
                    : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown className="apple-text-footnote prose prose-invert prose-sm max-w-none">
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p className="apple-text-footnote">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-sys6 dark:bg-gray-sys5 px-4 py-2 rounded-apple-md flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-apple-blue" />
                <span className="apple-text-footnote apple-label-secondary">Procesando...</span>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 0 && (
          <div className="px-3 py-2 space-y-1" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
            <p className="apple-text-caption1 apple-label-tertiary mb-2">Acciones rápidas:</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                { icon: AlertTriangle, text: 'Stock bajo', cmd: 'stock bajo' },
                { icon: TrendingUp, text: 'Productos top', cmd: 'productos vendidos' },
                { icon: DollarSign, text: 'Rentabilidad', cmd: 'rentabilidad' },
                { icon: Users, text: 'Inactivos', cmd: 'clientes inactivos' }
              ].map((action) => (
                <button
                  key={action.text}
                  onClick={() => setInput(action.cmd)}
                  className="apple-press apple-text-caption1 bg-gray-sys6 dark:bg-gray-sys5 hover:bg-gray-sys5 dark:hover:bg-gray-sys4 px-2 py-1 rounded-apple-sm apple-label-secondary transition-all flex items-center gap-1"
                >
                  <action.icon className="w-3 h-3" />
                  {action.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSendMessage} className="px-4 py-3 flex gap-2" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar producto, análisis, crear orden..."
            className="apple-input apple-text-footnote"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="apple-btn apple-btn-primary"
            size="icon"
            aria-label="Enviar mensaje al asistente"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
