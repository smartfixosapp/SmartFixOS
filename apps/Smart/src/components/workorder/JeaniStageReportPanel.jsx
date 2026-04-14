import React, { useState, useMemo } from "react";
import { X, Sparkles, Loader2, FileText, Camera, Paperclip, CheckCircle2, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { callJENAI } from "@/components/aria/jenaiClient";
import { base44 } from "@/api/base44Client";

/**
 * JeaniStageReportPanel
 * Recopila checklist + notas + archivos del stage actual,
 * pide a JEANI que lea todo (incluyendo contenido de HTML/TXT reports)
 * y genera un reporte técnico profesional con hallazgos, recomendaciones,
 * y mensaje al cliente.
 */
export default function JeaniStageReportPanel({
  order,
  checklist = [],
  checklistNotes = "",
  stageId = "diagnosing",
  stageLabel = "Diagnóstico",
  onClose,
  onApplyAsNote,
}) {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const o = order || {};

  // Filtrar archivos de este stage (o legacy sin stage)
  const stageAttachments = useMemo(() => {
    const photos = Array.isArray(o.photos_metadata) ? o.photos_metadata : [];
    return photos.filter(f => {
      const sid = f?.stage_id;
      return !sid || sid === stageId || sid === "general";
    });
  }, [o.photos_metadata, stageId]);

  const images = stageAttachments.filter(f => f?.type === "image" || (f?.mime || "").startsWith("image/"));
  const documents = stageAttachments.filter(f => !(f?.type === "image" || (f?.mime || "").startsWith("image/")));
  const testedItems = checklist.filter(c => c.status && c.status !== "not_tested");

  const analyze = async () => {
    setGenerating(true);
    setError(null);
    try {
      // Extraer contenido de reportes HTML/TXT
      const textContents = [];
      for (const doc of documents) {
        const url = doc.publicUrl || doc.thumbUrl || doc.url;
        if (!url) continue;
        const mime = doc.mime || "";
        const name = doc.filename || "";
        const isText = mime === "text/html" || mime.startsWith("text/") || /\.(html|htm|txt|csv|json|log)$/i.test(name);
        if (!isText) continue;
        try {
          const res = await fetch(url);
          let content = await res.text();
          if (mime === "text/html" || /\.(html|htm)$/i.test(name)) {
            const tmp = document.createElement("div");
            tmp.innerHTML = content;
            tmp.querySelectorAll("script,style").forEach(el => el.remove());
            content = (tmp.innerText || tmp.textContent || "").trim();
          }
          if (content.length > 5000) content = content.slice(0, 5000) + "\n...[truncado]";
          textContents.push({ filename: name, content });
        } catch {}
      }

      const deviceInfo = [o.device_brand, o.device_model].filter(Boolean).join(" ") || "dispositivo";
      const checklistSummary = testedItems.length > 0
        ? testedItems.map(c => `- ${c.label}: ${c.status === "ok" ? "OK" : c.status === "issue" ? "PROBLEMA" : "Requiere revisión"}${c.notes ? ` (${c.notes})` : ""}`).join("\n")
        : "Sin checklist documentado";

      const attachmentsBlock = textContents.length > 0
        ? "\n\n═══ REPORTES ADJUNTOS ═══\n" + textContents.map((a, i) => `--- ${i + 1}. ${a.filename} ---\n${a.content}`).join("\n\n")
        : "";

      const imagesNote = images.length > 0 ? `\n\nNOTA: Hay ${images.length} foto(s) adjunta(s) documentando evidencia visual.` : "";

      const systemPrompt = `Eres un técnico experto de taller de reparación.
Tu tarea: analizar la información del ${stageLabel.toLowerCase()} y generar un REPORTE TÉCNICO PROFESIONAL en español.

El reporte DEBE incluir estas secciones en orden:

**1. HALLAZGOS TÉCNICOS**
Lista de problemas detectados basados en el checklist, reportes adjuntos (batería, logs) y notas del técnico.

**2. RECOMENDACIONES TÉCNICAS**
Qué hay que hacer (sin mencionar precios):
- Reparaciones necesarias
- Mantenimiento preventivo (pasta térmica, limpieza abanicos, etc.)
- Actualizaciones de software/drivers si aplica
- Piezas que requieren cambio

**3. MENSAJE AL CLIENTE**
Redactado en lenguaje profesional y claro, sin jerga excesiva:
- Qué se encontró (objetivo)
- Qué se recomienda (preventivo y correctivo)
- Por qué es importante
- Usa frases que cubran al taller: "se detectó", "se recomienda", "según los diagnósticos realizados"

REGLAS:
- NO inventes síntomas que no estén en los datos
- NO incluyas precios ni tiempos de entrega
- Mantén el mensaje al cliente corto (máx 5 líneas)
- Usa **negrita** en títulos de sección
- Si los datos son insuficientes, dilo explícitamente`;

      const userPrompt = `═══ DATOS DE LA ORDEN ═══
Dispositivo: ${deviceInfo}
Cliente reporta: "${o.initial_problem || "No especificado"}"

═══ CHECKLIST ${stageLabel.toUpperCase()} ═══
${checklistSummary}

═══ NOTAS DEL TÉCNICO ═══
${checklistNotes || "Sin notas adicionales"}${attachmentsBlock}${imagesNote}

Genera el reporte técnico profesional siguiendo el formato indicado.`;

      const text = await callJENAI(userPrompt, { maxTokens: 1200, systemPrompt });
      setReport(text);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo generar el reporte");
    } finally {
      setGenerating(false);
    }
  };

  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Reporte copiado");
    } catch { toast.error("No se pudo copiar"); }
  };

  const saveAsNote = async () => {
    if (!report || !o.id) return;
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note",
        description: `📋 **Reporte de ${stageLabel} (JENAI)**\n\n${report}`,
        user_name: me?.full_name || me?.email || "JENAI",
        user_id: me?.id || null,
      });
      toast.success("Reporte guardado como nota");
      onApplyAsNote?.(report);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F0F12] border border-purple-500/30 rounded-[24px] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_30px_80px_rgba(168,85,247,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-indigo-600/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-black text-lg">Diagnóstico IA</h3>
              <p className="text-xs text-purple-300/70">{stageLabel} · {o.device_brand} {o.device_model}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!report && (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Datos a analizar</p>

                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-white/70">Checklist: <span className="font-bold text-white">{testedItems.length}</span> de {checklist.length} items evaluados</span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-white/70">Fotos: <span className="font-bold text-white">{images.length}</span> evidencia(s)</span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Paperclip className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-white/70">Reportes/documentos: <span className="font-bold text-white">{documents.length}</span></span>
                </div>

                <div className="flex items-start gap-3 text-sm">
                  <FileText className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span className="text-white/70 flex-1">Notas: <span className="text-white/90">{checklistNotes ? `"${checklistNotes.slice(0, 120)}${checklistNotes.length > 120 ? "..." : ""}"` : "Sin notas"}</span></span>
                </div>

                <div className="flex items-start gap-3 text-sm pt-2 border-t border-white/[0.06]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-0.5">Cliente:</span>
                  <span className="text-white/80 italic flex-1">"{o.initial_problem || "Sin problema reportado"}"</span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">⚠️ {error}</div>
              )}

              <button
                onClick={analyze}
                disabled={generating}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-wider text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-purple-900/40"
              >
                {generating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Analizando y generando...</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Analizar y Generar Reporte</>
                )}
              </button>

              <p className="text-[11px] text-white/40 text-center leading-relaxed">
                JENAI leerá el checklist, las notas, el problema reportado y el contenido de los reportes adjuntos para generar hallazgos, recomendaciones y mensaje al cliente.
              </p>
            </>
          )}

          {report && (
            <>
              <div className="rounded-2xl border border-purple-500/25 bg-purple-500/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">Reporte generado</p>
                </div>
                <div className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{report}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={copyReport} className="h-11 rounded-xl border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Copy className="w-4 h-4" /> Copiar
                </button>
                <button onClick={saveAsNote} className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> Guardar como nota
                </button>
              </div>

              <button onClick={() => { setReport(null); setError(null); }} className="w-full h-10 rounded-xl text-xs font-semibold text-white/50 hover:text-white/80 transition">
                ← Volver a analizar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
