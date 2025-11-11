import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAllPokemonMetadata } from "@/lib/pokemon";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

// GET - Get all Pokemon with their color data (admin only)
export async function GET(req: NextRequest) {
  try {
    let userId: string | null = null;
    
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin using Supabase
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .eq("is_deleted", false)
      .single();

    if (userError || !currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Get all Pokemon metadata
    const allPokemon = getAllPokemonMetadata();
    
    // Load color data for each Pokemon
    const pokemonWithColors = await Promise.all(
      allPokemon.map(async (pokemon) => {
        try {
          const filePath = join(process.cwd(), "src", "data", "pokemon", `${pokemon.id}.json`);
          const fileContent = await readFile(filePath, "utf-8");
          const pokemonData = JSON.parse(fileContent);
          
          // Get colors from static data
          const staticColors = pokemonData.colorPalette?.highlights || [
            pokemonData.colorPalette?.primary,
            pokemonData.colorPalette?.secondary,
            pokemonData.colorPalette?.accent,
          ].filter(Boolean).slice(0, 3);
          
          // Get sprite URL for 2D sprite extraction (client-side will do this)
          const spriteUrl = pokemonData.artwork?.front || null;
          
          return {
            id: pokemon.id,
            name: pokemon.name,
            spriteUrl,
            staticColors: staticColors.slice(0, 3), // Top 3 from static data
          };
        } catch (error) {
          console.error(`Error loading Pokemon ${pokemon.id}:`, error);
          return null;
        }
      })
    );

    // Filter out nulls
    const validPokemon = pokemonWithColors.filter((p): p is NonNullable<typeof p> => p !== null);

    return NextResponse.json({ pokemon: validPokemon });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/pokemon-colors:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update Pokemon color palette (admin only)
export async function PUT(req: NextRequest) {
  try {
    let userId: string | null = null;
    
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin using Supabase
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .eq("is_deleted", false)
      .single();

    if (userError || !currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { pokemonId, colors } = body;

    if (!pokemonId || !Array.isArray(colors) || colors.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: pokemonId and colors array required" },
        { status: 400 }
      );
    }

    // Ensure we have exactly 3 colors
    const selectedColors = colors.slice(0, 3);
    while (selectedColors.length < 3) {
      selectedColors.push(selectedColors[selectedColors.length - 1] || "#94a3b8");
    }

    // Read the Pokemon file
    const filePath = join(process.cwd(), "src", "data", "pokemon", `${pokemonId}.json`);
    const fileContent = await readFile(filePath, "utf-8");
    const pokemonData = JSON.parse(fileContent);

    // Update color palette
    if (!pokemonData.colorPalette) {
      pokemonData.colorPalette = {};
    }

    // Update highlights with the selected colors
    pokemonData.colorPalette.highlights = selectedColors;
    
    // Also update primary, secondary, accent if they exist
    if (selectedColors[0]) pokemonData.colorPalette.primary = selectedColors[0];
    if (selectedColors[1]) pokemonData.colorPalette.secondary = selectedColors[1];
    if (selectedColors[2]) pokemonData.colorPalette.accent = selectedColors[2];

    // Write back to file
    await writeFile(filePath, JSON.stringify(pokemonData, null, 2), "utf-8");

    return NextResponse.json({
      message: "Pokemon color palette updated successfully",
      pokemonId,
      colors: selectedColors,
    });
  } catch (error) {
    console.error("Unexpected error in PUT /api/admin/pokemon-colors:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

