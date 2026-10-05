export const MAX_BACKDATE_MIN = 30;

const pad = (n) => String(n).padStart(2, "0");
export const toHHMM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function resolvePunchTime(timeText, now = new Date()) {
  if (!timeText) return { at: now, backdated: false, minutesBack: 0, error: null };
  const [h, m] = String(timeText).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { at: now, backdated: false, minutesBack: 0, error: null };
  let at = new Date(now);
  at.setHours(h, m, 0, 0);
  if (at > now) {
    const yesterday = new Date(at);
    yesterday.setDate(yesterday.getDate() - 1);
    at = now - yesterday <= MAX_BACKDATE_MIN * 60000 ? yesterday : now;
  }
  const ms = now - at;
  if (ms > MAX_BACKDATE_MIN * 60000) {
    return { at: null, backdated: false, minutesBack: 0, error: `Solo puedes registrar hasta ${MAX_BACKDATE_MIN} min antes de ahora. Para ajustar más, pídele al dueño que lo corrija en Editar ponches.` };
  }
  return { at, backdated: ms > 60000, minutesBack: Math.round(ms / 60000), error: null };
}

export function PunchTimeField({ value, onChange, accent = "#F2662E", now = new Date() }) {
  const shown = value ?? toHHMM(now);
  const r = resolvePunchTime(value, now);
  return (
    <div className="w-full flex flex-col" style={{ gap: 8, textAlign: "left", padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "#8E8E93" }}>HORA DEL REGISTRO</p>
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <input
          type="time"
          value={shown}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Hora del registro"
          style={{ background: "#2C2C2E", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 17, colorScheme: "dark" }}
        />
        <button type="button" onClick={() => onChange(null)} className="apple-press" style={{ padding: "6px 14px", borderRadius: 999, background: `${accent}24`, border: `1px solid ${accent}40`, color: accent, fontSize: 12, fontWeight: 700 }}>Ahora</button>
      </div>
      {(r.error || r.backdated) && (
        <p style={{ fontSize: 12, color: "#FFA640" }}>{r.error || `Vas a registrar ${r.minutesBack} min antes de ahora. Para ajustar más, pídele al dueño que lo corrija en Editar ponches.`}</p>
      )}
    </div>
  );
}
