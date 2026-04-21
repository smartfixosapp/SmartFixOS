/**
 * GACC — Growth View
 * Announcements, NPS tracking, Email logs, A/B test flags, Slack webhooks
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Megaphone, Star, Mail, FlaskConical, Slack, Send, Plus,
  Trash2, RefreshCw, CheckCircle, AlertCircle, Eye, Calendar,
  Target, Users, ExternalLink, Copy, Tag
} from "lucide-react";
import { useGACC, timeAgo } from "./gaccContext";
import { toast } from "sonner";

// ── Announcements Manager ────────────────────────────────────────────────────
function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gacc_announcements") || "[]"); }
    catch { return []; }
  });
  const [form, setForm] = useState({ title: "", message: "", type: "info", target: "all" });
  const [creating, setCreating] = useState(false);

  const saveList = (list) => {
    localStorage.setItem("gacc_announcements", JSON.stringify(list));
    setAnnouncements(list);
  };

  const create = () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error("Titulo y mensaje requeridos"); return; }
    const newItem = {
      id: Date.now().toString(),
      ...form,
      created_at: new Date().toISOString(),
      active: true,
    };
    saveList([newItem, ...announcements]);
    setForm({ title: "", message: "", type: "info", target: "all" });
    setCreating(false);
    toast.success("Announcement creado");
  };

  const remove = (id) => {
    saveList(announcements.filter(a => a.id !== id));
    toast.success("Announcement eliminado");
  };

  const toggle = (id) => {
    saveList(announcements.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-cyan-400" />
          <p className="text-[13px] font-bold text-white">In-App Announcements</p>
        </div>
        <button onClick={() => setCreating(!creating)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all">
          <Plus className="w-3 h-3" /> Nuevo
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.02] p-3 space-y-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titulo del announcement" className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[12px] text-white placeholder:text-gray-700 focus:outline-none" />
          <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Mensaje..." rows={3} className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[12px] text-white placeholder:text-gray-700 focus:outline-none resize-none" />
          <div className="flex items-center gap-2">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[11px] text-white outline-none cursor-pointer">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="new-feature">Nueva Feature</option>
            </select>
            <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[11px] text-white outline-none cursor-pointer">
              <option value="all">Todas las tiendas</option>
              <option value="starter">Solo Starter</option>
              <option value="pro">Solo Pro</option>
              <option value="trial">Solo en Trial</option>
            </select>
            <button onClick={create} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all">
              <Send className="w-3 h-3" /> Publicar
            </button>
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-[11px] text-gray-500 hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {announcements.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">Sin announcements activos</p>
        ) : announcements.map(a => (
          <div key={a.id} className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl border ${
            a.active ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.04] bg-white/[0.01] opacity-50"
          }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[12px] text-white font-semibold">{a.title}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                  a.type === "warning" ? "bg-amber-500/20 text-amber-400" :
                  a.type === "success" ? "bg-emerald-500/20 text-emerald-400" :
                  a.type === "new-feature" ? "bg-purple-500/20 text-purple-400" :
                  "bg-blue-500/20 text-blue-400"
                }`}>{a.type}</span>
                <span className="text-[9px] text-gray-600">→ {a.target}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">{a.message}</p>
              <p className="text-[9px] text-gray-700 mt-1">{timeAgo(a.created_at)}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => toggle(a.id)} className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                a.active ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-white/[0.03] text-gray-500 border border-white/[0.07]"
              }`}>
                {a.active ? "ON" : "OFF"}
              </button>
              <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NPS Tracking ─────────────────────────────────────────────────────────────
function NPSTracking({ tenants }) {
  const scores = useMemo(() => {
    // NPS scores stored in tenant.metadata.nps_score (0-10)
    const withScores = tenants.filter(t => t.metadata?.nps_score !== undefined);
    const promoters = withScores.filter(t => t.metadata.nps_score >= 9).length;
    const passives = withScores.filter(t => t.metadata.nps_score >= 7 && t.metadata.nps_score < 9).length;
    const detractors = withScores.filter(t => t.metadata.nps_score < 7).length;
    const total = withScores.length || 1;
    const nps = Math.round(((promoters / total) - (detractors / total)) * 100);
    return { withScores, promoters, passives, detractors, total: withScores.length, nps };
  }, [tenants]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-amber-400" />
        <p className="text-[13px] font-bold text-white">NPS Tracking</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] text-gray-600">NPS Score</p>
          <p className={`text-2xl font-semibold ${scores.nps >= 50 ? "text-emerald-400" : scores.nps >= 0 ? "text-amber-400" : "text-red-400"}`}>
            {scores.total > 0 ? scores.nps : "--"}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3 text-center">
          <p className="text-[10px] text-gray-600">Promoters</p>
          <p className="text-2xl font-semibold text-emerald-400">{scores.promoters}</p>
          <p className="text-[9px] text-gray-700">9-10</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3 text-center">
          <p className="text-[10px] text-gray-600">Passives</p>
          <p className="text-2xl font-semibold text-amber-400">{scores.passives}</p>
          <p className="text-[9px] text-gray-700">7-8</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-3 text-center">
          <p className="text-[10px] text-gray-600">Detractors</p>
          <p className="text-2xl font-semibold text-red-400">{scores.detractors}</p>
          <p className="text-[9px] text-gray-700">0-6</p>
        </div>
      </div>

      {scores.total === 0 ? (
        <p className="text-[11px] text-gray-600 text-center py-2">
          Sin scores registrados. Las respuestas NPS se guardan en tenant.metadata.nps_score
        </p>
      ) : (
        <p className="text-[11px] text-gray-600 text-center py-1">
          {scores.total} de {tenants.length} tiendas han respondido
        </p>
      )}
    </div>
  );
}

// ── Slack Webhook Config ─────────────────────────────────────────────────────
function SlackWebhook() {
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem("gacc_slack_webhook") || "");
  const [events, setEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gacc_slack_events") || '{"new_tenant":true,"failed_payment":true,"churn_risk":false,"trial_expired":true}'); }
    catch { return { new_tenant: true, failed_payment: true, churn_risk: false, trial_expired: true }; }
  });
  const [testing, setTesting] = useState(false);

  const save = () => {
    localStorage.setItem("gacc_slack_webhook", webhookUrl);
    localStorage.setItem("gacc_slack_events", JSON.stringify(events));
    toast.success("Configuracion guardada");
  };

  const test = async () => {
    if (!webhookUrl) { toast.error("URL de webhook requerida"); return; }
    setTesting(true);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "GACC Test: Webhook funciona correctamente desde SmartFixOS" }),
      });
      if (res.ok || res.type === "opaque") toast.success("Webhook probado");
      else toast.error("Webhook fallo: " + res.status);
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Slack className="w-4 h-4 text-purple-400" />
        <p className="text-[13px] font-bold text-white">Slack / Discord Webhook</p>
      </div>

      <div>
        <p className="text-[10px] text-gray-600 tracking-wide font-bold mb-1">Webhook URL</p>
        <input
          type="password"
          value={webhookUrl}
          onChange={e => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[12px] text-white placeholder:text-gray-700 focus:outline-none font-mono"
        />
      </div>

      <div>
        <p className="text-[10px] text-gray-600 tracking-wide font-bold mb-2">Eventos a notificar</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "new_tenant", label: "Nueva tienda registrada" },
            { key: "failed_payment", label: "Pago fallido" },
            { key: "churn_risk", label: "Tienda en riesgo de churn" },
            { key: "trial_expired", label: "Trial vencido" },
          ].map(e => (
            <label key={e.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] cursor-pointer hover:bg-white/[0.04]">
              <input type="checkbox" checked={events[e.key] || false} onChange={ev => setEvents({ ...events, [e.key]: ev.target.checked })} className="w-3 h-3 accent-purple-500" />
              <span className="text-[11px] text-gray-400">{e.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={test} disabled={testing || !webhookUrl} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-white border border-white/[0.07] hover:border-white/[0.15] transition-all disabled:opacity-50">
          {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Probar
        </button>
        <button onClick={save} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all">
          <CheckCircle className="w-3 h-3" /> Guardar
        </button>
      </div>
    </div>
  );
}

// ── Main Growth View ─────────────────────────────────────────────────────────
export default function GrowthView() {
  const { tenants } = useGACC();

  return (
    <div className="app-container py-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Growth</h2>
        <p className="text-[11px] text-gray-600">Comunicacion, engagement y herramientas de crecimiento</p>
      </div>

      <AnnouncementsManager />
      <NPSTracking tenants={tenants} />
      <SlackWebhook />
    </div>
  );
}
