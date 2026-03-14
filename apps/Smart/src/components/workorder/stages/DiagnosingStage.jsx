import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Microscope, ClipboardList, Save, ShoppingCart, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import AddItemModal from "@/components/workorder/AddItemModal";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import OrderLinksDialog from "@/components/workorder/OrderLinksDialog";
import { loadOrderLinks } from "@/components/workorder/utils/orderLinksStore";

export default function DiagnosingStage({ order, onUpdate, user }) {
  const [diagnosis, setDiagnosis] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [events, setEvents] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkOrderPreview, setLinkOrderPreview] = useState(null);
  const [openCatalogFromLink, setOpenCatalogFromLink] = useState(false);

  const effectiveOrder = linkOrderPreview?.id === order?.id
    ? {
        ...order,
        ...linkOrderPreview,
        order_items: Array.isArray(linkOrderPreview?.order_items) ? linkOrderPreview.order_items : order?.order_items,
      }
    : order;

  useEffect(() => {
    loadEvents();
    loadLinks();
  }, [order?.id]);

  useEffect(() => {
    setLinkOrderPreview(null);
    setOpenCatalogFromLink(false);
  }, [order?.id]);

  const loadEvents = async () => {
    if (!order?.id) return;
    try {
      const data = await base44.entities.WorkOrderEvent.filter({ order_id: order.id }, "-created_date", 10);
      setEvents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadLinks = async () => {
    if (!order?.id) return;
    try {
      const result = await loadOrderLinks(order);
      setLinks(Array.isArray(result?.links) ? result.links : []);
    } catch (e) {
      console.error(e);
      setLinks([]);
    }
  };

  const handleSendQuote = async () => {
    if (!order.customer_email) {
      toast.error("El cliente no tiene email registrado");
      return;
    }
    setSendingQuote(true);
    try {
      // Cargar configuración del negocio
      const { getBusinessInfo } = await import("@/components/utils/emailTemplates");
      const businessInfo = await getBusinessInfo();
      
      // Generar PDF bonito
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF();
      
      // Header con gradiente
      doc.setFillColor(0, 168, 232);
      doc.rect(0, 0, 210, 60, 'F');
      doc.setFillColor(16, 185, 129);
      doc.setGState(new doc.GState({ opacity: 0.3 }));
      doc.circle(210, 0, 40, 'F');
      doc.circle(0, 60, 35, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));

      // Logo
      try {
        const logoUrl = businessInfo.logo_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png";
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = logoUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        doc.addImage(img, 'PNG', 20, 10, 35, 35);
      } catch (e) {
        console.log("Logo no disponible");
      }

      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(32);
      doc.setFont(undefined, 'bold');
      doc.text(businessInfo.business_name || 'SmartFixOS', 105, 25, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont(undefined, 'normal');
      doc.text('Cotización de Diagnóstico', 105, 36, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 45, { align: 'center' });

      let yPos = 75;

      // Info del equipo
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(15, yPos - 8, 180, 30, 3, 3, 'F');
      doc.setTextColor(0, 168, 232);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Orden:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(order.order_number || 'N/A', 45, yPos);
      yPos += 10;
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 168, 232);
      doc.text('Equipo:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`${order.device_brand || ''} ${order.device_model || ''}`, 45, yPos);
      yPos += 10;
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 168, 232);
      doc.text('Problema:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      const problemText = doc.splitTextToSize(order.initial_problem || 'N/A', 140);
      doc.text(problemText, 45, yPos);
      yPos += 35;

      // Desglose de precios
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(15, yPos - 5, 180, 65, 5, 5, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.roundedRect(15, yPos - 5, 180, 65, 5, 5, 'S');

      const estimado = Number(order.cost_estimate || order.total || 0);
      const subtotal = estimado / 1.115;
      const ivu = estimado - subtotal;

      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.setFont(undefined, 'normal');
      doc.text('Subtotal', 25, yPos);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(`$${subtotal.toFixed(2)}`, 185, yPos, { align: 'right' });
      yPos += 10;

      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 168, 232);
      doc.text('IVU (11.5%)', 25, yPos);
      doc.setFont(undefined, 'bold');
      doc.text(`+$${ivu.toFixed(2)}`, 185, yPos, { align: 'right' });
      yPos += 15;

      doc.setDrawColor(0, 168, 232);
      doc.setLineWidth(1);
      doc.line(25, yPos, 185, yPos);
      yPos += 12;

      doc.setFillColor(16, 185, 129);
      doc.roundedRect(20, yPos - 8, 170, 16, 3, 3, 'F');
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Total Estimado', 25, yPos);
      doc.setFontSize(18);
      doc.text(`$${estimado.toFixed(2)}`, 185, yPos, { align: 'right' });

      // Footer
      yPos = 270;
      doc.setDrawColor(0, 168, 232);
      doc.setLineWidth(0.3);
      doc.line(20, yPos, 190, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.setTextColor(0, 168, 232);
      doc.setFont(undefined, 'bold');
      doc.text(businessInfo.business_name || 'SmartFixOS', 105, yPos, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(businessInfo.slogan || 'Tu taller de confianza', 105, yPos + 5, { align: 'center' });

      // Email bonito con cotización integrada (sin necesidad de descargar)
      const emailHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 20px; background: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
          <div style="max-width: 650px; margin: 0 auto; background: white;">
            <div style="background: linear-gradient(135deg, #00A8E8 0%, #10B981 100%); padding: 60px 30px; text-align: center;">
              ${businessInfo.logo_url ? `
                <img src="${businessInfo.logo_url}" alt="${businessInfo.business_name}" style="height: 120px; width: auto; margin: 0 auto 20px; display: block; filter: drop-shadow(0 4px 20px rgba(0,0,0,0.2));" />
              ` : ''}
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 800;">🔍 Diagnóstico Completado</h1>
              <p style="color: rgba(255,255,255,0.95); margin: 12px 0 0 0; font-size: 18px; font-weight: 600;">Tu equipo ha sido evaluado</p>
            </div>
            
            <div style="padding: 50px 40px;">
              <p style="font-size: 20px; color: #111827; margin: 0 0 30px 0; font-weight: 600;">
                Hola <strong>${order.customer_name}</strong> 👋
              </p>
              
              <div style="background: #F0FDF4; border-radius: 16px; padding: 24px; margin: 30px 0; border-left: 6px solid #10B981;">
                <p style="margin: 0; color: #065F46; font-size: 22px; font-weight: 800;">
                  ✅ Diagnóstico Completo
                </p>
                <p style="margin: 12px 0 0 0; color: #064E3B; font-size: 16px; line-height: 1.6;">
                  Hemos completado el diagnóstico de tu <strong>${order.device_brand} ${order.device_model}</strong>
                </p>
              </div>
              
              <div style="background: #F9FAFB; border-radius: 16px; padding: 28px; margin: 30px 0; border: 2px solid #E5E7EB;">
                <div style="margin-bottom: 20px;">
                  <p style="color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Número de Orden</p>
                  <p style="color: #111827; font-size: 24px; font-weight: 800; margin: 0;">${order.order_number}</p>
                </div>
                <div>
                  <p style="color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Problema Reportado</p>
                  <p style="color: #1F2937; font-size: 16px; margin: 0; line-height: 1.6; background: white; padding: 16px; border-radius: 8px; border: 2px solid #E5E7EB;">
                    ${order.initial_problem || 'N/A'}
                  </p>
                </div>
              </div>
              
              <div style="background: #F9FAFB; border-radius: 16px; padding: 28px; margin: 30px 0; border: 2px solid #E5E7EB;">
                <p style="color: #111827; font-size: 18px; margin: 0 0 20px 0; font-weight: 700; text-align: center;">💰 Cotización Detallada</p>
                
                <div style="background: white; border-radius: 12px; padding: 24px; border: 2px solid #E5E7EB;">
                  <div style="margin-bottom: 16px;">
                    <p style="color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Orden</p>
                    <p style="color: #111827; font-size: 20px; font-weight: 800; margin: 0;">${order.order_number}</p>
                  </div>
                  
                  <div style="margin-bottom: 16px;">
                    <p style="color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Equipo</p>
                    <p style="color: #1F2937; font-size: 16px; margin: 0;">${order.device_brand || ''} ${order.device_model || ''}</p>
                  </div>
                  
                  <div style="margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #E5E7EB;">
                    <p style="color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Problema Reportado</p>
                    <p style="color: #1F2937; font-size: 14px; margin: 0; line-height: 1.6;">${order.initial_problem || 'N/A'}</p>
                  </div>
                  
                  <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                      <span style="color: #6B7280; font-size: 14px;">Subtotal</span>
                      <span style="color: #111827; font-size: 14px; font-weight: 700;">$${(Number(order.cost_estimate || order.total || 0) / 1.115).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 2px solid #E5E7EB;">
                      <span style="color: #00A8E8; font-size: 14px; font-weight: 600;">IVU (11.5%)</span>
                      <span style="color: #00A8E8; font-size: 14px; font-weight: 700;">+$${(Number(order.cost_estimate || order.total || 0) - (Number(order.cost_estimate || order.total || 0) / 1.115)).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px;">
                      <span style="color: white; font-size: 16px; font-weight: 800;">Total Estimado</span>
                      <span style="color: white; font-size: 20px; font-weight: 900;">${Number(order.cost_estimate || order.total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <p style="color: #374151; line-height: 1.8; font-size: 16px; margin: 20px 0;">
                Adjuntamos evidencias y detalles técnicos. Por favor revise la información y contáctenos para proceder.
              </p>
              
              ${businessInfo.phone || businessInfo.whatsapp ? `
                <div style="background: #F9FAFB; border-radius: 12px; padding: 24px; margin: 30px 0; text-align: center; border: 2px solid #E5E7EB;">
                  <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">💬 Contáctanos</p>
                  <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                    ${businessInfo.phone ? `
                      <a href="tel:${businessInfo.phone}" style="display: inline-flex; align-items: center; gap: 8px; background: #111827; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
                        📞 Llamar
                      </a>
                    ` : ''}
                    ${businessInfo.whatsapp ? `
                      <a href="https://wa.me/${businessInfo.whatsapp.replace(/\D/g, '')}" style="display: inline-flex; align-items: center; gap: 8px; background: #10B981; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
                        💬 WhatsApp
                      </a>
                    ` : ''}
                  </div>
                </div>
              ` : ''}
              
              <div style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #E5E7EB; text-align: center;">
                ${businessInfo.logo_url ? `
                  <img src="${businessInfo.logo_url}" alt="${businessInfo.business_name}" style="height: 60px; width: auto; margin: 0 auto 20px; display: block; opacity: 0.7;" />
                ` : ''}
                <p style="margin: 8px 0; color: #111827; font-size: 14px; font-weight: 700;">
                  ${businessInfo.business_name || 'SmartFixOS'}
                </p>
                <p style="margin: 4px 0; color: #6B7280; font-size: 13px;">
                  ${businessInfo.slogan || 'Tu taller de confianza'}
                </p>
                ${businessInfo.address ? `<p style="margin: 8px 0; color: #6B7280; font-size: 13px;">${businessInfo.address}</p>` : ''}
                ${businessInfo.phone ? `<p style="margin: 8px 0; color: #6B7280; font-size: 13px;">📞 ${businessInfo.phone}</p>` : ''}
                <p style="color: #9CA3AF; font-size: 11px; margin: 16px 0 0 0;">
                  ${new Date().toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await base44.integrations.Core.SendEmail({
        to: order.customer_email,
        subject: `🔍 Diagnóstico Completado - Orden #${order.order_number}`,
        body: emailHTML
      });
      
      toast.success("Cotización enviada al cliente");
    } catch (error) {
      console.error(error);
      toast.error("Error al enviar cotización");
    } finally {
      setSendingQuote(false);
    }
  };

  const handleSaveDiagnosis = async () => {
    if (!diagnosis.trim()) return;
    setSaving(true);
    try {
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "diagnosis_added",
        description: `Diagnóstico Técnico: ${diagnosis}`,
        user_name: user?.full_name || "Técnico",
        user_id: user?.id,
        metadata: { diagnosis: true }
      });
      
      setDiagnosis("");
      onUpdate();
      loadEvents();
      toast.success("Diagnóstico guardado");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar diagnóstico");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-purple-500/15 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_30%),linear-gradient(135deg,rgba(16,12,30,0.98),rgba(10,18,30,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-purple-200">
                Diagnostico
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Analisis tecnico
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Etapa de Diagnóstico</h2>
                <div className="inline-flex items-center rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-sm font-semibold text-purple-200">
                  {order?.device_brand} {order?.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Documenta hallazgos, añade enlaces de piezas y deja una cotización clara para que el cliente entienda el siguiente paso.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-purple-200">{order?.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Notas de Diagnóstico</p>
                    <p className="line-clamp-2 text-sm font-semibold text-white/75">
                      {events.find((event) => event.event_type === "diagnosis_added")?.description || "Documenta hallazgos, pruebas y conclusión."}
                    </p>
                  </div>
                  <Button
                    onClick={() => setActiveModal(activeModal === "diagnosis" ? null : "diagnosis")}
                    size="sm"
                    className="w-full rounded-xl bg-purple-600 px-3 text-white hover:bg-purple-500 sm:w-auto"
                  >
                    {activeModal === "diagnosis" ? "Cerrar" : "Abrir"}
                  </Button>
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Links y Cotización</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    onClick={() => setActiveModal(activeModal === "links" ? null : "links")}
                    size="sm"
                    className="w-full rounded-xl bg-cyan-600 px-3 text-white hover:bg-cyan-500 sm:w-auto"
                  >
                    {activeModal === "links" ? "Cerrar" : (links.length > 0 ? "Ver Links" : "Añadir Link")}
                  </Button>
                  <Button
                    onClick={handleSendQuote}
                    disabled={sendingQuote}
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                  >
                    {sendingQuote ? "Enviando..." : "Cotización"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <section className="relative overflow-hidden rounded-[28px] border border-purple-500/15 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.10),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
            <div className="relative z-10 border-b border-white/10 px-5 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/15 shadow-[0_10px_30px_rgba(168,85,247,0.12)]">
                    <ShoppingCart className="h-5 w-5 text-purple-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Acción rápida</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                      Añade piezas o servicios sugeridos para que la cotización salga lista desde esta misma etapa.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowCatalog(true)}
                  className="h-10 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-500 px-5 font-bold text-white shadow-[0_12px_30px_rgba(124,58,237,0.24)] hover:from-purple-500 hover:to-indigo-400"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Piezas y Servicios
                </Button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <WorkOrderUnifiedHub
        order={order}
        onUpdate={onUpdate}
        accent="purple"
        title="Centro de Historial"
        subtitle="Diagnóstico, notas, evidencia y seguridad integrados en un mismo lugar."
      />

      {activeModal === "diagnosis" && (
        <section className="overflow-hidden rounded-[28px] border border-purple-500/15 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_24px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(168,85,247,0.12),rgba(99,102,241,0.05),transparent)] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/15 text-purple-300 sm:h-12 sm:w-12">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Diagnóstico técnico</p>
                <h3 className="text-lg font-black tracking-tight text-white sm:text-xl">Notas de Diagnóstico</h3>
              </div>
            </div>
          </div>
          <div className="space-y-5 p-4 sm:p-6">
            <Textarea
              placeholder="Describe los hallazgos técnicos, pruebas realizadas y conclusión..."
              className="min-h-[180px] resize-none rounded-[22px] border-white/10 bg-black/30 text-white transition-all placeholder:text-white/20 focus:border-purple-400/40 focus:ring-purple-500/40"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                className="h-11 justify-start rounded-2xl border border-white/10 bg-white/5 px-4 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={handleSendQuote}
                disabled={sendingQuote}
              >
                <Send className="mr-2 h-4 w-4" />
                {sendingQuote ? "Enviando..." : "Enviar Cotización"}
              </Button>
              <Button
                onClick={async () => {
                  await handleSaveDiagnosis();
                  setActiveModal(null);
                }}
                disabled={saving || !diagnosis.trim()}
                className="h-11 rounded-2xl border-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-6 text-white shadow-lg shadow-purple-950/30 hover:from-purple-500 hover:to-indigo-500"
              >
                {saving ? "Guardando..." : <><Save className="mr-2 h-4 w-4" /> Guardar Nota</>}
              </Button>
            </div>
          </div>
        </section>
      )}

      <OrderLinksDialog
        order={effectiveOrder}
        user={user}
        onUpdate={() => {
          loadLinks();
          onUpdate?.();
        }}
        onLinkSaved={(nextOrder) => {
          if (nextOrder?.id === order?.id) {
            setLinkOrderPreview(nextOrder);
            setOpenCatalogFromLink(true);
            setShowCatalog(true);
          }
        }}
        open={activeModal === "links"}
        onOpenChange={(open) => setActiveModal(open ? "links" : null)}
        accent="cyan"
        allowAdd={true}
        title="Ver y Añadir Links"
        subtitle="Links de piezas"
        onLinksChange={setLinks}
      />

      <AddItemModal 
        open={showCatalog} 
        onClose={() => {
          setShowCatalog(false);
          setOpenCatalogFromLink(false);
        }} 
        order={effectiveOrder}
        initialItems={Array.isArray(effectiveOrder?.order_items) ? effectiveOrder.order_items : []}
        onUpdate={onUpdate}
        autoOpenCart={openCatalogFromLink}
      />
      
    </div>
  );
}
