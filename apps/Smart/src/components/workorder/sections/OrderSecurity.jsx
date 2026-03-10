import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Eye, EyeOff, Lock } from "lucide-react";
import SecurityEditDialog from "@/components/workorder/SecurityEditDialog";
import PatternDisplay from "@/components/security/PatternDisplay";

function safeAtob(str) {
  try {
    return atob(str || "");
  } catch (e) {
    return str || "";
  }
}

const SecurityItem = ({ label, masked, onToggle, visibleValue }) => (
  <div className="bg-black/30 border border-white/10 rounded-lg p-3 flex justify-between items-center">
    <div>
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="text-[13px] text-white font-mono tracking-widest mt-1">
        {masked ? "••••••" : visibleValue || "—"}
      </div>
    </div>
    <button className="text-gray-400 hover:text-white" onClick={onToggle}>
      {masked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  </div>
);

export default function OrderSecurity({ order, onUpdate }) {
  const o = order || {};
  const sec = o.device_security || {};
  const [showDialog, setShowDialog] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Force re-render when order changes
  useEffect(() => {
    // This effect ensures we react to order changes
  }, [order]);

  const hasAnySecurity = sec.device_pin || sec.device_password || sec.pattern_vector || sec.pattern_image;

  return (
    <>
      <Card className="bg-gradient-to-br from-purple-900/10 to-indigo-900/10 border-purple-500/20">
        <CardHeader className="border-b border-purple-500/20 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-500" />
              Seguridad
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDialog(true)}
              className="h-8 border-purple-500/30 text-purple-300 hover:bg-purple-900/20"
            >
              {hasAnySecurity ? "Editar/Ver" : "Configurar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {!hasAnySecurity ? (
            <div className="text-center py-6 text-gray-500">
              <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin seguridad configurada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sec.device_pin && (
                <SecurityItem
                  label="PIN Numérico"
                  masked={!showPin}
                  onToggle={() => setShowPin(!showPin)}
                  visibleValue={safeAtob(sec.device_pin)}
                />
              )}
              {sec.device_password && (
                <SecurityItem
                  label="Contraseña"
                  masked={!showPass}
                  onToggle={() => setShowPass(!showPass)}
                  visibleValue={safeAtob(sec.device_password)}
                />
              )}
              {sec.pattern_vector && (
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <div className="text-[11px] text-gray-400 mb-2">Patrón de Bloqueo</div>
                  <div className="flex justify-center">
                    <PatternDisplay patternVector={sec.pattern_vector} size={150} />
                  </div>
                  <p className="text-center text-xs text-purple-400 font-mono mt-2">{sec.pattern_vector}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SecurityEditDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        order={o}
        onUpdate={onUpdate}
      />
    </>
  );
}
