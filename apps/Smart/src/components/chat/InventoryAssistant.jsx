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
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white rounded-full p-4 shadow-lg flex items-center justify-center"
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
        className="fixed bottom-6 right-6 z-40 w-96 max-h-96 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-white">Asistente de Inventario</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-8">
              <p>👋 Pregúntame sobre productos, stock o búsquedas.</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-cyan-600/50 text-white"
                    : "bg-white/10 text-slate-100"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown className="text-sm prose prose-invert prose-sm max-w-none">
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 px-4 py-2 rounded-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-sm text-slate-400">Procesando...</span>
              </div>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 0 && (
          <div className="px-3 py-2 border-t border-white/10 space-y-1">
            <p className="text-xs text-slate-400 mb-2">Acciones rápidas:</p>
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
                  className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/10 text-slate-300 transition-all flex items-center gap-1"
                >
                  <action.icon className="w-3 h-3" />
                  {action.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-white/10 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar producto, análisis, crear orden..."
            className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
