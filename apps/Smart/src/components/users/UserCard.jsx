import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Code, Calendar, Lock, Unlock, Edit, Trash2, DollarSign, ChevronDown, ChevronUp, Send, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function UserCard({ user, roles, onEdit, onDelete, onToggleActive, onResendInvite }) {
  const [showPayments, setShowPayments] = React.useState(false);
  const [payments, setPayments] = React.useState([]);
  const [resending, setResending] = React.useState(false);

  const userRole = user.position || user.role;
  const role = roles.find(r => r.value === userRole) || roles[2];
  const RoleIcon = role.icon;

  const isPending = user.status === "pending";
  const isExpired = isPending && user.activation_expires_at && new Date(user.activation_expires_at) < new Date();

  React.useEffect(() => {
    if (showPayments) {
      loadPayments();
    }
  }, [showPayments]);

  const loadPayments = async () => {
    try {
      const { dataClient } = await import("@/components/api/dataClient");
      const data = await dataClient.entities.EmployeePayment.filter(
        { employee_id: user.id },
        "-created_date",
        10
      );
      setPayments(data || []);
    } catch (error) {
      console.error("Error loading payments:", error);
    }
  };

  const handleResend = async (e) => {
    e.stopPropagation();
    setResending(true);
    try {
      await onResendInvite();
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className={`group relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border rounded-3xl p-6 transition-all duration-300 hover:scale-[1.02] theme-light:bg-white ${
        user.active
          ? 'border-cyan-500/20 hover:border-cyan-500/50 hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]'
          : 'border-slate-800/30 opacity-60'
      }`}
    >
      {/* Efecto de brillo */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header con avatar y estado */}
      <div className="relative flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-r ${role.color} blur-xl opacity-60 rounded-2xl`} />
            <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${role.color} flex items-center justify-center shadow-lg`}>
              <span className="text-white font-black text-2xl">
                {user.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg leading-tight mb-1 theme-light:text-gray-900">
              {user.full_name}
            </h3>
            <Badge className={`${role.badge} text-white border-0 shadow-lg`}>
              <RoleIcon className="w-3 h-3 mr-1" />
              {role.label}
            </Badge>
          </div>
        </div>

        {/* Indicador de estado */}
        <div className="flex flex-col items-end gap-1.5">
          {user.active ? (
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400 blur-md opacity-60 rounded-full animate-pulse" />
              <div className="relative w-3 h-3 rounded-full bg-emerald-400" />
            </div>
          ) : (
            <div className="w-3 h-3 rounded-full bg-slate-600" />
          )}
          {/* Badge pendiente/expirado */}
          {isPending && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              isExpired
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              {isExpired ? "EXPIRADO" : "PENDIENTE"}
            </span>
          )}
        </div>
      </div>

      {/* Alerta invitación pendiente */}
      {isPending && (
        <div className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-4 border ${
          isExpired
            ? "bg-red-500/10 border-red-500/20"
            : "bg-amber-500/10 border-amber-500/20"
        }`}>
          <Clock className={`w-3.5 h-3.5 shrink-0 ${isExpired ? "text-red-400" : "text-amber-400"}`} />
          <p className={`text-[11px] font-semibold leading-tight ${isExpired ? "text-red-300" : "text-amber-300"}`}>
            {isExpired
              ? "El enlace de activación venció. Reenvía la invitación."
              : "Esperando que el empleado active su cuenta."}
          </p>
        </div>
      )}

      {/* Información del usuario */}
      <div className="relative space-y-3 mb-6">
        {user.employee_code && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
              <Code className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-mono text-cyan-300 theme-light:text-gray-700">{user.employee_code}</span>
          </div>
        )}
        {user.email && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-slate-300 truncate theme-light:text-gray-700">{user.email}</span>
          </div>
        )}
        {user.phone && (
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-slate-300 theme-light:text-gray-700">{user.phone}</span>
          </div>
        )}
        {user.created_date && (
          <div className="flex items-center gap-3 text-xs pt-2 border-t border-cyan-500/10">
            <Calendar className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span className="text-slate-500">
              Desde {format(new Date(user.created_date), "dd/MM/yyyy", { locale: es })}
            </span>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="relative flex gap-2">
        <Button
          size="sm"
          onClick={onEdit}
          className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 h-10 rounded-xl shadow-lg"
        >
          <Edit className="w-4 h-4 mr-1" />
          Editar
        </Button>
        {/* Botón reenviar — siempre visible para poder corregir email */}
        <Button
          size="sm"
          variant="outline"
          disabled={resending}
          onClick={handleResend}
          title="Reenviar invitación"
          className={`h-10 rounded-xl border transition-all ${
            isPending
              ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10 bg-amber-500/5"
              : "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          }`}
        >
          {resending
            ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            setShowPayments(!showPayments);
          }}
          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/10 h-10 rounded-xl"
        >
          <DollarSign className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive();
          }}
          className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/10 h-10 rounded-xl"
        >
          {user.active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="border-red-500/30 text-red-400 hover:bg-red-600/10 h-10 rounded-xl"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Historial de pagos */}
      {showPayments && (
        <div className="relative mt-4 pt-4 border-t border-cyan-500/20">
          <h4 className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-2 theme-light:text-emerald-600">
            <DollarSign className="w-4 h-4" />
            Últimos Pagos Recibidos
          </h4>
          {payments.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4 theme-light:text-gray-400">
              Sin pagos registrados
            </p>
          ) : (
            <div className="space-y-2">
              {payments.map(payment => {
                const paymentTypes = {
                  salary: "💵 Salario",
                  bonus: "🎁 Bono",
                  commission: "💰 Comisión",
                  advance: "⚡ Adelanto",
                  other: "📋 Otro"
                };
                return (
                  <div key={payment.id} className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 theme-light:bg-emerald-50">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-sm font-bold text-emerald-400 theme-light:text-emerald-600">
                          ${payment.amount?.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-400 theme-light:text-gray-600">
                          {paymentTypes[payment.payment_type] || payment.payment_type}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 theme-light:text-gray-500">
                        {new Date(payment.created_date).toLocaleDateString()}
                      </p>
                    </div>
                    {payment.notes && (
                      <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-emerald-500/10 theme-light:text-gray-600">
                        {payment.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
