import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { DAILY_PING_URLS, submitToIndexNow } from "@/lib/indexnow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vercel Cron endpoint — pings IndexNow once a day for the URLs that
 * legitimately change every day (home rotation, daily-puzzle meta,
 * explore featured palette, the "guess the pokemon" landing).
 *
 * Schedule (vercel.json): a few minutes after UTC midnight, so the
 * daily-pool rotation has flipped and the new weekly theme is reflected
 * in the meta + JSON-LD before we ping Bing.
 *
 * Auth model mirrors the existing `prune-email-bodies` cron: Vercel
 * sends `Authorization: Bearer ${CRON_SECRET}` on every invocation; we
 * refuse anything without it. The endpoint is otherwise idempotent and
 * cheap (one outbound POST), so repeated triggers from a misconfigured
 * cron are harmless aside from cosmetic Vercel log noise.
 */
export async function GET(req: NextRequest) {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) {
    logger.error("cron.indexnow_ping.secret_missing");
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await submitToIndexNow(DAILY_PING_URLS);
  logger.info("cron.indexnow_ping.completed", {
    submitted: result.submitted,
    status: result.status,
    ok: result.ok,
  });

  return NextResponse.json({
    ok: result.ok,
    submitted: result.submitted,
    status: result.status,
  });
}
