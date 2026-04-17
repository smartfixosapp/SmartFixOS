import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Edit, Trash2, Lock, Unlock, Send, Clock } from "lucide-react";

export default function UserCard({ user, roles, onEdit, onDelete, onToggleActive, onResendInvite, onClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [resending, setResending] = useState(false);

  const userRole = user.position || user.role;
  const role = roles.find(r => r.value === userRole) || {
    label: "Empleado", color: "bg-apple-gray", badge: "bg-apple-gray", icon: () => null
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
    <div className="apple-type relative">
      {/* Main card — clickable to open profile */}
      <button
        onClick={onClick}
        className={`group w-full text-left rounded-apple-lg p-5 transition-all duration-200 apple-press block ${
          isActive
            ? "apple-surface-elevated"
            : "apple-surface-elevated opacity-60 hover:opacity-80"
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={`w-[52px] h-[52px] rounded-apple-md ${role.badge} flex items-center justify-center shadow-apple-sm`}>
              <span className="text-white apple-text-title3">{initials}</span>
            </div>
            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-apple-surface ${
              isActive ? "bg-apple-green" : "bg-apple-gray"
            }`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="apple-label-primary apple-text-headline truncate">{user.full_name}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge className={`${role.badge} text-white border-0 apple-text-caption2 px-2 py-0 h-5`}>
                <RoleIcon className="w-2.5 h-2.5 mr-1" />
                {role.label}
              </Badge>
              {isPending && (
                <span className={`apple-text-caption2 px-1.5 py-0.5 rounded-apple-xs ${
                  isExpired ? "bg-apple-red/15 text-apple-red" : "bg-apple-orange/15 text-apple-orange"
                }`}>
                  {isExpired ? "Expirado" : "Pendiente"}
                </span>
              )}
            </div>
            {user.email && (
              <p className="apple-label-tertiary apple-text-caption1 mt-1 truncate">{user.email}</p>
            )}
          </div>

          {/* ⋯ menu button */}
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="w-8 h-8 flex items-center justify-center rounded-full apple-label-tertiary hover:bg-gray-sys6 dark:hover:bg-gray-sys5 transition-all flex-shrink-0 apple-press"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Pending alert strip */}
        {isPending && (
          <div className={`mt-3 flex items-center gap-2 rounded-apple-md px-3 py-2 ${
            isExpired ? "bg-apple-red/12 text-apple-red" : "bg-apple-orange/12 text-apple-orange"
          }`}>
            <Clock className="w-3 h-3 flex-shrink-0" />
            <p className="apple-text-caption1">
              {isExpired ? "Enlace expirado — reenvía la invitación" : "Esperando activación de cuenta"}
            </p>
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 top-14 z-50 apple-surface-elevated rounded-apple-lg shadow-apple-xl overflow-hidden min-w-[190px] border-0">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
              className="flex items-center gap-3 w-full px-4 py-3 apple-label-primary hover:bg-gray-sys6 dark:hover:bg-gray-sys5 apple-text-body transition-colors apple-press"
            >
              <Edit className="w-4 h-4" /> Editar empleado
            </button>
            <button
              onClick={handleResend}
              className="flex items-center gap-3 w-full px-4 py-3 apple-label-primary hover:bg-gray-sys6 dark:hover:bg-gray-sys5 apple-text-body transition-colors apple-press"
            >
              {resending
                ? <div className="w-4 h-4 border border-current/30 border-t-current rounded-full animate-spin" />
                : <Send className="w-4 h-4" />
              }
              Reenviar invitación
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleActive(); }}
              className="flex items-center gap-3 w-full px-4 py-3 apple-label-primary hover:bg-gray-sys6 dark:hover:bg-gray-sys5 apple-text-body transition-colors apple-press"
            >
              {isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              {isActive ? "Desactivar" : "Activar"}
            </button>
            <div style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }} />
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-apple-red hover:bg-apple-red/12 apple-text-body transition-colors apple-press"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
