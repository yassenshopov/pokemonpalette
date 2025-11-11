import { NextRequest, NextResponse } from "next/server";
import { getPokemonMetadataByName, getPokemonById } from "@/lib/pokemon";

// This route uses Node.js runtime (default) to access Pokemon data
// It's called by the Edge runtime OG image route to avoid bundling large files

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const pokemonMetadata = getPokemonMetadataByName(name);

    if (!pokemonMetadata) {
      return NextResponse.json({ error: "Pokemon not found" }, { status: 404 });
    }

    const pokemon = await getPokemonById(pokemonMetadata.id);

    if (!pokemon) {
      return NextResponse.json(
        { error: "Pokemon data not found" },
        { status: 404 }
      );
    }

    // Return only the data needed for OG image generation
    return NextResponse.json({
      id: pokemon.id,
      name: pokemon.name,
      colorPalette: pokemon.colorPalette,
      artwork: pokemon.artwork,
    });
  } catch (error) {
    console.error("Error in /api/pokemon-data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

