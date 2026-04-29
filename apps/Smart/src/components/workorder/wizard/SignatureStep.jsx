import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pen, Trash2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export default function SignatureStep({ formData, updateFormData }) {
  const [showDialog, setShowDialog] = useState(false);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const openSignaturePad = () => {
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  useEffect(() => {
    if (showDialog && canvasRef.current) {
      setTimeout(initCanvas, 100);
    }
  }, [showDialog]);

  const getPointerPos = (evt) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = evt.clientX || evt.touches?.[0]?.clientX || 0;
    const clientY = evt.clientY || evt.touches?.[0]?.clientY || 0;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handlePointerDown = (evt) => {
    evt.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getPointerPos(evt);
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasContent(true);
  };

  const handlePointerMove = (evt) => {
    if (!isDrawing) return;
    evt.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getPointerPos(evt);
    const ctx = canvas.getContext("2d");
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = (evt) => {
    evt.preventDefault();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasContent(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;

    const dataURL = canvas.toDataURL("image/png");
    updateFormData("signature", dataURL);
    closeDialog();
  };

  return (
    <div className="apple-surface apple-type space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="apple-text-title2 apple-label-primary">Firma del Cliente</h3>
        {formData.signature && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateFormData("signature", null)}
            className="apple-btn apple-btn-tinted text-apple-red bg-apple-red/12"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {!formData.signature ? (
        <Button
          type="button"
          onClick={openSignaturePad}
          className="apple-btn apple-btn-primary apple-btn-lg w-full"
        >
          <Pen className="w-5 h-5 mr-2" />
          Capturar Firma
        </Button>
      ) : (
        <div className="rounded-apple-md apple-card p-4 bg-white">
          <img src={formData.signature} alt="Firma del cliente" className="max-w-full h-auto mx-auto" />
          <Button
            type="button"
            variant="outline"
            onClick={openSignaturePad}
            className="apple-btn apple-btn-secondary mt-3 w-full"
          >
            Editar Firma
          </Button>
        </div>
      )}

      <div className="bg-apple-orange/12 rounded-apple-md p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={formData.terms_accepted || false}
            onCheckedChange={(checked) => updateFormData("terms_accepted", checked)}
            className="mt-0.5"
          />
          <span className="apple-text-subheadline text-apple-orange leading-relaxed">
            Acepto los términos y condiciones del servicio. Entiendo que este presupuesto puede variar según el diagnóstico final.
          </span>
        </label>
      </div>

      {/* Modal FULLSCREEN con canvas centrado */}
      <Dialog open={showDialog} onOpenChange={() => {}}>
        <DialogContent
          className="fixed inset-0 w-screen h-dvh max-w-none m-0 apple-surface border-0 flex flex-col"
          style={{ zIndex: 99999 }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader
            className="px-6 pt-6 pb-4 flex-shrink-0"
            style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
          >
            <DialogTitle className="apple-text-title2 apple-label-primary">Firma del Cliente</DialogTitle>
            <p className="apple-text-subheadline apple-label-secondary mt-2">
              Dibuja la firma con el dedo o stylus. Presiona "Guardar" cuando termines.
            </p>
          </DialogHeader>

          {/* Canvas centrado con flex */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div
              className="w-full max-w-4xl bg-white rounded-apple-md overflow-hidden shadow-apple-xl"
              style={{
                aspectRatio: "3/2",
                maxHeight: "calc(100vh - 250px)",
                touchAction: "none",
                userSelect: "none"
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onTouchCancel={handlePointerUp}
                className="w-full h-full"
                style={{
                  display: "block",
                  touchAction: "none",
                  pointerEvents: "auto",
                  cursor: "crosshair"
                }}
              />
            </div>
          </div>

          <div
            className="px-6 pb-6 pt-4 flex gap-3 justify-end flex-shrink-0"
            style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={clearCanvas}
              className="apple-btn apple-btn-secondary apple-btn-lg"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              className="apple-btn apple-btn-secondary apple-btn-lg"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveSignature}
              disabled={!hasContent}
              className="apple-btn apple-btn-primary apple-btn-lg"
            >
              <Check className="w-4 h-4 mr-2" />
              Guardar Firma
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
