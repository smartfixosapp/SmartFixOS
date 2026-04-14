// ──────────────────────────────────────────────────────────────────────────
// JeaniDiagnosticPanel — Diagnóstico IA con historial completo del cliente
//
// Jeani analiza TODAS las órdenes de trabajo previas del cliente, incluyendo:
//   - Servicios realizados (repair_tasks)
//   - Piezas utilizadas y proveedor (order_items, parts_needed)
//   - Fotos del trabajo (photos_metadata)
//   - Notas del técnico (comments, status_note, checklist_notes)
//   - Fechas, estados, técnicos asignados
//
// Resultado: diagnóstico + acción sugerida (garantía, re-trabajo, pieza
// defectuosa, cobrar reparación nueva, etc.)
// ──────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { Brain, Loader2, AlertTriangle, CheckCircle2, RefreshCw, X, ChevronDown, ChevronUp, StickyNote } from "lucide-react";
import { toast } from "sonner";

// ── Build the AI prompt from customer history ───────────────────────────

function buildDiagnosticPrompt({ customer, orders, currentOrder, userQuestion }) {
  const lines = [];

  lines.push("Eres JEANI, asistente de diagnóstico de SmartFixOS para talleres de reparación de dispositivos electrónicos.");
  lines.push("Un técnico te consulta sobre un cliente que regresa con un problema. Tu trabajo es:");
  lines.push("1. Analizar TODO el historial de trabajos previos del cliente");
  lines.push("2. Determinar si el problema actual está relacionado con un trabajo anterior");
  lines.push("3. Clasificar: GARANTÍA (pieza/trabajo defectuoso), RE-TRABAJO (error del técnico), PIEZA DEFECTUOSA (reclamar al proveedor), o PROBLEMA NUEVO (cobrar reparación)");
  lines.push("4. Sugerir la acción concreta a tomar");
  lines.push("");

  // Cliente
  lines.push("═══ CLIENTE ═══");
  lines.push(`Nombre: ${customer?.name || customer?.full_name || "Desconocido"}`);
  if (customer?.phone) lines.push(`Teléfono: ${customer.phone}`);
  if (customer?.email) lines.push(`Email: ${customer.email}`);
  lines.push("");

  // Orden actual (si viene de una WO específica)
  if (currentOrder) {
    lines.push("═══ ORDEN ACTUAL (la que el cliente trae con problema) ═══");
    lines.push(`Número: ${currentOrder.order_number || currentOrder.id?.slice(-6)}`);
    lines.push(`Dispositivo: ${[currentOrder.device_brand, currentOrder.device_model, currentOrder.device_color].filter(Boolean).join(" ") || "No especificado"}`);
    if (currentOrder.device_serial) lines.push(`Serial: ${currentOrder.device_serial}`);
    lines.push(`Estado: ${currentOrder.status}`);
    lines.push(`Problema original: ${currentOrder.initial_problem || "No registrado"}`);
    if (currentOrder.assigned_to_name) lines.push(`Técnico: ${currentOrder.assigned_to_name}`);

    // Fechas
    const created = currentOrder.created_date || currentOrder.created_at;
    if (created) lines.push(`Fecha creación: ${String(created).slice(0, 10)}`);
    const delivered = currentOrder.pickup_date || currentOrder.delivered_date;
    if (delivered) lines.push(`Fecha entrega: ${String(delivered).slice(0, 10)}`);

    // Días desde entrega
    if (delivered) {
      const daysSince = Math.round((Date.now() - new Date(delivered).getTime()) / (1000 * 60 * 60 * 24));
      lines.push(`⏱ Días desde entrega: ${daysSince}`);
    }

    // Piezas usadas
    const items = [
      ...(Array.isArray(currentOrder.order_items) ? currentOrder.order_items : []),
      ...(Array.isArray(currentOrder.parts_needed) ? currentOrder.parts_needed : []),
    ];
    if (items.length > 0) {
      lines.push("Piezas utilizadas:");
      const seen = new Set();
      for (const it of items) {
        const key = it.name || it.product_name || it.description;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const details = [];
        if (it.supplier) details.push(`proveedor: ${it.supplier}`);
        if (it.source === "purchase_order" && it.po_number) details.push(`OC: ${it.po_number}`);
        if (it.cost || it.price) details.push(`costo: $${Number(it.cost || it.price || 0).toFixed(2)}`);
        lines.push(`  • ${key}${details.length ? ` (${details.join(", ")})` : ""}`);
      }
    }

    // Tareas de reparación
    if (Array.isArray(currentOrder.repair_tasks) && currentOrder.repair_tasks.length) {
      lines.push("Tareas realizadas:");
      for (const t of currentOrder.repair_tasks) {
        lines.push(`  • ${t.description || t.name || "Tarea"} — estado: ${t.status || "?"}`);
      }
    }

    // Notas del técnico
    const notes = [];
    if (currentOrder.status_note) notes.push(currentOrder.status_note);
    if (currentOrder.checklist_notes) notes.push(currentOrder.checklist_notes);
    if (Array.isArray(currentOrder.comments)) {
      for (const c of currentOrder.comments.slice(-5)) {
        if (c.text) notes.push(`[${c.author || "?"}] ${c.text}`);
      }
    }
    if (notes.length) {
      lines.push("Notas del técnico:");
      for (const n of notes) lines.push(`  → ${n.slice(0, 200)}`);
    }

    // Fotos
    const photos = Array.isArray(currentOrder.photos_metadata) ? currentOrder.photos_metadata : [];
    if (photos.length) {
      lines.push(`Fotos tomadas: ${photos.length} foto(s)`);
      for (const p of photos.slice(0, 5)) {
        lines.push(`  📷 ${p.type || "foto"}: ${p.notes || p.filename || "sin descripción"}`);
      }
    }
    lines.push("");
  }

  // Historial de TODAS las órdenes previas
  const otherOrders = (orders || []).filter(
    (o) => !currentOrder || o.id !== currentOrder.id,
  );
  if (otherOrders.length > 0) {
    lines.push(`═══ HISTORIAL PREVIO (${otherOrders.length} orden${otherOrders.length === 1 ? "" : "es"} anteriores) ═══`);
    // Ordenar por fecha más reciente primero
    const sorted = [...otherOrders].sort((a, b) => {
      const da = a.created_date || a.created_at || "";
      const db = b.created_date || b.created_at || "";
      return String(db).localeCompare(String(da));
    });
    for (const o of sorted.slice(0, 15)) {
      const date = String(o.created_date || o.created_at || "").slice(0, 10);
      const device = [o.device_brand, o.device_model].filter(Boolean).join(" ") || "?";
      lines.push(`──── ${o.order_number || o.id?.slice(-6)} | ${date} | ${device} | ${o.status} ────`);
      if (o.initial_problem) lines.push(`  Problema: ${o.initial_problem.slice(0, 150)}`);
      if (o.assigned_to_name) lines.push(`  Técnico: ${o.assigned_to_name}`);

      // Piezas
      const prevItems = [
        ...(Array.isArray(o.order_items) ? o.order_items : []),
        ...(Array.isArray(o.parts_needed) ? o.parts_needed : []),
      ];
      if (prevItems.length) {
        const seen = new Set();
        const pieces = [];
        for (const it of prevItems) {
          const key = it.name || it.product_name;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          pieces.push(key + (it.supplier ? ` [${it.supplier}]` : ""));
        }
        if (pieces.length) lines.push(`  Piezas: ${pieces.join(", ")}`);
      }

      // Notas resumidas
      if (o.status_note) lines.push(`  Nota: ${o.status_note.slice(0, 100)}`);
      const comments = Array.isArray(o.comments) ? o.comments : [];
      if (comments.length) {
        const lastComment = comments[comments.length - 1];
        if (lastComment?.text) lines.push(`  Último comentario: ${lastComment.text.slice(0, 100)}`);
      }
    }
    lines.push("");
  }

  // Pregunta del usuario
  lines.push("═══ CONSULTA DEL TÉCNICO ═══");
  lines.push(userQuestion || "El cliente regresa con un problema después de una reparación. Analiza el historial y dame un diagnóstico.");
  lines.push("");

  lines.push("═══ INSTRUCCIONES DE RESPUESTA ═══");
  lines.push("Responde en español. Sé conciso y práctico — esto lo lee un técnico ocupado. Formato:");
  lines.push("");
  lines.push("🔍 DIAGNÓSTICO:");
  lines.push("(Explica qué puede estar pasando basándote en el historial. Sé específico — menciona piezas, fechas, técnicos por nombre si aplica)");
  lines.push("");
  lines.push("📋 CLASIFICACIÓN: [GARANTÍA / RE-TRABAJO / PIEZA DEFECTUOSA / PROBLEMA NUEVO]");
  lines.push("(Una línea justificando por qué)");
  lines.push("");
  lines.push("🔧 CHECKLIST DE DIAGNÓSTICO:");
  lines.push("(Lista numerada de pasos concretos que el técnico debe verificar AHORA MISMO en el taller, en orden de más probable a menos probable. Cada paso debe ser accionable — no genérico. Ejemplo: '1. Verificar voltaje de la batería con multímetro — debe dar 3.7-4.2V' en vez de '1. Revisar la batería')");
  lines.push("");
  lines.push("✅ ACCIÓN RECOMENDADA:");
  lines.push("(Qué hacer después del diagnóstico: reclamar garantía a X proveedor con OC Y, re-trabajar gratis, cobrar nueva reparación, etc.)");
  lines.push("");
  lines.push("⚠️ BANDERAS ROJAS:");
  lines.push("(Cosas que podrían indicar un problema más serio, patrones de fallo recurrente, o riesgos si no se atiende)");

  return lines.join("\n");
}

