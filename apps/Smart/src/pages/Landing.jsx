import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { NavBar } from "../components/site/sections/NavBar";
import { Hero } from "../components/site/sections/Hero";
import { Reemplaza5 } from "../components/site/sections/Reemplaza5";
import { UnDiaEnTuTaller } from "../components/site/sections/UnDiaEnTuTaller";
import { Modulos } from "../components/site/sections/Modulos";
import { AntesDespues } from "../components/site/sections/AntesDespues";
import { VistaPreviaTour } from "../components/site/sections/VistaPreviaTour";
import { ComoEntrar } from "../components/site/sections/ComoEntrar";
import { Historia } from "../components/site/sections/Historia";
import { PruebaSocial } from "../components/site/sections/PruebaSocial";
import { Planes } from "../components/site/sections/Planes";
import { FAQ } from "../components/site/sections/FAQ";
import { Waitlist } from "../components/site/sections/Waitlist";
import { Footer } from "../components/site/sections/Footer";

function HashHandoffNotice() {
  const [tokens, setTokens] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const captured = window.__SFOS_AUTH_HASH;
    if (captured && captured.indexOf("access_token") !== -1) {
      setTokens(captured);
      try { delete window.__SFOS_AUTH_HASH; } catch (_) {}
    }
  }, []);

  if (!tokens || dismissed) return null;

  const deepLink = `smartfixos://auth-callback${tokens}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md rounded-2xl border p-8 text-center" style={{ background: "var(--ar-card)", borderColor: "var(--ar-border)" }}>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(255,87,34,0.15)" }}>
          <CheckCircle2 className="h-7 w-7" style={{ color: "var(--ar-accent)" }} />
        </div>
        <h2 className="font-brico text-2xl font-bold tracking-[-0.03em]" style={{ color: "var(--ar-text)" }}>
          Casi listo
        </h2>
        <p className="mb-7 mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ar-text-2)" }}>
          Tu enlace de acceso está listo. Abre la app Archilla OS para terminar de iniciar sesión.
        </p>
        <a href={deepLink} className="ar-grad mb-3 block w-full rounded-xl py-3.5 font-semibold text-white">
          Abrir en Archilla OS
        </a>
        <button onClick={() => setDismissed(true)} className="block w-full py-2 text-[13px]" style={{ color: "var(--ar-text-3)" }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh scroll-smooth antialiased" style={{ background: "var(--ar-bg)", color: "var(--ar-text)" }}>
      <HashHandoffNotice />
      <NavBar />
      <main>
        <Hero />
        <Reemplaza5 />
        <UnDiaEnTuTaller />
        <Modulos />
        <AntesDespues />
        <VistaPreviaTour />
        <ComoEntrar />
        <Historia />
        <PruebaSocial />
        <Planes />
        <FAQ />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
