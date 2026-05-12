import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { getPokemonById, getPokemonByName } from "@/lib/pokemon";
import { formatPaletteResponse, parseColorFormat } from "@/lib/palette-formats";
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return withPublicApiCors(auth.response);

  const { id } = await params;
  const url = new URL(req.url);
  const format = parseColorFormat(url.searchParams.get("format"));
  const shiny = url.searchParams.get("shiny") === "true";

  // `parseInt("25xyz", 10)` happily returns 25 — so a request for
  // `/api/v1/palettes/25xyz` used to silently resolve to Pikachu instead
  // of falling through to the name-based lookup. Use `Number` (strict)
  // and the canonical National-Dex bound so trailing-junk inputs fail
  // the numeric branch and fall through to `getPokemonByName`, which
  // gives the API caller the predictable "id not found" 404 they expect.
  const numericId = /^\d+$/.test(id) ? Number(id) : Number.NaN;
  const isValidNumericId =
    Number.isInteger(numericId) && numericId >= 1 && numericId <= 100_000;
  const pokemon = isValidNumericId
    ? await getPokemonById(numericId)
    : await getPokemonByName(id);

  if (!pokemon) {
    return withPublicApiCors(
      NextResponse.json(
        { error: `Pokemon "${id}" not found` },
        { status: 404 },
      ),
    );
  }

  if (shiny && !pokemon.shinyColorPalette) {
    return withPublicApiCors(
      NextResponse.json(
        { error: `No shiny palette available for "${pokemon.name}"` },
        { status: 404 },
      ),
    );
  }

  return NextResponse.json(
    formatPaletteResponse(pokemon, { format, shiny }),
    { headers: CACHE_HEADERS },
  );
}
