import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

const MAX_IDS = 1000;

// POST - Bulk delete palettes. Body: { ids: string[] }.
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    let body: { ids?: unknown };
    try {
      body = (await req.json()) as { ids?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.length > 0,
        )
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json(
        { error: `Too many ids (max ${MAX_IDS})` },
        { status: 400 },
      );
    }

    const { error, count } = await supabaseAdmin
      .from("saved_palettes")
      .delete({ count: "exact" })
      .in("id", ids);

    if (error) {
      console.error("Bulk palette delete error:", error);
      return NextResponse.json(
        { error: "Bulk delete failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, affected: count ?? 0 });
  } catch (err) {
    console.error("Unexpected error in POST saved-palettes/bulk:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
