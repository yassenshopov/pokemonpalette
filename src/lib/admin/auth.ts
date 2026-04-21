import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export type AdminAuthSuccess = { ok: true; adminUserId: string };
export type AdminAuthFailure = { ok: false; response: NextResponse };

/**
 * Verifies the caller is signed in and has `is_admin = true` in the users
 * table. Returns a `NextResponse` error response on failure so callers can
 * simply `return result.response`.
 */
export async function requireAdmin(): Promise<AdminAuthSuccess | AdminAuthFailure> {
  let adminUserId: string | null = null;
  try {
    const authResult = await auth();
    adminUserId = authResult.userId;
  } catch (err) {
    console.error("Auth error:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      ),
    };
  }

  if (!adminUserId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: currentUser, error } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", adminUserId)
    .eq("is_deleted", false)
    .single();

  if (error || !currentUser || !currentUser.is_admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, adminUserId };
}
