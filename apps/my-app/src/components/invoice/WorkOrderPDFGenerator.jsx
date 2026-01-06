// AI NOTE: Generación de PDF para órdenes individuales usando jsPDF
// Requiere: npm install jspdf

import { jsPDF } from 'jspdf';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export async function generateWorkOrderPDF(order, businessInfo = {}) {
  const doc = new jsPDF();
  let y = 25;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // ===== HEADER ESTILO NOTIFICACIÓN =====
  // Fondo degradado
  doc.setFillColor(0, 168, 232);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(businessInfo.name || 'SmartFixOS', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  if (businessInfo.address) doc.text(businessInfo.address, margin, y);
  y += 5;
  if (businessInfo.phone) doc.text(`Tel: ${businessInfo.phone}`, margin, y);
  y += 5;
  if (businessInfo.email) doc.text(`Email: ${businessInfo.email}`, margin, y);
  y += 20;

  // ===== TÍTULO =====
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 168, 232);
  doc.text('RECIBO DE TRABAJO', margin, y);
  y += 12;

  // ===== INFO DE ORDEN EN CAJA =====
  doc.setFillColor(240, 253, 250);
  doc.roundedRect(margin, y, contentWidth, 20, 3, 3, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Orden #${order.order_number || order.id}`, margin + 5, y + 7);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const statusText = {
    intake: 'Recepción',
    diagnosing: 'Diagnóstico',
    awaiting_approval: 'Esperando Aprobación',
    waiting_parts: 'Esperando Piezas',
    in_progress: 'En Progreso',
    ready_for_pickup: 'Listo para Recoger',
    picked_up: 'Recogido',
    completed: 'Completado'
  }[order.status] || order.status;
  
  doc.text(`Estado: ${statusText}`, margin + 5, y + 14);

  if (order.created_date) {
    doc.text(`Fecha: ${new Date(order.created_date).toLocaleDateString()}`, pageWidth - margin - 55, y + 14);
  }
  y += 30;

  // ===== INFORMACIÓN DEL CLIENTE =====
  doc.setFillColor(0, 168, 232);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CLIENTE', margin + 3, y + 6);
  y += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Nombre: ${order.customer_name || 'N/A'}`, margin + 3, y);
  y += 6;
  if (order.customer_phone) {
    doc.text(`Teléfono: ${order.customer_phone}`, margin + 3, y);
    y += 6;
  }
  if (order.customer_email) {
    doc.text(`Email: ${order.customer_email}`, margin + 3, y);
    y += 6;
  }
  y += 12;

  // ===== INFORMACIÓN DEL EQUIPO =====
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('EQUIPO', margin + 3, y + 6);
  y += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  if (order.device_brand || order.device_type) {
    doc.text(`Tipo: ${order.device_brand || ''} ${order.device_type || ''}`, margin + 3, y);
    y += 6;
  }
  if (order.device_model) {
    doc.text(`Modelo: ${order.device_model}`, margin + 3, y);
    y += 6;
  }
  if (order.device_serial) {
    doc.text(`Serial/IMEI: ${order.device_serial}`, margin + 3, y);
    y += 6;
  }
  if (order.device_color) {
    doc.text(`Color: ${order.device_color}`, margin + 3, y);
    y += 6;
  }
  y += 12;

  // ===== PROBLEMA REPORTADO =====
  if (order.initial_problem) {
    doc.setFillColor(234, 179, 8);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PROBLEMA REPORTADO', margin + 3, y + 6);
    y += 12;

    doc.setFillColor(254, 252, 232);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const problemLines = doc.splitTextToSize(order.initial_problem, contentWidth - 6);
    const problemHeight = (problemLines.length * 6) + 6;
    doc.roundedRect(margin, y, contentWidth, problemHeight, 3, 3, 'F');
    doc.text(problemLines, margin + 3, y + 5);
    y += problemHeight + 12;
  }

  // ===== TRABAJO REALIZADO =====
  if (order.repair_tasks && order.repair_tasks.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TRABAJO REALIZADO', margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    order.repair_tasks.forEach((task, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${idx + 1}. ${task.description || 'Tarea sin descripción'}`, margin + 5, y);
      y += 6;
    });
    y += 10;
  }

  // ===== COSTOS =====
  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(139, 92, 246);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('COSTOS', margin + 3, y + 6);
  y += 14;

  // Tabla de costos
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  // Piezas y servicios
  if (order.parts_needed && order.parts_needed.length > 0) {
    order.parts_needed.forEach((part) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const itemName = `${part.name} x${part.quantity || 1}`;
      const itemPrice = money(part.price * (part.quantity || 1));
      doc.text(itemName, margin + 3, y);
      doc.text(itemPrice, pageWidth - margin - 3, y, { align: 'right' });
      y += 6;
    });
  }

  // Mano de obra
  if (order.labor_cost > 0) {
    doc.text('Mano de Obra', margin, y);
    doc.text(money(order.labor_cost), pageWidth - margin - 30, y, { align: 'right' });
    y += 6;
  }

  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // ✅ CALCULAR SUBTOTAL DESDE order_items
  const orderItems = order.order_items || order.parts_needed || [];
  const subtotal = orderItems.reduce((sum, item) => {
    const price = Number(item.price || 0);
    const qty = Number(item.qty || item.quantity || 1);
    return sum + (price * qty);
  }, 0) + (order.labor_cost || 0);
  
  doc.setTextColor(0, 0, 0);
  doc.text('Subtotal:', margin + 3, y);
  doc.text(money(subtotal), pageWidth - margin - 3, y, { align: 'right' });
  y += 6;

  // IVU
  const taxRate = order.tax_rate || 0.115;
  const taxAmount = subtotal * taxRate;
  doc.text(`IVU (${(taxRate * 100).toFixed(1)}%):`, margin + 3, y);
  doc.text(money(taxAmount), pageWidth - margin - 3, y, { align: 'right' });
  y += 6;

  // Total
  const total = order.total || order.cost_estimate || (subtotal + taxAmount);
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(margin, y - 3, contentWidth, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL:', margin + 3, y + 3);
  doc.text(money(total), pageWidth - margin - 3, y + 3, { align: 'right' });
  y += 12;
  doc.setTextColor(0, 0, 0);

  // Pagado
  if (order.amount_paid > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Pagado:', margin, y);
    doc.text(money(order.amount_paid), pageWidth - margin - 30, y, { align: 'right' });
    y += 6;
  }

  // Balance
  const balance = total - (order.amount_paid || 0);
  if (balance > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red
    doc.text('Balance Pendiente:', margin, y);
    doc.text(money(balance), pageWidth - margin - 30, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  } else {
    doc.setTextColor(16, 185, 129); // Green
    doc.text('PAGADO COMPLETAMENTE', margin, y);
    doc.setTextColor(0, 0, 0);
  }

  // ===== FOOTER =====
  const finalY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text('Gracias por su preferencia', pageWidth / 2, finalY, { align: 'center' });

  return doc;
}

export async function downloadWorkOrderPDF(order, businessInfo) {
  const doc = await generateWorkOrderPDF(order, businessInfo);
  doc.save(`Orden_${order.order_number || order.id}.pdf`);
}
