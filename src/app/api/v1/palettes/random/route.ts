import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { getRandomPokemon } from "@/lib/pokemon";
import { formatPaletteResponse, parseColorFormat } from "@/lib/palette-formats";

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const format = parseColorFormat(url.searchParams.get("format"));
  const shiny = url.searchParams.get("shiny") === "true";

  const pokemon = await getRandomPokemon();
  if (!pokemon) {
    return NextResponse.json(
      { error: "Failed to load a random Pokemon" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    formatPaletteResponse(pokemon, { format, shiny }),
  );
}
