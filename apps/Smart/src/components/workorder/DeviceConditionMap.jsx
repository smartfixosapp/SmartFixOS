import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Smartphone, ShieldAlert, X, Laptop, Monitor, Tablet, Watch } from "lucide-react";

const DEVICE_PRESETS = {
  phone: {
    hotspots: [
      { id: "screen", label: "Pantalla", x: 50, y: 38, kind: "screen" },
      { id: "camera", label: "Cámara", x: 77, y: 17, kind: "camera" },
      { id: "top_left", label: "Esquina sup. izq.", x: 18, y: 12, kind: "corner" },
      { id: "top_right", label: "Esquina sup. der.", x: 82, y: 12, kind: "corner" },
      { id: "bottom_left", label: "Esquina inf. izq.", x: 18, y: 84, kind: "corner" },
      { id: "bottom_right", label: "Esquina inf. der.", x: 82, y: 84, kind: "corner" },
      { id: "back", label: "Tapa / carcasa", x: 50, y: 73, kind: "housing" },
      { id: "port", label: "Puerto", x: 50, y: 93, kind: "port" },
    ],
    icon: Smartphone,
    frameClass: "h-[360px] w-[190px] rounded-[34px]"
  },
  tablet: {
    hotspots: [
      { id: "screen", label: "Pantalla", x: 50, y: 38, kind: "screen" },
      { id: "camera", label: "Cámara", x: 50, y: 11, kind: "camera" },
      { id: "top_left", label: "Esquina sup. izq.", x: 12, y: 12, kind: "corner" },
      { id: "top_right", label: "Esquina sup. der.", x: 88, y: 12, kind: "corner" },
      { id: "bottom_left", label: "Esquina inf. izq.", x: 12, y: 88, kind: "corner" },
      { id: "bottom_right", label: "Esquina inf. der.", x: 88, y: 88, kind: "corner" },
      { id: "buttons", label: "Botones laterales", x: 92, y: 45, kind: "buttons" },
      { id: "port", label: "Puerto", x: 50, y: 94, kind: "port" },
    ],
    icon: Tablet,
    frameClass: "h-[300px] w-[230px] rounded-[28px]"
  },
  laptop: {
    hotspots: [
      { id: "display", label: "Pantalla", x: 50, y: 22, kind: "display" },
      { id: "camera", label: "Cámara", x: 50, y: 7, kind: "camera" },
      { id: "hinge", label: "Bisagras", x: 50, y: 40, kind: "hinge" },
      { id: "keyboard", label: "Teclado", x: 50, y: 61, kind: "keyboard" },
      { id: "trackpad", label: "Trackpad", x: 50, y: 77, kind: "trackpad" },
      { id: "left_ports", label: "Puertos izq.", x: 14, y: 62, kind: "port" },
      { id: "right_ports", label: "Puertos der.", x: 86, y: 62, kind: "port" },
      { id: "housing", label: "Carcasa", x: 15, y: 84, kind: "housing" },
    ],
    icon: Laptop,
    frameClass: "h-[300px] w-[260px] rounded-[22px]"
  },
  tower: {
    hotspots: [
      { id: "front_panel", label: "Panel frontal", x: 50, y: 22, kind: "housing" },
      { id: "power_button", label: "Botón power", x: 50, y: 34, kind: "buttons" },
      { id: "usb_ports", label: "Puertos USB", x: 50, y: 46, kind: "port" },
      { id: "motherboard", label: "Placa madre", x: 50, y: 58, kind: "board" },
      { id: "ram", label: "RAM", x: 34, y: 64, kind: "memory" },
      { id: "disk", label: "Disco / SSD", x: 64, y: 69, kind: "disk" },
      { id: "fans", label: "Ventiladores", x: 50, y: 82, kind: "fan" },
      { id: "psu", label: "Fuente poder", x: 50, y: 93, kind: "power" },
    ],
    icon: Monitor,
    frameClass: "h-[360px] w-[170px] rounded-[16px]"
  },
  watch: {
    hotspots: [
      { id: "screen", label: "Pantalla", x: 50, y: 35, kind: "screen" },
      { id: "crown", label: "Corona / botón", x: 84, y: 34, kind: "buttons" },
      { id: "top_strap", label: "Correa superior", x: 50, y: 12, kind: "strap" },
      { id: "bottom_strap", label: "Correa inferior", x: 50, y: 86, kind: "strap" },
      { id: "back_sensor", label: "Sensor trasero", x: 50, y: 50, kind: "sensor" },
      { id: "housing", label: "Carcasa", x: 16, y: 35, kind: "housing" },
    ],
    icon: Watch,
    frameClass: "h-[320px] w-[160px] rounded-[30px]"
  }
};

