import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { 
  Smartphone, DollarSign, Check, X, Zap, User 
} from "lucide-react";

const CARRIERS = [
  { name: "Claro", color: "from-red-600 to-red-800", icon: "📱" },
  { name: "T-Mobile", color: "from-pink-600 to-pink-800", icon: "📞" },
  { name: "AT&T", color: "from-blue-600 to-blue-800", icon: "📲" },
  { name: "Liberty", color: "from-orange-600 to-orange-800", icon: "📳" },
  { name: "Boost", color: "from-green-600 to-green-800", icon: "🚀" },
  { name: "Cricket", color: "from-lime-600 to-lime-800", icon: "🦗" },
  { name: "Metro", color: "from-purple-600 to-purple-800", icon: "🚇" },
  { name: "Simple Mobile", color: "from-cyan-600 to-cyan-800", icon: "📱" },
  { name: "Ultra Mobile", color: "from-indigo-600 to-indigo-800", icon: "💎" },
  { name: "H2O", color: "from-blue-500 to-blue-700", icon: "💧" },
  { name: "Otra", color: "from-gray-600 to-gray-800", icon: "📞" },
];

const QUICK_AMOUNTS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

export default function RechargeDialog({ open, onClose, onRechargeComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
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
      
      // Guardar datos de recarga en sessionStorage para el POS
      const rechargeData = {
        phone_number: formData.phone_number,
        carrier: formData.carrier,
        carrier_custom: formData.carrier === "Otra" ? formData.carrier_custom : "",
        carrier_display: carrierName,
        amount: parseFloat(formData.amount),
        commission: parseFloat(formData.amount) * 0.05,
        customer_name: formData.customer_name || null,
        confirmation_code: formData.confirmation_code || `CONF-${Date.now()}`,
        notes: formData.notes || "",
        employee_id: user.id,
        employee_name: user.full_name
      };

      sessionStorage.setItem("pending_recharge", JSON.stringify(rechargeData));
      
      toast.success("✅ Redirigiendo al POS para cobrar...");
      
      handleClose();
      
      // Redirigir al POS
      setTimeout(() => {
        navigate(createPageUrl("POS") + "?recharge=true");
      }, 500);
    } catch (error) {
      console.error("Error procesando recarga:", error);
      toast.error("Error: " + (error.message || "Desconocido"));
    } finally {
      setProcessing(false);
    }
  };

  const selectedCarrier = CARRIERS.find(c => c.name === formData.carrier);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#020617] border border-cyan-500/30 max-w-2xl text-white theme-light:bg-white theme-light:border-gray-200">
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
                  onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  className="bg-black/30 border-cyan-500/20 text-white h-14 text-lg font-mono theme-light:bg-white theme-light:border-gray-300"
                  placeholder="(787) 123-4567"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block theme-light:text-gray-600">Selecciona la Compañía *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CARRIERS.map(carrier => (
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

          {/* Paso 2: Monto */}
          {step === 2 && (
            <div className="space-y-6">
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
                <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-xl p-4 theme-light:bg-emerald-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm theme-light:text-gray-700">Comisión estimada (5%)</span>
                    <span className="text-emerald-400 font-bold theme-light:text-emerald-700">
                      ${(parseFloat(formData.amount) * 0.05).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold theme-light:text-gray-900">Total a cobrar</span>
                    <span className="text-2xl text-white font-bold theme-light:text-gray-900">
                      ${parseFloat(formData.amount || 0).toFixed(2)}
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
                    <span className="text-gray-400 text-sm theme-light:text-gray-600">Monto</span>
                    <span className="text-2xl text-emerald-400 font-bold theme-light:text-emerald-700">
                      ${parseFloat(formData.amount).toFixed(2)}
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
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      Procesar Recarga
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
