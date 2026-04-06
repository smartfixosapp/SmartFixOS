import React, { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, Loader2, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";
import MobileVisualTimeline from "./MobileVisualTimeline";
import { triggerHaptic } from "@/lib/capacitor";

export default function MobileHistorialTab({ order, onUpdate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");

  const o = order || {};

  // Load events
  useEffect(() => {
    if (!o.id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await dataClient.entities.WorkOrderEvent.filter(
          { order_id: o.id },
          "-created_date",
          200
        );
        if (!cancelled) setEvents(Array.isArray(result) ? result : []);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [o.id]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, []);

  // Post comment
  const postComment = useCallback(async () => {
    if (!comment.trim() || !o.id) return;
    setPosting(true);
    triggerHaptic("light");
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note",
        description: comment.trim(),
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
      });
      setComment("");
      finalTranscriptRef.current = "";
      const result = await dataClient.entities.WorkOrderEvent.filter({ order_id: o.id }, "-created_date", 200);
      setEvents(Array.isArray(result) ? result : []);
      onUpdate?.();
      toast.success("Nota agregada");
    } catch {
      toast.error("Error al guardar nota");
    } finally {
      setPosting(false);
    }
  }, [comment, o.id, o.order_number, onUpdate]);

  // Toggle voice dictation
  const toggleVoice = useCallback(() => {
    if (listening) {
      try { recognitionRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Tu navegador no soporta dictado por voz");
      return;
    }
    triggerHaptic("medium");
    const recognition = new SpeechRecognition();
    recognition.lang = "es-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    finalTranscriptRef.current = comment;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + t;
        } else {
          interim = t;
        }
      }
      setComment(finalTranscriptRef.current + (interim ? " " + interim : ""));
    };
    recognition.onerror = (e) => {
      setListening(false);
      if (e?.error !== "aborted" && e?.error !== "no-speech") {
        toast.error("Error de dictado");
      }
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      toast.success("Habla ahora...");
    } catch {
      setListening(false);
      toast.error("No se pudo iniciar el dictado");
    }
  }, [listening, comment]);

  return (
    <div className="space-y-4 pb-8">
      {/* Note composer with voice dictation */}
      <div className="flex gap-2">
        <input
          value={comment}
          onChange={e => {
            setComment(e.target.value);
            finalTranscriptRef.current = e.target.value;
          }}
          placeholder={listening ? "Escuchando..." : "Escribe o dicta una nota..."}
          className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50"
          onKeyDown={e => { if (e.key === "Enter") postComment(); }}
        />
        {comment.trim() && !listening ? (
          <button
            onClick={postComment}
            disabled={posting}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 text-white font-bold active:scale-95 transition-all disabled:opacity-30"
            aria-label="Enviar nota"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        ) : (
          <button
            onClick={toggleVoice}
            className={`px-4 py-2.5 rounded-xl font-bold active:scale-95 transition-all ${
              listening
                ? "bg-red-600 text-white shadow-[0_0_16px_rgba(239,68,68,0.5)]"
                : "bg-violet-600 text-white"
            }`}
            aria-label={listening ? "Detener dictado" : "Iniciar dictado"}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
      </div>

      {listening && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold text-red-300">Grabando... habla claro</span>
        </div>
      )}

      {/* Unified Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <MobileVisualTimeline
          events={events}
          emptyMessage="Sin historial registrado"
        />
      )}
    </div>
  );
}
