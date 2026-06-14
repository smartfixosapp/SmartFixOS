import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Container, LogoLockup } from "../primitives";
import { EASE } from "../motion";
import { TESTFLIGHT_URL, REGISTRO_PATH, CUENTA_PATH } from "../constants";

const linkClass = "font-mono text-[13px] transition-colors";
const linkStyle = { color: "var(--ar-text-3)" };
const onEnter = (e) => { e.currentTarget.style.color = "var(--ar-text)"; };
const onLeave = (e) => { e.currentTarget.style.color = "var(--ar-text-3)"; };

function FooterAnchor({ href, children }) {
  return (
    <a href={href} className={linkClass} style={linkStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </a>
  );
}

function FooterRoute({ to, children }) {
  return (
    <Link to={to} className={linkClass} style={linkStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </Link>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div className="flex flex-col gap-3">
      <span
        className="font-mono uppercase"
        style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--ar-text-2)" }}
      >
        {title}
      </span>
      <nav className="flex flex-col gap-2.5">{children}</nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-ar-line">
      <Container className="py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="grid gap-12 md:grid-cols-[1.2fr_2fr] md:gap-16">
            <div className="flex flex-col items-start gap-4">
              <LogoLockup size={28} />
              <p className="text-[15px] leading-[1.5]" style={{ color: "var(--ar-text-2)" }}>
                Sistema operativo para tu taller.
              </p>
              <p className="font-mono text-[13px]" style={{ color: "var(--ar-text-3)" }}>
                Hecho en Puerto Rico 🇵🇷
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <FooterColumn title="Producto">
                <FooterAnchor href="#modulos">Módulos</FooterAnchor>
                <FooterAnchor href="#planes">Planes</FooterAnchor>
                <FooterAnchor href="#como-entra">Cómo entra</FooterAnchor>
                <FooterAnchor href="#por-dentro">Tour</FooterAnchor>
              </FooterColumn>

              <FooterColumn title="Cuenta">
                <FooterRoute to={REGISTRO_PATH}>Crear mi taller</FooterRoute>
                <FooterRoute to={CUENTA_PATH}>Entrar</FooterRoute>
                <a
                  href={TESTFLIGHT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                  style={linkStyle}
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                >
                  Descargar el app
                </a>
              </FooterColumn>

              <FooterColumn title="Legal">
                <FooterRoute to="/legal/terms">Términos</FooterRoute>
                <FooterRoute to="/legal/refunds">Reembolsos</FooterRoute>
              </FooterColumn>
            </div>
          </div>

          <div
            className="mt-14 flex flex-col gap-3 border-t pt-7 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--ar-border)" }}
          >
            <span className="font-mono text-[12px]" style={{ color: "var(--ar-text-3)" }}>
              © 2026 Archilla OS · 911 Smart Fix · San Juan, PR
            </span>
            <span
              className="font-mono text-[12px]"
              style={{ fontStyle: "italic", color: "var(--ar-text-3)" }}
            >
              De técnico a creador.
            </span>
          </div>
        </motion.div>
      </Container>
    </footer>
  );
}
