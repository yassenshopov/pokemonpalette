// Theme export utilities. Maps a Pokemon palette (3-6 hex colors) to a full
// shadcn token set in light + dark variants and serializes that to:
//   - Tailwind v4 CSS (matches the project's existing globals.css shape)
//   - Tailwind v3 config (HSL triplets + tailwind.config.js extend block)
//   - Raw JSON
//
// Pure functions, no React. Hex in, strings out.

export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
};

export type ThemeBundle = {
  light: ThemeTokens;
  dark: ThemeTokens;
  palette: string[];
};

// ---------- Color helpers ----------

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeHex(hex: string): string {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    return "000000";
  }
  return h.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export type Hsl = { h: number; s: number; l: number };

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hh = ((h % 360) + 360) % 360;
  const sn = clamp(s / 100);
  const ln = clamp(l / 100);

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const to255 = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

function withL(hex: string, l: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l });
}

function withSL(hex: string, s: number, l: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ h: hsl.h, s, l });
}

function contrastHex(hex: string): "#0a0a0a" | "#ffffff" {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#0a0a0a" : "#ffffff";
}

// HSL triplet string: "240 5.9% 10%" - what shadcn pre-v4 uses inside CSS vars.
function toHslTriplet(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return `${h} ${s}% ${l}%`;
}

// ---------- Token mapping ----------

function pickColor(colors: string[], i: number): string {
  if (colors.length === 0) return "#6366f1";
  return colors[i % colors.length] ?? "#6366f1";
}

function buildLight(colors: string[]): ThemeTokens {
  const primary = pickColor(colors, 0);
  const secondary = pickColor(colors, 1);
  const accent = pickColor(colors, 2);

  // Background/foreground stay near pure white/black for readability;
  // a faint primary tint adds character without hurting contrast.
  const background = withSL(primary, 20, 99);
  const foreground = withSL(primary, 30, 12);
  const card = withSL(primary, 15, 100);
  const popover = card;
  const muted = withSL(secondary, 25, 96);
  const mutedForeground = withSL(secondary, 15, 45);
  const border = withSL(primary, 20, 90);
  const input = border;
  const ring = withL(primary, Math.max(45, Math.min(65, hexToHsl(primary).l)));

  return {
    background,
    foreground,
    card,
    cardForeground: foreground,
    popover,
    popoverForeground: foreground,
    primary,
    primaryForeground: contrastHex(primary),
    secondary,
    secondaryForeground: contrastHex(secondary),
    muted,
    mutedForeground,
    accent,
    accentForeground: contrastHex(accent),
    destructive: "#ef4444",
    destructiveForeground: "#ffffff",
    border,
    input,
    ring,
    chart1: pickColor(colors, 0),
    chart2: pickColor(colors, 1),
    chart3: pickColor(colors, 2),
    chart4: pickColor(colors, 3),
    chart5: pickColor(colors, 4),
    sidebar: card,
    sidebarForeground: foreground,
    sidebarPrimary: primary,
    sidebarPrimaryForeground: contrastHex(primary),
    sidebarAccent: muted,
    sidebarAccentForeground: foreground,
    sidebarBorder: border,
    sidebarRing: ring,
  };
}

function buildDark(colors: string[]): ThemeTokens {
  const primary = pickColor(colors, 0);
  const secondary = pickColor(colors, 1);
  const accent = pickColor(colors, 2);

  const background = withSL(primary, 15, 9);
  const foreground = withSL(primary, 10, 96);
  const card = withSL(primary, 18, 13);
  const popover = card;
  const muted = withSL(secondary, 20, 18);
  const mutedForeground = withSL(secondary, 15, 65);
  const border = withSL(primary, 20, 22);
  const input = border;
  const ring = withL(primary, Math.max(55, Math.min(70, hexToHsl(primary).l)));

  // Brighten primary/secondary/accent slightly so they pop on dark surfaces
  // when the original Pokemon color is too dark to read.
  const liftPrimary = withL(primary, Math.max(55, hexToHsl(primary).l));
  const liftSecondary = withL(secondary, Math.max(55, hexToHsl(secondary).l));
  const liftAccent = withL(accent, Math.max(55, hexToHsl(accent).l));

  return {
    background,
    foreground,
    card,
    cardForeground: foreground,
    popover,
    popoverForeground: foreground,
    primary: liftPrimary,
    primaryForeground: contrastHex(liftPrimary),
    secondary: liftSecondary,
    secondaryForeground: contrastHex(liftSecondary),
    muted,
    mutedForeground,
    accent: liftAccent,
    accentForeground: contrastHex(liftAccent),
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    border,
    input,
    ring,
    chart1: pickColor(colors, 0),
    chart2: pickColor(colors, 1),
    chart3: pickColor(colors, 2),
    chart4: pickColor(colors, 3),
    chart5: pickColor(colors, 4),
    sidebar: card,
    sidebarForeground: foreground,
    sidebarPrimary: liftPrimary,
    sidebarPrimaryForeground: contrastHex(liftPrimary),
    sidebarAccent: muted,
    sidebarAccentForeground: foreground,
    sidebarBorder: border,
    sidebarRing: ring,
  };
}

