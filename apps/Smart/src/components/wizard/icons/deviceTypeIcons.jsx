// Íconos de tipos de dispositivos
export const DEVICE_TYPE_ICONS = {
  smartphone: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect rx="16" ry="16" width="96" height="96" fill="%2311161b"/><rect x="28" y="12" width="40" height="72" rx="8" fill="%23212a31"/><circle cx="48" cy="76" r="4" fill="%236b7280"/></svg>',
  phone: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect rx="16" ry="16" width="96" height="96" fill="%2311161b"/><rect x="28" y="12" width="40" height="72" rx="8" fill="%23212a31"/><circle cx="48" cy="76" r="4" fill="%236b7280"/></svg>',
  watch: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="30" y="24" width="36" height="48" rx="8" fill="%23212a31"/><rect x="38" y="16" width="20" height="8" rx="3" fill="%23343b46"/><rect x="38" y="72" width="20" height="8" rx="3" fill="%23343b46"/></svg>',
  laptop: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="14" y="20" width="68" height="38" rx="6" fill="%23212a31"/><rect x="10" y="60" width="76" height="8" rx="3" fill="%23343b46"/></svg>',
  desktop: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="10" y="16" width="76" height="44" rx="6" fill="%23212a31"/><rect x="36" y="62" width="24" height="6" rx="2" fill="%23343b46"/><rect x="28" y="68" width="40" height="8" rx="2" fill="%23343b46"/></svg>',
  tablet: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect rx="12" ry="12" width="96" height="96" fill="%2311161b"/><rect x="18" y="12" width="60" height="72" rx="8" fill="%23212a31"/></svg>',
  console: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="18" y="36" width="60" height="24" rx="8" fill="%23212a31"/><circle cx="32" cy="48" r="4" fill="%236b7280"/><circle cx="64" cy="48" r="4" fill="%236b7280"/></svg>',
  earbuds: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><circle cx="34" cy="40" r="10" fill="%23212a31"/><rect x="30" y="50" width="8" height="16" rx="3" fill="%23343b46"/><circle cx="62" cy="40" r="10" fill="%23212a31"/><rect x="58" y="50" width="8" height="16" rx="3" fill="%23343b46"/></svg>',
  audio: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><circle cx="34" cy="40" r="10" fill="%23212a31"/><rect x="30" y="50" width="8" height="16" rx="3" fill="%23343b46"/><circle cx="62" cy="40" r="10" fill="%23212a31"/><rect x="58" y="50" width="8" height="16" rx="3" fill="%23343b46"/></svg>',
  camera: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="18" y="30" width="60" height="36" rx="8" fill="%23212a31"/><circle cx="48" cy="48" r="12" fill="%23343b46"/></svg>',
  tv: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><rect x="10" y="18" width="76" height="46" rx="6" fill="%23212a31"/><rect x="28" y="66" width="40" height="6" rx="2" fill="%23343b46"/></svg>',
  accessory: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><circle cx="48" cy="48" r="20" fill="%23212a31"/></svg>',
  other: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2311161b"/><circle cx="48" cy="48" r="20" fill="%23212a31"/></svg>',
};

// Generar SVG placeholder con iniciales
export function svgDataUrlFromInitials(initials) {
  const text = (initials || "??").substring(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="#374151" rx="8"/>
    <text x="24" y="32" font-family="Arial" font-size="16" font-weight="bold" fill="white" text-anchor="middle">${text}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
