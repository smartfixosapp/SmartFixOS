import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";
import { Section, Heading, Lede, ButtonPrimary, ButtonSecondary, GlowBlob, cx } from "../primitives";
import { EASE, VIEWPORT, fadeUp } from "../motion";
import { TESTFLIGHT_URL, REGISTRO_PATH } from "../constants";
import { supabase } from "../../../../../../lib/supabase-client.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function CheckDraw() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <motion.path
        d="M5 12.5l4 4L19 7"
        stroke="var(--ar-ok)"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
      />
    </svg>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [invalid, setInvalid] = useState(false);

  const sending = status === "sending";
  const success = status === "success";
  const error = status === "error";

  const validate = () => {
    const ok = EMAIL_RE.test(email.trim());
    setInvalid(email.length > 0 && !ok);
    return ok;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setInvalid(true);
      return;
    }

    setStatus("sending");
    try {
      const { error: insertError } = await supabase
        .from("waitlist")
        .insert({ email: trimmed, source: "beta-final" });

      if (insertError && insertError.code !== "23505") throw insertError;
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="inline-flex items-center gap-3 rounded-2xl border px-5 py-4"
        style={{ borderColor: "var(--ar-ok)", background: "rgba(62,197,177,0.08)" }}
      >
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "rgba(62,197,177,0.14)" }}
        >
          <CheckDraw />
        </span>
        <span className="text-[15px] font-semibold" style={{ color: "var(--ar-text)" }}>
          ¡Listo! Te avisamos pronto.
        </span>
      </motion.div>
    );
  }

  const borderColor = error ? "var(--ar-danger)" : invalid ? "var(--ar-danger)" : "var(--ar-border)";

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-[520px] flex-col gap-3 sm:flex-row sm:items-stretch"
    >
      <div className="flex-1">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          disabled={sending}
          onChange={(e) => {
            setEmail(e.target.value);
            if (invalid) setInvalid(false);
            if (error) setStatus("idle");
          }}
          onBlur={validate}
          placeholder="tu@correo.com"
          aria-label="Tu correo"
          aria-invalid={invalid || error}
          className="ar-focus-ring h-14 w-full rounded-2xl border bg-ar-elev px-5 text-[15px] outline-none transition-colors disabled:opacity-60"
          style={{ borderColor, color: "var(--ar-text)" }}
        />
        <AnimatePresence>
          {(invalid || error) && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="mt-2 px-1 text-left font-mono text-[12px]"
              style={{ color: "var(--ar-danger)" }}
            >
              {error ? "Algo falló. Intenta de nuevo." : "Escribe un correo válido."}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        type="submit"
        disabled={sending}
        whileHover={sending ? undefined : { y: -3 }}
        whileTap={sending ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.28, ease: EASE }}
        className={cx(
          "ar-focus-ring inline-flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-2xl px-7 text-[15px] font-semibold sm:w-auto",
          "ar-grad ar-shadow-btn text-white disabled:cursor-not-allowed"
        )}
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
            Enviando
          </>
        ) : (
          <>
            Avísame
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </>
        )}
      </motion.button>
    </form>
  );
}

export function Waitlist() {
  return (
    <Section id="waitlist" className="relative overflow-hidden">
      <GlowBlob
        size={620}
        className="left-1/2 top-1/2"
        style={{ transform: "translate(-50%,-50%)" }}
        opacity={0.22}
        blur={110}
        pulse
      />

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } } }}
        className="mx-auto flex max-w-[760px] flex-col items-center text-center"
      >
        <motion.div variants={fadeUp}>
          <Heading as="h2" size="h1">
            Tu taller te está esperando.
          </Heading>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Lede className="mt-6 max-w-[52ch]">
            Entra a la beta gratis, o déjanos tu correo y te avisamos apenas haya cupo.
          </Lede>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <ButtonPrimary href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer">
            Probar el app
          </ButtonPrimary>
          <ButtonSecondary to={REGISTRO_PATH} icon={<ArrowRight className="h-4 w-4" />}>
            Crear mi taller
          </ButtonSecondary>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-10 w-full">
          <WaitlistForm />
        </motion.div>
      </motion.div>
    </Section>
  );
}
