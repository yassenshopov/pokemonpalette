// Shared color helpers used across the game and palette UI. Previously
// redeclared inline in multiple components - extracted so we don't ship
// duplicate copies of these tiny functions in three different chunks.

export type ContrastClass = "text-white" | "text-black";

function parseHex(hex: string | undefined): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== "string") return null;
  const hexClean = hex.replace("#", "");
  if (hexClean.length < 6) return null;
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

/**
 * Return a Tailwind text class that contrasts with the given background hex.
 */
export function getContrastTextClass(hex: string | undefined): ContrastClass {
  const rgb = parseHex(hex);
  if (!rgb) return "text-black";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "text-black" : "text-white";
}

/**
 * Return a hex contrast color (#000000 / #ffffff) for inline styles.
 */
export function getContrastHex(hex: string | undefined): "#000000" | "#ffffff" {
  const rgb = parseHex(hex);
  if (!rgb) return "#ffffff";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

/**
 * Convert a hex color to an rgba() string with the given opacity. Falls back
 * to transparent black if the input can't be parsed.
 */
export function getDimmedColor(hex: string, opacity = 0.2): string {
  const rgb = parseHex(hex);
  if (!rgb) return `rgba(0, 0, 0, ${opacity})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}
