import React from "react";
import { Button } from "@/components/ui/button";

export default class WorkOrderPanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Error inesperado en la orden" };
  }

  componentDidCatch(error, info) {
    console.error("[WorkOrderPanelErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "" });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-[#0b0f17] p-6 text-center">
          <p className="text-sm tracking-[0.22em] text-red-300/80">Error de panel</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">No se pudo abrir esta orden</h3>
          <p className="mt-3 text-sm text-white/65">{this.state.message}</p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={this.handleReset}
            >
              Reintentar
            </Button>
            <Button
              className="bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-bold"
              onClick={this.props.onClose}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

