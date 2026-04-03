import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Send, Loader2, Sparkles, ChevronDown, ChevronUp,
  Wrench, Zap, AlertTriangle, Lightbulb, RotateCcw, Cpu
} from "lucide-react";
import { callGroqAI } from "@/lib/groqAI";

// ── Preguntas rapidas contextuales por tipo de dispositivo ────────────────────
const QUICK_PROMPTS = {
  smartphone: [
    { icon: Zap,           label: "No enciende",          prompt: "El smartphone no enciende. Que pasos de diagnostico debo seguir?" },
    { icon: AlertTriangle, label: "Pantalla negra",       prompt: "La pantalla esta negra pero el telefono vibra y suena. Que puede ser?" },
    { icon: Wrench,        label: "No carga",             prompt: "El telefono no carga con ningun cable. Como diagnostico si es el puerto o la placa?" },
    { icon: Lightbulb,     label: "Se reinicia solo",     prompt: "El telefono se reinicia solo constantemente. Cuales son las causas mas comunes?" },
  ],
  tablet: [
    { icon: Zap,           label: "No enciende",          prompt: "La tablet no enciende. Pasos de diagnostico?" },
    { icon: AlertTriangle, label: "Tactil no responde",   prompt: "La pantalla muestra imagen pero el tactil no funciona. Que verifico?" },
    { icon: Wrench,        label: "Bateria hinchada",     prompt: "Sospecho que la bateria esta hinchada. Que senales confirman esto y como procedo?" },
  ],
  laptop_windows: [
    { icon: Zap,           label: "No enciende",          prompt: "La laptop no enciende. Diagnostico paso a paso desde la fuente hasta la placa madre." },
    { icon: AlertTriangle, label: "Pantalla azul",        prompt: "La laptop da pantalla azul (BSOD). Como determino si es RAM, disco o software?" },
    { icon: Wrench,        label: "Sobrecalentamiento",   prompt: "La laptop se sobrecalienta y se apaga. Como diagnostico el sistema termico?" },
    { icon: Lightbulb,     label: "Muy lenta",            prompt: "La laptop esta extremadamente lenta. Pasos para diagnosticar si es disco, RAM o malware?" },
  ],
  macbook: [
    { icon: Zap,           label: "No enciende",          prompt: "MacBook no enciende. Diagnostico para modelos Intel vs Apple Silicon." },
    { icon: AlertTriangle, label: "Kernel panic",         prompt: "MacBook tiene kernel panics frecuentes. Como diagnostico la causa?" },
    { icon: Wrench,        label: "No carga / sin luz",   prompt: "MacBook no carga, sin luz en MagSafe o USB-C. Que verifico?" },
    { icon: Lightbulb,     label: "Flexgate / backlight", prompt: "Sospecho flexgate en MacBook. Como confirmo si es el cable flex o el backlight?" },
  ],
  desktop_pc: [
    { icon: Zap,           label: "No enciende",          prompt: "PC desktop no enciende. Diagnostico de fuente de poder y placa madre paso a paso." },
    { icon: AlertTriangle, label: "Beeps / sin POST",     prompt: "La PC hace beeps y no arranca. Como interpreto los codigos de beep?" },
    { icon: Wrench,        label: "Sin video",            prompt: "La PC enciende pero no da video. Como descarto GPU vs RAM vs monitor?" },
  ],
  imac: [
    { icon: Zap,           label: "No enciende",          prompt: "iMac no enciende. Diagnostico de fuente interna y placa madre." },
    { icon: AlertTriangle, label: "Pantalla parpadea",    prompt: "La pantalla del iMac parpadea. Es la GPU, el panel LCD o el cable?" },
  ],
  game_console: [
    { icon: Zap,           label: "No enciende",          prompt: "La consola no enciende. Diagnostico de fuente de poder y placa madre." },
    { icon: AlertTriangle, label: "No lee discos",        prompt: "La consola no lee discos. Como diagnostico la lectora?" },
    { icon: Wrench,        label: "HDMI sin imagen",      prompt: "La consola enciende pero no da imagen por HDMI. Que verifico?" },
  ],
  generic: [
    { icon: Zap,           label: "No enciende",          prompt: "El dispositivo no enciende. Pasos generales de diagnostico?" },
    { icon: Wrench,        label: "Dano por agua",        prompt: "El dispositivo tiene dano por agua. Como procedo con el diagnostico?" },
    { icon: Lightbulb,     label: "Diagnostico general",  prompt: "Dame una guia general de diagnostico paso a paso para este tipo de dispositivo." },
  ],
};

