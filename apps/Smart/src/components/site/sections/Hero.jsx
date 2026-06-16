import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FlaskConical, ArrowRight, Inbox } from "lucide-react";
import { Container, Heading, Grad, Lede, TrustLine, GlowBlob, cx } from "../primitives";
import { PhoneMock } from "../PhoneMock";
import { BetaPill } from "../BetaPill";
import { useBetaSlots } from "../useBetaSlots";
import { EASE } from "../motion";
import { APP_STORE_URL, REGISTRO_PATH } from "../constants";
import heroShot from "../../../assets/images/screenshots/03-inicio.png";

const enter = (delay) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay },
});

export function Hero() {
  const { slots } = useBetaSlots();
  const full = slots?.status === "full";

  const scrollWaitlist = () => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section id="top" className="relative overflow-hidden pb-20 pt-28 sm:pt-32">
      <GlowBlob size={680} className="left-1/2 top-0" style={{ transform: "translate(-50%,-30%)" }} opacity={0.16} blur={90} />

      <Container className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="flex flex-col items-start">
          <motion.div {...enter(0.05)}><BetaPill /></motion.div>

          <motion.div {...enter(0.12)}>
            <Heading as="h1" size="display" className="mt-7">
              Tu taller entero,<br /><Grad>en una sola app.</Grad>
            </Heading>
          </motion.div>

          <motion.div {...enter(0.22)}>
            <Lede className="mt-6 max-w-[46ch]">
              Órdenes, caja, finanzas, inventario y tu equipo — todo conectado. Adiós libreta, calculadora, Excel y WhatsApp regado.
            </Lede>
          </motion.div>

          <motion.div {...enter(0.32)} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            {full ? (
              <button
                type="button"
                onClick={scrollWaitlist}
                className="ar-grad ar-shadow-btn ar-focus-ring inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl px-7 text-[15px] font-semibold text-white"
              >
                <Inbox className="h-4 w-4" strokeWidth={2.2} />
                <span className="flex flex-col items-start leading-tight">
                  <span>Únete al waitlist</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/80">BETA LLENA · TE AVISAMOS</span>
                </span>
              </button>
            ) : (
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ar-grad ar-shadow-btn ar-focus-ring inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl px-7 text-[15px] font-semibold text-white"
              >
                <FlaskConical className="h-4 w-4" strokeWidth={2.2} />
                <span className="flex flex-col items-start leading-tight">
                  <span className="inline-flex items-center gap-1.5">Probar el app <ArrowRight className="h-4 w-4" /></span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/80">14 DÍAS GRATIS</span>
                </span>
              </a>
            )}

            <Link
              to={REGISTRO_PATH}
              className="ar-focus-ring inline-flex h-14 items-center justify-center gap-2 rounded-2xl border px-6 text-[15px] font-semibold transition-colors"
              style={{ borderColor: "var(--ar-border)", color: "var(--ar-text)" }}
            >
              Crear mi taller desde la web <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div {...enter(0.42)} className="mt-8">
            <TrustLine>Hecho en un taller real · 911 Smart Fix · San Juan, PR</TrustLine>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
          className="flex justify-center lg:justify-end"
        >
          <PhoneMock src={heroShot} alt="Pantalla de inicio de Archilla OS" width={300} float glow />
        </motion.div>
      </Container>
    </section>
  );
}
