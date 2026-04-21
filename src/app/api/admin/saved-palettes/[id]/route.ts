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

    const { data: palette, error } = await supabaseAdmin
      .from("saved_palettes")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !palette) {
      return NextResponse.json({ error: "Palette not found" }, { status: 404 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, username, first_name, last_name, image_url, profile_image_url")
      .eq("id", palette.user_id)
      .maybeSingle();

    // Pull a slim list of related palettes for the same pokemon (same species).
    const { data: related } = await supabaseAdmin
      .from("saved_palettes")
      .select("id, user_id, pokemon_id, pokemon_name, is_shiny, colors, image_url, created_at")
      .eq("pokemon_id", palette.pokemon_id)
      .neq("id", palette.id)
      .order("created_at", { ascending: false })
      .limit(8);

    return NextResponse.json({
      palette,
      user: user ?? null,
      related: related ?? [],
    });
  } catch (err) {
    console.error("Unexpected error in GET palette [id]:", err);
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
      .from("saved_palettes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting palette:", error);
      return NextResponse.json(
        { error: "Failed to delete palette" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unexpected error in DELETE palette [id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
