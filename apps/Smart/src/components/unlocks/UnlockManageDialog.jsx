import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, CreditCard, CheckCircle2, X, Edit2, 
  Save, AlertCircle, Wallet, Clock, User, Smartphone, ExternalLink, Link as LinkIcon 
} from "lucide-react";
import { toast } from "sonner";

const UNLOCK_STATUSES = [
  { value: "received", label: "Recibido", color: "from-blue-500 to-cyan-500", icon: "📥" },
  { value: "in_progress", label: "En Progreso", color: "from-yellow-500 to-orange-500", icon: "⚙️" },
  { value: "completed", label: "Terminado", color: "from-green-500 to-emerald-500", icon: "✅" },
  { value: "ready_to_deliver", label: "Listo p/ Entregar", color: "from-purple-500 to-pink-500", icon: "📦" },
  { value: "delivered", label: "Entregado", color: "from-gray-600 to-gray-800", icon: "🎉" },
];

export default function UnlockManageDialog({ unlock, onClose, onPaymentOption, onUpdateUnlock }) {
  const [editMode, setEditMode] = useState(false);
  const [customDepositAmount, setCustomDepositAmount] = useState("");
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [showStatusEdit, setShowStatusEdit] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState(unlock.tracking_url || "");
  
  // Estados editables
  const [editData, setEditData] = useState({
    service_type: unlock.initial_problem?.split('\n')[0] || "",
    device_brand: unlock.device_brand || "",
    device_model: unlock.device_model || "",
    device_serial: unlock.device_serial || "",
    cost_estimate: unlock.cost_estimate || 0,
    notes: unlock.status_note || "",
    unlock_status: unlock.unlock_status || "received",
    tracking_url: unlock.tracking_url || ""
  });

  const total = Number(unlock.cost_estimate || unlock.total || 0);
  const paid = Number(unlock.amount_paid || unlock.total_paid || 0);
  const balance = Math.max(0, total - paid);
  const isPaid = balance <= 0.01;

  const quickDepositAmounts = [25, 50, 100, 150];

  const handleSaveEdits = async () => {
    try {
      await onUpdateUnlock?.(unlock.id, {
        device_brand: editData.device_brand,
        device_model: editData.device_model,
        device_serial: editData.device_serial,
        cost_estimate: parseFloat(editData.cost_estimate) || 0,
        balance_due: parseFloat(editData.cost_estimate) || 0,
        status_note: editData.notes,
        unlock_status: editData.unlock_status,
        tracking_url: editData.tracking_url
      });
      setEditMode(false);
      setShowStatusEdit(false);
      toast.success("✅ Desbloqueo actualizado");
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const currentStatus = UNLOCK_STATUSES.find(s => s.value === (unlock.unlock_status || "received"));

  const handleDepositClick = () => {
    if (showDepositInput && customDepositAmount) {
      const amount = parseFloat(customDepositAmount);
      if (amount > 0 && amount <= balance) {
        onPaymentOption("deposit", amount);
      } else {
        toast.error("Monto inválido");
      }
    } else {
      setShowDepositInput(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative z-[10000] bg-[#1c1c1e] border border-white/10 rounded-[40px] p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl ${
              isPaid 
                ? 'bg-gradient-to-br from-emerald-400 to-green-600' 
                : 'bg-gradient-to-br from-blue-500 to-cyan-500'
            }`}>
              {isPaid ? (
                <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={3} />
              ) : (
                <Smartphone className="w-8 h-8 text-white" strokeWidth={2.5} />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{unlock.customer_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-white/60 text-sm">#{unlock.order_number}</p>
                {currentStatus && (
                  <Badge className={`bg-gradient-to-r ${currentStatus.color} text-white text-xs`}>
                    {currentStatus.icon} {currentStatus.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unlock.tracking_url && (
              <Button
                onClick={() => window.open(unlock.tracking_url, '_blank')}
                size="icon"
                variant="ghost"
                aria-label="Ver estado del desbloqueo en sitio externo"
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-600/10"
                title="Ver estado del desbloqueo"
              >
                <ExternalLink className="w-5 h-5" />
              </Button>
            )}
            <Button
              onClick={() => setEditMode(!editMode)}
              size="icon"
              variant="ghost"
              aria-label={editMode ? "Cancelar edición" : "Editar desbloqueo"}
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/10"
            >
              {editMode ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </Button>
            <Button
              onClick={onClose}
              size="icon"
              variant="ghost"
              aria-label="Cerrar diálogo de desbloqueo"
              className="text-white/40 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Información del Desbloqueo */}
        {editMode ? (
          <div className="space-y-4 mb-6 bg-[#2c2c2e] rounded-2xl p-6 border border-white/10">
            <h3 className="text-white font-bold mb-4">Editar Información</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/60 mb-2 block">Marca</label>
                <Input
                  value={editData.device_brand}
                  onChange={(e) => setEditData({...editData, device_brand: e.target.value})}
                  className="bg-black/30 border-white/10 text-white h-11"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-2 block">Modelo</label>
                <Input
                  value={editData.device_model}
                  onChange={(e) => setEditData({...editData, device_model: e.target.value})}
                  className="bg-black/30 border-white/10 text-white h-11"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-2 block">IMEI / Serial</label>
              <Input
                value={editData.device_serial}
                onChange={(e) => setEditData({...editData, device_serial: e.target.value})}
                className="bg-black/30 border-white/10 text-white h-11 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-white/60 mb-2 block">Precio Total</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editData.cost_estimate}
                  onChange={(e) => setEditData({...editData, cost_estimate: e.target.value})}
                  className="bg-black/30 border-white/10 text-white h-11 pl-8 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-2 block">Estado del Desbloqueo</label>
              <div className="grid grid-cols-2 gap-2">
                {UNLOCK_STATUSES.map(status => (
                  <button
                    key={status.value}
                    onClick={() => setEditData({...editData, unlock_status: status.value})}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                      editData.unlock_status === status.value
                        ? `bg-gradient-to-r ${status.color} text-white border-transparent`
                        : 'bg-black/30 border-white/10 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    {status.icon} {status.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-2 block">URL de Seguimiento (opcional)</label>
              <Input
                value={editData.tracking_url}
                onChange={(e) => setEditData({...editData, tracking_url: e.target.value})}
                className="bg-black/30 border-white/10 text-white h-11 text-sm"
                placeholder="https://gsmunlock.com/order/..."
              />
              <p className="text-xs text-white/40 mt-1">Link para verificar estado en el proveedor</p>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-2 block">Notas</label>
              <Input
                value={editData.notes}
                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                className="bg-black/30 border-white/10 text-white h-11"
                placeholder="Notas adicionales..."
              />
            </div>

            <Button
              onClick={handleSaveEdits}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 h-12 font-bold"
            >
              <Save className="w-5 h-5 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {/* Info del dispositivo */}
            <div className="bg-[#2c2c2e] rounded-2xl p-5 border border-white/10">
              <h3 className="text-white/60 text-xs font-bold uppercase mb-3">Dispositivo</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Equipo</span>
                  <span className="text-white font-semibold">{unlock.device_brand} {unlock.device_model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">IMEI/Serial</span>
                  <span className="text-white font-mono text-sm">{unlock.device_serial || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Servicio</span>
                  <span className="text-white text-sm">{unlock.initial_problem?.split('\n')[0] || "Desbloqueo"}</span>
                </div>
              </div>
            </div>

            {/* Info financiera */}
            <div className={`rounded-2xl p-6 border ${
              isPaid 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : 'bg-[#2c2c2e] border-white/10'
            }`}>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/60 text-sm">Precio Total</span>
                  <span className="text-white font-bold text-lg">${total.toFixed(2)}</span>
                </div>
                {paid > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-400/80 text-sm">Pagado</span>
                    <span className="text-emerald-400 font-bold">-${paid.toFixed(2)}</span>
                  </div>
                )}
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold">Balance Pendiente</span>
                  <span className={`text-3xl font-black ${isPaid ? 'text-emerald-400' : 'text-white'}`}>
                    ${balance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Estado y Tracking */}
            <div className="bg-[#2c2c2e] rounded-2xl p-5 border border-white/10">
              <h3 className="text-white/60 text-xs font-bold uppercase mb-3">Estado</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowStatusEdit(!showStatusEdit)}
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    showStatusEdit
                      ? 'bg-cyan-600/20 border-cyan-500/50'
                      : 'bg-black/30 border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold bg-gradient-to-r ${currentStatus.color} bg-clip-text text-transparent`}>
                      {currentStatus.icon} {currentStatus.label}
                    </span>
                    <Edit2 className="w-4 h-4 text-white/40" />
                  </div>
                </button>

                {showStatusEdit && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-black/40 rounded-xl border border-white/5">
                    {UNLOCK_STATUSES.map(status => (
                      <button
                        key={status.value}
                        onClick={async () => {
                          try {
                            await onUpdateUnlock?.(unlock.id, { unlock_status: status.value });
                            setShowStatusEdit(false);
                            toast.success(`Estado actualizado: ${status.label}`);
                          } catch (error) {
                            toast.error("Error actualizando estado");
                          }
                        }}
                        className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                          unlock.unlock_status === status.value
                            ? `bg-gradient-to-r ${status.color} text-white border-transparent`
                            : 'bg-black/30 border-white/10 text-white/60 hover:bg-white/5'
                        }`}
                      >
                        {status.icon} {status.label}
                      </button>
                    ))}
                  </div>
                )}

                {unlock.tracking_url && (
                  <button
                    onClick={() => window.open(unlock.tracking_url, '_blank')}
                    className="w-full px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-400 font-semibold flex items-center justify-center gap-2 transition-all text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver Estado en Proveedor
                  </button>
                )}
              </div>
            </div>

            {/* Contacto del cliente */}
            <div className="bg-[#2c2c2e] rounded-2xl p-5 border border-white/10">
              <h3 className="text-white/60 text-xs font-bold uppercase mb-3">Cliente</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-white/40" />
                  <span className="text-white">{unlock.customer_name}</span>
                </div>
                {unlock.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-white/40" />
                    <span className="text-white/70 text-sm">{unlock.customer_phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Acciones de pago */}
        {!editMode && (
          <div className="space-y-3">
            <Button
              onClick={() => onPaymentOption("pay")}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white h-14 rounded-2xl text-lg font-bold shadow-lg"
            >
              <DollarSign className="w-6 h-6 mr-2" strokeWidth={3} />
              Cobrar Total (${balance.toFixed(2)})
            </Button>

            {/* Input de depósito personalizado */}
            {showDepositInput ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {quickDepositAmounts.map(amt => (
                    <button
                      key={amt}
                      onClick={() => setCustomDepositAmount(amt.toString())}
                      disabled={amt > balance}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                        customDepositAmount === amt.toString()
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-white/60">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={customDepositAmount}
                    onChange={(e) => setCustomDepositAmount(e.target.value)}
                    placeholder="Monto del depósito"
                    className="pl-10 h-14 bg-[#2c2c2e] border-blue-500/30 text-white text-2xl font-bold text-center"
                    autoFocus
                  />
                </div>

                {customDepositAmount && parseFloat(customDepositAmount) > balance && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>El depósito no puede exceder el balance (${balance.toFixed(2)})</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setShowDepositInput(false);
                      setCustomDepositAmount("");
                    }}
                    variant="outline"
                    className="flex-1 border-white/20 h-12"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleDepositClick}
                    disabled={!customDepositAmount || parseFloat(customDepositAmount) <= 0 || parseFloat(customDepositAmount) > balance}
                    className="flex-1 bg-blue-500 hover:bg-blue-400 h-12 font-bold"
                  >
                    <Wallet className="w-5 h-5 mr-2" />
                    Confirmar Depósito
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowDepositInput(true)}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white h-14 rounded-2xl text-lg font-bold"
              >
                <Wallet className="w-6 h-6 mr-2" strokeWidth={2.5} />
                Recibir Depósito
              </Button>
            )}

            <Button
              onClick={() => onPaymentOption("skip")}
              variant="outline"
              className="w-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white h-12 rounded-2xl font-semibold border border-white/10"
            >
              <CheckCircle2 className="w-5 h-5 mr-2 text-green-400" />
              Marcar Listo (Sin cobrar)
            </Button>
            
            <button 
              onClick={onClose}
              className="w-full text-center text-white/40 text-sm font-medium hover:text-white mt-4 transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
