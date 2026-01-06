import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Settings, ChevronRight, Building2, Users
} from "lucide-react";

export default function SettingsMobile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-slate-950 p-4 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-cyan-500" />
          Configuración
        </h1>
        <p className="text-gray-400 text-sm mt-1">Administración del sistema</p>
      </div>

      <div className="space-y-3">
        {(user?.role === "admin" || user?.role === "manager") && (
          <>
            <button
              onClick={() => navigate("/Settings")}
              className="w-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-4 hover:border-purple-500/50 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Configuración General</p>
                    <p className="text-purple-300 text-xs">Empresa, temas, pagos</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          </>
        )}

        <button
          onClick={() => navigate("/")}
          className="w-full bg-gradient-to-br from-gray-700/20 to-gray-900/20 border border-gray-600/30 rounded-xl p-4 hover:border-gray-500/50 transition-all text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-bold">Volver al Inicio</p>
                <p className="text-gray-400 text-xs">Dashboard principal</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>
    </div>
  );
}
