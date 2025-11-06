import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET - Get all game data (admin only)
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

    // Get all game attempts
    const { data: gameAttempts, error: gameError } = await supabaseAdmin
      .from("daily_game_attempts")
      .select("*")
      .order("created_at", { ascending: false });

    if (gameError) {
      console.error("Error fetching game data:", gameError);
      return NextResponse.json(
        { error: "Failed to fetch game data" },
        { status: 500 }
      );
    }

    // Get user info for all unique user IDs
    if (gameAttempts && gameAttempts.length > 0) {
      const userIds = [...new Set(gameAttempts.map(attempt => attempt.user_id))];
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, email, username, first_name, last_name")
        .in("id", userIds);

      // Map user data to game attempts
      const userMap = new Map(users?.map(u => [u.id, u]) || []);
      gameAttempts.forEach(attempt => {
        attempt.users = userMap.get(attempt.user_id) || null;
      });
    }

    // Get aggregated stats
    const { data: stats } = await supabaseAdmin
      .from("daily_game_attempts")
      .select("won, attempts, hints_used");

    const totalAttempts = stats?.length || 0;
    const wins = stats?.filter(s => s.won).length || 0;
    const winRate = totalAttempts > 0 ? (wins / totalAttempts * 100).toFixed(1) : "0";
    const averageAttempts = stats && stats.length > 0
      ? (stats.reduce((sum, s) => sum + s.attempts, 0) / stats.length).toFixed(2)
      : "0";
    const averageHintsUsed = stats && stats.length > 0
      ? (stats.reduce((sum, s) => sum + (s.hints_used || 0), 0) / stats.length).toFixed(2)
      : "0";

    return NextResponse.json({ 
      gameAttempts: gameAttempts || [],
      stats: {
        totalAttempts,
        wins,
        losses: totalAttempts - wins,
        winRate: `${winRate}%`,
        averageAttempts,
        averageHintsUsed,
      }
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/game-data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

