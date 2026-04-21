import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const { id } = await params;

    const { data: attempt, error } = await supabaseAdmin
      .from("daily_game_attempts")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, username, first_name, last_name, image_url, profile_image_url",
      )
      .eq("id", attempt.user_id)
      .maybeSingle();

    return NextResponse.json({
      attempt,
      user: user ?? null,
    });
  } catch (err) {
    console.error("Unexpected error in GET game-data [id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const { id } = await params;
    const { error } = await supabaseAdmin
      .from("daily_game_attempts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting attempt:", error);
      return NextResponse.json(
        { error: "Failed to delete attempt" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unexpected error in DELETE game-data [id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
