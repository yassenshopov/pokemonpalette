import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Opportunistically captures the caller's country and timezone from Vercel's
 * edge geo headers and stores them on `users.country_code` / `users.timezone`.
 *
 * Privacy posture (kept deliberately tight):
 *
 *   - No IP storage. We only persist the ISO-3166-1 alpha-2 country and an
 *     IANA timezone string, both derived by the edge runtime, never the
 *     raw client IP.
 *   - No region or city. Vercel exposes those headers too, but storing
 *     finer-grained location is opt-in territory we don't need for the
 *     admin map card.
 *   - One write per user per ~30 days. `geo_updated_at` throttles the
 *     upsert so a chatty client cannot turn this into a per-request DB
 *     mutation.
 *   - Auth required. Anonymous browsers do not get a row.
 *
 * Headers consulted (case-insensitive — Next normalizes to lowercase):
 *   x-vercel-ip-country           ISO-3166-1 alpha-2 (e.g. "US")
 *   x-vercel-ip-timezone          IANA TZ          (e.g. "America/New_York")
 *
 * Outside Vercel (local dev), the headers are absent and we no-op so the
 * client ping is harmless. Operators can simulate the headers with
 * `--add-header` for testing.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

const COUNTRY_RE = /^[A-Z]{2}$/;
const TZ_RE = /^[A-Za-z]+(?:[\/_+-][A-Za-z0-9_+-]+)*$/;

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (err) {
    logger.warn("api.me.geo.auth_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Vercel sets these on every request from its edge network. Both lookup
  // paths are tried so this also works when called from the proxy headers
  // some preview environments forward.
  const rawCountry =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("x-country") ??
    null;
  const rawTimezone =
    req.headers.get("x-vercel-ip-timezone") ??
    req.headers.get("x-timezone") ??
    null;

  const country = rawCountry ? rawCountry.toUpperCase() : null;
  const timezone = rawTimezone ? rawTimezone.trim() : null;

  // Defensive validation. Vercel's headers are well-shaped but we don't
  // want a malformed value (or a spoofed value forwarded by a misconfigured
  // proxy) to land in the DB and trip the CHECK constraint.
  const safeCountry =
    country && COUNTRY_RE.test(country) ? country : null;
  const safeTimezone =
    timezone && timezone.length <= 64 && TZ_RE.test(timezone)
      ? timezone
      : null;

  if (!safeCountry && !safeTimezone) {
    // No usable headers (likely local dev or a misconfigured CDN). We
    // intentionally still return 200 so the client doesn't retry forever.
    return NextResponse.json({ ok: true, captured: false });
  }

  // The reads/writes below use $queryRaw / $executeRaw because they touch
  // columns added in migration 021 (`country_code`, `timezone`,
  // `geo_updated_at`). Going through the typed Prisma client would force
  // every consumer to re-run `prisma generate`, which fights with the dev
  // server's engine-DLL lock on Windows. The DB is the source of truth;
  // these statements work whether or not the generated client has caught up.
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        country_code: string | null;
        timezone: string | null;
        geo_updated_at: Date | null;
        is_deleted: boolean;
      }>
    >`
      SELECT country_code, timezone, geo_updated_at, is_deleted
      FROM public.users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const existing = rows[0];

    if (!existing || existing.is_deleted) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const fresh =
      existing.geo_updated_at &&
      Date.now() - existing.geo_updated_at.getTime() < REFRESH_INTERVAL_MS;
    const sameCountry =
      safeCountry === null || existing.country_code === safeCountry;
    const sameTimezone =
      safeTimezone === null || existing.timezone === safeTimezone;

    if (fresh && sameCountry && sameTimezone) {
      return NextResponse.json({ ok: true, captured: false, fresh: true });
    }

    const nextCountry = safeCountry ?? existing.country_code;
    const nextTimezone = safeTimezone ?? existing.timezone;

    await prisma.$executeRaw`
      UPDATE public.users
      SET country_code   = ${nextCountry},
          timezone       = ${nextTimezone},
          geo_updated_at = now()
      WHERE id = ${userId}
    `;

    return NextResponse.json({ ok: true, captured: true });
  } catch (err) {
    logger.error("api.me.geo.update_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
