import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 1000;

// GET - Paginated list of users with valid emails for the admin email
// composer. The previous implementation returned every non-deleted user
// with a non-null email in a single response, which on a userbase that's
// grown into the tens of thousands meant ~10 MB JSON and a ~2 s server
// roundtrip. The composer now requests pages of 200 by default
// (configurable via `pageSize`, capped at 1,000), and the response
// includes a `nextCursor` so the client can keep paging until exhausted.
//
// Cursor format: the `createdAt|id` pair from the last row of the
// previous page. `id` breaks the tie when two rows share an exact
// timestamp (rare with timestamptz + clerk's createdAt) so pagination
// is fully stable across multiple requests.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const url = new URL(req.url);
  const pageSizeParam = parseInt(url.searchParams.get("pageSize") ?? "", 10);
  const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0
    ? Math.min(MAX_PAGE_SIZE, pageSizeParam)
    : DEFAULT_PAGE_SIZE;

  const cursorParam = url.searchParams.get("cursor");
  let cursorWhere: { OR: Array<Record<string, unknown>> } | undefined;
  if (cursorParam) {
    const [iso, id] = cursorParam.split("|");
    const cursorDate = iso ? new Date(iso) : null;
    if (cursorDate && !Number.isNaN(cursorDate.getTime()) && id) {
      cursorWhere = {
        OR: [
          { createdAt: { lt: cursorDate } },
          { AND: [{ createdAt: cursorDate }, { id: { lt: id } }] },
        ],
      };
    }
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        isDeleted: false,
        email: { not: null },
        ...(cursorWhere ?? {}),
      },
      // Stable composite order — necessary for cursor pagination to not
      // skip or repeat rows when several users share a millisecond.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1, // overshoot by one to detect "has more"
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        imageUrl: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    const hasMore = users.length > pageSize;
    const page = hasMore ? users.slice(0, pageSize) : users;

    const validUsers = page
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

    const lastUser = page[page.length - 1];
    const nextCursor =
      hasMore && lastUser
        ? `${lastUser.createdAt.toISOString()}|${lastUser.id}`
        : null;

    return NextResponse.json({
      users: validUsers,
      nextCursor,
      pageSize,
      hasMore,
    });
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
