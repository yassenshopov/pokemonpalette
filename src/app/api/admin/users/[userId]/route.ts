import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

// GET - Get user + aggregate stats (detail view data).
// Embedded lists (games, palettes) fetch their own data via the list APIs
// filtered by user_id so they inherit sort/search/pagination.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const { userId } = await params;

    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("is_deleted", false)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [
      { count: totalGames },
      { count: totalWins },
      { count: totalPalettes },
    ] = await Promise.all([
      supabaseAdmin
        .from("daily_game_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabaseAdmin
        .from("daily_game_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("won", true),
      supabaseAdmin
        .from("saved_palettes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    const games = totalGames ?? 0;
    const wins = totalWins ?? 0;
    const losses = games - wins;
    const winRate = games > 0 ? (wins / games) * 100 : 0;

    // Pull a slim recent-attempts list (last 30) for overview sparkline.
    const { data: recentAttempts } = await supabaseAdmin
      .from("daily_game_attempts")
      .select("id, date, won, attempts, hints_used, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    return NextResponse.json({
      user,
      stats: {
        totalGames: games,
        totalWins: wins,
        totalLosses: losses,
        winRate: Math.round(winRate * 100) / 100,
        totalPalettes: totalPalettes ?? 0,
      },
      recentAttempts: recentAttempts ?? [],
    });
  } catch (err) {
    console.error("Unexpected error in GET /api/admin/users/[userId]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH - Update mutable admin fields.
// Body: { banned?, locked?, is_admin? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const { userId } = await params;

    let body: { banned?: unknown; locked?: unknown; is_admin?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (userId === gate.adminUserId && body.is_admin === false) {
      return NextResponse.json(
        { error: "Admins cannot demote themselves." },
        { status: 400 },
      );
    }

    const patch: Record<string, boolean> = {};
    if (typeof body.banned === "boolean") patch.banned = body.banned;
    if (typeof body.locked === "boolean") patch.locked = body.locked;
    if (typeof body.is_admin === "boolean") patch.is_admin = body.is_admin;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(patch)
      .eq("id", userId)
      .eq("is_deleted", false)
      .select("*")
      .single();

    if (error || !data) {
      console.error("Error updating user:", error);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 },
      );
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("Unexpected error in PATCH /api/admin/users/[userId]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE - Soft-delete a user (is_deleted = true).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const { userId } = await params;

    if (userId === gate.adminUserId) {
      return NextResponse.json(
        { error: "Admins cannot delete themselves." },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ is_deleted: true })
      .eq("id", userId);

    if (error) {
      console.error("Error deleting user:", error);
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unexpected error in DELETE /api/admin/users/[userId]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
