import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Loader2, FileText, Search, Mail, Building2, CheckSquare } from "lucide-react";
import { generateInvoicePDF } from "./InvoicePDFGenerator";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function CreateInvoiceDialog({ open, onClose }) {
  const [step, setStep] = useState(0); // 0 = selector tipo, 1 = buscar, 2 = órdenes, 3 = productos, 4 = resumen
  const [invoiceType, setInvoiceType] = useState(null); // 'b2b' o 'regular'
  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    if (open) {
      // ✅ Saltar paso 0 y 1, ir directo a buscar empresas B2B
      setStep(1);
      setInvoiceType('b2b');
      loadAllCompanies();
    } else {
      setStep(0);
      setInvoiceType(null);
      setSearchQuery("");
      setCompanies([]);
      setSelectedCompany(null);
      setAvailableOrders([]);
      setSelectedOrders([]);
      setNotes("");
      setSendEmail(false);
    }
  }, [open]);

  const loadAllCompanies = async () => {
    setSearching(true);
    try {
      const allCustomers = await base44.entities.Customer.filter({ is_b2b: true });

      // ✅ SOLO MOSTRAR EMPRESAS CON ÓRDENES ABIERTAS
      const companiesWithOrders = [];
      for (const company of allCustomers || []) {
        const orders = await base44.entities.Order.filter({
          company_id: company.id,
          status: { $nin: ["delivered", "cancelled", "completed"] }
        });

        if (orders && orders.length > 0) {
          companiesWithOrders.push(company);
        }
      }

      setCompanies(companiesWithOrders);
    } catch (error) {
      console.error("Error loading companies:", error);
      toast.error("Error cargando empresas");
    } finally {
      setSearching(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter((c) =>
    (c.company_name || "").toLowerCase().includes(q) ||
    (c.company_tax_id || "").toLowerCase().includes(q) ||
    (c.name || "").toLowerCase().includes(q)
    );
  }, [companies, searchQuery]);

  const selectCompany = async (company) => {
    setSelectedCompany(company);
    setLoading(true);

    try {
      console.log("[CreateInvoice] Loading orders for company:", company.id);

      // ✅ Cargar TODAS las órdenes y filtrar manualmente
      const allOrders = await base44.entities.Order.list("-updated_date", 500);

      // ✅ Filtrar por company_id O company_name Y SOLO ABIERTAS
      const companyOrders = allOrders.filter((o) => {
        const isCompanyMatch = o.company_id === company.id ||
        o.company_name && o.company_name === company.company_name;
        const isOpen = !["delivered", "cancelled", "completed"].includes(o.status);
        return isCompanyMatch && isOpen;
      });

      console.log("[CreateInvoice] Found orders:", companyOrders.length);

      // ✅ Filtrar solo las que tienen precio
      const invoiceable = companyOrders.filter((o) => {
        const estimate = Number(o.cost_estimate || o.total || 0);
        console.log(`[CreateInvoice] Order ${o.order_number}: cost_estimate=${estimate}`);
        return estimate > 0;
      });

      console.log("[CreateInvoice] Invoiceable orders:", invoiceable.length);

      setAvailableOrders(invoiceable);
      
      // Cargar productos disponibles
      const products = await base44.entities.Product.filter({ 
        active: true,
        tipo_principal: "dispositivos",
        subcategoria: "dispositivo_completo"
      });
      setAvailableProducts(products || []);
      
      setStep(2);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Error cargando órdenes");
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (order) => {
    setSelectedOrders((prev) => {
      const exists = prev.find((o) => o.id === order.id);
      return exists ? prev.filter((o) => o.id !== order.id) : [...prev, order];
    });
  };

  const subtotal = useMemo(() => {
    const ordersTotal = selectedOrders.reduce((sum, order) => {
      const amount = Number(order.cost_estimate || order.total || 0);
      return sum + amount;
    }, 0);
    
    const productsTotal = selectedProducts.reduce((sum, product) => {
      const price = Number(product.price || 0);
      const qty = Number(product.selectedQty || 1);
      return sum + (price * qty);
    }, 0);
    
    return ordersTotal + productsTotal;
  }, [selectedOrders, selectedProducts]);

  const taxRate = 0.115;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const handleCreate = async () => {
    if (!selectedCompany) {
      toast.error("Selecciona una empresa primero");
      return;
    }

    if (selectedOrders.length === 0) {
      toast.error("Selecciona al menos una orden");
      return;
    }

    setLoading(true);
    try {
      // ✅ Cargar configuración de la tienda para el PDF (incluyendo logo)
      const businessSettings = await base44.entities.AppSettings.filter({ slug: "app-main-settings" });
      const brandingSettings = await base44.entities.AppSettings.filter({ slug: "app-branding" });
      
      const businessInfo = {
        name: businessSettings?.[0]?.payload?.business_name || "911 SmartFix",
        address: businessSettings?.[0]?.payload?.business_address || "",
        phone: businessSettings?.[0]?.payload?.business_phone || "",
        email: businessSettings?.[0]?.payload?.business_email || "",
        logo: brandingSettings?.[0]?.payload?.logo_url || "",
        logo_url: brandingSettings?.[0]?.payload?.logo_url || ""
      };

      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

      const invoiceData = {
        invoice_number: invoiceNumber,
        company_name: selectedCompany.company_name,
        company_tax_id: selectedCompany.company_tax_id || "",
        billing_address: selectedCompany.billing_address || "",
        work_order_ids: selectedOrders.map((o) => o.id),
        work_order_numbers: selectedOrders.map((o) => o.order_number),
        products: selectedProducts.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          qty: p.selectedQty || 1,
          device_imei: p.device_imei || "",
          device_condition: p.device_condition || "",
          device_storage: p.device_storage || "",
          device_color: p.device_color || "",
          device_carrier: p.device_carrier || ""
        })),
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        status: "draft",
        notes: notes || "",
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      const invoice = await base44.entities.Invoice.create(invoiceData);

      // Generar PDF con logo, órdenes y productos
      const pdfDoc = await generateInvoicePDF(invoice, selectedOrders, selectedProducts, businessInfo);
      const pdfBlob = pdfDoc.output('blob');

      if (sendEmail && selectedCompany.email) {
        try {
          const pdfFile = new File([pdfBlob], `Factura-${invoiceNumber}.pdf`, { type: 'application/pdf' });
          const uploadResult = await base44.integrations.Core.UploadFile({ file: pdfFile });

          await base44.entities.Invoice.update(invoice.id, {
            pdf_url: uploadResult.file_url,
            status: "sent"
          });

          // ✅ EMAIL MEJORADO ESTILO NOTIFICACIONES CON PDF ADJUNTO
          const emailHTML = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 20px; background: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
              <div style="max-width: 650px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                <!-- Header con gradiente -->
                <div style="background: linear-gradient(135deg, #00A8E8 0%, #10B981 50%, #A8D700 100%); padding: 60px 30px; text-align: center;">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                    alt="SmartFixOS"
                    style="height: 120px; width: auto; margin: 0 auto; display: block; filter: drop-shadow(0 4px 20px rgba(0,0,0,0.2));"
                  />
                  <h1 style="color: white; margin: 20px 0 0 0; font-size: 32px; font-weight: 800; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                    📄 Factura ${invoiceNumber}
                  </h1>
                </div>

                <!-- Cuerpo -->
                <div style="padding: 50px 40px;">
                  <p style="font-size: 18px; color: #111827; margin: 0 0 24px 0;">
                    Estimado/a <strong>${selectedCompany.billing_contact_person || selectedCompany.company_name}</strong>,
                  </p>

                  <div style="background: #F0FDF4; border-left: 6px solid #10B981; border-radius: 16px; padding: 24px; margin: 30px 0;">
                    <p style="margin: 0; color: #065F46; font-size: 16px; line-height: 1.7;">
                      Adjuntamos la factura consolidada correspondiente a las órdenes de trabajo completadas. 
                      El PDF incluye el desglose detallado de cada servicio.
                    </p>
                  </div>

                  <div style="background: #F9FAFB; border-radius: 16px; padding: 28px; margin: 30px 0;">
                    <h3 style="color: #111827; font-size: 16px; font-weight: 700; margin: 0 0 16px 0;">
                      📋 Órdenes Incluidas
                    </h3>
                    <ul style="margin: 0; padding: 0 0 0 20px; color: #374151;">
                      ${selectedOrders.map((o) => `
                        <li style="margin: 8px 0; line-height: 1.6;">
                          <strong>#${o.order_number}</strong> - ${o.device_brand} ${o.device_model}
                        </li>
                      `).join('')}
                    </ul>
                  </div>

                  <div style="background: linear-gradient(135deg, rgba(0,168,232,0.05), rgba(16,185,129,0.05)); border: 2px solid #E5E7EB; border-radius: 16px; padding: 28px; margin: 30px 0;">
                    <h3 style="color: #111827; font-size: 18px; font-weight: 800; margin: 0 0 20px 0;">
                      💰 Totales
                    </h3>
                    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 16px; color: #374151;">
                      <span>Subtotal:</span>
                      <span style="font-weight: 600;">$${subtotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 16px; color: #374151;">
                      <span>IVU (11.5%):</span>
                      <span style="font-weight: 600;">$${taxAmount.toFixed(2)}</span>
                    </div>
                    <div style="height: 2px; background: linear-gradient(to right, #00A8E8, #10B981); margin: 16px 0;"></div>
                    <div style="display: flex; justify-content: space-between; font-size: 24px; color: #111827; font-weight: 800;">
                      <span>TOTAL:</span>
                      <span>$${total.toFixed(2)}</span>
                    </div>
                  </div>

                  ${notes ? `
                    <div style="background: #FFFBEB; border: 2px solid #FCD34D; border-radius: 12px; padding: 20px; margin: 20px 0;">
                      <p style="margin: 0; color: #92400E; font-size: 14px; font-weight: 600;">
                        📝 Notas: ${notes}
                      </p>
                    </div>
                  ` : ''}

                  <div style="background: #EFF6FF; border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
                    <p style="margin: 0; color: #1E40AF; font-size: 14px; font-weight: 600;">
                      Términos de pago: <strong>${selectedCompany.payment_terms || 'NET-30'}</strong>
                    </p>
                  </div>

                  <!-- Botón de descarga -->
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${uploadResult.file_url}" 
                       download="Factura-${invoiceNumber}.pdf"
                       style="display: inline-block; background: linear-gradient(135deg, #00A8E8, #10B981); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 6px 20px rgba(0,168,232,0.3);">
                      📥 Descargar Factura PDF
                    </a>
                  </div>

                  <p style="color: #6B7280; font-size: 13px; line-height: 1.6; text-align: center; margin-top: 30px;">
                    Gracias por su preferencia. Ante cualquier duda, no dude en contactarnos.
                  </p>
                </div>

                <!-- Footer -->
                <div style="padding: 30px 40px; border-top: 2px solid #E5E7EB; text-align: center; background: #F9FAFB;">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                    alt="SmartFixOS"
                    style="height: 60px; width: auto; margin: 0 auto 20px auto; display: block; opacity: 0.7;"
                  />
                  <p style="margin: 8px 0; color: #111827; font-size: 14px; font-weight: 700;">SmartFixOS</p>
                  <p style="margin: 4px 0; color: #6B7280; font-size: 12px;">Tu taller de confianza</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await base44.integrations.Core.SendEmail({
            from_name: "SmartFixOS",
            to: selectedCompany.email,
            subject: `📄 Factura ${invoiceNumber} - ${selectedCompany.company_name}`,
            body: emailHTML
          });

          toast.success("✅ Factura creada y enviada por email con PDF");
        } catch (emailError) {
          console.error("Error sending email:", emailError);
          toast.error("Factura creada pero error al enviar email");
        }
      } else {
        // Descargar PDF directamente
        pdfDoc.save(`Factura-${invoiceNumber}.pdf`);
        toast.success("✅ Factura creada y descargada");
      }

      onClose(true);
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Error al crear la factura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="bg-[#0f0f10] border border-purple-500/20 text-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-purple-500/20 pb-4">
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Crear Factura {step === 0 ? "" : `- Paso ${step} de 3`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-6">
          {/* PASO 1: BUSCAR EMPRESA */}
          {step === 1 && invoiceType === 'b2b' &&
          <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  Buscar Empresa Cliente
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre de empresa, RUT/Tax ID..."
                  className="pl-10 bg-black/40 border-purple-500/30 text-white h-12" />
                </div>
              </div>

              {searching &&
            <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
                </div>
            }

              {!searching && filteredCompanies.length > 0 &&
            <div className="space-y-2">
                  {filteredCompanies.map((company) =>
              <Card
                key={company.id}
                onClick={() => selectCompany(company)}
                className="cursor-pointer bg-black/40 border-white/10 hover:border-purple-500/40 transition p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-purple-400" />
                            <p className="text-white font-bold truncate">{company.company_name}</p>
                          </div>
                          {company.company_tax_id &&
                    <p className="text-xs text-gray-400">RUT/Tax ID: {company.company_tax_id}</p>
                    }
                          <p className="text-xs text-gray-400 mt-1">
                            Contacto: {company.billing_contact_person || company.name}
                          </p>
                          <p className="text-xs text-gray-500">{company.email}</p>
                        </div>
                        <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30">
                          B2B
                        </Badge>
                      </div>
                    </Card>
              )}
                </div>
            }

              {searchQuery.length >= 2 && filteredCompanies.length === 0 && !searching &&
            <div className="text-center py-8 text-gray-400">
                  No se encontraron empresas para "{searchQuery}"
                </div>
            }

              {!searching && searchQuery.length < 2 && companies.length === 0 &&
            <div className="text-center py-8 text-gray-400">
                  Cargando empresas...
                </div>
            }
            </div>
          }

          {/* PASO 2: SELECCIONAR ÓRDENES */}
          {step === 2 &&
          <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">
                  Órdenes de {selectedCompany?.company_name}
                </h3>
                <p className="text-xs text-gray-400">
                  Selecciona las órdenes a incluir en la factura
                </p>
              </div>

              {loading ?
            <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
                </div> :
            availableOrders.length === 0 ?
            <div className="text-center py-8 text-gray-400">
                  No hay órdenes disponibles para facturar
                </div> :

            <div className="space-y-2">
                  {availableOrders.map((order) => {
                const isSelected = selectedOrders.some((o) => o.id === order.id);
                return (
                  <Card
                    key={order.id}
                    onClick={() => toggleOrderSelection(order)}
                    className={`cursor-pointer p-4 transition ${
                    isSelected ?
                    'bg-purple-600/20 border-purple-500/60 ring-2 ring-purple-500/40' :
                    'bg-black/40 border-white/10 hover:border-purple-500/40'}`
                    }>
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-purple-500 border-purple-500' : 'border-purple-500/40'}`
                      }>
                            {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white font-semibold">#{order.order_number}</p>
                              <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-500/30 text-xs">
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-300">
                              {order.device_brand} {order.device_model}
                            </p>
                            {order.device_serial &&
                        <p className="text-xs text-gray-500 font-mono mt-1">{order.device_serial}</p>
                        }
                            <p className="text-xs text-gray-400 mt-2">
                              Creada: {format(new Date(order.created_date), "dd MMM yyyy", { locale: es })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold text-lg">
                              ${Number(order.cost_estimate || order.total || 0).toFixed(2)}
                            </p>
                            {Number(order.balance_due || 0) > 0 &&
                        <Badge className="bg-amber-600/20 text-amber-300 border-amber-500/30 text-xs mt-1">
                                Saldo: ${Number(order.balance_due).toFixed(2)}
                              </Badge>
                        }
                          </div>
                        </div>
                      </Card>);

              })}
                </div>
            }
            </div>
          }

          {/* PASO 3: SELECCIONAR PRODUCTOS */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">
                  Dispositivos en Venta
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  Selecciona dispositivos para incluir en la factura (opcional)
                </p>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar dispositivo..."
                  className="bg-black/40 border-purple-500/30 text-white"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableProducts
                  .filter(p => 
                    !productSearch || 
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    (p.device_imei || "").toLowerCase().includes(productSearch.toLowerCase())
                  )
                  .map((product) => {
                    const isSelected = selectedProducts.some(p => p.id === product.id);
                    const selectedProduct = selectedProducts.find(p => p.id === product.id);
                    
                    return (
                      <Card
                        key={product.id}
                        className={`p-4 transition ${
                          isSelected 
                            ? 'bg-purple-600/20 border-purple-500/60 ring-2 ring-purple-500/40'
                            : 'bg-black/40 border-white/10 hover:border-purple-500/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([...selectedProducts, { ...product, selectedQty: 1 }]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
                              }
                            }}
                            className="w-5 h-5 mt-1 rounded"
                          />
                          <div className="flex-1">
                            <p className="text-white font-semibold mb-1">{product.name}</p>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-2">
                              {product.device_imei && (
                                <div>
                                  <span className="text-gray-500">IMEI:</span> {product.device_imei}
                                </div>
                              )}
                              {product.device_condition && (
                                <div>
                                  <span className="text-gray-500">Condición:</span> {product.device_condition}
                                </div>
                              )}
                              {product.device_storage && (
                                <div>
                                  <span className="text-gray-500">Almacenamiento:</span> {product.device_storage}
                                </div>
                              )}
                              {product.device_color && (
                                <div>
                                  <span className="text-gray-500">Color:</span> {product.device_color}
                                </div>
                              )}
                              {product.device_carrier && (
                                <div>
                                  <span className="text-gray-500">Carrier:</span> {product.device_carrier}
                                </div>
                              )}
                              {product.device_battery_health && (
                                <div>
                                  <span className="text-gray-500">Batería:</span> {product.device_battery_health}%
                                </div>
                              )}
                            </div>
                            
                            {isSelected && (
                              <div className="mt-3 flex items-center gap-2">
                                <label className="text-xs text-gray-400">Cantidad:</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={selectedProduct?.selectedQty || 1}
                                  onChange={(e) => {
                                    const qty = parseInt(e.target.value) || 1;
                                    setSelectedProducts(selectedProducts.map(p => 
                                      p.id === product.id ? { ...p, selectedQty: qty } : p
                                    ));
                                  }}
                                  className="w-20 h-8 bg-black/40 border-purple-500/30 text-white text-sm"
                                />
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold text-lg">
                              ${Number(product.price || 0).toFixed(2)}
                            </p>
                            {isSelected && selectedProduct?.selectedQty > 1 && (
                              <p className="text-xs text-gray-400 mt-1">
                                Total: ${(Number(product.price || 0) * selectedProduct.selectedQty).toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {/* PASO 4: RESUMEN */}
          {step === 4 &&
          <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">
                  Resumen de Factura
                </h3>
                <p className="text-xs text-gray-400">
                  {selectedCompany?.company_name} - {selectedOrders.length} órdenes, {selectedProducts.length} dispositivos
                </p>
              </div>

              {selectedOrders.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Órdenes Incluidas ({selectedOrders.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between bg-black/60 border border-white/5 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium">#{order.order_number}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {order.device_brand} {order.device_model}
                          </p>
                        </div>
                        <p className="text-white font-bold text-sm">${Number(order.cost_estimate || order.total || 0).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedProducts.length > 0 && (
                <div className="bg-black/40 border border-emerald-500/20 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Dispositivos Incluidos ({selectedProducts.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedProducts.map((product) => (
                      <div key={product.id} className="bg-black/60 border border-white/5 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white text-xs font-medium">{product.name}</p>
                          <p className="text-white font-bold text-sm">
                            ${(Number(product.price || 0) * (product.selectedQty || 1)).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {product.device_imei && <div>IMEI: {product.device_imei}</div>}
                          <div className="flex gap-2 flex-wrap">
                            {product.device_condition && <span>• {product.device_condition}</span>}
                            {product.device_storage && <span>• {product.device_storage}</span>}
                            {product.device_color && <span>• {product.device_color}</span>}
                          </div>
                          <div>Cantidad: {product.selectedQty || 1} x ${Number(product.price || 0).toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-300 mb-1.5 block">Notas / Términos Especiales (opcional)</label>
                <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descuentos aplicados, términos especiales..."
                className="bg-black/40 border-purple-500/30 text-white min-h-[80px]" />
              </div>

              {selectedCompany?.email &&
            <div className="flex items-center gap-2 bg-black/40 border border-emerald-500/30 rounded-lg p-3">
                  <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded" />
                  <label className="text-sm text-gray-300 flex-1">
                    <Mail className="w-4 h-4 inline mr-2 text-emerald-400" />
                    Enviar factura por email a {selectedCompany.email}
                  </label>
                </div>
            }

              <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Totales</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Subtotal:</span>
                    <span className="text-white font-semibold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">IVU (11.5%):</span>
                    <span className="text-white font-semibold">${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-purple-500/20">
                    <span className="text-white font-bold">Total:</span>
                    <span className="text-white font-bold text-lg">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <DialogFooter className="flex gap-2 border-t border-purple-500/20 pt-4 px-6 pb-4">
          {step > 0 &&
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={loading} className="bg-background text-slate-900 px-4 py-2 text-sm font-semibold rounded-full inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-9 border-white/15">

              ← Atrás
            </Button>
          }
          
          <Button
            variant="outline"
            onClick={() => onClose(false)}
            disabled={loading} className="bg-background text-slate-900 px-4 py-2 text-sm font-semibold rounded-full inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-9 border-white/15">

            Cancelar
          </Button>

          {step > 0 && step < 4 ?
          <Button
            onClick={() => {
              if (step === 2 && selectedOrders.length === 0) {
                toast.error("Selecciona al menos una orden");
                return;
              }
              setStep(step + 1);
            }}
            disabled={step === 1 && !selectedCompany}
            className="bg-gradient-to-r from-purple-600 to-pink-600">
              Siguiente →
            </Button> :

          <Button
            onClick={handleCreate}
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-pink-600">
              {loading ?
            <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {sendEmail ? "Enviando..." : "Generando..."}
                </> :

            <>
                  {sendEmail ?
              <>
                      <Mail className="w-4 h-4 mr-2" />
                      Crear y Enviar
                    </> :

              <>
                      <Download className="w-4 h-4 mr-2" />
                      Crear y Descargar
                    </>
              }
                </>
            }
            </Button>
          }
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}
