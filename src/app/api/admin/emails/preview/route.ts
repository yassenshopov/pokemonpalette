import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { EmailService } from "@/lib/email-service";
import { getDailyPaletteForDate } from "@/lib/game/daily-palette";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { clientEnv } from "@/lib/env";
import {
  emailRequestSchema,
  asTemplateData,
  type EmailRequest,
} from "@/lib/email-templates/validation";

// Even admin-only routes benefit from a per-user rate cap: the email
// preview path renders a full HTML template per call and is exposed
// to any signed-in admin (incl. a transient session-takeover). Keep
// the limit generous so legitimate admin UX is never blocked.
const previewLimiter = rateLimit("admin-emails-preview", {
  requests: 60,
  window: "1 m",
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const rl = await previewLimiter.check(admin.adminUserId);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = emailRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const payload: EmailRequest = parsed.data;
    // Both templates expect a fully-qualified gameUrl; the admin UI
    // omits it and lets the server stamp the canonical value so the
    // preview matches what users will actually receive. Same for
    // `baseUrl` on the daily-drop preview. We pull from `clientEnv`
    // (not raw `process.env`) so a missing var fails at boot rather
    // than at the first call, and so the schema-validated default
    // is consistent across preview / send / cron paths.
    const baseUrl =
      clientEnv.NEXT_PUBLIC_BASE_URL ?? "https://www.pokemonpalette.com";

    if (payload.template === "daily-nudge") {
      payload.data.gameUrl = `${baseUrl}/game`;
    } else if (payload.template === "daily-drop") {
      payload.data.gameUrl = `${baseUrl}/game`;
      payload.data.baseUrl = baseUrl;
      // Always show the actual palette for today's daily Pokémon so the
      // preview matches what recipients will see when this email lands.
      const dailyPalette = await getDailyPaletteForDate();
      if (dailyPalette) {
        payload.data.previewColors = dailyPalette.colors;
      }
    }

    const typed = asTemplateData<typeof payload.template>(payload);
    const preview = EmailService.previewTemplate(typed.template, typed.data);

    return NextResponse.json({ preview });
  } catch (error) {
    logger.error("admin.emails.preview.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to preview email" },
      { status: 500 },
    );
  }
}
