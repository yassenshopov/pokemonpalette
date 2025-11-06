import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET - Get all saved palettes (admin only)
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

    // Get all saved palettes
    const { data: palettes, error: palettesError } = await supabaseAdmin
      .from("saved_palettes")
      .select("*")
      .order("created_at", { ascending: false });

    if (palettesError) {
      console.error("Error fetching saved palettes:", palettesError);
      return NextResponse.json(
        { error: "Failed to fetch saved palettes" },
        { status: 500 }
      );
    }

    // Get user info for all unique user IDs
    if (palettes && palettes.length > 0) {
      const userIds = [...new Set(palettes.map(palette => palette.user_id))];
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, email, username, first_name, last_name")
        .in("id", userIds);

      // Map user data to palettes
      const userMap = new Map(users?.map(u => [u.id, u]) || []);
      palettes.forEach(palette => {
        palette.users = userMap.get(palette.user_id) || null;
      });
    }

    // Get aggregated stats
    const { data: stats } = await supabaseAdmin
      .from("saved_palettes")
      .select("pokemon_id, is_shiny, pokemon_name");

    const totalPalettes = stats?.length || 0;
    const uniquePokemon = new Set(stats?.map(s => s.pokemon_id) || []).size;
    const shinyCount = stats?.filter(s => s.is_shiny).length || 0;
    const mostSavedPokemon = stats?.reduce((acc, s) => {
      const key = s.pokemon_name;
      if (!acc[key]) {
        acc[key] = { count: 0, pokemon_id: s.pokemon_id };
      }
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { count: number; pokemon_id: number }>) || {};
    const topPokemon = Object.entries(mostSavedPokemon)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, count: data.count, pokemon_id: data.pokemon_id }));

    return NextResponse.json({ 
      palettes: palettes || [],
      stats: {
        totalPalettes,
        uniquePokemon,
        shinyCount,
        regularCount: totalPalettes - shinyCount,
        topPokemon,
      }
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/saved-palettes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

