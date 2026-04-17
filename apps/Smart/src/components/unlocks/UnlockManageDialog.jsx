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
  { value: "received", label: "Recibido", color: "bg-apple-blue", icon: "📥" },
  { value: "in_progress", label: "En Progreso", color: "bg-apple-yellow", icon: "⚙️" },
  { value: "completed", label: "Terminado", color: "bg-apple-green", icon: "✅" },
  { value: "ready_to_deliver", label: "Listo p/ Entregar", color: "bg-apple-purple", icon: "📦" },
  { value: "delivered", label: "Entregado", color: "bg-gray-sys3", icon: "🎉" },
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
    <div className="apple-type fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" onClick={onClose} />

      <div className="relative z-[10000] apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-apple-lg ${
              isPaid
                ? 'bg-apple-green'
                : 'bg-apple-blue'
            }`}>
              {isPaid ? (
                <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={3} />
              ) : (
                <Smartphone className="w-8 h-8 text-white" strokeWidth={2.5} />
              )}
            </div>
            <div>
              <h2 className="apple-text-title2 apple-label-primary">{unlock.customer_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="apple-label-secondary apple-text-subheadline tabular-nums">#{unlock.order_number}</p>
                {currentStatus && (
                  <Badge className={`${currentStatus.color} text-white apple-text-caption1 border-0`}>
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
                className="text-apple-blue hover:bg-apple-blue/12"
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
              className="text-apple-blue hover:bg-apple-blue/12"
            >
              {editMode ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </Button>
            <Button
              onClick={onClose}
              size="icon"
              variant="ghost"
              aria-label="Cerrar diálogo de desbloqueo"
              className="apple-label-tertiary hover:apple-label-primary"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Información del Desbloqueo */}
        {editMode ? (
          <div className="space-y-4 mb-6 apple-card border-0 rounded-apple-md p-6">
            <h3 className="apple-label-primary apple-text-headline mb-4">Editar Información</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="apple-text-caption1 apple-label-tertiary mb-2 block">Marca</label>
                <Input
                  value={editData.device_brand}
                  onChange={(e) => setEditData({...editData, device_brand: e.target.value})}
                  className="apple-input h-11"
                />
              </div>
              <div>
                <label className="apple-text-caption1 apple-label-tertiary mb-2 block">Modelo</label>
                <Input
                  value={editData.device_model}
                  onChange={(e) => setEditData({...editData, device_model: e.target.value})}
                  className="apple-input h-11"
                />
              </div>
            </div>

            <div>
              <label className="apple-text-caption1 apple-label-tertiary mb-2 block">IMEI / Serial</label>
              <Input
                value={editData.device_serial}
                onChange={(e) => setEditData({...editData, device_serial: e.target.value})}
                className="apple-input h-11 font-mono"
              />
            </div>

            <div>
              <label className="apple-text-caption1 apple-label-tertiary mb-2 block">Precio Total</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 apple-label-tertiary">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editData.cost_estimate}
                  onChange={(e) => setEditData({...editData, cost_estimate: e.target.value})}
                  className="apple-input h-11 pl-8 font-semibold tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="apple-text-caption1 apple-label-tertiary mb-2 block">Estado del Desbloqueo</label>
              <div className="grid grid-cols-2 gap-2">
                {UNLOCK_STATUSES.map(status => (
                  <button
                    key={status.value}
                    onClick={() => setEditData({...editData, unlock_status: status.value})}
                    className={`apple-press px-3 py-2 rounded-apple-sm apple-text-caption1 font-semibold transition-all ${
                      editData.unlock_status === status.value
                        ? `${status.color} text-white`
                        : 'bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary'
                    }`}
                  >
                    {status.icon} {status.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="apple-text-caption1 apple-label-tertiary mb-2 block">URL de Seguimiento (opcional)</label>
              <Input
                value={editData.tracking_url}
                onChange={(e) => setEditData({...editData, tracking_url: e.target.value})}
                className="apple-input h-11 apple-text-footnote"
                placeholder="https://gsmunlock.com/order/..."
              />
              <p className="apple-text-caption2 apple-label-tertiary mt-1">Link para verificar estado en el proveedor</p>
            </div>

            <div>
              <label className="apple-text-caption1 apple-label-tertiary mb-2 block">Notas</label>
              <Input
                value={editData.notes}
                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                className="apple-input h-11"
                placeholder="Notas adicionales..."
              />
            </div>

            <Button
              onClick={handleSaveEdits}
              className="apple-btn apple-btn-primary apple-btn-lg w-full"
            >
              <Save className="w-5 h-5 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {/* Info del dispositivo */}
            <div className="apple-card border-0 rounded-apple-md p-5">
              <h3 className="apple-label-tertiary apple-text-caption1 font-semibold mb-3">Dispositivo</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="apple-label-secondary apple-text-subheadline">Equipo</span>
                  <span className="apple-label-primary font-semibold apple-text-subheadline">{unlock.device_brand} {unlock.device_model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="apple-label-secondary apple-text-subheadline">IMEI/Serial</span>
                  <span className="apple-label-primary font-mono apple-text-footnote">{unlock.device_serial || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="apple-label-secondary apple-text-subheadline">Servicio</span>
                  <span className="apple-label-primary apple-text-footnote">{unlock.initial_problem?.split('\n')[0] || "Desbloqueo"}</span>
                </div>
              </div>
            </div>

            {/* Info financiera */}
            <div className={`rounded-apple-md p-6 ${
              isPaid
                ? 'bg-apple-green/12'
                : 'apple-card border-0'
            }`}>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="apple-label-secondary apple-text-subheadline">Precio Total</span>
                  <span className="apple-label-primary font-semibold apple-text-headline tabular-nums">${total.toFixed(2)}</span>
                </div>
                {paid > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-apple-green apple-text-subheadline">Pagado</span>
                    <span className="text-apple-green font-semibold tabular-nums">-${paid.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }} />
                <div className="flex justify-between items-center">
                  <span className="apple-label-primary font-semibold apple-text-body">Balance Pendiente</span>
                  <span className={`apple-text-title1 font-bold tabular-nums ${isPaid ? 'text-apple-green' : 'apple-label-primary'}`}>
                    ${balance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Estado y Tracking */}
            <div className="apple-card border-0 rounded-apple-md p-5">
              <h3 className="apple-label-tertiary apple-text-caption1 font-semibold mb-3">Estado</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowStatusEdit(!showStatusEdit)}
                  className={`apple-press w-full px-4 py-3 rounded-apple-sm transition-all text-left ${
                    showStatusEdit
                      ? 'bg-apple-blue/12'
                      : 'bg-gray-sys6 dark:bg-gray-sys5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`apple-text-subheadline font-semibold text-white ${currentStatus.color} px-3 py-1 rounded-apple-xs`}>
                      {currentStatus.icon} {currentStatus.label}
                    </span>
                    <Edit2 className="w-4 h-4 apple-label-tertiary" />
                  </div>
                </button>

                {showStatusEdit && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
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
                        className={`apple-press px-3 py-2 rounded-apple-sm apple-text-caption1 font-semibold transition-all ${
                          unlock.unlock_status === status.value
                            ? `${status.color} text-white`
                            : 'bg-white dark:bg-gray-sys6 apple-label-secondary'
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
                    className="apple-press w-full px-4 py-2 bg-apple-blue/12 rounded-apple-sm text-apple-blue font-semibold flex items-center justify-center gap-2 transition-all apple-text-footnote"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver Estado en Proveedor
                  </button>
                )}
              </div>
            </div>

            {/* Contacto del cliente */}
            <div className="apple-card border-0 rounded-apple-md p-5">
              <h3 className="apple-label-tertiary apple-text-caption1 font-semibold mb-3">Cliente</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 apple-label-tertiary" />
                  <span className="apple-label-primary apple-text-body">{unlock.customer_name}</span>
                </div>
                {unlock.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 apple-label-tertiary" />
                    <span className="apple-label-secondary apple-text-footnote tabular-nums">{unlock.customer_phone}</span>
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
              className="apple-btn apple-btn-lg w-full bg-apple-green hover:bg-apple-green text-white h-14 rounded-apple-md apple-text-headline font-semibold shadow-apple-md"
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
                      className={`apple-press flex-1 py-2 rounded-apple-sm apple-text-footnote font-semibold transition-all tabular-nums ${
                        customDepositAmount === amt.toString()
                          ? 'bg-apple-blue text-white'
                          : 'bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary'
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 apple-text-headline font-semibold apple-label-tertiary">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={customDepositAmount}
                    onChange={(e) => setCustomDepositAmount(e.target.value)}
                    placeholder="Monto del depósito"
                    className="apple-input pl-10 h-14 apple-text-title2 font-semibold text-center tabular-nums"
                    autoFocus
                  />
                </div>

                {customDepositAmount && parseFloat(customDepositAmount) > balance && (
                  <div className="flex items-center gap-2 text-apple-red apple-text-footnote">
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
                    className="apple-btn apple-btn-secondary flex-1 h-12"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleDepositClick}
                    disabled={!customDepositAmount || parseFloat(customDepositAmount) <= 0 || parseFloat(customDepositAmount) > balance}
                    className="apple-btn apple-btn-primary flex-1 h-12 font-semibold"
                  >
                    <Wallet className="w-5 h-5 mr-2" />
                    Confirmar Depósito
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowDepositInput(true)}
                className="apple-btn apple-btn-lg w-full bg-apple-blue hover:bg-apple-blue text-white h-14 rounded-apple-md apple-text-headline font-semibold"
              >
                <Wallet className="w-6 h-6 mr-2" strokeWidth={2.5} />
                Recibir Depósito
              </Button>
            )}

            <Button
              onClick={() => onPaymentOption("skip")}
              variant="outline"
              className="apple-btn apple-btn-secondary w-full h-12 rounded-apple-md font-semibold"
            >
              <CheckCircle2 className="w-5 h-5 mr-2 text-apple-green" />
              Marcar Listo (Sin cobrar)
            </Button>

            <button
              onClick={onClose}
              className="w-full text-center apple-label-tertiary apple-text-footnote font-medium hover:apple-label-primary mt-4 transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
