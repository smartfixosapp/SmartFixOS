import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, Grid3X3, Copy } from "lucide-react";
import { toast } from "sonner";
import PatternDisplay from "../security/PatternDisplay";

/**
 * Componente para mostrar información de seguridad de la orden
 * Muestra PIN, Password y Patrón de Android de forma segura
 */
export default function SecurityInfoCard({ order }) {
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Desencriptar datos (base64)
  const decrypt = (data) => {
    try {
      return atob(data);
    } catch {
      return data;
    }
  };

  const security = order?.device_security || {};
  const hasPin = !!security.device_pin;
  const hasPassword = !!security.device_password;
  const hasPattern = !!security.pattern_vector;

  const decryptedPin = hasPin ? decrypt(security.device_pin) : "";
  const decryptedPassword = hasPassword ? decrypt(security.device_password) : "";

  // Parsear patrón: "pattern:0-1-4-7" → [0, 1, 4, 7]
  const parsePattern = () => {
    if (!hasPattern) return [];
    try {
      const vectorPart = security.pattern_vector.replace('pattern:', '');
      return vectorPart.split('-').map(n => parseInt(n));
    } catch {
      return [];
    }
  };

  const patternPath = parsePattern();

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  if (!hasPin && !hasPassword && !hasPattern) {
    return (
      <Card className="bg-black/40 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-500" />
            Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No hay datos de seguridad registrados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-amber-600/10 to-orange-600/10 border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" />
          🔐 Seguridad del Dispositivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PIN */}
        {hasPin && (
          <div className="bg-black/30 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-amber-300 font-semibold">PIN</p>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(decryptedPin, "PIN")}
                  className="h-8 w-8 text-gray-400 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowPin(!showPin)}
                  className="h-8 w-8 text-gray-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-white font-mono text-lg tracking-widest">
              {showPin ? decryptedPin : "••••••"}
            </p>
          </div>
        )}

        {/* Password */}
        {hasPassword && (
          <div className="bg-black/30 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-amber-300 font-semibold">Password</p>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(decryptedPassword, "Password")}
                  className="h-8 w-8 text-gray-400 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-8 w-8 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-white font-mono text-sm break-all">
              {showPassword ? decryptedPassword : "••••••••"}
            </p>
          </div>
        )}

        {/* Patrón Android */}
        {hasPattern && (
          <div className="bg-black/30 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-amber-400" />
                <p className="text-xs text-amber-300 font-semibold">Patrón de Android</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => copyToClipboard(security.pattern_vector, "Patrón")}
                className="h-8 w-8 text-gray-400 hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            {/* Canvas visual del patrón */}
            <div className="flex items-center justify-center mb-3">
              <PatternDisplay patternVector={security.pattern_vector} size={180} />
            </div>

            {/* Secuencia en texto */}
            <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-lg p-2">
              <p className="text-xs text-cyan-300 font-mono text-center">
                Secuencia: {patternPath.map((n, i) => `${i > 0 ? ' → ' : ''}${n}`).join('')}
              </p>
            </div>

            {/* Código raw */}
            <p className="text-[10px] text-gray-500 mt-2 font-mono text-center">
              {security.pattern_vector}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
