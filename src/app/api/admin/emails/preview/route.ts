import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { EmailService, EmailTemplate, EmailTemplateData } from "@/lib/email-service";
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
