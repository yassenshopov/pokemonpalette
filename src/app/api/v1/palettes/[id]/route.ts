import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { getPokemonById, getPokemonByName } from "@/lib/pokemon";
import { formatPaletteResponse, parseColorFormat } from "@/lib/palette-formats";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const url = new URL(req.url);
  const format = parseColorFormat(url.searchParams.get("format"));
  const shiny = url.searchParams.get("shiny") === "true";

  const numericId = parseInt(id, 10);
  const pokemon = isNaN(numericId)
    ? await getPokemonByName(id)
    : await getPokemonById(numericId);

  if (!pokemon) {
    return NextResponse.json(
      { error: `Pokemon "${id}" not found` },
      { status: 404 },
    );
  }

  if (shiny && !pokemon.shinyColorPalette) {
    return NextResponse.json(
      { error: `No shiny palette available for "${pokemon.name}"` },
      { status: 404 },
    );
  }

  return NextResponse.json(
    formatPaletteResponse(pokemon, { format, shiny }),
    { headers: CACHE_HEADERS },
  );
}
