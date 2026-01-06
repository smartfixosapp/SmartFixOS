// AI NOTE: Generación de PDF para facturas agrupadas usando jsPDF

import { jsPDF } from 'jspdf';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export async function generateInvoicePDF(invoice, orders, businessInfo = {}) {
  const doc = new jsPDF();
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // ===== HEADER =====
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 168, 232);
  doc.text(businessInfo.name || 'SmartFixOS', margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  if (businessInfo.address) doc.text(businessInfo.address, margin, y);
  y += 5;
  if (businessInfo.phone) doc.text(`Tel: ${businessInfo.phone}`, margin, y);
  y += 5;
  if (businessInfo.email) doc.text(`Email: ${businessInfo.email}`, margin, y);
  y += 15;

  // ===== TÍTULO =====
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('FACTURA', margin, y);
  y += 10;

  // ===== INFO FACTURA =====
  doc.setFontSize(11);
  doc.text(`Factura #${invoice.invoice_number || invoice.id}`, margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${new Date(invoice.created_date).toLocaleDateString()}`, pageWidth - margin - 60, y);
  y += 7;

  if (invoice.due_date) {
    doc.text(`Vencimiento: ${new Date(invoice.due_date).toLocaleDateString()}`, pageWidth - margin - 60, y);
    y += 7;
  }
  y += 8;

  // ===== LÍNEA =====
  doc.setDrawColor(0, 168, 232);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ===== INFO EMPRESA =====
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURAR A:', margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.company_name, margin, y);
  y += 6;
  if (invoice.company_tax_id) {
    doc.text(`RUT/ID Fiscal: ${invoice.company_tax_id}`, margin, y);
    y += 6;
  }
  if (invoice.billing_address) {
    const addressLines = doc.splitTextToSize(invoice.billing_address, 80);
    doc.text(addressLines, margin, y);
    y += (addressLines.length * 6);
  }
  y += 10;

  // ===== TABLA DE ÓRDENES =====
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ÓRDENES INCLUIDAS', margin, y);
  y += 10;

  // Headers
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(0, 168, 232);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y - 5, pageWidth - (margin * 2), 8, 'F');
  doc.text('Orden', margin + 2, y);
  doc.text('Equipo', margin + 30, y);
  doc.text('Servicio', margin + 90, y);
  doc.text('Monto', pageWidth - margin - 25, y, { align: 'right' });
  y += 8;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  orders.forEach((order, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 5, pageWidth - (margin * 2), 7, 'F');
    }

    doc.text(order.order_number || order.id.slice(0, 8), margin + 2, y);
    
    const deviceText = `${order.device_brand || ''} ${order.device_model || ''}`.trim() || 'N/A';
    doc.text(deviceText.substring(0, 25), margin + 30, y);
    
    const serviceText = order.initial_problem?.substring(0, 30) || 'Reparación';
    doc.text(serviceText, margin + 90, y);
    
    doc.text(money(order.cost_estimate || order.total || 0), pageWidth - margin - 25, y, { align: 'right' });
    y += 7;
  });

  y += 10;

  // ===== TOTALES =====
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', pageWidth - margin - 60, y);
  doc.text(money(invoice.subtotal), pageWidth - margin - 5, y, { align: 'right' });
  y += 7;

  const taxRate = invoice.tax_rate || 0.115;
  doc.text(`IVU (${(taxRate * 100).toFixed(1)}%):`, pageWidth - margin - 60, y);
  doc.text(money(invoice.tax_amount), pageWidth - margin - 5, y, { align: 'right' });
  y += 7;

  doc.setDrawColor(0, 168, 232);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', pageWidth - margin - 60, y);
  doc.text(money(invoice.total), pageWidth - margin - 5, y, { align: 'right' });

  // ===== NOTAS =====
  if (invoice.notes) {
    y += 15;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - (margin * 2));
    doc.text(notesLines, margin, y);
  }

  // ===== FOOTER =====
  const finalY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text('Gracias por su preferencia', pageWidth / 2, finalY, { align: 'center' });

  return doc;
}

export async function downloadInvoicePDF(invoice, orders, businessInfo) {
  const doc = await generateInvoicePDF(invoice, orders, businessInfo);
  doc.save(`Factura_${invoice.invoice_number || invoice.id}.pdf`);
}
