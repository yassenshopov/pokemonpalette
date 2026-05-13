import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_RETENTION_DAYS = 30;

/**
 * Vercel Cron endpoint for the email-body retention policy.
 *
 * Schedule lives in `vercel.json`; the platform calls this route once
 * a day with `Authorization: Bearer ${CRON_SECRET}`. The handler:
 *
 *   1. Verifies the bearer token against `CRON_SECRET`. Anyone hitting
 *      this URL without the secret gets a 401 — the job mutates data.
 *   2. Calls the `prune_email_bodies(retention_days)` SECURITY DEFINER
 *      function in Postgres (see migration 028). Nulls
 *      `html_content` / `text_content` on every row older than the
 *      retention horizon while preserving the row + its metadata for
 *      audit purposes.
 *
 * The retention horizon can be overridden via the `?retention=N`
 * query param for ad-hoc runs (e.g. an admin triggers a tighter
 * cleanup). The default matches migration 028.
 */
export async function GET(req: NextRequest) {
  const secret = serverEnv.CRON_SECRET;
  // We refuse to run when the secret isn't configured — better to
  // 503 the cron call and surface the misconfig in Vercel's UI than
  // to leave the job silently authless on a half-deployed prod.
  if (!secret) {
    logger.error("cron.prune_email_bodies.secret_missing");
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retentionRaw = req.nextUrl.searchParams.get("retention");
  let retention = DEFAULT_RETENTION_DAYS;
  if (retentionRaw !== null) {
    const parsed = Number.parseInt(retentionRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3650) {
      return NextResponse.json(
        { error: "Invalid retention (expected positive integer ≤ 3650)" },
        { status: 400 },
      );
    }
    retention = parsed;
  }

  try {
    // Run via the SECURITY DEFINER Postgres function so the policy
    // logic + access checks live with the table, not split between
    // Node and SQL. The Supabase service-role client is the only
    // caller granted EXECUTE on the function (see migration 028).
    const { data, error } = await supabaseAdmin.rpc("prune_email_bodies", {
      retention_days: retention,
    });

    if (error) {
      logger.error("cron.prune_email_bodies.rpc_failed", {
        error: error.message,
      });
      return NextResponse.json(
        { error: "Prune failed" },
        { status: 500 },
      );
    }

    const affected = typeof data === "number" ? data : 0;
    logger.info("cron.prune_email_bodies.completed", {
      retention,
      affected,
    });

    return NextResponse.json({ ok: true, retention, affected });
  } catch (err) {
    logger.error("cron.prune_email_bodies.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Prune failed" },
      { status: 500 },
    );
  }
}
