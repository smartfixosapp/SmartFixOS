import type { CSSProperties } from "react";

const PATHS: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  phone: '<rect x="7" y="2.500" width="10" height="19" rx="2.500"/><path d="M11 18.500h2"/>',
  tablet: '<rect x="4.500" y="2.500" width="15" height="19" rx="2.500"/><path d="M11 18.500h2"/>',
  laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19.500h20"/>',
  game: '<rect x="2.500" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.500 12.500h3M16 11.500h.01M18 13.500h.01"/>',
  cal: '<rect x="3.500" y="5" width="17" height="15.500" rx="3"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
  box: '<path d="M12 3 3.500 7.500v9L12 21l8.500-4.500v-9L12 3Z"/><path d="M3.500 7.500 12 12l8.500-4.500M12 12v9"/>',
  shield: '<path d="M12 3 4.500 6v6c0 4.500 3.200 7.700 7.500 9 4.300-1.300 7.500-4.500 7.500-9V6L12 3Z"/><path d="m9 12 2.200 2.200L15 10.500"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.500"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  status: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3"/>',
  devices: '<rect x="3" y="4" width="12" height="16" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/>',
  dollar: '<path d="M12 3v18M16.500 7.500c-.6-1.500-2.300-2.300-4.500-2.300-2.600 0-4.300 1.200-4.300 3.200 0 4.600 9.100 2 9.100 6.700 0 2-1.900 3.400-4.800 3.400-2.500 0-4.400-1-5-2.800"/>',
  note: '<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  wa: '<path d="M12 3.500a8.500 8.500 0 0 0-7.300 12.800L3.500 20.500l4.400-1.100A8.500 8.500 0 1 0 12 3.500Z"/><path d="M9.200 8.200c-.4 3.200 2.600 6.200 6.200 6.400l.9-1.700-2-1-1 .9c-1-.4-1.900-1.300-2.300-2.300l.9-1-1-2z"/>',
  cam: '<path d="M4 8h3l1.500-2.500h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
  img: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.500"/><circle cx="9" cy="10" r="1.600"/><path d="m4 17 5-4 4 3 3-2.500 4.500 3.500"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.500 20.500c.8-4 3.800-6 7.500-6s6.700 2 7.500 6"/>',
  bld: '<rect x="5" y="3" width="14" height="18" rx="1.500"/><path d="M9 7.500h2M13 7.500h2M9 11.500h2M13 11.500h2M10.500 21v-4h3v4"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  tool: '<path d="M20 7a4.500 4.500 0 0 1-6.200 4.200L7 18a2 2 0 1 1-2.800-2.800l6.800-6.800A4.500 4.500 0 0 1 17 3l-2.500 2.500 1 3 3 1z"/>',
  spark: '<path d="M11 3l1.900 5.600L18.500 10.500l-5.600 1.900L11 18l-1.900-5.600L3.500 10.500l5.600-1.900z"/><path d="M19 16v4M17 18h4"/>',
  more: '<circle cx="5" cy="12" r="1.300"/><circle cx="12" cy="12" r="1.300"/><circle cx="19" cy="12" r="1.300"/>',
  bat: '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21.500 11v2M6.500 11v2"/>',
  plug: '<path d="M9 3v5M15 3v5M6.500 8h11v3a5.500 5.500 0 0 1-11 0zM12 16.500V21"/>',
  power: '<path d="M12 3v8"/><path d="M6.500 6.500a8 8 0 1 0 11 0"/>',
  drop: '<path d="M12 3c3.500 4.500 6 7.300 6 10.500a6 6 0 0 1-12 0C6 10.300 8.500 7.500 12 3Z"/>',
  spk: '<path d="M4 9.500h3.500L12 6v12l-4.500-3.500H4z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.500 5l-3 14"/>',
  lock: '<rect x="5" y="10.500" width="14" height="10" rx="2.500"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
  unlock: '<rect x="5" y="10.500" width="14" height="10" rx="2.500"/><path d="M8 10.500V8a4 4 0 0 1 7.500-2"/>',
  bolt: '<path d="M13 2.500 5 13.500h6l-1 8 8-11h-6z"/>',
  pen: '<path d="M4 20l1-4.500L16.500 4l3.500 3.500L8.500 19z"/><path d="M14 6.500 17.500 10"/>',
  home: '<path d="M4 11 12 4l8 7v9h-5.500v-5.500h-5V20H4z"/>',
  cart: '<path d="M3 4h2.500l2.200 11h10.800L20.500 7.500H7"/><circle cx="9" cy="19" r="1.400"/><circle cx="17" cy="19" r="1.400"/>',
  users: '<circle cx="9" cy="8.500" r="3.500"/><path d="M2.500 20c.6-3.500 3-5.500 6.500-5.500s5.900 2 6.500 5.500M16 5.200a3.500 3.500 0 0 1 0 6.600M18.500 14.800c1.700.8 2.700 2.500 3 5.200"/>',
  alert: '<path d="M12 4 2.500 20h19z"/><path d="M12 10v4.500M12 17.500h.01"/>',
  sim: '<path d="M6 3h8l4 4v14H6z"/><rect x="9" y="12" width="6" height="6" rx="1"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  side: '<rect x="3" y="4.500" width="18" height="15" rx="2.500"/><path d="M9.500 4.500v15"/>',
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: string;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, className, style }: IconProps) {
  const body = PATHS[name] ?? PATHS.alert;
  return (
    <svg className={`rb-i${className ? ` ${className}` : ""}`} style={style} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: body }} />
  );
}
