import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import {
  EmailService,
  EmailTemplate,
  EmailTemplateData,
} from "@/lib/email-service";
import { getDailyPaletteForDate } from "@/lib/game/daily-palette";
import { logger } from "@/lib/logger";

type RecipientUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  receivesDailyEmails: boolean;
};

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const { template, data, to, userIds } = body as {
      template: EmailTemplate;
      data: EmailTemplateData[EmailTemplate];
      to?: string | string[];
      userIds?: string[];
    };

    if (!template) {
      return NextResponse.json(
        { error: "Template is required" },
        { status: 400 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://www.pokemonpalette.com";

    if (template === "daily-nudge") {
      const nudgeData = data as EmailTemplateData["daily-nudge"];
      nudgeData.gameUrl = `${baseUrl}/game`;
    } else if (template === "daily-drop") {
      const dropData = data as EmailTemplateData["daily-drop"];
      dropData.gameUrl = `${baseUrl}/game`;
      dropData.baseUrl = baseUrl;
      // Resolve today's daily palette once per send so every recipient
      // gets the same swatches that match the current /game challenge.
      const dailyPalette = await getDailyPaletteForDate();
      if (dailyPalette) {
        dropData.previewColors = dailyPalette.colors;
      }
    }

    let recipients: string[] = [];
    let users: RecipientUser[] = [];

    if (userIds && userIds.length > 0) {
      const rows = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          isDeleted: false,
          email: { not: null },
          ...(template === "daily-nudge" || template === "daily-drop"
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
        .filter((r): r is RecipientUser & { email: string } =>
          r.email !== null,
        )
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

    if (to) {
      const customEmails = Array.isArray(to) ? to : [to];
      const validCustomEmails = customEmails.filter((email) =>
        EmailService.isValidEmail(email),
      );
      recipients = [...recipients, ...validCustomEmails];
    }

    const uniqueRecipients = Array.from(
      new Map(
        recipients.map((email) => [email.toLowerCase(), email]),
      ).values(),
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
          let personalizedData = { ...data };
          if (template === "daily-nudge" || template === "daily-drop") {
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
            template,
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
