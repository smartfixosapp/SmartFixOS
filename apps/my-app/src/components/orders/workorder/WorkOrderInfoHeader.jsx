
import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createPageUrl } from "@/components/utils/helpers";
import {
  Trash2, X, DollarSign, Phone, MessageSquare, Shield, Eye, EyeOff, Copy,
  CheckCircle2, XCircle, Image as ImageIcon, ChevronDown, ChevronUp
} from "lucide-react";

import WorkOrderItems from "./WorkOrderItems";
import WorkOrderChecklist from "./WorkOrderChecklist";
import PhotoDock from "../../workorder/PhotoDock";
import WorkOrderTimeline from "./WorkOrderTimeline";
import WorkOrderProgress from "./WorkOrderProgress";
import DeleteOrderDialog from "../DeleteOrderDialog";

/* ================= PATTERN PAD (3x3 interactivo) ================= */
function PatternPad({ value, onChange }) {
  // Nodos 1..9
  const [active, setActive] = useState(() => {
    const v = String(value || "");
    if (v.startsWith("pattern:")) return v.replace("pattern:", "").split("-").filter(Boolean);
    return [];
  });
  const [dragging, setDragging] = useState(false);
  const padRef = useRef(null);

  // coordenadas aproximadas de 9 nodos
  const nodes = Array.from({ length: 9 }).map((_, i) => i + 1);
  const coords = useMemo(
    () =>
      nodes.map((n, idx) => {
        const r = Math.floor(idx / 3);
        const c = idx % 3;
        return { n, r, c };
      }),
    []
  );

  const nodeSize = 64; // px
  const gap = 18;
  const padSize = nodeSize * 3 + gap * 2;

  const nodeRect = (r, c) => ({
    left: c * (nodeSize + gap),
    top: r * (nodeSize + gap),
    right: c * (nodeSize + gap) + nodeSize,
    bottom: r * (nodeSize + gap) + nodeSize,
  });

  const pointToNode = (x, y) => {
    // convertir coords absolutas a relativas del pad
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const rx = x - rect.left;
    const ry = y - rect.top;
    for (const { n, r, c } of coords) {
      const nr = nodeRect(r, c);
      if (rx >= nr.left && rx <= nr.right && ry >= nr.top && ry <= nr.bottom) {
        return String(n);
      }
    }
    return null;
  };

  const start = (clientX, clientY) => {
    setActive([]);
    setDragging(true);
    const hit = pointToNode(clientX, clientY);
    if (hit) setActive((a) => (a.includes(hit) ? a : [...a, hit]));
  };

  const move = (clientX, clientY) => {
    if (!dragging) return;
    const hit = pointToNode(clientX, clientY);
    if (hit) setActive((a) => (a.includes(hit) ? a : [...a, hit]));
  };

  const end = () => {
    setDragging(false);
    onChange(`pattern:${active.join("-")}`);
  };

  return (
    <div>
      <div
        ref={padRef}
        className="relative select-none rounded-lg border border-white/10 bg-black/40"
        style={{ width: padSize, height: padSize, touchAction: "none" }}
        onMouseDown={(e) => start(e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={end}
        onMouseLeave={() => dragging && end()}
        onTouchStart={(e) => start(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={end}
      >
        {/* lineas */}
        <svg width={padSize} height={padSize} className="absolute inset-0 pointer-events-none">
          {active.map((n, i) => {
            if (i === 0) return null;
            const prev = Number(active[i - 1]) - 1;
            const curr = Number(n) - 1;
            const pr = Math.floor(prev / 3), pc = prev % 3;
            const cr = Math.floor(curr / 3), cc = curr % 3;
            const p = nodeRect(pr, pc), c = nodeRect(cr, cc);
            const x1 = p.left + nodeSize / 2, y1 = p.top + nodeSize / 2;
            const x2 = c.left + nodeSize / 2, y2 = c.top + nodeSize / 2;
            return <line key={`${i}-${n}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeOpacity="0.7" strokeWidth="2" />;
          })}
        </svg>

        {/* nodos */}
        {coords.map(({ n, r, c }) => {
          const rect = nodeRect(r, c);
          const isOn = active.includes(String(n));
          return (
            <div
              key={n}
              className={`absolute grid place-items-center rounded-full transition
                          ${isOn ? "bg-red-600" : "bg-white/10"} border border-white/20`}
              style={{ left: rect.left, top: rect.top, width: nodeSize, height: nodeSize }}
            >
              <div className={`w-3 h-3 rounded-full ${isOn ? "bg-white" : "bg-white/60"}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-gray-400">
        Traza con el dedo o mouse. Patrón: <span className="text-gray-200">{(value || "").replace(/^pattern:/, "") || "—"}</span>
      </div>
    </div>
  );
}

/* ================= HELPERS ================= */
const asMoney = (n) => `$${Number(n || 0).toFixed(2)}`;
const statusPretty = (s) => (s || "").replace(/_/g, " ");
const priorityChip = (p) => {
  const v = String(p || "normal").toLowerCase();
  const cls =
    v === "urgent" ? "bg-red-600/20 text-red-300 border-red-600/30" :
    v === "high"   ? "bg-orange-500/20 text-orange-300 border-orange-500/30" :
                     "bg-blue-600/20 text-blue-300 border-blue-600/30";
  const label = v === "urgent" ? "Urgente" : v === "high" ? "Alta" : "Normal";
  return { cls, label };
};

/* ================= PANEL ================= */
export default function WorkOrderPanel({ order, onUpdate, onClose, onDelete }) {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Security local state
  const securityInitial = order?.device_security || {};
  const [pin, setPin] = useState(securityInitial.device_pin || "");
  const [pass, setPass] = useState(securityInitial.device_password || "");
  const [pattern, setPattern] = useState(securityInitial.pattern_image || "");
  const [notes, setNotes] = useState(securityInitial.security_notes || "");
  const [savingSec, setSavingSec] = useState(false);
  const [secOk, setSecOk] = useState(false);
  const [secErr, setSecErr] = useState(null);
  const [showPin, setShowPin] = useState(true);     // visible por solicitud
  const [showPass, setShowPass] = useState(true);   // visible por solicitud

  // Secciones colapsables
  const [openItems, setOpenItems] = useState(true);
  const [openChecklist, setOpenChecklist] = useState(false);
  const [openPhotos, setOpenPhotos] = useState(true);
  const [openTimeline, setOpenTimeline] = useState(true);

  useEffect(() => {
    (async () => {
      try { setUser(await base44.auth.me()); } catch {}
      if (order?.assigned_to) {
        try { setAssignedUser(await base44.entities.User.get(order.assigned_to)); }
        catch { setAssignedUser({ full_name: order?.assigned_to_name || "Desconocido" }); }
      }
    })();
  }, [order?.id, order?.assigned_to, order?.assigned_to_name]);

  const handleGoToPOS = () => {
    nav(createPageUrl(`POS?workOrderId=${order.id}`), { state: { fromDashboard: true } });
  };

  const handleChildUpdate = async (data) => {
    // refresca arriba si te pasan objeto o simplemente notifica
    onUpdate?.(data);
  };

  const partsTotal = useMemo(
    () => (Array.isArray(order?.parts_needed) ? order.parts_needed.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0) : 0),
    [order?.parts_needed]
  );
  const tax = partsTotal * 0.115;
  const grandTotal = partsTotal + tax;
  const balance = grandTotal - Number(order?.amount_paid || 0);
  const pr = priorityChip(order?.priority);
  const rawPhone = String(order?.customer_phone || "").replace(/\D+/g, "");
  const hasPhone = rawPhone.length > 0;

  const copyToClipboard = async (v) => { try { v && (await navigator.clipboard.writeText(v)); } catch {} };

  const saveSecurity = async () => {
    if (!order?.id) return;
    setSavingSec(true); setSecErr(null); setSecOk(false);
    try {
      const device_security = {
        device_pin: pin || "",
        device_password: pass || "",
        pattern_image: pattern || "", // aquí guardamos pattern:1-2-3 o una URL si más adelante cambias
        security_notes: notes || "",
      };
      await base44.entities.Order.update(order.id, { device_security });

      try {
        await base44.entities.WorkOrderEvent.create({
          order_id: order.id,
          order_number: order.order_number,
          event_type: "security_update",
          description: "Actualización de datos de acceso del equipo",
          user_id: user?.id,
          user_name: user?.full_name || "Sistema",
        });
      } catch {}

      setSecOk(true);
      // refleja inmediatamente en la UI de arriba
      onUpdate?.({ ...order, device_security });
      setTimeout(() => setSecOk(false), 1500);
    } catch (e) {
      setSecErr("No se pudo guardar. Intenta nuevamente.");
      setTimeout(() => setSecErr(null), 2000);
    } finally {
      setSavingSec(false);
    }
  };

  return (
    <div
      className="relative h-full flex flex-col text-white"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
    >
      {/* ===== Header sticky ===== */}
      <header className="flex-shrink-0 sticky top-0 z-30 border-b border-white/10 bg-[#0D0D0D]/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        <div className="px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-semibold truncate">
              #{order?.order_number || "—"} — {order?.customer_name || "Cliente"}
            </div>
            <div className="text-[12px] text-gray-400 truncate">
              {order?.device_brand || "—"} {order?.device_model || ""}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge className={`text-[11px] ${pr.cls}`}>Prioridad: {pr.label}</Badge>
            <Badge variant="outline" className="text-[11px] border-white/20">Estado: {statusPretty(order?.status)}</Badge>
            <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-300">Balance: {asMoney(balance)}</Badge>

            <Button onClick={handleGoToPOS} className="hidden sm:inline-flex bg-green-600 hover:bg-green-700 h-9">
              <DollarSign className="w-4 h-4 mr-1.5" />
              Cobrar
            </Button>

            {user && ["admin", "manager"].includes(user.role) && (
              <Button onClick={() => setShowDeleteDialog(true)} size="icon" variant="destructive" className="h-9 w-9" title="Eliminar">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button onClick={onClose} size="icon" variant="ghost" className="h-9 w-9 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Main (UNA SOLA PÁGINA) ===== */}
      <main className="flex-1 overflow-y-auto app-scroll bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A]">
        <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-4 space-y-6">

          {/* Info básica */}
          <section className="rounded-lg border border-white/10 bg-black/30 p-3 sm:p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-500" /> Cliente
                </h3>
                <div className="mt-1 text-sm">
                  <div className="font-medium">{order?.customer_name || "—"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400">
                    {order?.customer_phone ? (
                      <>
                        <a href={`tel:${rawPhone}`} className="inline-flex items-center gap-1.5 hover:text-red-400">
                          <Phone className="w-4 h-4" /> {order.customer_phone}
                        </a>
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`https://wa.me/${rawPhone}?text=${encodeURIComponent(`Hola ${order?.customer_name || ""}, te escribimos de 911 SmartFix sobre tu orden ${order?.order_number || ""}.`)}`}
                          className="inline-flex items-center gap-1.5 hover:text-green-400"
                        >
                          <MessageSquare className="w-4 h-4" /> WhatsApp
                        </a>
                      </>
                    ) : <span className="text-gray-500">Sin teléfono</span>}
                    {order?.customer_email ? (
                      <a href={`mailto:${order.customer_email}`} className="inline-flex items-center gap-1.5 hover:text-blue-400">
                        <ImageIcon className="w-4 h-4 rotate-90" /> Email
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white">Técnico</h3>
                <div className="mt-1 text-sm">
                  <div className="font-medium">{assignedUser?.full_name || order?.assigned_to_name || "Sin asignar"}</div>
                  <div className="text-gray-400">Recibido por: {order?.created_by || "Sistema"}</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white">Equipo</h3>
                <div className="mt-1 text-sm">
                  <div className="font-medium">{order?.device_brand || "—"} {order?.device_model || ""}</div>
                  <div className="text-gray-400">Serial/IMEI: {order?.device_serial || "No provisto"}</div>
                </div>
              </div>
            </div>
          </section>

          {/* ACCESO (PIN/PASS/PATRÓN/NOTAS) — visible y con patrón interactivo */}
          <section className="rounded-lg border border-white/10 bg-black/30 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Acceso del equipo</h3>
              <div className="flex items-center gap-2">
                {secOk && (
                  <span className="text-xs px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-600/30">
                    <CheckCircle2 className="w-3 h-3 inline mr-1" /> Guardado
                  </span>
                )}
                {secErr && (
                  <span className="text-xs px-2 py-1 rounded-md bg-red-600/20 text-red-300 border border-red-600/30">
                    <XCircle className="w-3 h-3 inline mr-1" /> {secErr}
                  </span>
                )}
                <Button className="h-9 bg-white/10 hover:bg-white/20" onClick={saveSecurity} disabled={savingSec}>
                  Guardar acceso
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Col 1: PIN + PASS */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400">PIN</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ""))}
                      maxLength={12}
                      className="bg-black/40 border-white/10"
                    />
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setShowPin(s => !s)} title={showPin ? "Ocultar" : "Mostrar"}>
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => copyToClipboard(pin)} title="Copiar PIN">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* render espejo visible/oculto */}
                  <div className="mt-1 text-xs text-gray-400">Vista: <span className="text-gray-100">{showPin ? (pin || "—") : (pin ? "••••" : "—")}</span></div>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Password</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                      className="bg-black/40 border-white/10"
                    />
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setShowPass(s => !s)} title={showPass ? "Ocultar" : "Mostrar"}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => copyToClipboard(pass)} title="Copiar password">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">Vista: <span className="text-gray-100">{showPass ? (pass || "—") : (pass ? "••••••" : "—")}</span></div>
                </div>
              </div>

              {/* Col 2: PATRÓN */}
              <div>
                <label className="text-xs text-gray-400 block mb-2">Patrón (traza para registrar)</label>
                <PatternPad
                  value={pattern}
                  onChange={(p) => setPattern(p)}
                />
              </div>

              {/* Col 3: NOTAS */}
              <div>
                <label className="text-xs text-gray-400">Notas</label>
                <Textarea
                  rows={7}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas relevantes para desbloqueo / pruebas…"
                  className="bg-black/40 border-white/10 resize-none"
                />
                <div className="mt-1 text-xs text-gray-400">
                  {notes?.trim() ? <>Vista: <span className="text-gray-100">{notes}</span></> : "—"}
                </div>
              </div>
            </div>
          </section>

          {/* Partes & Servicios */}
          <section className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
            <header className="px-3 sm:px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setOpenItems(v => !v)}>
              <div className="font-semibold">Partes y Servicios</div>
              {openItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </header>
            {openItems && (
              <div className="p-3 sm:p-4">
                <WorkOrderItems order={order} onUpdate={handleChildUpdate} user={user} />
              </div>
            )}
          </section>

          {/* Checklist */}
          <section className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
            <header className="px-3 sm:px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setOpenChecklist(v => !v)}>
              <div className="font-semibold">Checklist</div>
              {openChecklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </header>
            {openChecklist && (
              <div className="p-3 sm:p-4">
                <WorkOrderChecklist order={order} onUpdate={handleChildUpdate} user={user} />
              </div>
            )}
          </section>

          {/* Fotos */}
          <section className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
            <header className="px-3 sm:px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setOpenPhotos(v => !v)}>
              <div className="font-semibold">Fotos</div>
              {openPhotos ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </header>
            {openPhotos && (
              <div className="p-3 sm:p-4">
                <PhotoDock order={order} onUpdate={handleChildUpdate} />
              </div>
            )}
          </section>

          {/* Historial & Comentarios */}
          <section className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
            <header className="px-3 sm:px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setOpenTimeline(v => !v)}>
              <div className="font-semibold">Historial & Comentarios</div>
              {openTimeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </header>
            {openTimeline && (
              <div className="p-3 sm:p-4">
                <WorkOrderTimeline order={order} onUpdate={handleChildUpdate} user={user} />
              </div>
            )}
          </section>

        </div>
      </main>

      {/* ===== Footer fijo con progreso y acciones ===== */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0D0D0D]/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <WorkOrderProgress order={order} onUpdate={handleChildUpdate} user={user} />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Button onClick={handleGoToPOS} className="bg-green-600 hover:bg-green-700 h-10">
                <DollarSign className="w-4 h-4 mr-1.5" />
                Cobrar
              </Button>
              <Button onClick={onClose} variant="secondary" className="h-10 bg-red-800 hover:bg-red-700">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== Delete dialog ===== */}
      <DeleteOrderDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        order={order}
        onSuccess={() => {
          setShowDeleteDialog(false);
          onDelete?.();
        }}
        user={user}
      />
    </div>
  );
}
