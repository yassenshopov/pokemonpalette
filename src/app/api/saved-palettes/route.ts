import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface SavedPaletteData {
  pokemonId: number;
  pokemonName: string;
  pokemonForm?: string;
  isShiny: boolean;
  colors: string[];
  imageUrl?: string;
  paletteName?: string;
}

// GET - Retrieve user's saved palettes
export async function GET() {
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

    const { data: palettes, error } = await supabaseAdmin
      .from("saved_palettes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching saved palettes:", error);
      return NextResponse.json(
        { error: "Failed to fetch saved palettes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ palettes });
  } catch (error) {
    console.error("Unexpected error in GET /api/saved-palettes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Save a new palette
export async function POST(req: NextRequest) {
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

    const body: SavedPaletteData = await req.json();
    const {
      pokemonId,
      pokemonName,
      pokemonForm,
      isShiny,
      colors,
      imageUrl,
      paletteName,
    } = body;

    // Validate required fields
    if (!pokemonId || !pokemonName || !colors || colors.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: pokemonId, pokemonName, colors" },
        { status: 400 }
      );
    }

    // Check if user already has a palette for this exact Pokemon configuration
    const { data: existingPalette } = await supabaseAdmin
      .from("saved_palettes")
      .select("id")
      .eq("user_id", userId)
      .eq("pokemon_id", pokemonId)
      .eq("pokemon_form", pokemonForm || null)
      .eq("is_shiny", isShiny)
      .single();

    if (existingPalette) {
      // Update existing palette
      const { data: updatedPalette, error } = await supabaseAdmin
        .from("saved_palettes")
        .update({
          colors: colors,
          image_url: imageUrl,
          palette_name: paletteName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPalette.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating saved palette:", error);
        return NextResponse.json(
          { error: "Failed to update palette" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Palette updated successfully",
        palette: updatedPalette,
      });
    } else {
      // Create new palette
      const { data: newPalette, error } = await supabaseAdmin
        .from("saved_palettes")
        .insert({
          user_id: userId,
          pokemon_id: pokemonId,
          pokemon_name: pokemonName,
          pokemon_form: pokemonForm,
          is_shiny: isShiny,
          colors: colors,
          image_url: imageUrl,
          palette_name: paletteName,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving palette:", error);
        return NextResponse.json(
          { error: "Failed to save palette" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Palette saved successfully",
        palette: newPalette,
      });
    }
  } catch (error) {
    console.error("Unexpected error in POST /api/saved-palettes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
