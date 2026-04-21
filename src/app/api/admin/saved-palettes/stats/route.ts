import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const { data, error } = await supabaseAdmin.rpc("admin_palette_stats");
    if (error) {
      console.error("palette stats rpc error", error);
      return NextResponse.json(
        { error: "Failed to compute palette stats" },
        { status: 500 },
      );
    }
    return NextResponse.json(data ?? {});
  } catch (err) {
    console.error("Unexpected error in GET palette stats:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
