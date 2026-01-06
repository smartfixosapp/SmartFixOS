/**
 * Genera un ícono SVG simple para marcas/modelos/familias cuando no tienen uno personalizado
 */
export function generateFallbackIcon(name, size = 64) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const colors = [
    "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", 
    "#EC4899", "#14B8A6", "#F97316", "#06B6D4", "#84CC16"
  ];
  
  // Simple hash para color consistente
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${color}" rx="${size * 0.2}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="${size * 0.5}" font-weight="bold">
      ${initial}
    </text>
  </svg>`;
}

/**
 * Genera un ícono para un modelo de dispositivo
 */
export function generateModelIcon(name, color = "#3B82F6") {
  const initial = (name || "?").charAt(0).toUpperCase();
  const size = 64;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${color}" rx="12"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="32" font-weight="bold">
      ${initial}
    </text>
  </svg>`;
}

/**
 * Retorna un color consistente para una marca
 */
export function getBrandColor(brandName = "") {
  const brand = brandName.toLowerCase().trim();
  
  const brandColors = {
    apple: "#A3AAAE",
    samsung: "#1428A0",
    oneplus: "#EB0028",
    lenovo: "#E2231A",
    motorola: "#5C92FA",
    huawei: "#ED1C24",
    xiaomi: "#FF6900",
    microsoft: "#00A4EF",
    hp: "#0096D6",
    dell: "#007DB8",
    lg: "#A50034",
    sony: "#000000",
    google: "#4285F4",
    asus: "#000000",
    acer: "#83B81A",
  };
  
  return brandColors[brand] || "#3B82F6";
}
