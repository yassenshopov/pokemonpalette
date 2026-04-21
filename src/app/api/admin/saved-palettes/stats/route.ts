import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const { data, error } = await supabaseAdmin.rpc("admin_palette_stats");
    if (error) {
      logger.error("admin.palette-stats.rpc_failed", { error: error.message });
      return NextResponse.json(
        { error: "Failed to compute palette stats" },
        { status: 500 },
      );
    }
    return NextResponse.json(data ?? {});
  } catch (err) {
    logger.error("admin.palette-stats.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
