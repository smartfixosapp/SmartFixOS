import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, FileText, X, Mail, MessageCircle, Check, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { openWhatsApp } from "@/components/utils/helpers";
import ThermalSaleReceipt from "./ThermalSaleReceipt";
import ThermalOrderReceipt from "./ThermalOrderReceipt";
import { jsPDF } from "jspdf";

export default function UniversalPrintDialog({ 
  open, 
  onClose, 
  type = "sale", // "sale" o "order"
  data, 
  customer 
}) {
  const [printerType, setPrinterType] = useState(null); // "thermal" o "standard"
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState({ email: false, whatsapp: false });
  const [sent, setSent] = useState({ email: false, whatsapp: false });
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [showManualInput, setShowManualInput] = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [logo, setLogo] = useState("");

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem("printer_type");
      if (saved) {
        setPrinterType(saved);
        setShowPreview(true);
      }
      loadBusinessInfo();
      loadLogo();
    }
  }, [open]);

  const loadBusinessInfo = async () => {
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length) {
        setBusinessInfo(configs[0].payload);
      }
    } catch (error) {
      console.log("Using default business info");
    }
  };

  const loadLogo = async () => {
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "app-branding" });
      if (configs?.length > 0 && configs[0].payload?.logo_url) {
        setLogo(configs[0].payload.logo_url);
      }
    } catch (error) {
      console.log("No logo configured");
    }
  };

  const selectPrinter = (type) => {
    setPrinterType(type);
    localStorage.setItem("printer_type", type);
    setShowPreview(true);
  };

  const handlePrint = () => {
    window.print();
    toast.success("✅ Imprimiendo recibo");
    setTimeout(() => onClose?.(), 1000);
  };

  const handleGeneratePDF = async () => {
    try {
      toast.loading("Generando PDF...");
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let y = 20;

      // ===== HEADER PROFESIONAL CON LOGO =====
      if (logo) {
        try {
          doc.addImage(logo, 'PNG', pageWidth / 2 - 30, y, 60, 25, undefined, 'FAST');
          y += 35;
        } catch {
          doc.setFontSize(28);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 168, 232);
          doc.text(businessInfo?.business_name || '911 Smart Fix', pageWidth / 2, y, { align: 'center' });
          y += 15;
        }
      } else {
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 168, 232);
        doc.text(businessInfo?.business_name || '911 Smart Fix', pageWidth / 2, y, { align: 'center' });
        y += 15;
      }

      // Tipo de documento
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(type === "sale" ? "RECIBO DE VENTA" : "ORDEN DE REPARACIÓN", pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Línea decorativa
      doc.setDrawColor(0, 168, 232);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      // ===== INFORMACIÓN DEL DOCUMENTO =====
      doc.setFillColor(240, 253, 250);
      doc.roundedRect(margin, y, contentWidth, 25, 3, 3, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Número:', margin + 5, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${type === "sale" ? data.sale_number : data.order_number}`, margin + 30, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.text('Fecha:', margin + 5, y + 16);
      doc.setFont('helvetica', 'normal');
      doc.text(format(new Date(data.created_date || new Date()), 'dd/MM/yyyy HH:mm'), margin + 30, y + 16);

      if (type === "order") {
        doc.setFont('helvetica', 'bold');
        doc.text('Estado:', pageWidth - margin - 55, y + 8);
        doc.setFont('helvetica', 'normal');
        const statusMap = {
          intake: 'Recepción',
          in_progress: 'En Reparación',
          ready_for_pickup: 'Listo',
          delivered: 'Entregado'
        };
        doc.text(statusMap[data.status] || data.status, pageWidth - margin - 25, y + 8);
      }
      
      y += 35;

      // ===== CLIENTE =====
      if (customer?.name || data.customer_name) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 168, 232);
        doc.text('CLIENTE', margin, y);
        y += 8;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(customer?.name || data.customer_name, margin, y);
        y += 6;
        if (customer?.phone || data.customer_phone) {
          doc.setTextColor(80, 80, 80);
          doc.text(`Tel: ${customer?.phone || data.customer_phone}`, margin, y);
          y += 6;
        }
        if (customer?.email || data.customer_email) {
          doc.text(`Email: ${customer?.email || data.customer_email}`, margin, y);
          y += 6;
        }
        y += 10;
      }

      // ===== EQUIPO (solo para órdenes) =====
      if (type === "order" && (data.device_brand || data.device_model)) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text('EQUIPO', margin, y);
        y += 8;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`${data.device_brand || ''} ${data.device_model || ''}`, margin, y);
        y += 6;
        
        if (data.device_serial) {
          doc.setTextColor(80, 80, 80);
          doc.text(`S/N: ${data.device_serial}`, margin, y);
          y += 6;
        }

        if (data.initial_problem) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Problema:', margin, y);
          y += 6;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          const problemLines = doc.splitTextToSize(data.initial_problem, contentWidth - 10);
          doc.text(problemLines, margin + 5, y);
          y += (problemLines.length * 5) + 5;
        }
        
        y += 10;
      }

      // ===== TABLA DE ITEMS =====
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('ARTÍCULOS', margin, y);
      y += 10;

      // Header de tabla
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 5, contentWidth, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Artículo', margin + 2, y);
      doc.text('Cant.', pageWidth - margin - 70, y);
      doc.text('Precio', pageWidth - margin - 45, y);
      doc.text('Total', pageWidth - margin - 5, y, { align: 'right' });
      y += 8;

      // Items
      const items = type === "sale" ? data.items : data.order_items || [];
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      items.forEach((item, idx) => {
        const qty = item.quantity || item.qty || 1;
        const price = item.price || 0;
        const total = qty * price;
        
        // Alternar fondo
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(margin, y - 4, contentWidth, 7, 'F');
        }
        
        doc.text(item.name.substring(0, 40), margin + 2, y);
        doc.text(`${qty}`, pageWidth - margin - 70, y);
        doc.text(`$${price.toFixed(2)}`, pageWidth - margin - 45, y);
        doc.text(`$${total.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
        y += 7;
      });

      y += 10;

      // ===== TOTALES =====
      const totals = type === "sale" ? {
        subtotal: data.subtotal || 0,
        tax: data.tax_amount || 0,
        total: data.total || 0,
        discount: data.discount_amount || 0
      } : (() => {
        const items = data.order_items || [];
        const subtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 1)), 0);
        const labor = data.labor_cost || 0;
        const total = subtotal + labor;
        const tax = total * 0.115;
        return { subtotal, labor, total: total + tax, tax };
      })();

      // Caja de totales
      const totalsX = pageWidth - margin - 70;
      
      doc.setDrawColor(200, 200, 200);
      doc.line(totalsX - 5, y, pageWidth - margin, y);
      y += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', totalsX, y);
      doc.text(`$${totals.subtotal.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
      y += 6;

      if (totals.labor > 0) {
        doc.text('Mano de Obra:', totalsX, y);
        doc.text(`$${totals.labor.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
        y += 6;
      }

      if (totals.discount > 0) {
        doc.setTextColor(5, 150, 105);
        doc.text('Descuento:', totalsX, y);
        doc.text(`-$${totals.discount.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 6;
      }

      doc.text('IVU (11.5%):', totalsX, y);
      doc.text(`$${totals.tax.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
      y += 8;

      // Total destacado
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(totalsX - 5, y - 5, 75, 12, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL:', totalsX, y + 3);
      doc.text(`$${totals.total.toFixed(2)}`, pageWidth - margin - 5, y + 3, { align: 'right' });
      y += 20;

      // ===== INFO DE PAGO =====
      if (type === "sale") {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const paymentMap = {
          cash: 'Efectivo',
          card: 'Tarjeta',
          ath_movil: 'ATH Movil',
          transfer: 'Transferencia'
        };
        doc.text(`Metodo de pago: ${paymentMap[data.payment_method] || data.payment_method}`, margin, y);
        y += 15;
      }

      if (type === "order" && data.amount_paid > 0) {
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, y, contentWidth, 15, 2, 2, 'F');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Pagado:', margin + 5, y + 6);
        doc.text(`$${(data.amount_paid || 0).toFixed(2)}`, pageWidth - margin - 30, y + 6);
        doc.setFont('helvetica', 'bold');
        doc.text('Balance:', margin + 5, y + 12);
        const balance = totals.total - (data.amount_paid || 0);
        doc.setTextColor(balance > 0 ? 220 : 0, balance > 0 ? 38 : 150, balance > 0 ? 38 : 0);
        doc.text(`$${balance.toFixed(2)}`, pageWidth - margin - 30, y + 12);
        y += 25;
      }

      // ===== FOOTER =====
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      const footerY = pageHeight - 25;
      doc.text('¡Gracias por su preferencia!', pageWidth / 2, footerY, { align: 'center' });
      doc.setFontSize(8);
      doc.text(businessInfo?.business_name || '911 Smart Fix', pageWidth / 2, footerY + 6, { align: 'center' });

      // Descargar
      doc.save(`${type === "sale" ? "Recibo" : "Orden"}_${type === "sale" ? data.sale_number : data.order_number}.pdf`);
      
      toast.dismiss();
      toast.success("✅ PDF descargado");
    } catch (error) {
      toast.dismiss();
      toast.error("Error generando PDF");
      console.error(error);
    }
  };

  const generatePDFBlob = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let y = 20;

    // ===== HEADER PROFESIONAL CON LOGO =====
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', pageWidth / 2 - 30, y, 60, 25, undefined, 'FAST');
        y += 35;
      } catch {
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 168, 232);
        doc.text(businessInfo?.business_name || '911 Smart Fix', pageWidth / 2, y, { align: 'center' });
        y += 15;
      }
    } else {
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 168, 232);
      doc.text(businessInfo?.business_name || '911 Smart Fix', pageWidth / 2, y, { align: 'center' });
      y += 15;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(type === "sale" ? "RECIBO DE VENTA" : "ORDEN DE REPARACIÓN", pageWidth / 2, y, { align: 'center' });
    y += 12;

    doc.setDrawColor(0, 168, 232);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    doc.setFillColor(240, 253, 250);
    doc.roundedRect(margin, y, contentWidth, 25, 3, 3, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Número:', margin + 5, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${type === "sale" ? data.sale_number : data.order_number}`, margin + 30, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', margin + 5, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(data.created_date || new Date()), 'dd/MM/yyyy HH:mm'), margin + 30, y + 16);

    if (type === "order") {
      doc.setFont('helvetica', 'bold');
      doc.text('Estado:', pageWidth - margin - 55, y + 8);
      doc.setFont('helvetica', 'normal');
      const statusMap = { intake: 'Recepción', in_progress: 'En Reparación', ready_for_pickup: 'Listo', delivered: 'Entregado' };
      doc.text(statusMap[data.status] || data.status, pageWidth - margin - 25, y + 8);
    }
    
    y += 35;

    if (customer?.name || data.customer_name) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 168, 232);
      doc.text('CLIENTE', margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(customer?.name || data.customer_name, margin, y);
      y += 6;
      if (customer?.phone || data.customer_phone) {
        doc.setTextColor(80, 80, 80);
        doc.text(`Tel: ${customer?.phone || data.customer_phone}`, margin, y);
        y += 6;
      }
      if (customer?.email || data.customer_email) {
        doc.text(`Email: ${customer?.email || data.customer_email}`, margin, y);
        y += 6;
      }
      y += 10;
    }

    if (type === "order" && (data.device_brand || data.device_model)) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text('EQUIPO', margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`${data.device_brand || ''} ${data.device_model || ''}`, margin, y);
      y += 6;
      
      if (data.device_serial) {
        doc.setTextColor(80, 80, 80);
        doc.text(`S/N: ${data.device_serial}`, margin, y);
        y += 6;
      }

      if (data.initial_problem) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Problema:', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        const problemLines = doc.splitTextToSize(data.initial_problem, contentWidth - 10);
        doc.text(problemLines, margin + 5, y);
        y += (problemLines.length * 5) + 5;
      }
      
      y += 10;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('ARTÍCULOS', margin, y);
    y += 10;

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 5, contentWidth, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('Artículo', margin + 2, y);
    doc.text('Cant.', pageWidth - margin - 70, y);
    doc.text('Precio', pageWidth - margin - 45, y);
    doc.text('Total', pageWidth - margin - 5, y, { align: 'right' });
    y += 8;

    const items = type === "sale" ? data.items : data.order_items || [];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    items.forEach((item, idx) => {
      const qty = item.quantity || item.qty || 1;
      const price = item.price || 0;
      const total = qty * price;
      
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 4, contentWidth, 7, 'F');
      }
      
      doc.text(item.name.substring(0, 40), margin + 2, y);
      doc.text(`${qty}`, pageWidth - margin - 70, y);
      doc.text(`$${price.toFixed(2)}`, pageWidth - margin - 45, y);
      doc.text(`$${total.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
      y += 7;
    });

    y += 10;

    const totals = type === "sale" ? {
      subtotal: data.subtotal || 0,
      tax: data.tax_amount || 0,
      total: data.total || 0,
      discount: data.discount_amount || 0
    } : (() => {
      const items = data.order_items || [];
      const subtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 1)), 0);
      const labor = data.labor_cost || 0;
      const total = subtotal + labor;
      const tax = total * 0.115;
      return { subtotal, labor, total: total + tax, tax };
    })();

    const totalsX = pageWidth - margin - 70;
    
    doc.setDrawColor(200, 200, 200);
    doc.line(totalsX - 5, y, pageWidth - margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsX, y);
    doc.text(`$${totals.subtotal.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
    y += 6;

    if (totals.labor > 0) {
      doc.text('Mano de Obra:', totalsX, y);
      doc.text(`$${totals.labor.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
      y += 6;
    }

    if (totals.discount > 0) {
      doc.setTextColor(5, 150, 105);
      doc.text('Descuento:', totalsX, y);
      doc.text(`-$${totals.discount.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 6;
    }

    doc.text('IVU (11.5%):', totalsX, y);
    doc.text(`$${totals.tax.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
    y += 8;

    doc.setFillColor(16, 185, 129);
    doc.roundedRect(totalsX - 5, y - 5, 75, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL:', totalsX, y + 3);
    doc.text(`$${totals.total.toFixed(2)}`, pageWidth - margin - 5, y + 3, { align: 'right' });
    y += 20;

    if (type === "sale") {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const paymentMap = { cash: 'Efectivo', card: 'Tarjeta', ath_movil: 'ATH Movil', transfer: 'Transferencia' };
      doc.text(`Metodo de pago: ${paymentMap[data.payment_method] || data.payment_method}`, margin, y);
      y += 15;
    }

    if (type === "order" && data.amount_paid > 0) {
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, y, contentWidth, 15, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Pagado:', margin + 5, y + 6);
      doc.text(`$${(data.amount_paid || 0).toFixed(2)}`, pageWidth - margin - 30, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.text('Balance:', margin + 5, y + 12);
      const balance = totals.total - (data.amount_paid || 0);
      doc.setTextColor(balance > 0 ? 220 : 0, balance > 0 ? 38 : 150, balance > 0 ? 38 : 0);
      doc.text(`$${balance.toFixed(2)}`, pageWidth - margin - 30, y + 12);
      y += 25;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    const footerY = pageHeight - 25;
    doc.text('¡Gracias por su preferencia!', pageWidth / 2, footerY, { align: 'center' });
    doc.setFontSize(8);
    doc.text(businessInfo?.business_name || '911 Smart Fix', pageWidth / 2, footerY + 6, { align: 'center' });

    return doc.output('blob');
  };

  const handleSendEmail = async (email) => {
    const targetEmail = email || manualEmail;
    
    if (!targetEmail) {
      toast.error("Ingresa un email válido");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      toast.error("Formato de email inválido");
      return;
    }

    setSending(prev => ({ ...prev, email: true }));
    try {
      // Generar PDF
      const pdfBlob = await generatePDFBlob();
      const { file_url: pdfUrl } = await base44.integrations.Core.UploadFile({ file: pdfBlob });
      const customerName = customer?.name || data.customer_name || "Cliente";
      
      const itemsList = (type === "sale" ? data.items : data.order_items || []).map((item, idx) => 
        `<tr style="background: ${idx % 2 === 0 ? '#F9FAFB' : 'white'};">
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; color: #1F2937; font-weight: 600;">${item.name}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: center; color: #374151;">${item.quantity || item.qty || 1}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: right; color: #6B7280;">$${(item.price || 0).toFixed(2)}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold; color: #059669;">$${((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}</td>
        </tr>`
      ).join('');

      const totals = type === "sale" ? {
        subtotal: data.subtotal || 0,
        tax: data.tax_amount || 0,
        total: data.total || 0,
        discount: data.discount_amount || 0
      } : (() => {
        const items = data.order_items || [];
        const subtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0);
        const labor = data.labor_cost || 0;
        const total = subtotal + labor;
        const tax = total * (data.tax_rate || 0.115);
        return { subtotal, labor, total: total + tax, tax };
      })();

      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="margin: 0; padding: 0; background: #F3F4F6;">
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #00A8E8 0%, #10B981 50%, #A8D700 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                ${type === "sale" ? "🧾 Recibo de Venta" : "🔧 Orden de Reparación"}
              </h1>
            </div>
            
            <div style="padding: 40px 30px; background: white;">
              <div style="background: #F9FAFB; border-left: 4px solid #00A8E8; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <p style="margin: 0; color: #6B7280; font-size: 12px;">NÚMERO</p>
                <p style="margin: 4px 0 0 0; color: #111827; font-size: 20px; font-weight: bold;">
                  ${type === "sale" ? data.sale_number : data.order_number}
                </p>
                <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 14px;">${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                ${customer?.name || data.customer_name ? `
                <div style="border-top: 1px solid #E5E7EB; padding-top: 12px; margin-top: 12px;">
                  <p style="margin: 0; color: #111827; font-weight: bold;">${customer?.name || data.customer_name}</p>
                  ${customer?.phone || data.customer_phone ? `<p style="margin: 4px 0 0 0; color: #374151;">📞 ${customer?.phone || data.customer_phone}</p>` : ''}
                </div>
                ` : ''}
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background: #374151;">
                    <th style="padding: 12px; text-align: left; color: white;">Artículo</th>
                    <th style="padding: 12px; text-align: center; color: white;">Cant.</th>
                    <th style="padding: 12px; text-align: right; color: white;">Precio</th>
                    <th style="padding: 12px; text-align: right; color: white;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsList}</tbody>
              </table>

              <div style="background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Subtotal</span>
                  <span style="font-weight: bold;">$${totals.subtotal.toFixed(2)}</span>
                </div>
                ${totals.labor > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Mano de Obra</span>
                  <span style="font-weight: bold;">$${totals.labor.toFixed(2)}</span>
                </div>` : ''}
                ${totals.discount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #059669;">
                  <span>Descuento</span>
                  <span style="font-weight: bold;">-$${totals.discount.toFixed(2)}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>IVU (11.5%)</span>
                  <span style="font-weight: bold;">$${totals.tax.toFixed(2)}</span>
                </div>
                <div style="border-top: 3px solid #10B981; padding-top: 12px; margin-top: 12px; display: flex; justify-content: space-between;">
                  <span style="font-size: 20px; font-weight: bold; color: #059669;">TOTAL</span>
                  <span style="font-size: 28px; font-weight: bold; color: #059669;">$${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style="background: #F9FAFB; padding: 30px; text-align: center; border-top: 3px solid #E5E7EB;">
              <p style="margin: 0; color: #111827; font-weight: bold;">✨ SmartFixOS</p>
              <p style="margin: 8px 0 0 0; color: #9CA3AF; font-size: 11px;">
                ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm:ss")}
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const fromName = businessInfo?.business_name || "SmartFixOS";
      await base44.integrations.Core.SendEmail({
        from_name: fromName,
        to: targetEmail,
        subject: `${type === "sale" ? "🧾 Recibo de Venta" : "🔧 Orden de Reparación"} #${type === "sale" ? data.sale_number : data.order_number}`,
        body: emailBody
      });

      setSent(prev => ({ ...prev, email: true }));
      setShowManualInput(null);
      setManualEmail("");
      toast.success("✅ Recibo enviado por email");
    } catch (error) {
      toast.error("Error al enviar email");
    } finally {
      setSending(prev => ({ ...prev, email: false }));
    }
  };

  const handleSendWhatsApp = async (phone) => {
    const targetPhone = phone || manualPhone;
    
    if (!targetPhone) {
      toast.error("Ingresa un número de teléfono");
      return;
    }

    setSending(prev => ({ ...prev, whatsapp: true }));
    try {
      // Generar PDF
      toast.loading("Generando PDF para WhatsApp...");
      const pdfBlob = await generatePDFBlob();
      toast.dismiss();
      
      // Nota: WhatsApp Web no permite adjuntar archivos automáticamente
      // pero generamos el PDF y lo descargamos para que el usuario lo comparta manualmente
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type === "sale" ? "Recibo" : "Orden"}_${type === "sale" ? data.sale_number : data.order_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();

      const message = `
${type === "sale" ? "🧾 *RECIBO DE VENTA*" : "🔧 *ORDEN DE REPARACIÓN*"}
━━━━━━━━━━━━━━━━━━━━

${businessInfo?.business_name || '911 Smart Fix'}

📋 *${type === "sale" ? "Recibo" : "Orden"}:* ${type === "sale" ? data.sale_number : data.order_number}
👤 *Cliente:* ${customer?.name || data.customer_name || "Cliente"}
📅 *Fecha:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}

📄 *Tu recibo completo está adjunto en PDF*
(Por favor, adjunta el archivo PDF descargado)

━━━━━━━━━━━━━━━━━━━━
🔧 *${businessInfo?.business_name || '911 Smart Fix'}*
${businessInfo?.business_phone ? `📞 ${businessInfo.business_phone}` : ''}
Gracias por su preferencia
      `.trim();

      openWhatsApp(targetPhone, message);
      setSent(prev => ({ ...prev, whatsapp: true }));
      setShowManualInput(null);
      setManualPhone("");
      toast.success("✅ PDF descargado - Abriendo WhatsApp");
    } catch (error) {
      toast.error("Error al generar PDF");
      console.error(error);
    } finally {
      setSending(prev => ({ ...prev, whatsapp: false }));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md">
      <div className="h-full overflow-y-auto p-4">
        <div className="min-h-full flex items-center justify-center">
          <div className="w-full max-w-4xl bg-[#0F0F12] border-2 border-cyan-500/30 rounded-2xl shadow-[0_24px_80px_rgba(0,168,232,0.6)]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-cyan-500/20">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <Printer className="w-7 h-7 text-cyan-400" />
                Imprimir Recibo
              </h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            {!showPreview ? (
              // Selector de impresora
              <div className="p-8">
                <p className="text-gray-300 text-center mb-8 text-lg">
                  Selecciona el tipo de impresora
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => selectPrinter("thermal")}
                    className="group relative overflow-hidden bg-gradient-to-br from-orange-600/20 to-amber-600/20 border-2 border-orange-500/40 hover:border-orange-400/70 rounded-2xl p-8 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_40px_rgba(249,115,22,0.3)]"
                  >
                    <div className="text-center">
                      <div className="text-6xl mb-4">🧾</div>
                      <h3 className="text-white font-black text-2xl mb-2">Impresora Térmica</h3>
                      <p className="text-gray-400 text-sm">
                        Recibo compacto 58mm/80mm
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => selectPrinter("standard")}
                    className="group relative overflow-hidden bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-2 border-blue-500/40 hover:border-blue-400/70 rounded-2xl p-8 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_40px_rgba(37,99,235,0.3)]"
                  >
                    <div className="text-center">
                      <div className="text-6xl mb-4">📄</div>
                      <h3 className="text-white font-black text-2xl mb-2">Impresora Normal</h3>
                      <p className="text-gray-400 text-sm">
                        Recibo formato A4 / Carta
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              // Preview y opciones de impresión
              <div>
                <div className="p-6 bg-cyan-600/10 border-b border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                        <Printer className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold">
                          {printerType === "thermal" ? "Impresora Térmica" : "Impresora Normal"}
                        </p>
                        <p className="text-cyan-300 text-sm">
                          {printerType === "thermal" ? "Recibo compacto" : "Formato completo"}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setShowPreview(false);
                        setPrinterType(null);
                        localStorage.removeItem("printer_type");
                      }}
                      variant="outline"
                      size="sm"
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20"
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>

                {/* Preview del recibo */}
                <div className="p-6 max-h-[60vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-black">
                  {printerType === "thermal" ? (
                    type === "sale" ? (
                      <ThermalSaleReceipt sale={data} customer={customer} />
                    ) : (
                      <ThermalOrderReceipt order={data} />
                    )
                  ) : (
                    <StandardReceipt type={type} data={data} customer={customer} logo={logo} businessInfo={businessInfo} />
                  )}
                </div>

                {/* Botones de acción */}
                <div className="p-6 border-t border-cyan-500/20 bg-black/40 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handlePrint}
                      className="h-14 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 shadow-[0_8px_24px_rgba(0,168,232,0.5)] font-bold text-base"
                    >
                      <Printer className="w-5 h-5 mr-2" />
                      Imprimir
                    </Button>
                    <Button
                      onClick={handleGeneratePDF}
                      className="h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-[0_8px_24px_rgba(168,85,247,0.5)] font-bold text-base"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Generar PDF
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {showManualInput === 'email' ? (
                      <div className="col-span-2 flex gap-2">
                        <Input
                          type="email"
                          value={manualEmail}
                          onChange={(e) => setManualEmail(e.target.value)}
                          placeholder="cliente@email.com"
                          className="flex-1 bg-black/40 border-white/15 text-white"
                          autoFocus
                        />
                        <Button
                          onClick={() => handleSendEmail()}
                          disabled={sending.email || !manualEmail}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {sending.email ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setShowManualInput(null);
                            setManualEmail("");
                          }}
                          className="text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => customer?.email || data.customer_email ? handleSendEmail(customer?.email || data.customer_email) : setShowManualInput('email')}
                        disabled={sending.email || sent.email}
                        className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 h-12"
                      >
                        {sending.email ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : sent.email ? (
                          <Check className="w-4 h-4 mr-2" />
                        ) : (
                          <Mail className="w-4 h-4 mr-2" />
                        )}
                        {sent.email ? "Enviado" : "Email"}
                      </Button>
                    )}

                    {showManualInput === 'whatsapp' ? (
                      <div className="col-span-2 flex gap-2">
                        <Input
                          type="tel"
                          value={manualPhone}
                          onChange={(e) => setManualPhone(e.target.value)}
                          placeholder="(787) 123-4567"
                          className="flex-1 bg-black/40 border-white/15 text-white"
                          autoFocus
                        />
                        <Button
                          onClick={() => handleSendWhatsApp()}
                          disabled={!manualPhone}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Enviar
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setShowManualInput(null);
                            setManualPhone("");
                          }}
                          className="text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => customer?.phone || data.customer_phone ? handleSendWhatsApp(customer?.phone || data.customer_phone) : setShowManualInput('whatsapp')}
                        disabled={sent.whatsapp}
                        className="bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 h-12"
                      >
                        {sent.whatsapp ? (
                          <Check className="w-4 h-4 mr-2" />
                        ) : (
                          <MessageCircle className="w-4 h-4 mr-2" />
                        )}
                        {sent.whatsapp ? "Enviado" : "WhatsApp"}
                      </Button>
                    )}
                  </div>

                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="w-full h-12 border-2 border-gray-500/30 text-gray-300 hover:bg-gray-700"
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          
          ${printerType === "thermal" ? `
            #thermal-receipt-root,
            #thermal-receipt-root * {
              visibility: visible !important;
            }
            
            #thermal-receipt-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
            }
            
            @page {
              size: 80mm auto;
              margin: 0;
            }
          ` : `
            #standard-receipt-root,
            #standard-receipt-root * {
              visibility: visible !important;
            }
            
            #standard-receipt-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }
            
            @page {
              size: letter;
              margin: 15mm;
            }
          `}
        }
      `}</style>
    </div>
  );
}

// Recibo estándar formato A4
function StandardReceipt({ type, data, customer, logo, businessInfo }) {
  const calculateTotal = () => {
    if (type === "sale") {
      return {
        subtotal: data.subtotal || 0,
        tax: data.tax_amount || 0,
        total: data.total || 0,
        discount: data.discount_amount || 0,
        discountedItems: []
      };
    } else {
      const items = data.order_items || [];
      let totalDiscount = 0;
      const discountedItems = [];
      
      // Calcular subtotal CON descuentos aplicados a cada item
      const subtotal = items.reduce((sum, item) => {
        const price = Number(item.price || 0);
        const qty = Number(item.qty || item.quantity || 1);
        const discount = Number(item.discount || 0);
        
        if (discount > 0) {
          totalDiscount += discount;
          discountedItems.push({ name: item.name, discount });
        }
        
        return sum + (price * qty - discount);
      }, 0);
      
      const labor = Number(data.labor_cost || 0);
      const laborDiscount = Number(data.labor_discount || 0);
      
      if (laborDiscount > 0) {
        totalDiscount += laborDiscount;
        discountedItems.push({ name: 'Mano de Obra', discount: laborDiscount });
      }
      
      const finalLabor = labor - laborDiscount;
      const total = subtotal + finalLabor;
      const tax = total * (data.tax_rate || 0.115);
      
      return {
        subtotal,
        labor: finalLabor,
        total: total + tax,
        tax,
        totalDiscount,
        discountedItems
      };
    }
  };

  const totals = calculateTotal();

  return (
    <div id="standard-receipt-root" style={{
      maxWidth: '210mm',
      margin: '0 auto',
      background: 'white',
      padding: '20mm',
      fontFamily: 'Arial, sans-serif',
      color: '#000'
    }}>
      {/* Header con logo y branding */}
      <div style={{ textAlign: 'center', marginBottom: '15mm', borderBottom: '3px solid #00A8E8', paddingBottom: '10mm' }}>
        {logo ? (
          <div>
            <img src={logo} alt="Logo" style={{ maxWidth: '150px', maxHeight: '60px', margin: '0 auto 10px auto', display: 'block' }} onError={(e) => { e.target.style.display = 'none'; }} />
            {businessInfo?.business_name && (
              <h2 style={{ fontSize: '16pt', fontWeight: 'bold', color: '#00A8E8', margin: '5mm 0 0 0' }}>
                {businessInfo.business_name}
              </h2>
            )}
          </div>
        ) : (
          <h1 style={{ fontSize: '32pt', fontWeight: 'bold', color: '#00A8E8', margin: 0 }}>
            {businessInfo?.business_name || '911 Smart Fix'}
          </h1>
        )}
        <p style={{ fontSize: '14pt', color: '#666', margin: '5mm 0 0 0' }}>
          {type === "sale" ? "RECIBO DE VENTA" : "ORDEN DE REPARACIÓN"}
        </p>
        <p style={{ fontSize: '11pt', color: '#999', margin: '3mm 0 0 0' }}>
          {new Date(data.created_date || new Date()).toLocaleString('es-PR')}
        </p>
      </div>

      {/* Número de documento */}
      <div style={{ 
        background: 'linear-gradient(135deg, #00A8E8 0%, #10B981 100%)', 
        padding: '8mm', 
        borderRadius: '8px', 
        marginBottom: '10mm',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '12pt', color: 'white', margin: '0 0 3mm 0', fontWeight: 'bold' }}>
          {type === "sale" ? "VENTA #" : "ORDEN #"}
        </p>
        <p style={{ fontSize: '24pt', fontWeight: 'bold', color: 'white', margin: 0, letterSpacing: '2px' }}>
          {type === "sale" ? data.sale_number : data.order_number || 'SIN #'}
        </p>
      </div>

      {/* Cliente */}
      {(customer || data.customer_name) && (
        <div style={{ marginBottom: '10mm', padding: '8mm', background: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0 0 3mm 0', color: '#00A8E8' }}>
            CLIENTE
          </h3>
          <p style={{ fontSize: '12pt', margin: '2mm 0', fontWeight: 'bold' }}>
            {customer?.name || data.customer_name}
          </p>
          <p style={{ fontSize: '11pt', margin: '1mm 0', color: '#666' }}>
            📱 {customer?.phone || data.customer_phone || 'N/A'}
          </p>
          {(customer?.email || data.customer_email) && (
            <p style={{ fontSize: '11pt', margin: '1mm 0', color: '#666' }}>
              ✉️ {customer?.email || data.customer_email}
            </p>
          )}
        </div>
      )}

      {/* Dispositivo (solo para órdenes) */}
      {type === "order" && (
        <div style={{ marginBottom: '10mm', padding: '8mm', background: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0 0 3mm 0', color: '#10B981' }}>
            EQUIPO
          </h3>
          <p style={{ fontSize: '12pt', margin: '2mm 0', fontWeight: 'bold' }}>
            {data.device_brand} {data.device_model}
          </p>
          {data.device_serial && (
            <p style={{ fontSize: '10pt', margin: '1mm 0', color: '#666' }}>
              S/N: {data.device_serial}
            </p>
          )}
          {data.initial_problem && (
            <div style={{ marginTop: '3mm' }}>
              <p style={{ fontSize: '10pt', fontWeight: 'bold', margin: '0 0 2mm 0' }}>
                Problema reportado:
              </p>
              <p style={{ fontSize: '10pt', color: '#666', whiteSpace: 'pre-wrap' }}>
                {data.initial_problem}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        marginBottom: '10mm',
        fontSize: '11pt'
      }}>
        <thead>
          <tr style={{ background: '#00A8E8', color: 'white' }}>
            <th style={{ padding: '3mm', textAlign: 'left', borderBottom: '2px solid #0891B2' }}>
              Artículo
            </th>
            <th style={{ padding: '3mm', textAlign: 'center', borderBottom: '2px solid #0891B2' }}>
              Cant.
            </th>
            <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '2px solid #0891B2' }}>
              Precio
            </th>
            <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '2px solid #0891B2' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {(type === "sale" ? data.items : data.order_items || []).map((item, idx) => {
            const qty = item.quantity || item.qty || 1;
            const price = item.price || 0;
            const discount = item.discount || 0;
            const subtotalItem = price * qty;
            const finalPrice = subtotalItem - discount;
            
            return (
              <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '3mm' }}>{item.name}</td>
                <td style={{ padding: '3mm', textAlign: 'center' }}>{qty}</td>
                <td style={{ padding: '3mm', textAlign: 'right' }}>
                  ${price.toFixed(2)}
                </td>
                <td style={{ padding: '3mm', textAlign: 'right', fontWeight: 'bold' }}>
                  {discount > 0 ? (
                    <span>
                      <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '10pt', marginRight: '3mm' }}>
                        ${subtotalItem.toFixed(2)}
                      </span>
                      <span style={{ color: '#10B981' }}>${finalPrice.toFixed(2)}</span>
                    </span>
                  ) : (
                    `$${finalPrice.toFixed(2)}`
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Tabla de descuentos aplicados */}
      {type === "order" && totals.discountedItems && totals.discountedItems.length > 0 && (
        <div style={{ marginBottom: '8mm', padding: '5mm', background: '#f0fdf4', border: '2px solid #10B981', borderRadius: '6px' }}>
          <h4 style={{ fontSize: '11pt', fontWeight: 'bold', margin: '0 0 3mm 0', color: '#10B981' }}>
            💰 DESCUENTOS APLICADOS
          </h4>
          {totals.discountedItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '10pt' }}>
              <span>• {item.name}</span>
              <span style={{ color: '#10B981', fontWeight: 'bold' }}>-${item.discount.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #10B981', marginTop: '3mm', paddingTop: '3mm', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>Total Descuentos:</span>
            <span style={{ color: '#10B981' }}>-${totals.totalDiscount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Totales */}
      <div style={{ marginLeft: 'auto', width: '60%', marginBottom: '10mm' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '12pt' }}>
          <span>Subtotal:</span>
          <span>${totals.subtotal.toFixed(2)}</span>
        </div>
        {totals.labor > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '12pt' }}>
            <span>Mano de Obra:</span>
            <span>${totals.labor.toFixed(2)}</span>
          </div>
        )}
        {type === "sale" && totals.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '12pt', color: '#059669' }}>
            <span>Descuento:</span>
            <span>-${totals.discount.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '12pt' }}>
          <span>IVU (11.5%):</span>
          <span>${totals.tax.toFixed(2)}</span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          padding: '4mm 0', 
          borderTop: '3px solid #00A8E8',
          fontSize: '16pt',
          fontWeight: 'bold'
        }}>
          <span>TOTAL:</span>
          <span style={{ color: '#00A8E8' }}>${totals.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Info de pago */}
      {type === "sale" && (
        <div style={{ 
          background: '#10B981', 
          color: 'white', 
          padding: '6mm', 
          borderRadius: '6px',
          marginBottom: '10mm'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12pt', fontWeight: 'bold' }}>
            <span>Método de Pago:</span>
            <span>
              {data.payment_method === 'cash' ? '💵 Efectivo' :
               data.payment_method === 'card' ? '💳 Tarjeta' :
               data.payment_method === 'ath_movil' ? '📱 ATH Móvil' :
               data.payment_method}
            </span>
          </div>
          {data.payment_details?.change_given > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', marginTop: '2mm' }}>
              <span>Cambio:</span>
              <span>${data.payment_details.change_given.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Estado de orden */}
      {type === "order" && (
        <div style={{ marginBottom: '10mm', padding: '6mm', background: '#f8f9fa', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', marginBottom: '2mm' }}>
            <span>Pagado:</span>
            <span style={{ fontWeight: 'bold', color: '#10B981' }}>
              ${(data.amount_paid || 0).toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12pt', fontWeight: 'bold' }}>
            <span>Balance:</span>
            <span style={{ color: '#EF4444' }}>
              ${(data.balance_due || 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        borderTop: '2px dashed #ccc', 
        paddingTop: '8mm', 
        marginTop: '10mm',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '14pt', fontWeight: 'bold', color: '#00A8E8', margin: '0 0 3mm 0' }}>
          ¡Gracias por su preferencia!
        </p>
        <p style={{ fontSize: '10pt', color: '#666', margin: '2mm 0' }}>
          {type === "sale" ? `Atendido por: ${data.employee || 'Sistema'}` : `Creado por: ${data.created_by_name || ''}`}
        </p>
        <p style={{ fontSize: '9pt', color: '#999', marginTop: '5mm' }}>
          SmartFixOS - Sistema de Gestión Inteligente
        </p>
      </div>
    </div>
  );
}
