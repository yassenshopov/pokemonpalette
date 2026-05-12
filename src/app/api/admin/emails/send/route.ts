import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { EmailService, type EmailTemplate, type EmailTemplateData } from "@/lib/email-service";
import { getDailyPaletteForDate } from "@/lib/game/daily-palette";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { clientEnv } from "@/lib/env";
import { emailSendRequestSchema } from "@/lib/email-templates/validation";

type RecipientUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  receivesDailyEmails: boolean;
};

// Email blasts have to be rate-limited harder than the preview path:
// each call kicks off a Resend batch that costs money + counts against
// the org quota, and an admin with a leaked session is the textbook
// abuse case. 5/minute lets a real admin send a few burst campaigns
// before the cool-down without making it trivial to spray hundreds of
// emails.
const sendLimiter = rateLimit("admin-emails-send", {
  requests: 5,
  window: "1 m",
});

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const rl = await sendLimiter.check(gate.adminUserId);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = emailSendRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const payload = parsed.data;
    const baseUrl =
      clientEnv.NEXT_PUBLIC_BASE_URL ?? "https://www.pokemonpalette.com";

    if (payload.template === "daily-nudge") {
      payload.data.gameUrl = `${baseUrl}/game`;
    } else if (payload.template === "daily-drop") {
      payload.data.gameUrl = `${baseUrl}/game`;
      payload.data.baseUrl = baseUrl;
      // Resolve today's daily palette once per send so every recipient
      // gets the same swatches that match the current /game challenge.
      const dailyPalette = await getDailyPaletteForDate();
      if (dailyPalette) {
        payload.data.previewColors = dailyPalette.colors;
      }
    }

    let recipients: string[] = [];
    let users: RecipientUser[] = [];

    if (payload.userIds && payload.userIds.length > 0) {
      const rows = await prisma.user.findMany({
        where: {
          id: { in: payload.userIds },
          isDeleted: false,
          email: { not: null },
          ...(payload.template === "daily-nudge" ||
          payload.template === "daily-drop"
            ? { receivesDailyEmails: true }
            : {}),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          receivesDailyEmails: true,
        },
      });
      users = rows
        .filter((r): r is RecipientUser & { email: string } => r.email !== null)
        .map((r) => ({
          id: r.id,
          email: r.email as string,
          firstName: r.firstName,
          lastName: r.lastName,
          receivesDailyEmails: r.receivesDailyEmails,
        }));
      recipients = users
        .map((u) => u.email)
        .filter((e): e is string => EmailService.isValidEmail(e));
    }

    if (payload.to) {
      const customEmails = Array.isArray(payload.to) ? payload.to : [payload.to];
      const validCustomEmails = customEmails.filter((email) =>
        EmailService.isValidEmail(email),
      );
      recipients = [...recipients, ...validCustomEmails];
    }

    const uniqueRecipients = Array.from(
      new Map(recipients.map((email) => [email.toLowerCase(), email])).values(),
    );

    if (uniqueRecipients.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found" },
        { status: 400 },
      );
    }

    recipients = uniqueRecipients;

    // Resend allows 2 requests per second — send in batches of 2 every 500ms.
    // EmailService.sendEmail persists each send to the `emails` table on
    // its own; this route just collects per-recipient results for the UI.
    const batchSize = 2;
    const delayBetweenBatches = 500;
    const results: Array<{
      email: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const user = users.find((u) => u.email === email);
          let personalizedData: EmailTemplateData[EmailTemplate] = {
            ...payload.data,
          } as EmailTemplateData[EmailTemplate];
          if (
            payload.template === "daily-nudge" ||
            payload.template === "daily-drop"
          ) {
            if (user) {
              personalizedData = {
                ...personalizedData,
                userName:
                  user.firstName || user.lastName
                    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                    : undefined,
              } as EmailTemplateData[EmailTemplate];
            }
          }

          const result = await EmailService.sendEmail({
            to: email,
            template: payload.template,
            data: personalizedData,
            userId: user?.id,
          });

          return {
            email,
            success: result.success,
            messageId: result.messageId,
            error: result.error,
          };
        }),
      );

      results.push(...batchResults);

      if (i + batchSize < recipients.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenBatches),
        );
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
      total: recipients.length,
      results,
    });
  } catch (err) {
    logger.error("admin.emails.send.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 },
    );
  }
}
