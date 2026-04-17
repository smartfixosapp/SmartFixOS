import React, { useState, useEffect } from "react";
import { generateRechargeNumber } from "@/components/utils/sequenceHelpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import {
  Smartphone, DollarSign, Check, X, Zap, User, Settings, ExternalLink
} from "lucide-react";
import CarriersConfigDialog from "./CarriersConfigDialog";

const DEFAULT_CARRIERS = [
  { name: "Claro", tint: "red", icon: "📱", active: true },
  { name: "T-Mobile", tint: "red", icon: "📞", active: true },
  { name: "AT&T", tint: "blue", icon: "📲", active: true },
  { name: "Liberty", tint: "orange", icon: "📳", active: true },
  { name: "Boost", tint: "green", icon: "🚀", active: true },
  { name: "Cricket", tint: "green", icon: "🦗", active: true },
  { name: "Metro", tint: "purple", icon: "🚇", active: true },
  { name: "Simple Mobile", tint: "blue", icon: "📱", active: true },
  { name: "Ultra Mobile", tint: "indigo", icon: "💎", active: true },
  { name: "H2O", tint: "blue", icon: "💧", active: true },
];

const QUICK_AMOUNTS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

export default function RechargeDialog({ open, onClose, onRechargeComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [carriers, setCarriers] = useState([]);
  const [loadingCarriers, setLoadingCarriers] = useState(true);
  const [showCarriersConfig, setShowCarriersConfig] = useState(false);
  const [externalRechargeUrl, setExternalRechargeUrl] = useState("");
  const [formData, setFormData] = useState({
    phone_number: "",
    carrier: "",
    carrier_custom: "",
    amount: "",
    customer_name: "",
    confirmation_code: "",
    notes: ""
  });
  const [processing, setProcessing] = useState(false);
  const [applyTax, setApplyTax] = useState(true);

  useEffect(() => {
    if (open) {
      loadCarriers();
      loadExternalUrl();
    }
  }, [open]);

  const loadCarriers = async () => {
    setLoadingCarriers(true);
    try {
      const configs = await dataClient.entities.SystemConfig.filter({ key: "recharge.carriers" });
      if (configs?.length) {
        const saved = JSON.parse(configs[0].value);
        setCarriers(saved.filter(c => c.active !== false));
      } else {
        setCarriers(DEFAULT_CARRIERS.filter(c => c.active !== false));
      }
    } catch (error) {
      console.error("Error loading carriers:", error);
      setCarriers(DEFAULT_CARRIERS.filter(c => c.active !== false));
    } finally {
      setLoadingCarriers(false);
    }
  };

  const loadExternalUrl = async () => {
    try {
      const configs = await dataClient.entities.SystemConfig.filter({ key: "recharge.external_url" });
      if (configs?.length) {
        setExternalRechargeUrl(configs[0].value || "");
      }
    } catch (error) {
      console.error("Error loading external url:", error);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFormData({
      phone_number: "",
      carrier: "",
      carrier_custom: "",
      amount: "",
      customer_name: "",
      confirmation_code: "",
      notes: ""
    });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleProcessRecharge = async () => {
    setProcessing(true);
    try {
      const user = await dataClient.auth.me();

      const carrierName = formData.carrier === "Otra" ? formData.carrier_custom : formData.carrier;

      // Validar que el amount existe
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        toast.error("Monto inválido");
        setProcessing(false);
        return;
      }

      // Crear item de recarga con precio + IVU
      const subtotal = parseFloat(formData.amount);
      const tax = applyTax ? subtotal * 0.115 : 0;
      const total = subtotal + tax;

      console.log("🔵 Procesando recarga:", { subtotal, tax, total, applyTax });

      const rechargeData = {
        phone_number: formData.phone_number,
        carrier: formData.carrier,
        carrier_custom: formData.carrier === "Otra" ? formData.carrier_custom : "",
        carrier_display: carrierName,
        amount: subtotal,
        commission: subtotal * 0.05,
        customer_name: formData.customer_name || null,
        confirmation_code: formData.confirmation_code || `CONF-${Date.now()}`,
        notes: formData.notes || "",
        employee_id: user.id,
        employee_name: user.full_name,
        apply_tax: applyTax
      };

      console.log("✅ Recarga completada, enviando al POS");

      // Enviar al callback parent (POS)
      onRechargeComplete?.(rechargeData);
      handleReset();
    } catch (error) {
      console.error("Error procesando recarga:", error);
      toast.error("Error: " + (error.message || "Desconocido"));
    } finally {
      setProcessing(false);
    }
  };

  const selectedCarrier = carriers.find(c => c.name === formData.carrier);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-2xl z-[200]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-3">
            <div className="w-12 h-12 rounded-apple-md bg-apple-blue/15 flex items-center justify-center">
              <Zap className="w-6 h-6 text-apple-blue" />
            </div>
            Recarga de Celular
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-6 pt-4">
          {/* Indicador de pasos */}
          <div className="flex justify-between items-center">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all apple-text-subheadline font-semibold ${
                  step >= s
                    ? 'bg-apple-blue text-white'
                    : 'bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary'
                }`}>
                  {step > s ? <Check className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-2 rounded-full ${step > s ? 'bg-apple-blue' : 'bg-gray-sys6 dark:bg-gray-sys5'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Paso 1: Número y Compañía */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-2 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-apple-blue" />
                  Número a Recargar *
                </label>
                <Input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({...formData, phone_number: value});
                  }}
                  className="apple-input h-14 apple-text-headline font-mono tabular-nums"
                  placeholder="7879233860 (10 dígitos)"
                  maxLength={10}
                  autoFocus
                />
                {formData.phone_number && formData.phone_number.length !== 10 && (
                  <p className="apple-text-caption1 text-apple-red mt-1">El número debe tener exactamente 10 dígitos</p>
                )}
                {formData.phone_number && formData.phone_number.length === 10 && (
                  <p className="apple-text-caption1 text-apple-green mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Número válido
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="apple-text-caption1 apple-label-secondary">Selecciona la Compañía *</label>
                  <button
                    onClick={() => setShowCarriersConfig(true)}
                    className="apple-text-caption1 text-apple-blue flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    Gestionar
                  </button>
                </div>
                {loadingCarriers ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-apple-blue border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {carriers.map(carrier => {
                      const tint = carrier.tint || "blue";
                      const selected = formData.carrier === carrier.name;
                      return (
                    <button
                      key={carrier.name}
                      type="button"
                      onClick={() => setFormData({...formData, carrier: carrier.name})}
                      className={`apple-press flex flex-col items-center gap-2 p-4 rounded-apple-md transition-all ${
                        selected
                          ? `bg-apple-${tint}/15 ring-2 ring-apple-${tint}`
                          : 'apple-card'
                      }`}
                    >
                      <span className="text-3xl">{carrier.icon}</span>
                      <span className={`apple-text-subheadline font-semibold ${selected ? `text-apple-${tint}` : 'apple-label-primary'}`}>{carrier.name}</span>
                    </button>
                      );
                    })}
                  </div>
                )}

                {formData.carrier === "Otra" && (
                  <Input
                    value={formData.carrier_custom}
                    onChange={(e) => setFormData({...formData, carrier_custom: e.target.value})}
                    className="apple-input mt-3 h-11"
                    placeholder="Nombre de la compañía..."
                  />
                )}
              </div>

              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-apple-blue" />
                  Nombre del Cliente (opcional)
                </label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  className="apple-input h-11"
                  placeholder="Dejar vacío si el cliente no desea dar su nombre"
                />
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={
                  !formData.phone_number ||
                  formData.phone_number.length !== 10 ||
                  !formData.carrier ||
                  (formData.carrier === "Otra" && !formData.carrier_custom?.trim())
                }
                className="apple-btn apple-btn-primary w-full h-12"
              >
                Continuar
                <Check className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Paso 2: Monto y Link Externo */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Link Externo para procesar recarga */}
              {externalRechargeUrl && (
                <div className="bg-apple-blue/12 rounded-apple-md p-4">
                  <p className="apple-text-caption1 text-apple-blue mb-3">Procesar recarga externamente</p>
                  <button
                    onClick={() => {
                      const popup = window.open(externalRechargeUrl, 'recharge_popup', 'width=800,height=900,scrollbars=yes');
                      toast.success("Ventana de recarga abierta. Los datos se mantendrán aquí.");
                    }}
                    className="apple-btn apple-btn-primary w-full"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Abrir {externalRechargeUrl.includes('pagatodo') ? 'PagaTodoPR.com' : 'Sistema de Recarga'}
                  </button>
                </div>
              )}

              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-apple-green" />
                  Monto de Recarga *
                </label>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {QUICK_AMOUNTS.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setFormData({...formData, amount: amount.toString()})}
                      className={`apple-press py-3 rounded-apple-sm font-semibold transition-all tabular-nums ${
                        formData.amount === amount.toString()
                          ? 'bg-apple-green text-white'
                          : 'apple-card apple-label-primary'
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="apple-input h-14 apple-text-title2 font-bold text-center tabular-nums"
                  placeholder="$0.00"
                />
              </div>

              {formData.amount && (
                <div className="bg-apple-green/12 rounded-apple-md p-4 space-y-3">
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="apple-label-secondary apple-text-subheadline">Subtotal</span>
                    <span className="apple-label-primary font-semibold">
                      ${parseFloat(formData.amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setApplyTax(!applyTax)}
                        className={`w-12 h-6 rounded-full transition-all relative ${
                          applyTax ? 'bg-apple-green' : 'bg-gray-sys5'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                          applyTax ? 'left-6' : 'left-0.5'
                        }`} />
                      </button>
                      <span className="apple-label-secondary apple-text-subheadline">IVU (11.5%)</span>
                    </div>
                    <span className="apple-label-primary font-semibold tabular-nums">
                      {applyTax ? `$${(parseFloat(formData.amount) * 0.115).toFixed(2)}` : '$0.00'}
                    </span>
                  </div>

                  <div style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }} />

                  <div className="flex items-center justify-between">
                    <span className="apple-label-primary apple-text-headline">Total a Cobrar</span>
                    <span className="apple-text-title1 text-apple-green font-bold tabular-nums">
                      ${(parseFloat(formData.amount) * (applyTax ? 1.115 : 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="apple-btn apple-btn-secondary flex-1 h-12"
                >
                  Atrás
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!formData.amount || parseFloat(formData.amount) <= 0}
                  className="apple-btn apple-btn-primary bg-apple-green flex-1 h-12"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3: Confirmación y Pago */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="apple-card p-5">
                <h3 className="apple-label-primary apple-text-headline mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-apple-blue" />
                  Resumen de Recarga
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="apple-label-secondary apple-text-subheadline">Número</span>
                    <span className="apple-label-primary font-mono font-semibold tabular-nums">{formData.phone_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="apple-label-secondary apple-text-subheadline">Compañía</span>
                    <Badge className={`bg-apple-${selectedCarrier?.tint || "blue"}/15 text-apple-${selectedCarrier?.tint || "blue"} border-0`}>
                      {selectedCarrier?.icon} {formData.carrier === "Otra" ? formData.carrier_custom : formData.carrier}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="apple-label-secondary apple-text-subheadline">Subtotal</span>
                    <span className="apple-label-primary font-semibold">
                      ${parseFloat(formData.amount).toFixed(2)}
                    </span>
                  </div>
                  {applyTax && (
                    <div className="flex items-center justify-between tabular-nums">
                      <span className="apple-label-secondary apple-text-subheadline">IVU (11.5%)</span>
                      <span className="apple-label-primary font-semibold">
                        ${(parseFloat(formData.amount) * 0.115).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                    <span className="apple-label-primary apple-text-headline">Total a Cobrar</span>
                    <span className="apple-text-title2 text-apple-green font-bold tabular-nums">
                      ${(parseFloat(formData.amount) * (applyTax ? 1.115 : 1)).toFixed(2)}
                    </span>
                  </div>
                  {formData.customer_name && (
                    <div className="flex items-center justify-between">
                      <span className="apple-label-secondary apple-text-subheadline">Cliente</span>
                      <span className="apple-label-primary apple-text-subheadline">{formData.customer_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Código de confirmación (opcional) */}
              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-1 block">Código de Confirmación (opcional)</label>
                <Input
                  value={formData.confirmation_code}
                  onChange={(e) => setFormData({...formData, confirmation_code: e.target.value})}
                  className="apple-input h-11 font-mono"
                  placeholder="Se generará automáticamente si no lo ingresas"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="apple-text-caption1 apple-label-secondary mb-1 block">Notas (opcional)</label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="apple-input h-11"
                  placeholder="Información adicional..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={processing}
                  className="apple-btn apple-btn-secondary flex-1 h-12"
                >
                  Atrás
                </Button>
                <Button
                  onClick={handleProcessRecharge}
                  disabled={processing}
                  className="apple-btn apple-btn-primary bg-apple-green flex-1 h-12"
                >
                  {processing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Agregando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      Agregar a Carrito
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Gestión de Carriers */}
        <CarriersConfigDialog
          open={showCarriersConfig}
          onClose={() => setShowCarriersConfig(false)}
          onSave={(updatedCarriers) => {
            setCarriers(updatedCarriers.filter(c => c.active !== false));
            toast.success("Carriers actualizados");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
