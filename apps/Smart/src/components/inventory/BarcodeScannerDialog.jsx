import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Scan,
  Plus,
  Minus,
  Check,
  X,
  Camera,
  Keyboard,
  Package,
  AlertCircle
} from "lucide-react";

export default function BarcodeScannerDialog({ open, onClose, onSuccess, mode = "add" }) {
  const [scanMode, setScanMode] = useState("manual"); // manual, camera
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (open && scanMode === "manual") {
      // Focus input cuando se abre el diálogo
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }

    return () => {
      // Limpiar cámara al cerrar
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [open, scanMode]);

  const handleBarcodeSubmit = async (code) => {
    if (!code.trim()) return;

    setLoading(true);
    setError("");

    try {
      // Buscar producto por SKU o código de barras
      const products = await base44.entities.Product.filter({ sku: code.trim() });

      if (!products || products.length === 0) {
        setError(`No se encontró producto con código: ${code}`);
        setProduct(null);
        setLoading(false);
        return;
      }

      const foundProduct = products[0];
      setProduct(foundProduct);
      setQuantity(1);
      setLoading(false);
    } catch (err) {
      console.error("Error searching product:", err);
      setError("Error al buscar el producto");
      setLoading(false);
    }
  };

  const handleManualInput = (e) => {
    if (e.key === "Enter") {
      handleBarcodeSubmit(barcode);
    }
  };

  const handleStartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        streamRef.current = stream;
      }

      setScanMode("camera");
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("No se pudo acceder a la cámara. Usa el modo manual.");
    }
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanMode("manual");
  };

  const handleUpdateStock = async () => {
    if (!product || quantity <= 0) return;

    setLoading(true);
    try {
      const currentStock = Number(product.stock || 0);
      const change = mode === "add" ? quantity : -quantity;
      const newStock = Math.max(0, currentStock + change);

      // Actualizar stock
      await base44.entities.Product.update(product.id, {
        stock: newStock
      });

      // Registrar movimiento
      await base44.entities.InventoryMovement.create({
        product_id: product.id,
        product_name: product.name,
        movement_type: mode === "add" ? "purchase" : "adjustment",
        quantity: change,
        previous_stock: currentStock,
        new_stock: newStock,
        reference_type: "barcode_scan",
        notes: `Escaneado: ${mode === "add" ? "Entrada" : "Salida"} de ${quantity} unidades`,
        performed_by: (await base44.auth.me().catch(() => ({})))?.full_name || "Sistema"
      });

      // Limpiar y continuar
      setProduct(null);
      setBarcode("");
      setQuantity(1);
      setError("");
      
      if (onSuccess) {
        onSuccess(product, newStock);
      }

      // Focus de nuevo en el input para siguiente escaneo
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error("Error updating stock:", err);
      setError("Error al actualizar el stock");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    handleStopCamera();
    setProduct(null);
    setBarcode("");
    setQuantity(1);
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white flex items-center gap-2">
            <Scan className="w-6 h-6 text-red-600" />
            Escanear Código de Barras
            <Badge className={mode === "add" ? "bg-green-600" : "bg-orange-600"}>
              {mode === "add" ? "Agregar Stock" : "Reducir Stock"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Selector */}
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setScanMode("manual");
                handleStopCamera();
              }}
              variant={scanMode === "manual" ? "default" : "outline"}
              className={scanMode === "manual" ? "bg-red-600" : "border-white/15"}
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Manual
            </Button>
            <Button
              onClick={handleStartCamera}
              variant={scanMode === "camera" ? "default" : "outline"}
              className={scanMode === "camera" ? "bg-red-600" : "border-white/15"}
            >
              <Camera className="w-4 h-4 mr-2" />
              Cámara
            </Button>
          </div>

          {/* Manual Input */}
          {scanMode === "manual" && (
            <div>
              <Label className="text-gray-300 mb-2 block">
                Código de Barras o SKU
              </Label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyPress={handleManualInput}
                  placeholder="Escanea o escribe el código..."
                  className="flex-1 bg-black/40 border-white/15 text-white text-lg"
                  autoFocus
                />
                <Button
                  onClick={() => handleBarcodeSubmit(barcode)}
                  disabled={!barcode.trim() || loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Scan className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                💡 Escanea con un lector de código de barras o escribe manualmente
              </p>
            </div>
          )}

          {/* Camera View */}
          {scanMode === "camera" && (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 bg-black rounded-lg"
                playsInline
              />
              <div className="absolute inset-0 border-2 border-red-600 rounded-lg pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 border-white/50" />
              </div>
              <p className="text-center text-white mt-2 text-sm">
                Coloca el código de barras en el recuadro
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Product Found */}
          {product && (
            <div className="p-4 bg-black/40 border border-white/10 rounded-lg space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{product.name}</h3>
                    <p className="text-sm text-gray-400">SKU: {product.sku}</p>
                    <p className="text-xs text-gray-500">
                      Stock actual: <span className="font-bold">{product.stock || 0}</span>
                    </p>
                  </div>
                </div>
                <Badge className="bg-blue-600/20 text-blue-300 border-blue-600/30">
                  ${Number(product.price || 0).toFixed(2)}
                </Badge>
              </div>

              {/* Quantity Selector */}
              <div>
                <Label className="text-gray-300 mb-2 block">
                  Cantidad a {mode === "add" ? "agregar" : "reducir"}
                </Label>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    variant="outline"
                    size="icon"
                    className="border-white/15"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 text-center bg-black/40 border-white/15 text-white text-xl font-bold"
                  />
                  <Button
                    onClick={() => setQuantity(quantity + 1)}
                    variant="outline"
                    size="icon"
                    className="border-white/15"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 text-right">
                    <p className="text-sm text-gray-400">Nuevo stock:</p>
                    <p className="text-2xl font-bold text-white">
                      {mode === "add" 
                        ? (Number(product.stock || 0) + quantity)
                        : Math.max(0, Number(product.stock || 0) - quantity)
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateStock}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {mode === "add" ? "Agregar al Stock" : "Reducir del Stock"}
                </Button>
                <Button
                  onClick={() => {
                    setProduct(null);
                    setBarcode("");
                    setQuantity(1);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  variant="outline"
                  className="border-white/15"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        {!product && (
          <div className="flex justify-end">
            <Button onClick={handleClose} variant="outline" className="border-white/15">
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
