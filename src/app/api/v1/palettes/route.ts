import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireApiKey } from "@/lib/api-auth";
import {
  getAllPokemonMetadata,
  batchGetPokemonById,
} from "@/lib/pokemon";
import {
  convertPalette,
  paletteToTailwindConfig,
  paletteToCssVariables,
  parseColorFormat,
  type ColorFormat,
} from "@/lib/palette-formats";
import {
  PUBLIC_API_CORS_HEADERS,
  publicApiPreflight,
  withPublicApiCors,
} from "@/lib/cors";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  ...PUBLIC_API_CORS_HEADERS,
};

export async function OPTIONS() {
  return publicApiPreflight();
}

// Pokemon JSON ships in `public/data/pokemon/` and is immutable per
// deploy — filter results + batched JSON reads can therefore be cached
// for the lifetime of the deployment. The keying uses every query
// parameter the response varies on, so the function returns a unique
// payload per request shape while sharing all the disk-read work
// behind a single in-process cache entry. `revalidate: false` plus the
// `palettes-v1` tag means a hard invalidation requires either a new
// deploy or an explicit `revalidateTag` call (e.g. from the admin
// color-management workbench).
const buildPaletteResponse = unstable_cache(
  async (
    page: number,
    pageSize: number,
    format: ColorFormat,
    shiny: boolean,
    typeFilter: string | undefined,
    generationFilter: number | undefined,
  ) => {
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

    return { data, page, pageSize, total, totalPages, colorFormat: format, shiny };
  },
  ["api-v1-palettes-list"],
  { revalidate: false, tags: ["palettes-v1"] },
);

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return withPublicApiCors(auth.response);

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));
  const format = parseColorFormat(url.searchParams.get("format"));
  const shiny = url.searchParams.get("shiny") === "true";

  const typeFilter = url.searchParams.get("type") ?? undefined;
  const generationFilter = url.searchParams.get("generation")
    ? parseInt(url.searchParams.get("generation")!, 10)
    : undefined;

  const payload = await buildPaletteResponse(
    page,
    pageSize,
    format,
    shiny,
    typeFilter,
    generationFilter,
  );

  return NextResponse.json(payload, { headers: CACHE_HEADERS });
}
