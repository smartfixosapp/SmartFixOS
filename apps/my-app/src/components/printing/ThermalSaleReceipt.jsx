import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { base44 } from "@/api/base44Client";

export default function ThermalSaleReceipt({ sale, customer, onClose, autoPrint = false }) {
  const [terms, setTerms] = useState("");

  useEffect(() => {
    loadTerms();
  }, []);

  useEffect(() => {
    if (autoPrint && terms) {
      setTimeout(() => {
        window.print();
        onClose?.();
      }, 800);
    }
  }, [autoPrint, onClose, terms]);

  const loadTerms = async () => {
    try {
      const configs = await base44.entities.SystemConfig.filter({ key: "receipt_terms" });
      if (configs?.length > 0) {
        const value = configs[0].value || configs[0].value_json || "";
        setTerms(typeof value === 'string' ? value : value.text || "");
      } else {
        setTerms(`
• No se aceptan devoluciones en productos electrónicos.
• Garantía de 30 días en reparaciones.
• El taller no se hace responsable por pérdida de datos.
• Equipos no reclamados en 90 días pasan a propiedad del taller.
• Al firmar acepta términos y condiciones.
        `.trim());
      }
    } catch (error) {
      console.error("Error loading terms:", error);
      setTerms("Términos disponibles en SmartFixOS");
    }
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          
          body * {
            visibility: hidden !important;
          }
          
          #thermal-receipt-root,
          #thermal-receipt-root * {
            visibility: visible !important;
          }
          
          #thermal-receipt-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
        
        @media screen {
          #thermal-receipt-root {
            max-width: 80mm;
            margin: 20px auto;
            background: white;
            padding: 10mm;
            font-family: 'Courier New', monospace;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
        }
      `}</style>

      <div id="thermal-receipt-root" style={{
        fontFamily: "'Courier New', monospace",
        fontSize: '10pt',
        lineHeight: '1.3',
        color: '#000',
        padding: '4mm'
      }}>
        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
          <div style={{ fontSize: '16pt', fontWeight: 'bold' }}>SmartFixOS</div>
          <div style={{ fontSize: '9pt', marginTop: '1mm' }}>RECIBO DE VENTA</div>
          <div style={{ fontSize: '8pt', marginTop: '1mm' }}>
            {format(new Date(sale.created_date || new Date()), "dd/MM/yyyy HH:mm", { locale: es })}
          </div>
        </div>

        <div style={{ borderTop: '2px dashed #000', paddingTop: '3mm', marginBottom: '3mm' }} />

        {/* VENTA # */}
        <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt' }}>VENTA:</div>
          <div style={{ fontSize: '16pt', fontWeight: 'bold', letterSpacing: '1px' }}>
            {sale.sale_number || 'SIN #'}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #000', paddingTop: '3mm', marginBottom: '3mm' }} />

        {/* CLIENTE */}
        {customer && (
          <div style={{ marginBottom: '3mm' }}>
            <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>CLIENTE:</div>
            <div>{customer.name || 'N/A'}</div>
            <div style={{ fontSize: '9pt' }}>{customer.phone || ''}</div>
          </div>
        )}

        {/* ITEMS */}
        <div style={{ marginBottom: '3mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold', marginBottom: '2mm' }}>ARTÍCULOS:</div>
          {(sale.items || []).map((item, idx) => (
            <div key={idx} style={{ marginBottom: '2mm' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
                <span>{item.name}</span>
                <span>${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '8pt', color: '#666' }}>
                {item.quantity || 1} x ${(item.price || 0).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #000', paddingTop: '3mm', marginBottom: '3mm' }} />

        {/* TOTALES */}
        <div style={{ fontSize: '9pt' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
            <span>Subtotal:</span>
            <span>${(sale.subtotal || 0).toFixed(2)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', color: '#059669' }}>
              <span>Descuento:</span>
              <span>-${sale.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
            <span>IVU (11.5%):</span>
            <span>${(sale.tax_amount || 0).toFixed(2)}</span>
          </div>
          <div style={{ borderTop: '2px solid #000', paddingTop: '2mm', marginTop: '2mm' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12pt', fontWeight: 'bold' }}>
              <span>TOTAL:</span>
              <span>${(sale.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* PAGO */}
        <div style={{ marginTop: '3mm', marginBottom: '3mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
            <span>Método:</span>
            <span style={{ fontWeight: 'bold' }}>
              {sale.payment_method === 'cash' ? '💵 Efectivo' :
               sale.payment_method === 'card' ? '💳 Tarjeta' :
               sale.payment_method === 'ath_movil' ? '📱 ATH Móvil' :
               sale.payment_method}
            </span>
          </div>
          {sale.payment_details?.change_given > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginTop: '1mm' }}>
              <span>Cambio:</span>
              <span>${sale.payment_details.change_given.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '2px dashed #000', paddingTop: '3mm', marginTop: '3mm' }}>
          <div style={{ fontSize: '8pt', textAlign: 'center' }}>
            ¡Gracias por su compra!
          </div>
          <div style={{ fontSize: '7pt', textAlign: 'center', marginTop: '2mm' }}>
            Vendedor: {sale.employee || 'Sistema'}
          </div>
        </div>

        {/* ✅ TÉRMINOS Y CONDICIONES */}
        {terms && (
          <div style={{ borderTop: '1px solid #000', paddingTop: '3mm', marginTop: '3mm' }}>
            <div style={{ fontSize: '8pt', fontWeight: 'bold', textAlign: 'center', marginBottom: '2mm' }}>
              TÉRMINOS Y CONDICIONES
            </div>
            <div style={{ fontSize: '7pt', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
              {terms}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
