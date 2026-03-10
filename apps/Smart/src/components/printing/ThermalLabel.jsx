import React, { useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function ThermalLabel({ order, onClose, autoPrint = false }) {
  useEffect(() => {
    if (autoPrint) {
      setTimeout(() => {
        window.print();
        onClose?.();
      }, 500);
    }
  }, [autoPrint, onClose]);

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
        fontSize: '11pt',
        lineHeight: '1.3',
        color: '#000',
        padding: '4mm'
      }}>
        {/* LOGO Y HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '4mm', borderBottom: '2px dashed #000', paddingBottom: '3mm' }}>
          <div style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '2mm' }}>
            SmartFixOS
          </div>
          <div style={{ fontSize: '9pt' }}>ETIQUETA DE EQUIPO</div>
        </div>

        {/* ORDEN */}
        <div style={{ marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>ORDEN:</div>
          <div style={{ fontSize: '14pt', fontWeight: 'bold', letterSpacing: '1px' }}>
            {order.order_number || 'SIN NÚMERO'}
          </div>
        </div>

        {/* CLIENTE */}
        <div style={{ marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>CLIENTE:</div>
          <div style={{ fontSize: '11pt' }}>{order.customer_name || 'N/A'}</div>
          <div style={{ fontSize: '10pt' }}>{order.customer_phone || ''}</div>
        </div>

        {/* DISPOSITIVO */}
        <div style={{ marginBottom: '3mm', borderTop: '1px solid #000', paddingTop: '2mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>DISPOSITIVO:</div>
          <div style={{ fontSize: '11pt' }}>
            {order.device_brand || ''} {order.device_model || ''}
          </div>
          {order.device_serial && (
            <div style={{ fontSize: '9pt' }}>S/N: {order.device_serial}</div>
          )}
        </div>

        {/* PROBLEMA */}
        <div style={{ marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>PROBLEMA:</div>
          <div style={{ fontSize: '10pt', whiteSpace: 'pre-wrap' }}>
            {order.initial_problem || 'No especificado'}
          </div>
        </div>

        {/* FECHA */}
        <div style={{ borderTop: '2px dashed #000', paddingTop: '3mm', marginTop: '3mm', textAlign: 'center' }}>
          <div style={{ fontSize: '9pt' }}>
            {format(new Date(order.created_date || new Date()), "dd/MMM/yyyy • HH:mm", { locale: es })}
          </div>
        </div>
      </div>
    </div>
  );
}
