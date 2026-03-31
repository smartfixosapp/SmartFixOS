import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Edit, Trash2, Lock, Unlock, Send, Clock } from "lucide-react";

export default function UserCard({ user, roles, onEdit, onDelete, onToggleActive, onResendInvite, onClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [resending, setResending] = useState(false);

  const userRole = user.position || user.role;
  const role = roles.find(r => r.value === userRole) || {
    label: "Empleado", color: "from-slate-500 to-slate-700", badge: "bg-slate-500", icon: () => null
  };
  const RoleIcon = role.icon;

  const isPending = user.status === "pending";
  const isExpired = isPending && user.activation_expires_at && new Date(user.activation_expires_at) < new Date();
  const isActive = user.active !== false;

  const nameParts = (user.full_name || "").split(" ").filter(Boolean);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
    : (nameParts[0]?.[0] || "?").toUpperCase();

  const handleResend = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    setResending(true);
    try { await onResendInvite(); } finally { setResending(false); }
  };

  return (
    <div className="relative">
      {/* Main card — clickable to open profile */}
      <button
        onClick={onClick}
        className={`group w-full text-left rounded-[22px] p-5 transition-all duration-200 active:scale-[0.98] block border ${
          isActive
            ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] hover:border-white/[0.18]"
            : "bg-white/[0.02] border-white/[0.04] opacity-60 hover:opacity-80"
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={`w-[52px] h-[52px] rounded-[16px] bg-gradient-to-br ${role.color} flex items-center justify-center shadow-lg`}>
              <span className="text-white font-black text-lg">{initials}</span>
            </div>
            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#090a0d] ${
              isActive ? "bg-emerald-400" : "bg-slate-600"
            }`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[15px] leading-tight truncate">{user.full_name}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge className={`${role.badge} text-white border-0 text-[10px] px-2 py-0 h-5`}>
                <RoleIcon className="w-2.5 h-2.5 mr-1" />
                {role.label}
              </Badge>
              {isPending && (
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                  isExpired ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                }`}>
                  {isExpired ? "EXPIRADO" : "PENDIENTE"}
                </span>
              )}
            </div>
            {user.email && (
              <p className="text-white/30 text-[11px] mt-1 truncate">{user.email}</p>
            )}
          </div>

          {/* ⋯ menu button */}
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/25 hover:text-white/60 hover:bg-white/10 transition-all flex-shrink-0"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Pending alert strip */}
        {isPending && (
          <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 ${
            isExpired ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
          }`}>
            <Clock className="w-3 h-3 flex-shrink-0" />
            <p className="text-[11px] font-semibold">
              {isExpired ? "Enlace expirado — reenvía la invitación" : "Esperando activación de cuenta"}
            </p>
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 top-14 z-50 bg-[#16171c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[190px]">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-white/80 hover:bg-white/10 text-sm transition-colors"
            >
              <Edit className="w-4 h-4" /> Editar empleado
            </button>
            <button
              onClick={handleResend}
              className="flex items-center gap-3 w-full px-4 py-3 text-white/80 hover:bg-white/10 text-sm transition-colors"
            >
              {resending
                ? <div className="w-4 h-4 border border-current/30 border-t-current rounded-full animate-spin" />
                : <Send className="w-4 h-4" />
              }
              Reenviar invitación
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleActive(); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-white/80 hover:bg-white/10 text-sm transition-colors"
            >
              {isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              {isActive ? "Desactivar" : "Activar"}
            </button>
            <div className="h-px bg-white/10" />
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
