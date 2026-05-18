/**
 * Approximate human-readable name for a hex color.
 *
 * We deliberately keep this simple and deterministic: convert hex → HSL,
 * then bucket by lightness, saturation, and hue. The output is used in
 * the server-rendered Pokemon page prose (e.g. "led by #f6d851, a warm
 * yellow") to give Google unique, content-rich text for each of the
 * ~1,350 Pokemon palette pages instead of just listing hex codes. Color
 * naming doesn't need to be perceptually perfect — it needs to be stable
 * (same hex → same name on every build) and grammatically natural.
 *
 * Bucket layout:
 *   L > 96 → "near-white"
 *   L < 6  → "near-black"
 *   S < 8  → grayscale: "very dark gray" / "dark gray" / "gray" / "light gray"
 *   else   → hue-based: red, orange, yellow, lime, green, teal, cyan, blue,
 *            indigo, violet, magenta, pink, with optional "deep" / "muted" /
 *            "soft" / "bright" modifiers from L and S.
 */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hueFamily(h: number): string {
  if (h < 12 || h >= 345) return "red";
  if (h < 25) return "red-orange";
  if (h < 45) return "orange";
  if (h < 60) return "amber";
  if (h < 72) return "yellow";
  if (h < 90) return "lime";
  if (h < 150) return "green";
  if (h < 175) return "teal";
  if (h < 195) return "cyan";
  if (h < 230) return "blue";
  if (h < 260) return "indigo";
  if (h < 285) return "violet";
  if (h < 315) return "magenta";
  return "pink";
}

/**
 * Return a short, lowercase, human-readable name for a hex color, like
 * `"warm yellow"` or `"deep teal"`. Stable: same hex always yields the
 * same name across builds.
 */
export function describeHex(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "color";

  const { h, s, l } = hsl;

  if (l >= 96) return "near-white";
  if (l <= 6) return "near-black";

  // Grayscale (very low saturation).
  if (s < 8) {
    if (l < 25) return "very dark gray";
    if (l < 45) return "dark gray";
    if (l < 65) return "gray";
    if (l < 85) return "light gray";
    return "off-white";
  }

  // Warm brown band: low-to-mid lightness + orange/amber hue + mid saturation
  // reads as brown rather than orange. Catches a lot of Pokemon palettes
  // (Eevee, Stantler, Bidoof, etc.) accurately.
  if (h >= 15 && h <= 50 && l < 45 && s < 70) {
    if (l < 22) return "dark brown";
    return "brown";
  }

  const family = hueFamily(h);

  let lightnessMod = "";
  if (l < 22) lightnessMod = "deep";
  else if (l < 35) lightnessMod = "dark";
  else if (l > 78) lightnessMod = "pale";
  else if (l > 65) lightnessMod = "light";

  let satMod = "";
  if (s < 25) satMod = "muted";
  else if (s > 80 && l > 35 && l < 70) satMod = "vivid";

  // Pick the more informative modifier — don't stack both, it gets
  // awkward ("pale muted blue"). Prefer the lightness modifier because
  // it's more visually distinctive than saturation.
  const modifier = lightnessMod || satMod;

  return modifier ? `${modifier} ${family}` : family;
}

/**
 * Categorise a hex as "warm" / "cool" / "neutral" for use in higher-level
 * palette mood prose. Hues 0–60 and 300–360 lean warm, 180–270 lean cool,
 * the rest is "balanced" / neutral. Very desaturated colors are always
 * "neutral".
 */
export function colorTemperature(hex: string): "warm" | "cool" | "neutral" {
  const hsl = hexToHsl(hex);
  if (!hsl) return "neutral";
  if (hsl.s < 12) return "neutral";
  const { h } = hsl;
  if ((h >= 0 && h < 70) || h >= 300) return "warm";
  if (h >= 170 && h < 280) return "cool";
  return "neutral";
}
