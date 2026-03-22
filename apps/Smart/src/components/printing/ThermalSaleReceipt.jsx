import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { base44 } from "@/api/base44Client";

export default function ThermalSaleReceipt({ sale, customer, onClose, autoPrint = false }) {
  const [terms, setTerms] = useState("");
  const [logo, setLogo] = useState("");

  useEffect(() => {
    loadTerms();
    loadLogo();
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
      // 1. Leer desde pos-receipt-config (editor POS & Recibo en Settings)
      const posConfig = (() => {
        try { return JSON.parse(localStorage.getItem("pos_receipt_config") || "{}"); } catch { return {}; }
      })();

      let termsText = "";
      if (posConfig.warranty_text)   termsText += posConfig.warranty_text;
      if (posConfig.conditions_text) termsText += (termsText ? "\n\n" : "") + posConfig.conditions_text;

      if (termsText.trim()) { setTerms(termsText.trim()); return; }

      // 2. Fallback: business-branding
      const brandingConfigs = await base44.entities.AppSettings.filter({ slug: "business-branding" });
      if (brandingConfigs?.length > 0) {
        const branding = brandingConfigs[0].payload || {};
        let bt = branding.terms_sales || "";
        if (branding.warranty_sales) {
          const wi = typeof branding.warranty_sales === 'object' ? branding.warranty_sales : { text: branding.warranty_sales };
          if (wi.text) { bt += `\n\n🛡️ GARANTÍA\n${wi.text}`; }
        }
        if (bt.trim()) { setTerms(bt.trim()); return; }
      }

      // 3. Fallback genérico
      setTerms("• No se aceptan devoluciones en productos electrónicos.\n• Garantía de 30 días en reparaciones.\n• El taller no se hace responsable por pérdida de datos.");
    } catch {
      setTerms("");
    }
  };

  const loadLogo = async () => {
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "business-branding" });
      if (configs?.length > 0 && configs[0].payload?.logo_url) {
        setLogo(configs[0].payload.logo_url);
      }
    } catch (error) {
      console.log("No logo configured");
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
          {logo && (
            <img src={logo} alt="Logo" style={{ maxWidth: '50mm', maxHeight: '15mm', margin: '0 auto 2mm auto', display: 'block' }} onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          <div style={{ fontSize: '9pt', marginTop: '1mm' }}>RECIBO DE VENTA</div>
          <div style={{ fontSize: '8pt', marginTop: '1mm' }}>
            {format(new Date(sale.created_date || new Date()), "d 'de' MMMM 'del' yyyy", { locale: es })}
          </div>
        </div>

        <div style={{ borderTop: '2px dashed #000', paddingTop: '3mm', marginBottom: '3mm' }} />

        {/* VENTA # */}
        <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
          <div style={{ fontSize: '7pt', color: '#555' }}>Recibo No.</div>
          <div style={{ fontSize: '11pt', fontWeight: 'bold', letterSpacing: '0.5px' }}>
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

        {(() => {
          const pc = (() => { try { return JSON.parse(localStorage.getItem("pos_receipt_config") || "{}"); } catch { return {}; } })();
          return (
            <div style={{ borderTop: '2px dashed #000', paddingTop: '3mm', marginTop: '3mm' }}>
              <div style={{ fontSize: '8pt', textAlign: 'center' }}>
                {pc.footer_text || '¡Gracias por su compra!'}
              </div>
              {pc.review_link && (
                <div style={{ fontSize: '7pt', textAlign: 'center', marginTop: '2mm' }}>⭐ {pc.review_link}</div>
              )}
              <div style={{ fontSize: '7pt', textAlign: 'center', marginTop: '2mm', color: '#555' }}>
                Atendido por: {sale.employee || '911 Smart Fix'}
              </div>
            </div>
          );
        })()}

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
