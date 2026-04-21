import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

type BulkOp = "ban" | "unban" | "delete" | "lock" | "unlock";

interface BulkBody {
  ids?: unknown;
  op?: unknown;
}

const MAX_IDS = 1000;

// POST - Run a bulk operation on a set of user IDs.
// Body: { ids: string[], op: 'ban' | 'unban' | 'delete' | 'lock' | 'unlock' }
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    let body: BulkBody;
    try {
      body = (await req.json()) as BulkBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const op = body.op as BulkOp | undefined;
    if (!op || !["ban", "unban", "delete", "lock", "unlock"].includes(op)) {
      return NextResponse.json({ error: "Invalid op" }, { status: 400 });
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

    // Prevent self-harm: remove the caller's own id from any destructive op.
    const safeIds =
      op === "delete" || op === "ban" || op === "lock"
        ? ids.filter((id) => id !== gate.adminUserId)
        : ids;

    if (safeIds.length === 0) {
      return NextResponse.json(
        { error: "Refusing to act on yourself." },
        { status: 400 },
      );
    }

    let patch: Record<string, boolean> = {};
    switch (op) {
      case "ban":
        patch = { banned: true };
        break;
      case "unban":
        patch = { banned: false };
        break;
      case "lock":
        patch = { locked: true };
        break;
      case "unlock":
        patch = { locked: false };
        break;
      case "delete":
        patch = { is_deleted: true };
        break;
    }

    const { error, count } = await supabaseAdmin
      .from("users")
      .update(patch, { count: "exact" })
      .in("id", safeIds);

    if (error) {
      console.error("Bulk users update error:", error);
      return NextResponse.json(
        { error: "Bulk operation failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      affected: count ?? 0,
      skipped: ids.length - safeIds.length,
    });
  } catch (err) {
    console.error("Unexpected error in POST /api/admin/users/bulk:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
