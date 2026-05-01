import type { ColorPalette } from "@/types/pokemon";

export type ColorFormat = "hex" | "rgb" | "hsl";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function convertColor(hex: string, format: ColorFormat): string {
  if (format === "hex") return hex;
  const [r, g, b] = hexToRgb(hex);
  if (format === "rgb") return `rgb(${r}, ${g}, ${b})`;
  const [h, s, l] = rgbToHsl(r, g, b);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function convertPalette(palette: ColorPalette, format: ColorFormat): ColorPalette {
  if (format === "hex") return palette;
  return {
    primary: convertColor(palette.primary, format),
    secondary: convertColor(palette.secondary, format),
    accent: convertColor(palette.accent, format),
    background: convertColor(palette.background, format),
    text: convertColor(palette.text, format),
    highlights: palette.highlights.map((c) => convertColor(c, format)),
  };
}

export function paletteToTailwindConfig(
  name: string,
  palette: ColorPalette,
  format: ColorFormat = "hex",
) {
  const p = convertPalette(palette, format);
  return {
    theme: {
      extend: {
        colors: {
          [name.toLowerCase().replace(/[^a-z0-9]/g, "-")]: {
            primary: p.primary,
            secondary: p.secondary,
            accent: p.accent,
            bg: p.background,
            text: p.text,
          },
        },
      },
    },
  };
}

export function paletteToCssVariables(
  name: string,
  palette: ColorPalette,
  format: ColorFormat = "hex",
) {
  const p = convertPalette(palette, format);
  const prefix = `--${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  return {
    [`${prefix}-primary`]: p.primary,
    [`${prefix}-secondary`]: p.secondary,
    [`${prefix}-accent`]: p.accent,
    [`${prefix}-bg`]: p.background,
    [`${prefix}-text`]: p.text,
  };
}

export function parseColorFormat(param: string | null): ColorFormat {
  if (param === "rgb" || param === "hsl") return param;
  return "hex";
}

export function formatPaletteResponse(
  pokemon: {
    id: number;
    name: string;
    species: string;
    type: string[];
    generation: number;
    rarity: string;
    colorPalette: ColorPalette;
    shinyColorPalette?: ColorPalette | null;
    artwork: unknown;
  },
  options: { format?: ColorFormat; shiny?: boolean } = {},
) {
  const format = options.format ?? "hex";
  const useShiny = options.shiny ?? false;

  const basePalette = useShiny && pokemon.shinyColorPalette
    ? pokemon.shinyColorPalette
    : pokemon.colorPalette;

  const converted = convertPalette(basePalette, format);
  const shinyConverted = pokemon.shinyColorPalette
    ? convertPalette(pokemon.shinyColorPalette, format)
    : null;

  return {
    id: pokemon.id,
    name: pokemon.name,
    species: pokemon.species,
    type: pokemon.type,
    generation: pokemon.generation,
    rarity: pokemon.rarity,
    shiny: useShiny,
    colorFormat: format,
    colorPalette: converted,
    shinyColorPalette: useShiny ? null : shinyConverted,
    tailwindConfig: paletteToTailwindConfig(
      useShiny ? `${pokemon.name}-shiny` : pokemon.name,
      basePalette,
      format,
    ),
    cssVariables: paletteToCssVariables(
      useShiny ? `${pokemon.name}-shiny` : pokemon.name,
      basePalette,
      format,
    ),
    artwork: pokemon.artwork,
  };
}