// ── Build system prompt with full order context ──────────────────────────────
function buildSystemPrompt(order, checklist, deviceCategory, mode = "diagnosis") {
  const issues = checklist
    .filter(c => c.status === "issue")
    .map(c => `- ${c.label}${c.notes ? `: ${c.notes}` : ""}`)
    .join("\n");

  const warnings = checklist
    .filter(c => c.status === "warning")
    .map(c => `- ${c.label}${c.notes ? `: ${c.notes}` : ""}`)
    .join("\n");

  const okItems = checklist
    .filter(c => c.status === "ok")
    .map(c => c.label)
    .join(", ");

  const notTested = checklist
    .filter(c => c.status === "not_tested")
    .map(c => c.label)
    .join(", ");

  const modeContext = mode === "repair"
    ? `Eres DARJENI, la asistente de reparacion de SmartFixOS. El tecnico esta EN PROCESO DE REPARAR el dispositivo y necesita ayuda tecnica practica.
Enfocate en: guias de reparacion paso a paso, soldadura, reemplazo de componentes, herramientas necesarias, precauciones, y solucion de problemas durante la reparacion.`
    : `Eres DARJENI, la asistente de diagnostico de SmartFixOS para talleres de reparacion de dispositivos electronicos.`;

  return `${modeContext}

CONTEXTO DEL DISPOSITIVO:
- Tipo: ${deviceCategory}
- Marca: ${order?.device_brand || "No especificada"}
- Modelo: ${order?.device_model || "No especificado"}
- Color: ${order?.device_color || "N/A"}
- Serial: ${order?.device_serial || "N/A"}
- Problema reportado por el cliente: ${order?.initial_problem || "No especificado"}

ESTADO DEL CHECKLIST:
${issues ? `PROBLEMAS ENCONTRADOS:\n${issues}` : "Sin problemas marcados aun."}
${warnings ? `\nREQUIEREN REVISION:\n${warnings}` : ""}
${okItems ? `\nFUNCIONANDO BIEN: ${okItems}` : ""}
${notTested ? `\nSIN PROBAR: ${notTested}` : ""}

REGLAS:
1. Responde SOLO en espanol, conciso y practico
2. Eres experta en reparacion de dispositivos electronicos (microelectronica, software, hardware)
3. Da pasos de diagnostico claros y numerados
4. Si detectas un patron de falla comun, mencionalo
5. Sugiere herramientas necesarias cuando aplique (multimetro, microscopio, ultrasonido, etc.)
6. Si el problema puede ser de placa madre, indica puntos de medicion tipicos
7. NUNCA inventes datos del dispositivo que no esten en el contexto
8. Si hay items del checklist sin probar, sugiere probarlos si son relevantes
9. Maximo 250 palabras por respuesta
10. Usa formato con viñetas o pasos numerados para claridad`;
}

