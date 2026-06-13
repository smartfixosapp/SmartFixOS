import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight, FlaskConical } from "lucide-react";
import { LogoLockup, cx } from "../primitives";
import { TESTFLIGHT_URL, REGISTRO_PATH, NAV_LINKS } from "../constants";

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
      style={{
        height: 64,
        background: scrolled ? "rgba(10,10,10,0.72)" : "transparent",
        backdropFilter: scrolled ? "blur(16px) saturate(140%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px) saturate(140%)" : "none",
        borderBottom: scrolled ? "1px solid var(--ar-border)" : "1px solid transparent",
      }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-5 sm:px-8 xl:px-10">
        <a href="#top" className="shrink-0"><LogoLockup size={28} /></a>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors"
              style={{ color: "var(--ar-text-2)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ar-text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ar-text-2)")}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <Link
            to={REGISTRO_PATH}
            className="rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{ borderColor: "var(--ar-border)", color: "var(--ar-text)" }}
          >
            Crear mi taller
          </Link>
          <a
            href={TESTFLIGHT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ar-grad inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
          >
            <FlaskConical className="h-3.5 w-3.5" strokeWidth={2.2} />
            Probar el app
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ar-focus-ring rounded-lg p-2 md:hidden"
          style={{ color: "var(--ar-text)" }}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] md:hidden"
            style={{ background: "rgba(10,10,10,0.96)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <LogoLockup size={28} />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2" style={{ color: "var(--ar-text)" }} aria-label="Cerrar menú">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-1 px-5 pt-6">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3 font-brico text-2xl font-bold tracking-[-0.03em]" style={{ color: "var(--ar-text)" }}>
                  {l.label}
                </a>
              ))}
              <div className="mt-6 flex flex-col gap-3">
                <Link to={REGISTRO_PATH} onClick={() => setOpen(false)} className="flex h-12 items-center justify-center rounded-2xl border text-[15px] font-semibold" style={{ borderColor: "var(--ar-border)", color: "var(--ar-text)" }}>
                  Crear mi taller
                </Link>
                <a href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer" className="ar-grad flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white">
                  Probar el app <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
