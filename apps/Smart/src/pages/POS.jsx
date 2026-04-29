import React, { useState, useEffect } from "react";
import POSMobile from "./POSMobile.jsx";
import POSDesktop from "./POSDesktop.jsx";

class POSErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("POS render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-black text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full border border-red-500/40 rounded-2xl p-6 bg-red-950/20">
            <h2 className="text-xl font-bold text-red-300 mb-2">Error en POS</h2>
            <p className="text-sm text-red-200 mb-4">
              Se detectó un error de renderizado en la pantalla POS.
            </p>
            <pre className="text-xs text-red-100 bg-black/40 p-3 rounded-lg overflow-auto max-h-52">
              {String(this.state.error?.message || "Error desconocido")}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
            >
              Recargar POS
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function POS() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <POSErrorBoundary>
      {isMobile ? <POSMobile /> : <POSDesktop />}
    </POSErrorBoundary>
  );
}
