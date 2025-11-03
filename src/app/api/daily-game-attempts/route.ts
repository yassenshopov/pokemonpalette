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

export interface DailyGameAttemptData {
  date: string; // ISO date string (YYYY-MM-DD)
  targetPokemonId: number;
  isShiny: boolean;
  guesses: number[]; // Array of Pokemon IDs guessed
  attempts: number; // Number of attempts made (1-4)
  won: boolean;
  pokemonGuessed?: number; // The Pokemon ID they guessed (if won)
  hintsUsed?: number; // Number of hints used (0-3)
}

// GET - Retrieve user's game attempts (with optional stats)
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

    const searchParams = req.nextUrl.searchParams;
    const includeStats = searchParams.get("stats") === "true";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : null;
    const dateFilter = searchParams.get("date"); // Filter by specific date (YYYY-MM-DD)

    let query = supabaseAdmin
      .from("daily_game_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (dateFilter) {
      query = query.eq("date", dateFilter);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: attempts, error } = await query;

    if (error) {
      console.error("Error fetching game attempts:", error);
      return NextResponse.json(
        { error: "Failed to fetch game attempts" },
        { status: 500 }
      );
    }

    // If stats requested, calculate additional statistics
    if (includeStats && attempts) {
      const stats = {
        totalGames: attempts.length,
        totalWins: attempts.filter((a: any) => a.won).length,
        totalLosses: attempts.filter((a: any) => a.won === false).length,
        winRate: attempts.length > 0 
          ? (attempts.filter((a: any) => a.won).length / attempts.length) * 100 
          : 0,
        averageAttempts: attempts.length > 0
          ? attempts.reduce((sum: number, a: any) => sum + a.attempts, 0) / attempts.length
          : 0,
        currentStreak: calculateCurrentStreak(attempts),
        longestStreak: calculateLongestStreak(attempts),
      };

      return NextResponse.json({ attempts, stats });
    }

    return NextResponse.json({ attempts });
  } catch (error) {
    console.error("Unexpected error in GET /api/daily-game-attempts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Save or update a daily game attempt
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

    const body: DailyGameAttemptData = await req.json();
    const {
      date,
      targetPokemonId,
      isShiny,
      guesses,
      attempts,
      won,
      pokemonGuessed,
      hintsUsed = 0,
    } = body;

    // Validate required fields
    if (!date || !targetPokemonId || !guesses || attempts === undefined || won === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: date, targetPokemonId, guesses, attempts, won" },
        { status: 400 }
      );
    }

    // Validate attempts is between 1 and 4
    if (attempts < 1 || attempts > 4) {
      return NextResponse.json(
        { error: "Attempts must be between 1 and 4" },
        { status: 400 }
      );
    }

    // Check if user already has an attempt for this date
    const { data: existingAttempt } = await supabaseAdmin
      .from("daily_game_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("date", date)
      .single();

    if (existingAttempt) {
      // Update existing attempt
      const { data: updatedAttempt, error } = await supabaseAdmin
        .from("daily_game_attempts")
        .update({
          target_pokemon_id: targetPokemonId,
          is_shiny: isShiny,
          guesses: guesses,
          attempts: attempts,
          won: won,
          pokemon_guessed: pokemonGuessed || null,
          hints_used: hintsUsed || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAttempt.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating game attempt:", error);
        return NextResponse.json(
          { error: "Failed to update game attempt" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Game attempt updated successfully",
        attempt: updatedAttempt,
      });
    } else {
      // Create new attempt
      const { data: newAttempt, error } = await supabaseAdmin
        .from("daily_game_attempts")
        .insert({
          user_id: userId,
          date: date,
          target_pokemon_id: targetPokemonId,
          is_shiny: isShiny,
          guesses: guesses,
          attempts: attempts,
          won: won,
          pokemon_guessed: pokemonGuessed || null,
          hints_used: hintsUsed || 0,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving game attempt:", error);
        return NextResponse.json(
          { error: "Failed to save game attempt" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Game attempt saved successfully",
        attempt: newAttempt,
      });
    }
  } catch (error) {
    console.error("Unexpected error in POST /api/daily-game-attempts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to calculate current streak
function calculateCurrentStreak(attempts: any[]): number {
  if (attempts.length === 0) return 0;

  // Sort by date descending
  const sorted = [...attempts].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if they played today or yesterday
  let expectedDate = new Date(today);
  let foundYesterday = false;

  for (const attempt of sorted) {
    const attemptDate = new Date(attempt.date);
    attemptDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((today.getTime() - attemptDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      // Played today
      streak = 1;
      expectedDate = new Date(attemptDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
      foundYesterday = true;
    } else if (daysDiff === 1 && foundYesterday) {
      // Played yesterday (continuation of streak)
      streak++;
      expectedDate = new Date(attemptDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (daysDiff === streak && foundYesterday) {
      // Consecutive day
      streak++;
      expectedDate = new Date(attemptDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      // Streak broken
      break;
    }
  }

  return streak;
}

// Helper function to calculate longest streak
function calculateLongestStreak(attempts: any[]): number {
  if (attempts.length === 0) return 0;

  // Sort by date ascending
  const sorted = [...attempts].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(sorted[i - 1].date);
    const currDate = new Date(sorted[i].date);
    
    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      // Consecutive day
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      // Streak broken
      currentStreak = 1;
    }
  }

  return longestStreak;
}

