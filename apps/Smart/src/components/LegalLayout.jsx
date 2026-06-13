import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Shared layout for /legal/* pages: terms, privacy, refunds.
 *
 * Design language matches the public Landing — dark bg, Bricolage Grotesque
 * for headings, Inter for body. Reads like a clean editorial document, not
 * a wall of legalese. All children should be plain prose; this layout
 * provides spacing + typography + the back-to-home nav.
 *
 * Usage:
 *   <LegalLayout title="Términos y Condiciones" eyebrow="Legal" lastUpdated="23 mayo 2026">
 *     <h2>1. Acceso al servicio</h2>
 *     <p>...</p>
 *   </LegalLayout>
 */
export default function LegalLayout({ title, eyebrow, lastUpdated, children }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans">
      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center font-[700] tracking-[-0.04em] text-white text-2xl leading-none select-none hover:opacity-80 transition-opacity"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
            aria-label="Volver a archillaos.com"
          >
            <span>smartfix</span>
            <span
              className="inline-grid place-items-center mx-[-0.02em]"
              style={{ width: "0.92em", height: "0.92em" }}
              aria-hidden
            >
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", animation: "sfx-gear-spin-legal 14s linear infinite", transformOrigin: "50% 50%" }}>
                <defs>
                  <clipPath id="legal-gear-clip">
                    <path d="M 90.57 39.13 L 91.48 43.43 L 99.38 42.18 L 99.38 57.82 L 91.48 56.57 L 90.57 60.87 L 89.21 65.05 L 96.68 67.92 L 88.86 81.47 L 82.64 76.43 L 79.70 79.70 L 76.43 82.64 L 81.47 88.86 L 67.92 96.68 L 65.05 89.21 L 60.87 90.57 L 56.57 91.48 L 57.82 99.38 L 42.18 99.38 L 43.43 91.48 L 39.13 90.57 L 34.95 89.21 L 32.08 96.68 L 18.53 88.86 L 23.57 82.64 L 20.30 79.70 L 17.36 76.43 L 11.14 81.47 L 3.32 67.92 L 10.79 65.05 L 9.43 60.87 L 8.52 56.57 L 0.62 57.82 L 0.62 42.18 L 8.52 43.43 L 9.43 39.13 L 10.79 34.95 L 3.32 32.08 L 11.14 18.53 L 17.36 23.57 L 20.30 20.30 L 23.57 17.36 L 18.53 11.14 L 32.08 3.32 L 34.95 10.79 L 39.13 9.43 L 43.43 8.52 L 42.18 0.62 L 57.82 0.62 L 56.57 8.52 L 60.87 9.43 L 65.05 10.79 L 67.92 3.32 L 81.47 11.14 L 76.43 17.36 L 79.70 20.30 L 82.64 23.57 L 88.86 18.53 L 96.68 32.08 L 89.21 34.95 L 90.57 39.13 Z" />
                  </clipPath>
                </defs>
                <g clipPath="url(#legal-gear-clip)">
                  <rect x="0" y="0" width="50" height="100" fill="#1FA0DC" />
                  <rect x="50" y="0" width="50" height="100" fill="#8FC93F" />
                </g>
                <circle cx="50" cy="50" r="22" fill="#0a0a0a" />
              </svg>
            </span>
            <span>s</span>
            <style>{`@keyframes sfx-gear-spin-legal { to { transform: rotate(360deg); } }`}</style>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </div>
      </header>

      {/* Document */}
      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        {eyebrow && (
          <div className="inline-flex items-center gap-2.5 mb-8">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "#8FC93F", boxShadow: "0 0 10px #8FC93F" }}
            />
            <span className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/45">
              {eyebrow}
            </span>
          </div>
        )}

        <h1
          className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
        >
          {title}
        </h1>

        {lastUpdated && (
          <p className="mt-4 text-[13px] text-white/40">
            Última actualización: {lastUpdated}
          </p>
        )}

        <div className="legal-prose mt-12">
          {children}
        </div>

        {/* Footer note */}
        <div className="mt-20 pt-10 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <p className="text-[13px] text-white/45">
            ¿Preguntas legales? Escríbenos a{" "}
            <a
              href="mailto:archillastudios@gmail.com"
              className="text-white hover:underline underline-offset-4 decoration-white/30"
            >
              archillastudios@gmail.com
            </a>
          </p>
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap text-[11px] uppercase tracking-[0.22em] text-white/25">
            <Link to="/legal/terms" className="hover:text-white/55 transition-colors">Términos</Link>
            <Link to="/legal/privacy" className="hover:text-white/55 transition-colors">Privacidad</Link>
            <Link to="/legal/refunds" className="hover:text-white/55 transition-colors">Refunds</Link>
          </div>
        </div>
      </main>

      {/* Prose styles — local to legal pages so we don't pull a full prose plugin */}
      <style>{`
        .legal-prose {
          color: rgba(255, 255, 255, 0.72);
          font-size: 16px;
          line-height: 1.72;
        }
        .legal-prose h2 {
          color: white;
          font-family: "Bricolage Grotesque", system-ui, sans-serif;
          font-weight: 600;
          font-size: 22px;
          line-height: 1.25;
          letter-spacing: -0.01em;
          margin: 48px 0 16px;
        }
        .legal-prose h3 {
          color: rgba(255, 255, 255, 0.92);
          font-weight: 600;
          font-size: 16.5px;
          margin: 32px 0 10px;
        }
        .legal-prose p { margin: 16px 0; }
        .legal-prose ul, .legal-prose ol { margin: 16px 0; padding-left: 22px; }
        .legal-prose ul { list-style: disc; }
        .legal-prose ol { list-style: decimal; }
        .legal-prose li { margin: 6px 0; }
        .legal-prose strong { color: white; font-weight: 600; }
        .legal-prose a {
          color: white;
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: rgba(255, 255, 255, 0.3);
          transition: text-decoration-color 0.15s;
        }
        .legal-prose a:hover { text-decoration-color: rgba(255, 255, 255, 0.7); }
        .legal-prose code {
          font-family: ui-monospace, "SF Mono", monospace;
          font-size: 0.92em;
          background: rgba(255,255,255,0.06);
          padding: 1px 6px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
