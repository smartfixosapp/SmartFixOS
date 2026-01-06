import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { History, Search, Mail, MessageCircle, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { openWhatsApp } from "@/components/utils/helpers";

export default function SalesHistoryDialog({ open, onClose }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sendingEmail, setSendingEmail] = useState(null);
  const [showManualEmailInput, setShowManualEmailInput] = useState(null);
  const [showManualPhoneInput, setShowManualPhoneInput] = useState(null);
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  useEffect(() => {
    if (open) {
      loadSales();
    }
  }, [open]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const allSales = await base44.entities.Sale.list("-created_date", 100);
      setSales(allSales || []);
    } catch (error) {
      console.error("Error loading sales:", error);
      toast.error("Error cargando historial");
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(sale => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      sale.sale_number?.toLowerCase().includes(searchLower) ||
      sale.customer_name?.toLowerCase().includes(searchLower) ||
      sale.employee?.toLowerCase().includes(searchLower)
    );
  });

  const getCustomerFromSale = async (sale) => {
    if (!sale.customer_id) return null;
    try {
      const customer = await base44.entities.Customer.get(sale.customer_id);
      return customer;
    } catch (error) {
      console.error("Error loading customer:", error);
      return null;
    }
  };

  const handleSendEmail = async (sale, emailOverride = null) => {
    const customer = await getCustomerFromSale(sale);
    const email = emailOverride || customer?.email;

    if (!email) {
      setShowManualEmailInput(sale.id);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Formato de email inválido");
      return;
    }

    setSendingEmail(sale.id);
    try {
      const itemsList = (sale.items || []).map((item, idx) => 
        `<tr style="background: ${idx % 2 === 0 ? '#F9FAFB' : 'white'};">
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; color: #1F2937; font-weight: 600;">${item.name}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: center; color: #374151;">${item.quantity}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: right; color: #6B7280;">$${item.price.toFixed(2)}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold; color: #059669;">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
      ).join('');

      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background: #F3F4F6;">
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            
            <div style="background: linear-gradient(135deg, #00A8E8 0%, #10B981 50%, #A8D700 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                🧾 Recibo de Venta
              </h1>
            </div>
            
            <div style="padding: 40px 30px; background: white;">
              <div style="background: #F9FAFB; border-left: 4px solid #00A8E8; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px;">
                  <div>
                    <p style="margin: 0; color: #6B7280; font-size: 12px;">RECIBO</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 20px; font-weight: bold;">${sale.sale_number}</p>
                  </div>
                  <div>
                    <p style="margin: 0; color: #6B7280; font-size: 12px;">FECHA</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 600;">${format(new Date(sale.created_date), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                ${customer ? `
                <div style="border-top: 1px solid #E5E7EB; padding-top: 15px;">
                  <p style="margin: 0; color: #6B7280; font-size: 12px;">CLIENTE</p>
                  <p style="margin: 4px 0 0 0; color: #111827; font-size: 18px; font-weight: bold;">${customer.name}</p>
                </div>
                ` : ''}
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                  <tr style="background: #374151;">
                    <th style="padding: 12px; text-align: left; color: white;">Descripción</th>
                    <th style="padding: 12px; text-align: center; color: white;">Cant.</th>
                    <th style="padding: 12px; text-align: right; color: white;">Precio</th>
                    <th style="padding: 12px; text-align: right; color: white;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
              </table>

              <div style="background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #374151;">Subtotal</span>
                  <span style="color: #1F2937; font-weight: bold;">$${(sale.subtotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #374151;">IVU (11.5%)</span>
                  <span style="color: #1F2937; font-weight: bold;">$${(sale.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div style="border-top: 2px solid #10B981; padding-top: 12px; margin-top: 12px; display: flex; justify-content: space-between;">
                  <span style="color: #059669; font-size: 20px; font-weight: 900;">TOTAL</span>
                  <span style="color: #059669; font-size: 32px; font-weight: 900;">$${(sale.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style="background: #F9FAFB; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #6B7280; font-size: 11px;">
                SmartFixOS • Gracias por su compra
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await base44.integrations.Core.SendEmail({
        from_name: "SmartFixOS",
        to: email,
        subject: `🧾 Recibo #${sale.sale_number} - SmartFixOS`,
        body: emailBody
      });

      toast.success("✅ Recibo enviado por email");
      setShowManualEmailInput(null);
      setManualEmail("");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Error al enviar email");
    } finally {
      setSendingEmail(null);
    }
  };

  const handleSendWhatsApp = async (sale, phoneOverride = null) => {
    const customer = await getCustomerFromSale(sale);
    const phone = phoneOverride || customer?.phone;

    if (!phone) {
      setShowManualPhoneInput(sale.id);
      return;
    }

    const itemsList = (sale.items || []).map(item => 
      `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    const message = `
🧾 *RECIBO DE VENTA*
━━━━━━━━━━━━━━━━━━━━

📋 *Recibo:* ${sale.sale_number}
👤 *Cliente:* ${customer?.name || 'Cliente'}
📅 *Fecha:* ${format(new Date(sale.created_date), 'dd/MM/yyyy HH:mm')}

*ITEMS:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* $${(sale.subtotal || 0).toFixed(2)}
📊 *IVU (11.5%):* $${(sale.tax_amount || 0).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
✅ *TOTAL:* $${(sale.total || 0).toFixed(2)}

💳 *Método:* ${
  sale.payment_method === "cash" ? "Efectivo" : 
  sale.payment_method === "card" ? "Tarjeta" : 
  sale.payment_method === "ath_movil" ? "ATH Móvil" : 
  sale.payment_method
}

━━━━━━━━━━━━━━━━━━━━
🔧 SmartFixOS
Gracias por su compra
    `.trim();

    openWhatsApp(phone, message);
    setShowManualPhoneInput(null);
    setManualPhone("");
    toast.success("✅ Abriendo WhatsApp");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gradient-to-br from-[#0f0f0f] to-black border-cyan-500/30 overflow-hidden flex flex-col theme-light:from-white theme-light:to-gray-50 theme-light:border-gray-300">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2 theme-light:text-gray-900">
            <History className="w-6 h-6 text-cyan-500" />
            Historial de Ventas
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por # venta, cliente o vendedor..."
              className="pl-10 bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-gray-400 theme-light:text-gray-600">
              {search ? "No se encontraron ventas" : "No hay ventas registradas"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className="bg-black/30 border border-white/10 rounded-lg p-4 hover:bg-black/50 transition-all theme-light:bg-white theme-light:border-gray-200 theme-light:hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-bold text-lg theme-light:text-gray-900">
                          {sale.sale_number}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          sale.voided 
                            ? 'bg-red-600/20 text-red-300 border border-red-600/30 theme-light:bg-red-100 theme-light:text-red-700 theme-light:border-red-300'
                            : 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300'
                        }`}>
                          {sale.voided ? 'ANULADA' : 'VÁLIDA'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-gray-400 theme-light:text-gray-600">Cliente: </span>
                          <span className="text-white theme-light:text-gray-900">{sale.customer_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 theme-light:text-gray-600">Vendedor: </span>
                          <span className="text-white theme-light:text-gray-900">{sale.employee || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 theme-light:text-gray-600">Fecha: </span>
                          <span className="text-white theme-light:text-gray-900">
                            {format(new Date(sale.created_date), "dd/MM/yyyy HH:mm", { locale: es })}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 theme-light:text-gray-600">Método: </span>
                          <span className="text-white theme-light:text-gray-900">
                            {sale.payment_method === 'cash' ? '💵 Efectivo' :
                             sale.payment_method === 'card' ? '💳 Tarjeta' :
                             sale.payment_method === 'ath_movil' ? '📱 ATH' :
                             sale.payment_method}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-emerald-400 theme-light:text-emerald-600">
                          ${(sale.total || 0).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-400 theme-light:text-gray-600">
                          ({(sale.items || []).length} items)
                        </span>
                      </div>
                    </div>

                    {!sale.voided && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {showManualEmailInput === sale.id ? (
                          <div className="flex gap-2 items-center">
                            <Input
                              type="email"
                              value={manualEmail}
                              onChange={(e) => setManualEmail(e.target.value)}
                              placeholder="cliente@email.com"
                              className="w-48 bg-black/40 border-white/15 text-white h-9 text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                handleSendEmail(sale, manualEmail);
                              }}
                              disabled={sendingEmail === sale.id || !manualEmail}
                              className="bg-blue-600 hover:bg-blue-700 h-9"
                            >
                              {sendingEmail === sale.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowManualEmailInput(null);
                                setManualEmail("");
                              }}
                              className="text-gray-400 h-9 px-2 theme-light:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : showManualPhoneInput === sale.id ? (
                          <div className="flex gap-2 items-center">
                            <Input
                              type="tel"
                              value={manualPhone}
                              onChange={(e) => setManualPhone(e.target.value)}
                              placeholder="787-123-4567"
                              className="w-48 bg-black/40 border-white/15 text-white h-9 text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                handleSendWhatsApp(sale, manualPhone);
                              }}
                              disabled={!manualPhone}
                              className="bg-green-600 hover:bg-green-700 h-9"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowManualPhoneInput(null);
                                setManualPhone("");
                              }}
                              className="text-gray-400 h-9 px-2 theme-light:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSendEmail(sale)}
                              disabled={sendingEmail === sale.id}
                              className="bg-blue-600 hover:bg-blue-700 h-9"
                            >
                              {sendingEmail === sale.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4 mr-2" />
                              )}
                              Email
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSendWhatsApp(sale)}
                              className="bg-green-600 hover:bg-green-700 h-9"
                            >
                              <MessageCircle className="w-4 h-4 mr-2" />
                              WhatsApp
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex gap-3 pt-4 border-t border-gray-800 theme-light:border-gray-200">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-700 hover:bg-gray-800 theme-light:border-gray-300 theme-light:hover:bg-gray-100"
          >
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
