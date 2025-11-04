import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET - Get detailed user data including game attempts and saved palettes (admin only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    let adminUserId: string | null = null;
    
    try {
      const authResult = await auth();
      adminUserId = authResult.userId;
    } catch (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", adminUserId)
      .eq("is_deleted", false)
      .single();

    if (userError || !currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { userId } = await params;

    // Get user details
    const { data: user, error: userFetchError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("is_deleted", false)
      .single();

    if (userFetchError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get game attempts
    const { data: gameAttempts, error: attemptsError } = await supabaseAdmin
      .from("daily_game_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(50);

    if (attemptsError) {
      console.error("Error fetching game attempts:", attemptsError);
    }

    // Calculate game stats
    const totalGames = gameAttempts?.length || 0;
    const totalWins = gameAttempts?.filter((a: any) => a.won).length || 0;
    const totalLosses = totalGames - totalWins;
    const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
    const averageAttempts = gameAttempts && gameAttempts.length > 0
      ? gameAttempts.reduce((sum: number, a: any) => sum + a.attempts, 0) / gameAttempts.length
      : 0;

    // Get saved palettes
    const { data: savedPalettes, error: palettesError } = await supabaseAdmin
      .from("saved_palettes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (palettesError) {
      console.error("Error fetching saved palettes:", palettesError);
    }

    return NextResponse.json({
      user,
      gameAttempts: gameAttempts || [],
      gameStats: {
        totalGames,
        totalWins,
        totalLosses,
        winRate: Math.round(winRate * 100) / 100,
        averageAttempts: Math.round(averageAttempts * 100) / 100,
      },
      savedPalettes: savedPalettes || [],
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/users/[userId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