// ── Chat Message Component ───────────────────────────────────────────────────
function ChatMessage({ msg }) {
  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        msg.role === "user"
          ? "bg-purple-600/30 border border-purple-500/20 text-purple-100"
          : "bg-white/[0.06] border border-white/10 text-white/85"
      }`}>
        {msg.role === "assistant" && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">DARJENI</span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.content}</div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function DiagnosticAI({ order, checklist = [], deviceCategory = "generic", mode = "diagnosis" }) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const scrollRef               = useRef(null);
  const inputRef                = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const quickPrompts = QUICK_PROMPTS[deviceCategory] || QUICK_PROMPTS.generic;

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;

    const userMsg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(order, checklist, deviceCategory);

      // Build conversation history for context (last 6 messages)
      const recentHistory = [...messages.slice(-6), userMsg]
        .map(m => `${m.role === "user" ? "Tecnico" : "DARJENI"}: ${m.content}`)
        .join("\n\n");

      const fullPrompt = `${systemPrompt}\n\n--- CONVERSACION ---\n${recentHistory}\n\nDARJENI:`;

      const response = await callGroqAI(fullPrompt, {
        maxTokens: 600,
        temperature: 0.35,
      });

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      console.error("DiagnosticAI error:", err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Error al conectar con la IA. Verifica tu conexion e intentalo de nuevo.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
  };

  // Count issues for the badge
  const issueCount = checklist.filter(c => c.status === "issue").length;
  const warningCount = checklist.filter(c => c.status === "warning").length;

  return (
    <section className="overflow-hidden rounded-[28px] border border-purple-500/15 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] shadow-[0_20px_50px_rgba(0,0,0,0.28)]">

      {/* ── Header / Toggle ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between border-b border-white/10 bg-gradient-to-r from-purple-500/10 via-indigo-500/8 to-transparent px-5 py-4 transition-all hover:from-purple-500/15 sm:px-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-400/25 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 shadow-lg shadow-purple-950/20">
            <Brain className="h-5 w-5 text-purple-300" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black tracking-tight text-white sm:text-lg">Asistente de Diagnostico</h3>
              <Badge className="rounded-full border-0 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-purple-300">
                <Sparkles className="mr-1 h-2.5 w-2.5" />IA
              </Badge>
            </div>
            <p className="text-[11px] text-white/40">
              Preguntale a DARJENI sobre el diagnostico
              {issueCount > 0 && <span className="ml-1 text-red-400">· {issueCount} problema{issueCount > 1 ? "s" : ""} detectado{issueCount > 1 ? "s" : ""}</span>}
              {warningCount > 0 && <span className="ml-1 text-amber-400">· {warningCount} a revisar</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Badge className="rounded-full border-0 bg-white/10 text-[10px] text-white/50">
              {messages.length} msg
            </Badge>
          )}
          {open ? <ChevronUp className="h-5 w-5 text-white/30" /> : <ChevronDown className="h-5 w-5 text-white/30" />}
        </div>
      </button>

      {/* ── Chat Body ── */}
      {open && (
        <div className="flex flex-col">

          {/* Context banner */}
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-2xl border border-white/8 bg-black/25 px-4 py-3 sm:mx-5">
            <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-purple-400/60" />
            <p className="text-[11px] leading-relaxed text-white/40">
              <span className="font-bold text-white/55">
                {order?.device_brand} {order?.device_model}
              </span>
              {order?.initial_problem && (
                <> — "{order.initial_problem}"</>
              )}
              {issueCount > 0 && (
                <span className="ml-1 text-red-400/80">
                  · {issueCount} falla{issueCount > 1 ? "s" : ""} en checklist
                </span>
              )}
            </p>
          </div>

          {/* Messages area */}
          <div
            ref={scrollRef}
            className="flex max-h-[420px] min-h-[180px] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-400/15 bg-purple-500/10">
                  <Brain className="h-8 w-8 text-purple-400/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white/50">Hola, soy DARJENI</p>
                  <p className="mt-1 max-w-xs text-xs text-white/30">
                    Preguntame cualquier cosa sobre el diagnostico de este dispositivo. Tengo acceso al checklist y los datos de la orden.
                  </p>
                </div>

                {/* Quick prompts */}
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {quickPrompts.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(qp.prompt)}
                      className="flex items-center gap-1.5 rounded-xl border border-purple-500/15 bg-purple-500/8 px-3 py-2 text-[11px] font-semibold text-purple-300 transition-all hover:bg-purple-500/15 active:scale-95"
                    >
                      <qp.icon className="h-3 w-3" />
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  <span className="text-xs text-white/40">DARJENI esta analizando...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts after first message */}
          {messages.length > 0 && messages.length < 8 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2 sm:px-5">
              {quickPrompts.slice(0, 3).map((qp, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(qp.prompt)}
                  disabled={loading}
                  className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-medium text-white/35 transition-all hover:bg-white/[0.08] hover:text-white/50 disabled:opacity-40"
                >
                  <qp.icon className="h-2.5 w-2.5" />
                  {qp.label}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-white/10 p-4 sm:p-5">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe el problema o pregunta algo..."
                  rows={1}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 pr-10 text-sm text-white placeholder:text-white/25 focus:border-purple-400/30 focus:outline-none focus:ring-1 focus:ring-purple-500/20"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                  onInput={(e) => {
                    e.target.style.height = "44px";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                />
              </div>
              <div className="flex gap-1.5">
                {messages.length > 0 && (
                  <Button
                    onClick={handleReset}
                    size="sm"
                    variant="ghost"
                    className="h-11 w-11 shrink-0 rounded-2xl border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                    title="Nueva conversacion"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  size="sm"
                  className="h-11 w-11 shrink-0 rounded-2xl border-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/30 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-30"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
