import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const url = new URL(req.url);
  const templateFilter = url.searchParams.get("template");
  const requestedLimit = Number.parseInt(
    url.searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const logs = await prisma.email.findMany({
      where: templateFilter ? { templateType: templateFilter } : undefined,
      orderBy: { sentAt: "desc" },
      take: limit,
      select: {
        id: true,
        recipientEmail: true,
        senderEmail: true,
        senderName: true,
        subject: true,
        templateType: true,
        status: true,
        errorMessage: true,
        sentAt: true,
      },
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        recipientEmail: log.recipientEmail,
        senderEmail: log.senderEmail,
        senderName: log.senderName,
        subject: log.subject,
        templateType: log.templateType,
        status: log.status,
        errorMessage: log.errorMessage,
        sentAt: log.sentAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error("admin.emails.logs.fetch_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch email logs" },
      { status: 500 },
    );
  }
}