export function paletteToTokens(colors: string[]): ThemeBundle {
  const safe = colors.length > 0 ? colors : ["#6366f1", "#818cf8", "#c7d2fe"];
  return {
    light: buildLight(safe),
    dark: buildDark(safe),
    palette: safe,
  };
}

// ---------- Token preview metadata ----------

export type TokenRow = {
  key: keyof ThemeTokens;
  label: string;
  cssVar: string;
};

export const PREVIEW_ROWS: TokenRow[] = [
  { key: "primary", label: "Primary", cssVar: "--primary" },
  { key: "secondary", label: "Secondary", cssVar: "--secondary" },
  { key: "accent", label: "Accent", cssVar: "--accent" },
  { key: "background", label: "Background", cssVar: "--background" },
  { key: "foreground", label: "Foreground", cssVar: "--foreground" },
  { key: "muted", label: "Muted", cssVar: "--muted" },
  { key: "border", label: "Border", cssVar: "--border" },
  { key: "card", label: "Card", cssVar: "--card" },
];

// ---------- Formatters ----------

// CSS variable name for a token key. Matches shadcn's naming convention.
function cssVarName(key: keyof ThemeTokens): string {
  switch (key) {
    case "cardForeground":
      return "--card-foreground";
    case "popoverForeground":
      return "--popover-foreground";
    case "primaryForeground":
      return "--primary-foreground";
    case "secondaryForeground":
      return "--secondary-foreground";
    case "mutedForeground":
      return "--muted-foreground";
    case "accentForeground":
      return "--accent-foreground";
    case "destructiveForeground":
      return "--destructive-foreground";
    case "chart1":
    case "chart2":
    case "chart3":
    case "chart4":
    case "chart5":
      return `--chart-${key.slice(-1)}`;
    case "sidebar":
      return "--sidebar";
    case "sidebarForeground":
      return "--sidebar-foreground";
    case "sidebarPrimary":
      return "--sidebar-primary";
    case "sidebarPrimaryForeground":
      return "--sidebar-primary-foreground";
    case "sidebarAccent":
      return "--sidebar-accent";
    case "sidebarAccentForeground":
      return "--sidebar-accent-foreground";
    case "sidebarBorder":
      return "--sidebar-border";
    case "sidebarRing":
      return "--sidebar-ring";
    default:
      return `--${key}`;
  }
}

const TOKEN_KEYS: (keyof ThemeTokens)[] = [
  "background",
  "foreground",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "destructiveForeground",
  "border",
  "input",
  "ring",
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
  "sidebar",
  "sidebarForeground",
  "sidebarPrimary",
  "sidebarPrimaryForeground",
  "sidebarAccent",
  "sidebarAccentForeground",
  "sidebarBorder",
  "sidebarRing",
];

function emitVarBlock(
  tokens: ThemeTokens,
  formatValue: (hex: string) => string,
  indent = "  ",
): string {
  return TOKEN_KEYS.map(
    (k) => `${indent}${cssVarName(k)}: ${formatValue(tokens[k])};`,
  ).join("\n");
}

const THEME_INLINE_BLOCK = `@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}`;

export function toTailwindV4Css(
  bundle: ThemeBundle,
  opts?: { pokemonName?: string },
): string {
  const name = opts?.pokemonName ? capitalize(opts.pokemonName) : "Pokemon";
  const header = `/* ${name} theme - generated by Pokémon Palette */`;
  return [
    header,
    "",
    THEME_INLINE_BLOCK,
    "",
    ":root {",
    emitVarBlock(bundle.light, (h) => h),
    "}",
    "",
    ".dark {",
    emitVarBlock(bundle.dark, (h) => h),
    "}",
    "",
  ].join("\n");
}

export function toTailwindV3Config(
  bundle: ThemeBundle,
  opts?: { pokemonName?: string },
): string {
  const name = opts?.pokemonName ? capitalize(opts.pokemonName) : "Pokemon";
  const header = `/* ${name} theme - generated by Pokémon Palette */`;

  const cssBlock = [
    "/* globals.css */",
    "@layer base {",
    "  :root {",
    emitVarBlock(bundle.light, toHslTriplet, "    "),
    "  }",
    "",
    "  .dark {",
    emitVarBlock(bundle.dark, toHslTriplet, "    "),
    "  }",
    "}",
  ].join("\n");

  const tailwindConfig = `// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};`;

  return [header, "", cssBlock, "", tailwindConfig, ""].join("\n");
}

export function toJson(
  bundle: ThemeBundle,
  opts?: { pokemonName?: string },
): string {
  const name = opts?.pokemonName ? opts.pokemonName.toLowerCase() : "pokemon";
  return JSON.stringify(
    {
      name: `${name}-theme`,
      generatedBy: "pokemonpalette.com",
      palette: bundle.palette,
      light: bundle.light,
      dark: bundle.dark,
    },
    null,
    2,
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