// ── Fetch all orders for a customer ─────────────────────────────────────

async function fetchCustomerOrders(customerId, customerName, customerPhone) {
  if (!customerId && !customerName && !customerPhone) return [];
  try {
    // Try by customer_id first
    let orders = [];
    if (customerId) {
      try {
        orders = await dataClient.entities.Order.list("-created_date", 100);
        orders = (orders || []).filter(
          (o) => o.customer_id === customerId,
        );
      } catch { /* fallback below */ }
    }
    // If no results, try matching by name or phone
    if (orders.length === 0 && (customerName || customerPhone)) {
      try {
        const allOrders = await dataClient.entities.Order.list("-created_date", 200);
        orders = (allOrders || []).filter((o) => {
          if (customerName && o.customer_name?.toLowerCase() === customerName.toLowerCase()) return true;
          if (customerPhone && o.customer_phone === customerPhone) return true;
          return false;
        });
      } catch { /* no-op */ }
    }
    return orders;
  } catch (err) {
    console.error("Error fetching customer orders:", err);
    return [];
  }
}

// ── Main component ──────────────────────────────────────────────────────

export default function JeaniDiagnosticPanel({
  order,          // Current WO (optional — if opened from WO detail)
  customer,       // Customer object (optional — if opened from customer profile)
  onClose,        // Close callback
}) {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);
  const [error, setError] = useState(null);
  const [question, setQuestion] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(null); // { orders, customer }
  const [showHistory, setShowHistory] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const customerName = order?.customer_name || customer?.name || customer?.full_name || "";
  const customerPhone = order?.customer_phone || customer?.phone || "";
  const customerId = order?.customer_id || customer?.id || "";

  const runDiagnosis = useCallback(async () => {
    if (!question.trim() && !order) {
      toast.error("Describe el problema del cliente");
      return;
    }

    setLoading(true);
    setError(null);
    setDiagnosis(null);

    try {
      // Step 1: Fetch all customer orders
      const allOrders = await fetchCustomerOrders(customerId, customerName, customerPhone);
      const customerObj = customer || {
        name: customerName,
        phone: customerPhone,
        email: order?.customer_email || "",
      };
      setHistoryLoaded({ orders: allOrders, customer: customerObj });

      // Step 2: Build prompt
      const prompt = buildDiagnosticPrompt({
        customer: customerObj,
        orders: allOrders,
        currentOrder: order,
        userQuestion: question.trim() || undefined,
      });

      console.log("🧠 [JeaniDiagnostic] Prompt length:", prompt.length, "chars, orders:", allOrders.length);

      // Step 3: Send to AI
      // Collect photo URLs for multimodal analysis (up to 3 most recent from current order)
      let fileUrls = null;
      if (order?.photos_metadata?.length) {
        const urls = order.photos_metadata
          .filter((p) => p.publicUrl)
          .slice(0, 3)
          .map((p) => p.publicUrl);
        if (urls.length) fileUrls = urls;
      }

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: fileUrls,
      });

      if (!result) throw new Error("No se recibió respuesta del servidor IA");

      setDiagnosis(result);
      toast.success("🧠 Diagnóstico completado");
    } catch (err) {
      console.error("Diagnostic error:", err);
      const msg = err?.message || String(err);
      setError(msg);
      toast.error("Error en diagnóstico: " + msg.slice(0, 100));
    } finally {
      setLoading(false);
    }
  }, [question, order, customer, customerId, customerName, customerPhone]);

  // ── Add diagnosis as note to WO ────────────────────────────────────────
  const handleAddNoteToWO = useCallback(async () => {
    if (!order?.id || !diagnosis) return;
    setAddingNote(true);
    try {
      // Get current comments array from WO
      let currentComments = [];
      try {
        const wo = await dataClient.entities.Order.get(order.id);
        currentComments = Array.isArray(wo?.comments) ? wo.comments : [];
      } catch { /* start fresh */ }

      // Get current user name
      let authorName = "JEANI";
      try {
        const session = JSON.parse(localStorage.getItem("employee_session") || "{}");
        authorName = session?.name || "JEANI";
      } catch { /* no-op */ }

      // Build note text (truncated to keep it manageable)
      const noteText = `🧠 DIAGNÓSTICO IA (${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })})\n\nConsulta: ${question || "Diagnóstico general"}\n\n${diagnosis.slice(0, 1500)}`;

      const newComment = {
        id: `diag-${Date.now()}`,
        text: noteText,
        author: authorName,
        author_role: "ai_diagnostic",
        timestamp: new Date().toISOString(),
      };

      await dataClient.entities.Order.update(order.id, {
        comments: [...currentComments, newComment],
      });

      toast.success("📝 Diagnóstico añadido como nota a la orden de trabajo");
    } catch (err) {
      console.error("Error adding diagnostic note:", err);
      toast.error("No se pudo añadir la nota: " + (err?.message || "error"));
    } finally {
      setAddingNote(false);
    }
  }, [order, diagnosis, question]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#0a0a0c] border border-violet-500/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-violet-600/20 to-cyan-600/10 border-b border-violet-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-white font-black text-sm">
              Diagnóstico IA · JEANI
            </h3>
            <p className="text-[10px] text-white/40">
              Análisis con historial completo{customerName ? ` · ${customerName}` : ""}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Contexto del equipo actual */}
        {order && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">
              Equipo en cuestión
            </p>
            <p className="text-sm text-white font-bold">
              {[order.device_brand, order.device_model, order.device_color]
                .filter(Boolean)
                .join(" ") || "Dispositivo"}
            </p>
            <p className="text-xs text-white/50 mt-0.5">
              {order.order_number} · {order.initial_problem || "Sin problema registrado"}
            </p>
          </div>
        )}

        {/* Input de pregunta */}
        <div>
          <label className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1 block">
            ¿Qué problema reporta el cliente?
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ej: El cliente dice que la batería se descarga rápido después de que se la cambiamos hace 5 días..."
            rows={3}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
          />
        </div>

        {/* Botón de análisis */}
        <button
          onClick={runDiagnosis}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analizando historial{historyLoaded ? ` (${historyLoaded.orders.length} órdenes)` : ""}...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              Analizar con Jeani
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <p className="text-xs text-red-300 font-bold">Error en diagnóstico</p>
            </div>
            <p className="text-xs text-red-300/80">{error}</p>
          </div>
        )}

        {/* Resultado del diagnóstico */}
        {diagnosis && (
          <div className="space-y-3">
            <div className="p-5 rounded-xl bg-violet-500/[0.05] border border-violet-500/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-violet-400" />
                  <p className="text-xs text-violet-300 font-black uppercase tracking-widest">
                    Resultado del diagnóstico
                  </p>
                </div>
                <button
                  onClick={runDiagnosis}
                  disabled={loading}
                  className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                  title="Regenerar diagnóstico"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerar
                </button>
              </div>
              <div className="text-sm text-white/90 leading-relaxed whitespace-pre-line">
                {diagnosis}
              </div>
            </div>

            {/* Historial cargado — expandible */}
            {historyLoaded && historyLoaded.orders.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/50 font-bold hover:bg-white/[0.05]"
              >
                <span>
                  📋 Historial analizado: {historyLoaded.orders.length} orden{historyLoaded.orders.length === 1 ? "" : "es"}
                </span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            {showHistory && historyLoaded && (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {historyLoaded.orders
                  .sort((a, b) => String(b.created_date || b.created_at || "").localeCompare(String(a.created_date || a.created_at || "")))
                  .map((o) => (
                    <div key={o.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold">
                          {o.order_number || o.id?.slice(-6)}
                        </span>
                        <span className="text-white/40">
                          {String(o.created_date || o.created_at || "").slice(0, 10)}
                        </span>
                      </div>
                      <p className="text-white/50 mt-0.5 truncate">
                        {[o.device_brand, o.device_model].filter(Boolean).join(" ")}
                        {o.initial_problem ? ` · ${o.initial_problem.slice(0, 60)}` : ""}
                      </p>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black ${
                        o.status === "delivered" || o.status === "picked_up" || o.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : o.status === "cancelled"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}>
                        {o.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
