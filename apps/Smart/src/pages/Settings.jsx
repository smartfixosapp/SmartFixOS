import React, { useState } from "react";
import { LogOut } from "lucide-react";
import MasterSettingsHub from "@/components/settings/MasterSettingsHub";
import { SignOutConfirm } from "@/components/layout/AccountMenu";

export default function Settings() {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="apple-type min-h-dvh pb-24" style={{ background: "#000", color: "#fff" }}>
      <MasterSettingsHub />
      <div className="app-container pt-2">
        <p style={{ fontSize: 13, color: "#8E8E93", letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 8px 16px" }}>Cuenta</p>
        <button
          onClick={() => setConfirm(true)}
          className="apple-press w-full flex items-center gap-3 text-left"
          style={{ background: "#1C1C1E", borderRadius: 16, padding: "14px 16px", color: "#FF6961", fontSize: 16, fontWeight: 600 }}
        >
          <span style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,69,58,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut className="w-4 h-4" />
          </span>
          Cerrar sesión
        </button>
      </div>
      <SignOutConfirm open={confirm} onClose={() => setConfirm(false)} />
    </div>
  );
}
