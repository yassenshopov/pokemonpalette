import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET - Get users with emails for email sending (admin only)
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const users = await prisma.user.findMany({
      where: { isDeleted: false, email: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        imageUrl: true,
        profileImageUrl: true,
      },
    });

    const validUsers = users
      .filter((u) => u.email && EMAIL_RE.test(u.email))
      .map((u) => ({
        id: u.id,
        email: u.email,
        name:
          u.firstName || u.lastName
            ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
            : u.username || u.email?.split("@")[0] || "User",
        first_name: u.firstName ?? null,
        last_name: u.lastName ?? null,
        username: u.username ?? null,
        image_url: u.imageUrl ?? null,
        profile_image_url: u.profileImageUrl ?? null,
      }));

    return NextResponse.json({ users: validUsers });
  } catch (err) {
    logger.error("admin.emails.users.fetch_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
