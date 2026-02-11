import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_PALETTE_SIZES = [3, 4, 5, 6] as const;

// GET - Get user's palette size preference
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("palette_size")
      .eq("id", userId)
      .eq("is_deleted", false)
      .single();

    if (userError) {
      console.error("Error fetching palette preference:", userError);
      return NextResponse.json(
        { error: "Failed to fetch palette preference" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const size = user.palette_size ?? 3;
    const validSize = VALID_PALETTE_SIZES.includes(size as (typeof VALID_PALETTE_SIZES)[number])
      ? size
      : 3;

    return NextResponse.json({ paletteSize: validSize });
  } catch (error) {
    console.error("Unexpected error in GET /api/account/palette-preference:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update user's palette size preference
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { paletteSize } = body as { paletteSize: number };

    if (
      typeof paletteSize !== "number" ||
      !Number.isInteger(paletteSize) ||
      !VALID_PALETTE_SIZES.includes(paletteSize as (typeof VALID_PALETTE_SIZES)[number])
    ) {
      return NextResponse.json(
        { error: "paletteSize must be 3, 4, 5, or 6" },
        { status: 400 }
      );
    }

    const { data: user, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ palette_size: paletteSize })
      .eq("id", userId)
      .eq("is_deleted", false)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating palette preference:", updateError);
      return NextResponse.json(
        { error: "Failed to update palette preference" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      paletteSize: user.palette_size ?? 3,
    });
  } catch (error) {
    console.error("Unexpected error in PUT /api/account/palette-preference:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