const ISSUE_OPTIONS = {
  screen: [
    { key: "screen_broken", label: "Pantalla rota / rajada", icon: "💔" },
    { key: "screen_no_image", label: "Pantalla sin imagen", icon: "📺" },
    { key: "screen_lines", label: "Líneas en pantalla", icon: "📉" },
    { key: "touch_not_working", label: "Touch no responde", icon: "👆" },
    { key: "touch_ghost", label: "Touch fantasma", icon: "👻" },
  ],
  corner: [
    { key: "housing_damage", label: "Golpe / carcasa dañada", icon: "🔨" },
    { key: "screen_broken", label: "Cristal roto en esquina", icon: "💥" },
    { key: "bent_frame", label: "Marco doblado", icon: "📐" },
  ],
  housing: [
    { key: "housing_damage", label: "Carcasa dañada", icon: "🔨" },
    { key: "water_damage", label: "Daño por líquido", icon: "💧" },
    { key: "back_glass_broken", label: "Tapa / cristal trasero roto", icon: "🧩" },
  ],
  port: [
    { key: "port_damaged", label: "Puerto dañado", icon: "🔌" },
    { key: "port_dirty", label: "Puerto sucio", icon: "🧹" },
    { key: "battery_no_charge", label: "No carga", icon: "⚠️" },
  ],
  camera: [
    { key: "rear_camera_issue", label: "Cámara trasera no funciona", icon: "📷" },
    { key: "front_camera_issue", label: "Cámara frontal no funciona", icon: "🤳" },
    { key: "housing_damage", label: "Golpe en cámara / marco", icon: "💥" },
  ],
  keyboard: [
    { key: "keyboard_not_working", label: "Teclado no responde", icon: "⌨️" },
    { key: "key_missing", label: "Tecla dañada / faltante", icon: "🧩" },
    { key: "liquid_damage", label: "Daño por líquido", icon: "💧" },
  ],
  trackpad: [
    { key: "trackpad_not_working", label: "Trackpad no responde", icon: "🖱️" },
    { key: "click_issue", label: "Click dañado", icon: "🛠️" },
  ],
  display: [
    { key: "screen_broken", label: "Panel quebrado", icon: "💔" },
    { key: "screen_lines", label: "Líneas / artefactos", icon: "📉" },
    { key: "screen_no_image", label: "Sin imagen", icon: "📺" },
  ],
  hinge: [
    { key: "bent_frame", label: "Bisagra doblada", icon: "📐" },
    { key: "housing_damage", label: "Bisagra suelta", icon: "🔩" },
  ],
  board: [
    { key: "motherboard_issue", label: "Falla en placa", icon: "🧠" },
    { key: "short_circuit", label: "Corto eléctrico", icon: "⚡" },
  ],
  memory: [
    { key: "ram_issue", label: "Problema con RAM", icon: "🧱" },
  ],
  disk: [
    { key: "disk_failure", label: "Disco dañado", icon: "💽" },
    { key: "disk_not_detected", label: "Disco no detectado", icon: "🚫" },
  ],
  fan: [
    { key: "fan_noise", label: "Ventilador ruidoso", icon: "🌀" },
    { key: "overheating", label: "Sobrecalentamiento", icon: "🌡️" },
  ],
  power: [
    { key: "power_supply_issue", label: "Fuente dañada", icon: "🔋" },
    { key: "no_power", label: "No enciende", icon: "⛔" },
  ],
  buttons: [
    { key: "button_not_working", label: "Botón no responde", icon: "🔘" },
  ],
  strap: [
    { key: "strap_damaged", label: "Correa dañada", icon: "🪢" },
  ],
  sensor: [
    { key: "sensor_issue", label: "Sensor no funciona", icon: "🧭" },
  ],
};

function issueLabelFor(key, fallback = "Condición marcada") {
  for (const values of Object.values(ISSUE_OPTIONS)) {
    const found = values.find((item) => item.key === key);
    if (found) return found.label;
  }
  return fallback;
}

export function normalizeConditionMarkers(markers = []) {
  return (Array.isArray(markers) ? markers : []).map((marker, index) => ({
    id: marker.id || `${marker.hotspot_id || "marker"}-${marker.issue_key || index}-${index}`,
    hotspot_id: marker.hotspot_id,
    hotspot_label: marker.hotspot_label,
    issue_key: marker.issue_key,
    issue_label: marker.issue_label || issueLabelFor(marker.issue_key),
    x: Number(marker.x || 50),
    y: Number(marker.y || 50),
  }));
}

