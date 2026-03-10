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
  { name: "Claro", color: "from-red-600 to-red-800", icon: "📱", active: true },
  { name: "T-Mobile", color: "from-pink-600 to-pink-800", icon: "📞", active: true },
  { name: "AT&T", color: "from-blue-600 to-blue-800", icon: "📲", active: true },
  { name: "Liberty", color: "from-orange-600 to-orange-800", icon: "📳", active: true },
  { name: "Boost", color: "from-green-600 to-green-800", icon: "🚀", active: true },
  { name: "Cricket", color: "from-lime-600 to-lime-800", icon: "🦗", active: true },
  { name: "Metro", color: "from-purple-600 to-purple-800", icon: "🚇", active: true },
  { name: "Simple Mobile", color: "from-cyan-600 to-cyan-800", icon: "📱", active: true },
  { name: "Ultra Mobile", color: "from-indigo-600 to-indigo-800", icon: "💎", active: true },
  { name: "H2O", color: "from-blue-500 to-blue-700", icon: "💧", active: true },
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
      <DialogContent className="bg-[#020617] border border-cyan-500/30 max-w-2xl text-white theme-light:bg-white theme-light:border-gray-200 z-[200]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3 theme-light:text-gray-900">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            Recarga de Celular
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Indicador de pasos */}
          <div className="flex justify-between items-center">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  step >= s 
                    ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 border-transparent text-white' 
                    : 'bg-black/30 border-white/20 text-gray-500'
                }`}>
                  {step > s ? <Check className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-gradient-to-r from-cyan-600 to-emerald-600' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Paso 1: Número y Compañía */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="text-xs text-gray-400 mb-2 block theme-light:text-gray-600 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  Número a Recargar *
                </label>
                <Input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({...formData, phone_number: value});
                  }}
                  className="bg-black/30 border-cyan-500/20 text-white h-14 text-lg font-mono theme-light:bg-white theme-light:border-gray-300"
                  placeholder="7879233860 (10 dígitos)"
                  maxLength={10}
                  autoFocus
                />
                {formData.phone_number && formData.phone_number.length !== 10 && (
                  <p className="text-xs text-red-400 mt-1">El número debe tener exactamente 10 dígitos</p>
                )}
                {formData.phone_number && formData.phone_number.length === 10 && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Número válido
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-gray-400 theme-light:text-gray-600">Selecciona la Compañía *</label>
                  <button
                    onClick={() => setShowCarriersConfig(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    Gestionar
                  </button>
                </div>
                {loadingCarriers ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {carriers.map(carrier => (
                    <button
                      key={carrier.name}
                      type="button"
                      onClick={() => setFormData({...formData, carrier: carrier.name})}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        formData.carrier === carrier.name
                          ? `bg-gradient-to-br ${carrier.color} text-white border-transparent shadow-lg`
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300'
                      }`}
                    >
                      <span className="text-3xl">{carrier.icon}</span>
                      <span className="text-sm font-bold">{carrier.name}</span>
                    </button>
                    ))}
                  </div>
                )}

                {formData.carrier === "Otra" && (
                  <Input
                    value={formData.carrier_custom}
                    onChange={(e) => setFormData({...formData, carrier_custom: e.target.value})}
                    className="mt-3 bg-black/30 border-cyan-500/20 text-white h-11 theme-light:bg-white theme-light:border-gray-300"
                    placeholder="Nombre de la compañía..."
                  />
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block theme-light:text-gray-600 flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  Nombre del Cliente (opcional)
                </label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  className="bg-black/30 border-cyan-500/20 text-white h-11 theme-light:bg-white theme-light:border-gray-300"
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
                className="w-full h-12 bg-gradient-to-r from-cyan-600 to-emerald-700 shadow-[0_4px_20px_rgba(0,168,232,0.4)]"
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
                <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-xl p-4">
                  <p className="text-xs text-cyan-300 mb-3">💡 Procesar recarga externamente</p>
                  <button
                    onClick={() => {
                      const popup = window.open(externalRechargeUrl, 'recharge_popup', 'width=800,height=900,scrollbars=yes');
                      toast.success("Ventana de recarga abierta. Los datos se mantendrán aquí.");
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Abrir {externalRechargeUrl.includes('pagatodo') ? 'PagaTodoPR.com' : 'Sistema de Recarga'}
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-2 block theme-light:text-gray-600 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Monto de Recarga *
                </label>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {QUICK_AMOUNTS.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setFormData({...formData, amount: amount.toString()})}
                      className={`py-3 rounded-lg border-2 font-bold transition-all ${
                        formData.amount === amount.toString()
                          ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white border-transparent shadow-lg'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300'
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
                  className="bg-black/30 border-cyan-500/20 text-white h-14 text-2xl font-bold text-center theme-light:bg-white theme-light:border-gray-300"
                  placeholder="$0.00"
                />
              </div>

              {formData.amount && (
                <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-xl p-4 space-y-3 theme-light:bg-emerald-50">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm theme-light:text-gray-700">Subtotal</span>
                    <span className="text-white font-bold theme-light:text-gray-900">
                      ${parseFloat(formData.amount).toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setApplyTax(!applyTax)}
                        className={`w-12 h-6 rounded-full transition-all relative ${
                          applyTax ? 'bg-emerald-500' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                          applyTax ? 'left-6' : 'left-0.5'
                        }`} />
                      </button>
                      <span className="text-gray-400 text-sm theme-light:text-gray-700">IVU (11.5%)</span>
                    </div>
                    <span className="text-white font-bold theme-light:text-gray-900">
                      {applyTax ? `$${(parseFloat(formData.amount) * 0.115).toFixed(2)}` : '$0.00'}
                    </span>
                  </div>

                  <div className="h-px bg-white/10" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-lg theme-light:text-gray-900">Total a Cobrar</span>
                    <span className="text-3xl text-emerald-400 font-bold theme-light:text-emerald-700">
                      ${(parseFloat(formData.amount) * (applyTax ? 1.115 : 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 border-white/15 h-12 theme-light:border-gray-300"
                >
                  Atrás
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!formData.amount || parseFloat(formData.amount) <= 0}
                  className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-green-700"
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
              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-5 theme-light:bg-gray-50 theme-light:border-gray-200">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  Resumen de Recarga
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm theme-light:text-gray-600">Número</span>
                    <span className="text-white font-mono font-bold theme-light:text-gray-900">{formData.phone_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm theme-light:text-gray-600">Compañía</span>
                    <Badge className={`bg-gradient-to-r ${selectedCarrier?.color} text-white border-0`}>
                      {selectedCarrier?.icon} {formData.carrier === "Otra" ? formData.carrier_custom : formData.carrier}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm theme-light:text-gray-600">Subtotal</span>
                    <span className="text-white font-bold theme-light:text-gray-900">
                      ${parseFloat(formData.amount).toFixed(2)}
                    </span>
                  </div>
                  {applyTax && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm theme-light:text-gray-600">IVU (11.5%)</span>
                      <span className="text-white font-bold theme-light:text-gray-900">
                        ${(parseFloat(formData.amount) * 0.115).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-white font-bold theme-light:text-gray-900">Total a Cobrar</span>
                    <span className="text-2xl text-emerald-400 font-bold theme-light:text-emerald-700">
                      ${(parseFloat(formData.amount) * (applyTax ? 1.115 : 1)).toFixed(2)}
                    </span>
                  </div>
                  {formData.customer_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm theme-light:text-gray-600">Cliente</span>
                      <span className="text-white theme-light:text-gray-900">{formData.customer_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Código de confirmación (opcional) */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block theme-light:text-gray-600">Código de Confirmación (opcional)</label>
                <Input
                  value={formData.confirmation_code}
                  onChange={(e) => setFormData({...formData, confirmation_code: e.target.value})}
                  className="bg-black/30 border-cyan-500/20 text-white h-11 font-mono theme-light:bg-white theme-light:border-gray-300"
                  placeholder="Se generará automáticamente si no lo ingresas"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block theme-light:text-gray-600">Notas (opcional)</label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="bg-black/30 border-cyan-500/20 text-white h-11 theme-light:bg-white theme-light:border-gray-300"
                  placeholder="Información adicional..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={processing}
                  className="flex-1 border-white/15 h-12 theme-light:border-gray-300"
                >
                  Atrás
                </Button>
                <Button
                  onClick={handleProcessRecharge}
                  disabled={processing}
                  className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-green-700 shadow-[0_4px_20px_rgba(16,185,129,0.4)]"
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
