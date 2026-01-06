import React, { useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function ThermalOrderReceipt({ order, onClose, autoPrint = false }) {
  useEffect(() => {
    if (autoPrint) {
      setTimeout(() => {
        window.print();
        onClose?.();
      }, 500);
    }
  }, [autoPrint, onClose]);

  const calculateTotal = () => {
    const items = order.order_items || [];
    const subtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0);
    const labor = order.labor_cost || 0;
    const total = subtotal + labor;
    const tax = total * (order.tax_rate || 0.115);
    return {
      subtotal,
      labor,
      total: total + tax,
      tax
    };
  };

  const totals = calculateTotal();

  return (
    <div className="print-only">
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 2mm;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
        @media screen {
          .print-only {
            max-width: 80mm;
            margin: 0 auto;
            background: white;
            padding: 8mm;
            font-family: 'Courier New', monospace;
          }
        }
      `}</style>

      <div style={{
        fontFamily: "'Courier New', monospace",
        fontSize: '10pt',
        lineHeight: '1.3',
        color: '#000',
        padding: '4mm'
      }}>
        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
          <div style={{ fontSize: '16pt', fontWeight: 'bold' }}>SmartFixOS</div>
          <div style={{ fontSize: '9pt', marginTop: '1mm' }}>ORDEN DE REPARACIÓN</div>
          <div style={{ fontSize: '8pt', marginTop: '1mm' }}>
            {format(new Date(order.created_date || new Date()), "dd/MM/yyyy HH:mm", { locale: es })}
          </div>
        </div>

        <div style={{ borderTop: '2px dashed #000', paddingTop: '3mm', marginBottom: '3mm' }} />

        {/* ORDEN # */}
        <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt' }}>ORDEN:</div>
          <div style={{ fontSize: '16pt', fontWeight: 'bold', letterSpacing: '1px' }}>
            {order.order_number || 'SIN #'}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #000', paddingTop: '3mm', marginBottom: '3mm' }} />

        {/* CLIENTE */}
        <div style={{ marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>CLIENTE:</div>
          <div>{order.customer_name || 'N/A'}</div>
          <div style={{ fontSize: '9pt' }}>{order.customer_phone || ''}</div>
        </div>

        {/* DISPOSITIVO */}
        <div style={{ marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>EQUIPO:</div>
          <div>{order.device_brand || ''} {order.device_model || ''}</div>
          {order.device_serial && (
            <div style={{ fontSize: '9pt' }}>S/N: {order.device_serial}</div>
          )}
        </div>

        {/* PROBLEMA */}
        <div style={{ marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>PROBLEMA:</div>
          <div style={{ fontSize: '9pt', whiteSpace: 'pre-wrap' }}>
            {order.initial_problem || 'No especificado'}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #000', paddingTop: '3mm', marginBottom: '3mm' }} />

        {/* ITEMS */}
        {order.order_items && order.order_items.length > 0 && (
          <div style={{ marginBottom: '3mm' }}>
            <div style={{ fontSize: '9pt', fontWeight: 'bold', marginBottom: '2mm' }}>ITEMS:</div>
            {order.order_items.map((item, idx) => (
              <div key={idx} style={{ fontSize: '9pt', marginBottom: '1mm', display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.name} x{item.qty || item.quantity || 1}</span>
                <span>${((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* TOTALES */}
        <div style={{ borderTop: '2px solid #000', paddingTop: '3mm', marginBottom: '3mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: '1mm' }}>
            <span>Subtotal:</span>
            <span>${totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.labor > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: '1mm' }}>
              <span>Mano de Obra:</span>
              <span>${totals.labor.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: '1mm' }}>
            <span>IVU (11.5%):</span>
            <span>${totals.tax.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12pt', fontWeight: 'bold', marginTop: '2mm' }}>
            <span>TOTAL:</span>
            <span>${totals.total.toFixed(2)}</span>
          </div>
        </div>

        {/* ESTADO DE PAGO */}
        <div style={{ marginBottom: '3mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
            <span>Pagado:</span>
            <span>${(order.amount_paid || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', fontWeight: 'bold' }}>
            <span>Balance:</span>
            <span>${(order.balance_due || 0).toFixed(2)}</span>
          </div>
        </div>

        <div style={{ borderTop: '2px dashed #000', paddingTop: '3mm', marginTop: '3mm' }}>
          <div style={{ fontSize: '8pt', textAlign: 'center' }}>
            ¡Gracias por confiar en nosotros!
          </div>
          <div style={{ fontSize: '7pt', textAlign: 'center', marginTop: '2mm' }}>
            {order.created_by_name || ''}
          </div>
        </div>
      </div>
    </div>
  );
}
