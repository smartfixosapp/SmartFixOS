/** Checklist por íconos — versión “tap único” */
function ChecklistIconsStep({ formData, updateFormData }) {
  // detectar tipo para ajustar los ítems
  const type = (formData.device_subcategory?.name || "").toLowerCase();

  const base = [
    { key: "screen",   label: "Pantalla",   icon: "🖥️" },
    { key: "touch",    label: "Touch",      icon: "👆" },
    { key: "battery",  label: "Batería",    icon: "🔋" },
    { key: "buttons",  label: "Botones",    icon: "🔘" },
    { key: "speakers", label: "Parlantes",  icon: "🔈" },
    { key: "mics",     label: "Micrófonos", icon: "🎤" },
    { key: "cameras",  label: "Cámaras",    icon: "📷" },
    { key: "charging", label: "Carga",      icon: "🔌" },
    { key: "wifi",     label: "Wi-Fi",      icon: "📶" },
  ];

  const laptopExtra = [
    { key: "keyboard", label: "Teclado",   icon: "⌨️" },
    { key: "trackpad", label: "Trackpad",  icon: "🖱️" },
    { key: "hinges",   label: "Bisagras",  icon: "🧩" },
    { key: "ssd",      label: "SSD",       icon: "💾" },
  ];

  const phoneExtra = [
    { key: "faceid",   label: "Face ID",   icon: "😶‍🌫️" },
    { key: "touchid",  label: "Touch ID",  icon: "🌀" },
    { key: "vibration",label: "Vibración", icon: "📳" },
  ];

  let items = [...base];
  if (type.includes("laptop") || type.includes("desktop") || type.includes("computer")) {
    items = [...items, ...laptopExtra];
  }
  if (type.includes("phone") || type.includes("smartphone") || type.includes("celular")) {
    items = [...items, ...phoneExtra];
  }

  // estado guardado en formData.checklist_items: [{key, status}]
  const state = new Map((formData.checklist_items || []).map(i => [i.key, i.status]));

  const cycle = (current) => {
    // N/A -> OK -> BAD -> N/A
    if (!current || current === "na") return "ok";
    if (current === "ok") return "bad";
    return "na";
  };

  const setStatus = (key) => {
    const current = state.get(key) || "na";
    const nextStatus = cycle(current);
    const map = new Map((formData.checklist_items || []).map(i => [i.key, i.status]));
    map.set(key, nextStatus);
    const nextArr = Array.from(map.entries()).map(([k, v]) => ({ key: k, status: v }));
    updateFormData("checklist_items", nextArr);
  };

  const cardClasses = (s) => {
    if (s === "ok")  return "border-emerald-500/40 bg-emerald-600/15 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]";
    if (s === "bad") return "border-red-500/40 bg-red-600/15 shadow-[0_0_0_1px_rgba(239,68,68,0.25)]";
    return "border-gray-600/50 bg-black/30";
  };

  const dot = (s) => (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        s === "ok" ? "bg-emerald-400" : s === "bad" ? "bg-red-400" : "bg-gray-400"
      }`}
      aria-hidden
    />
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((it) => {
        const s = state.get(it.key) || "na";
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => setStatus(it.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setStatus(it.key);
              }
            }}
            className={[
              "group relative select-none rounded-xl border px-3 py-3 text-left transition",
              "hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-500/60",
              cardClasses(s)
            ].join(" ")}
            aria-pressed={s !== "na"}
          >
            <div className="flex items-center gap-3">
              {/* Ícono grande */}
              <div className="grid place-items-center rounded-lg bg-white/10 w-16 h-16 text-4xl">
                {it.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{it.label}</span>
                  {dot(s)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {s === "ok" ? "OK" : s === "bad" ? "Dañado" : "No probado"}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Toca para cambiar estado</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
