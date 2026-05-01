import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import {
  getAllPokemonMetadata,
  batchGetPokemonById,
} from "@/lib/pokemon";
import {
  paletteToTailwindConfig,
  paletteToCssVariables,
  parseColorFormat,
  type ColorFormat,
} from "@/lib/palette-formats";
import type { ColorPalette } from "@/types/pokemon";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

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

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));
  const format = parseColorFormat(url.searchParams.get("format"));
  const shiny = url.searchParams.get("shiny") === "true";

  const typeFilter = url.searchParams.get("type") ?? undefined;
  const generationFilter = url.searchParams.get("generation")
    ? parseInt(url.searchParams.get("generation")!, 10)
    : undefined;

  let allMeta = getAllPokemonMetadata();

  if (typeFilter) {
    allMeta = allMeta.filter((m) =>
      m.type.some((t) => t.toLowerCase() === typeFilter.toLowerCase()),
    );
  }
  if (generationFilter) {
    allMeta = allMeta.filter((m) => m.generation === generationFilter);
  }

  const total = allMeta.length;
  const totalPages = Math.ceil(total / pageSize);
  const slice = allMeta.slice((page - 1) * pageSize, page * pageSize);

  const fullData = await batchGetPokemonById(slice.map((m) => m.id));

  const data = slice.map((m) => {
    const pokemon = fullData.get(m.id);
    const basePalette = shiny && pokemon?.shinyColorPalette
      ? pokemon.shinyColorPalette
      : pokemon?.colorPalette ?? null;

    const converted = basePalette ? convertPalette(basePalette, format) : null;
    const shinyConverted = !shiny && pokemon?.shinyColorPalette
      ? convertPalette(pokemon.shinyColorPalette, format)
      : null;
    const slug = shiny ? `${m.name}-shiny` : m.name;

    return {
      id: m.id,
      name: m.name,
      species: m.species,
      type: m.type,
      generation: m.generation,
      rarity: m.rarity,
      shiny,
      colorFormat: format,
      colorPalette: converted,
      shinyColorPalette: shiny ? null : shinyConverted,
      tailwindConfig: basePalette
        ? paletteToTailwindConfig(slug, basePalette, format)
        : null,
      cssVariables: basePalette
        ? paletteToCssVariables(slug, basePalette, format)
        : null,
    };
  });

  return NextResponse.json(
    { data, page, pageSize, total, totalPages, colorFormat: format, shiny },
    { headers: CACHE_HEADERS },
  );
}
