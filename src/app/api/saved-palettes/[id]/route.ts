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

// DELETE - Remove a saved palette
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let userId: string | null = null;

    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Palette ID is required" },
        { status: 400 }
      );
    }

    // Verify the palette belongs to the user before deleting
    const { data: palette, error: fetchError } = await supabaseAdmin
      .from("saved_palettes")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !palette) {
      return NextResponse.json({ error: "Palette not found" }, { status: 404 });
    }

    if (palette.user_id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to delete this palette" },
        { status: 403 }
      );
    }

    // Delete the palette
    const { error: deleteError } = await supabaseAdmin
      .from("saved_palettes")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting saved palette:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete palette" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Palette deleted successfully",
    });
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/saved-palettes/[id]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
