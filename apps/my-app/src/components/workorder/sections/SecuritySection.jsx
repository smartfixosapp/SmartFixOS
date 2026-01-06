import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Eye, EyeOff, Grid3X3 } from "lucide-react";
import PatternDisplay from "@/components/security/PatternDisplay";

export default function SecuritySection({ order }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showPatternModal, setShowPatternModal] = useState(false);

  const security = order.device_security || {};

  // 👈 C4) Modal del patrón con backdrop lock
  useEffect(() => {
    if (showPatternModal) {
      document.body.classList.add("modal-pattern-open");
    } else {
      document.body.classList.remove("modal-pattern-open");
    }
    return () => {
      document.body.classList.remove("modal-pattern-open");
    };
  }, [showPatternModal]);

  return (
    <>
      <style>{`
        body.modal-pattern-open {
          overflow: hidden !important;
        }
      `}</style>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Seguridad del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {security.device_password && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Contraseña</label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={security.device_password}
                  readOnly
                  className="flex-1 bg-black border border-gray-700 rounded px-3 py-2 text-white"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="border-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {security.device_pin && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">PIN</label>
              <div className="flex items-center gap-2">
                <input
                  type={showPin ? "text" : "password"}
                  value={security.device_pin}
                  readOnly
                  className="flex-1 bg-black border border-gray-700 rounded px-3 py-2 text-white font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPin(!showPin)}
                  className="border-gray-700"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {(security.pattern_image || security.pattern_vector) && (
            <div className="pt-4 border-t border-gray-800">
              <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" />
                Patrón de desbloqueo
              </label>
              <Button
                variant="outline"
                onClick={() => setShowPatternModal(true)}
                className="border-gray-700"
              >
                Ver patrón
              </Button>
            </div>
          )}

          {!security.device_password && !security.device_pin && !security.pattern_image && !security.pattern_vector && (
            <p className="text-gray-500 text-sm">No se registró información de seguridad</p>
          )}
        </CardContent>
      </Card>

      {/* Modal del patrón */}
      <Dialog open={showPatternModal} onOpenChange={setShowPatternModal}>
        <DialogContent
          style={{ zIndex: 9999 }}
          className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-900/30 max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-cyan-400" />
              Patrón de desbloqueo
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            {security.pattern_vector ? (
              <>
                <div className="flex items-center justify-center p-4">
                  <PatternDisplay patternVector={security.pattern_vector} size={240} />
                </div>
                <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-lg p-3 w-full">
                  <p className="text-xs text-cyan-300 font-mono text-center">
                    {security.pattern_vector}
                  </p>
                </div>
              </>
            ) : security.pattern_image ? (
              <div className="w-full max-w-sm">
                <img
                  src={security.pattern_image}
                  alt="Pattern"
                  className="w-full h-auto border-2 border-gray-700 rounded-lg bg-black"
                />
              </div>
            ) : null}
            
            <Button
              onClick={() => setShowPatternModal(false)}
              className="w-full bg-gradient-to-r from-cyan-600 to-cyan-800 hover:from-cyan-500 hover:to-cyan-700"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
