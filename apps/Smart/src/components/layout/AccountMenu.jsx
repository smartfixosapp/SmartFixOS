import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Settings, LogOut, Store, Users, PackagePlus } from "lucide-react";
import { signOut } from "@/components/auth/signOut";

export function SignOutConfirm({ open, onClose }) {
  const [busy, setBusy] = useState(false);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[300] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="signout-title">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => !busy && onClose()} />
      <div className="relative w-full sm:w-[400px] flex flex-col items-center" style={{ background: "#1C1C1E", borderRadius: 28, padding: "28px 20px 20px", color: "#fff" }}>
        <span style={{ width: 76, height: 76, borderRadius: 999, background: "rgba(255,69,58,0.1)", color: "#FF453A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <LogOut className="w-8 h-8" />
        </span>
        <p id="signout-title" style={{ fontSize: 20, fontWeight: 800 }}>¿Cerrar sesión?</p>
        <p style={{ fontSize: 15, color: "#8E8E93", marginTop: 8, marginBottom: 28, textAlign: "center" }}>Se cerrará tu sesión en este dispositivo.</p>
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={async () => { setBusy(true); await signOut(); }}
            disabled={busy}
            className="apple-press w-full disabled:opacity-60"
            style={{ height: 52, borderRadius: 14, background: "#FF453A", color: "#fff", fontSize: 15, fontWeight: 600 }}
          >
            {busy ? "Cerrando…" : "Cerrar sesión"}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="apple-press w-full"
            style={{ height: 44, borderRadius: 14, background: "transparent", color: "#8E8E93", fontSize: 15, fontWeight: 500 }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AccountMenu({ name, initials }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef(null);
  let tenantName = "";
  try {
    tenantName = localStorage.getItem("smartfix_tenant_name") || "";
  } catch {
    tenantName = "";
  }

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="apple-press"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mi cuenta"
        style={{ width: 38, height: 38, borderRadius: 999, background: "#F2662E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}
      >
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-[120] w-64 overflow-hidden" style={{ background: "#1C1C1E", borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.1)" }}>
            <p className="truncate" style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{name || "Mi cuenta"}</p>
            {tenantName && (
              <p className="truncate flex items-center gap-1.5" style={{ fontSize: 13, color: "#8E8E93", marginTop: 2 }}>
                <Store className="w-3.5 h-3.5" /> {tenantName}
              </p>
            )}
          </div>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); navigate("/Equipo"); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
            style={{ color: "#fff", fontSize: 15 }}
          >
            <Users className="w-[18px] h-[18px]" /> Equipo y nómina
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); navigate("/Compras"); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
            style={{ color: "#fff", fontSize: 15 }}
          >
            <PackagePlus className="w-[18px] h-[18px]" /> Compras
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); navigate("/Settings"); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
            style={{ color: "#fff", fontSize: 15 }}
          >
            <Settings className="w-[18px] h-[18px]" /> Ajustes
          </button>
          <div style={{ height: 0.5, background: "rgba(255,255,255,0.1)" }} />
          <button
            role="menuitem"
            onClick={() => { setOpen(false); setConfirm(true); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
            style={{ color: "#FF6961", fontSize: 15 }}
          >
            <LogOut className="w-[18px] h-[18px]" /> Cerrar sesión
          </button>
        </div>
      )}
      <SignOutConfirm open={confirm} onClose={() => setConfirm(false)} />
    </div>
  );
}
