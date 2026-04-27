import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { EmailService, EmailTemplate, EmailTemplateData } from "@/lib/email-service";
import { getDailyPaletteForDate } from "@/lib/game/daily-palette";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const body = await req.json();
    const { template, data } = body as {
      template: EmailTemplate;
      data: EmailTemplateData[EmailTemplate];
    };

    if (!template) {
      return NextResponse.json({ error: "Template is required" }, { status: 400 });
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
      // Always show the actual palette for today's daily Pokémon so the
      // preview matches what recipients will see when this email lands.
      const dailyPalette = await getDailyPaletteForDate();
      if (dailyPalette) {
        dropData.previewColors = dailyPalette.colors;
      }
    }

    const preview = EmailService.previewTemplate(template, data);

    return NextResponse.json({ preview });
  } catch (error) {
    logger.error("admin.emails.preview.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to preview email" },
      { status: 500 }
    );
  }
}