export default function DeviceConditionMap({
  markers = [],
  onChange,
  editable = false,
  deviceType = "",
  title = "Mapa visual del equipo",
  subtitle = "Marca golpes o daños visibles directamente sobre el equipo.",
}) {
  const normalizedMarkers = useMemo(() => normalizeConditionMarkers(markers), [markers]);
  const [activeHotspotId, setActiveHotspotId] = useState(null);
  const normalizedType = String(deviceType || "").toLowerCase();
  const presetKey = normalizedType.includes("laptop")
    ? "laptop"
    : normalizedType.includes("torre") || normalizedType.includes("desktop") || normalizedType.includes("pc")
    ? "tower"
    : normalizedType.includes("tablet")
    ? "tablet"
    : normalizedType.includes("reloj") || normalizedType.includes("watch")
    ? "watch"
    : "phone";
  const preset = DEVICE_PRESETS[presetKey] || DEVICE_PRESETS.phone;
  const HOTSPOTS = preset.hotspots;
  const ActiveIcon = preset.icon;
  const activeHotspot = HOTSPOTS.find((spot) => spot.id === activeHotspotId) || null;
  const activeOptions = activeHotspot ? ISSUE_OPTIONS[activeHotspot.kind] || ISSUE_OPTIONS.housing : [];

  const addMarker = (option) => {
    if (!editable || !activeHotspot || !onChange) return;
    const next = [
      ...normalizedMarkers,
      {
        id: `${activeHotspot.id}-${option.key}-${Date.now()}`,
        hotspot_id: activeHotspot.id,
        hotspot_label: activeHotspot.label,
        issue_key: option.key,
        issue_label: option.label,
        x: activeHotspot.x,
        y: activeHotspot.y,
      },
    ];
    onChange(next);
    setActiveHotspotId(null);
  };

  const removeMarker = (id) => {
    if (!editable || !onChange) return;
    onChange(normalizedMarkers.filter((marker) => marker.id !== id));
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-base font-semibold text-white">
            <ShieldAlert className="h-4 w-4 text-cyan-300" />
            {title}
          </h4>
          <p className="mt-1 text-sm text-white/55">{subtitle}</p>
        </div>
        <Badge className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-white/75">
          {normalizedMarkers.length} marca{normalizedMarkers.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_35%),rgba(255,255,255,0.02)] p-5">
          <div className={`relative border border-cyan-300/25 bg-gradient-to-b from-slate-900 to-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_24px_50px_rgba(0,0,0,0.35)] ${preset.frameClass}`}>
            <div className="absolute left-1/2 top-3 h-2.5 w-20 -translate-x-1/2 rounded-full bg-white/10" />
            <div className="absolute left-1/2 top-8 h-[72%] w-[78%] -translate-x-1/2 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" />
            <div className="absolute left-1/2 bottom-4 -translate-x-1/2 text-cyan-200/60">
              <ActiveIcon className="h-5 w-5" />
            </div>
            {HOTSPOTS.map((spot) => {
              const selected = activeHotspotId === spot.id;
              const hasMarker = normalizedMarkers.some((marker) => marker.hotspot_id === spot.id);
              return (
                <button
                  key={spot.id}
                  type="button"
                  disabled={!editable}
                  onClick={() => editable && setActiveHotspotId(spot.id)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all ${
                    selected
                      ? "h-8 w-8 border-rose-100 bg-rose-500 shadow-[0_0_0_6px_rgba(244,63,94,0.2)]"
                      : hasMarker
                      ? "h-7 w-7 border-rose-200/90 bg-rose-500"
                      : "h-6 w-6 border-white/20 bg-white/8"
                  } ${editable ? "hover:scale-110" : "cursor-default"}`}
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  title={spot.label}
                >
                  <span className="sr-only">{spot.label}</span>
                </button>
              );
            })}

            {editable && activeHotspot && (
              <div
                className="absolute z-30 w-[220px] rounded-xl border border-cyan-400/30 bg-[#071521]/95 p-2 shadow-2xl backdrop-blur-md"
                style={{
                  left: `${Math.min(78, Math.max(14, activeHotspot.x))}%`,
                  top: `${Math.min(78, Math.max(16, activeHotspot.y))}%`,
                  transform: "translate(-50%, -50%)"
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-bold tracking-[0.12em] text-cyan-200/80">{activeHotspot.label}</p>
                  <button type="button" className="text-white/50 hover:text-white" onClick={() => setActiveHotspotId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-1.5">
                  {activeOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => addMarker(option)}
                      className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-left text-xs text-white hover:border-cyan-300/30 hover:bg-white/[0.06]"
                    >
                      <span className="mr-1.5">{option.icon}</span>
                      {option.label}
                    </button>
                  ))}
                  {!!normalizedMarkers.filter((m) => m.hotspot_id === activeHotspot.id).length && (
                    <button
                      type="button"
                      onClick={() => {
                        const byHotspot = normalizedMarkers.filter((m) => m.hotspot_id === activeHotspot.id);
                        const last = byHotspot[byHotspot.length - 1];
                        if (last) removeMarker(last.id);
                      }}
                      className="rounded-lg border border-rose-400/35 bg-rose-500/15 px-2.5 py-1.5 text-left text-xs text-rose-100 hover:bg-rose-500/25"
                    >
                      <span className="mr-1.5">🗑️</span>
                      Quitar ultima marca
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
