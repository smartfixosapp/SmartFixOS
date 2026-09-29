import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import appClient from "@/api/appClient";
import ExecutiveDashboard from "@/components/dashboard/ExecutiveDashboard";
import AccountMenu from "@/components/layout/AccountMenu";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    appClient.auth.me().then(setUser).catch(() => {});
  }, []);

  const firstName = (user?.full_name || user?.email || "").split(/[\s@]/)[0] || "";
  const initials = firstName.slice(0, 2).toUpperCase() || "?";

  return (
    <div className="apple-type min-h-dvh pb-16" style={{ background: "#000", color: "#fff" }}>
      <div className="app-container pt-6 pb-3" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>Inicio</h1>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
            Hola{firstName ? `, ${firstName}` : ""}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => navigate("/Settings")}
              className="apple-press"
              style={{ width: 38, height: 38, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <Settings className="w-4 h-4" style={{ color: "#fff" }} />
            </button>
            <AccountMenu name={user?.full_name || user?.email || ""} initials={initials} />
          </div>
        </div>
      </div>

      <div className="app-container">
        <ExecutiveDashboard />
      </div>
    </div>
  );
}
