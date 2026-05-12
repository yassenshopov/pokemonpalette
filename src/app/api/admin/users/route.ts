import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { parseAdminQuery } from "@/lib/admin/query";
import { logger } from "@/lib/logger";

const SORTABLE = [
  "created_at",
  "last_active_at",
  "last_sign_in_at",
  "email",
  "username",
] as const;

const SORT_MAP: Record<(typeof SORTABLE)[number], keyof Prisma.UserOrderByWithRelationInput> = {
  created_at: "createdAt",
  last_active_at: "lastActiveAt",
  last_sign_in_at: "lastSignInAt",
  email: "email",
  username: "username",
};

const FILTER_KEYS = [
  "status",
  "two_factor",
  "is_admin",
  "created_from",
  "created_to",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

const CSV_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "email", header: "Email" },
  { key: "username", header: "Username" },
  { key: "first_name", header: "First name" },
  { key: "last_name", header: "Last name" },
  { key: "banned", header: "Banned" },
  { key: "locked", header: "Locked" },
  { key: "two_factor_enabled", header: "2FA" },
  { key: "is_admin", header: "Admin" },
  { key: "created_at", header: "Created at" },
  { key: "last_active_at", header: "Last active" },
  { key: "last_sign_in_at", header: "Last sign in" },
];

const CSV_ROW_LIMIT = 50_000;
const CSV_CHUNK_SIZE = 1_000;

// Tight projection used only by the CSV exporter — strictly the columns
// that appear in `CSV_COLUMNS`, skipping the four JSONB blobs (email
// addresses, phone numbers, external accounts, public metadata) and a
// handful of derived flags the CSV doesn't surface. Cuts the per-row
// wire payload by roughly an order of magnitude for the typical row.
const CSV_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  banned: true,
  locked: true,
  twoFactorEnabled: true,
  totpEnabled: true,
  isAdmin: true,
  createdAt: true,
  lastActiveAt: true,
  lastSignInAt: true,
} as const;

type CsvUserRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  banned: boolean;
  locked: boolean;
  twoFactorEnabled: boolean;
  totpEnabled: boolean;
  isAdmin: boolean;
  createdAt: Date;
  lastActiveAt: Date | null;
  lastSignInAt: Date | null;
};

function toCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRowFor(user: CsvUserRow): string {
  // Field order must match the CSV_COLUMNS header order below.
  return [
    user.id,
    user.email,
    user.username,
    user.firstName,
    user.lastName,
    user.banned,
    user.locked,
    user.twoFactorEnabled || user.totpEnabled,
    user.isAdmin,
    user.createdAt,
    user.lastActiveAt,
    user.lastSignInAt,
  ]
    .map(toCsvField)
    .join(",");
}

function streamUsersCsv(
  where: Prisma.UserWhereInput,
  orderBy: Prisma.UserOrderByWithRelationInput,
): NextResponse {
  const encoder = new TextEncoder();
  const headerLine = CSV_COLUMNS.map((c) => c.header).join(",");

  // We page with `skip + take` for compatibility with arbitrary
  // orderBy values (cursor pagination would require the sort key to
  // be unique, which "email asc" isn't). The hard `CSV_ROW_LIMIT`
  // bounds the total work; if an admin needs more we'll add a
  // dedicated background export job.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(headerLine + "\n"));
        let fetched = 0;
        let offset = 0;
        while (fetched < CSV_ROW_LIMIT) {
          const take = Math.min(CSV_CHUNK_SIZE, CSV_ROW_LIMIT - fetched);
          const batch = (await prisma.user.findMany({
            where,
            orderBy,
            skip: offset,
            take,
            select: CSV_USER_SELECT,
          })) as CsvUserRow[];
          if (batch.length === 0) break;
          const body = batch.map(csvRowFor).join("\n") + "\n";
          controller.enqueue(encoder.encode(body));
          fetched += batch.length;
          offset += batch.length;
          if (batch.length < take) break;
        }
        controller.close();
      } catch (err) {
        logger.error("admin.users.csv_stream_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

// SECURITY: `private_metadata` and `unsafe_metadata` are intentionally
// omitted from this projection. Clerk's `privateMetadata` is documented
// as server-only state (think internal flags, debugging notes, billing
// tags); shipping it down to every admin's browser was leaking it into
// dev tools, browser caches, and anyone shoulder-surfing the admin
// console. `unsafeMetadata` is user-writable from the client and can
// contain arbitrary PII the user uploaded for their own consumption.
// Admins should never need either field for routine moderation; a
// dedicated "view raw metadata" endpoint with extra auth can be added
// later if a real workflow needs it.
//
// `public_metadata` stays — it's literally what Clerk surfaces in any
// public user lookup, and the admin UI uses it for the isAdmin flag.
//
// We return rows with snake_case keys because that's what the admin UI
// and CSV exports expect. Prisma gives us camelCase; serialize once.
function serializeUser(u: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
  profileImageUrl: string | null;
  hasImage: boolean;
  primaryEmailAddressId: string | null;
  primaryPhoneNumberId: string | null;
  banned: boolean;
  locked: boolean;
  backupCodeEnabled: boolean;
  twoFactorEnabled: boolean;
  totpEnabled: boolean;
  passwordEnabled: boolean;
  createOrganizationEnabled: boolean;
  deleteSelfEnabled: boolean;
  lastActiveAt: Date | null;
  lastSignInAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  isAdmin: boolean;
  receivesDailyEmails: boolean;
  paletteSize: number;
  emailAddresses: unknown;
  phoneNumbers: unknown;
  externalAccounts: unknown;
  publicMetadata: unknown;
}) {
  return {
    id: u.id,
    email: u.email,
    first_name: u.firstName,
    last_name: u.lastName,
    username: u.username,
    image_url: u.imageUrl,
    profile_image_url: u.profileImageUrl,
    has_image: u.hasImage,
    primary_email_address_id: u.primaryEmailAddressId,
    primary_phone_number_id: u.primaryPhoneNumberId,
    banned: u.banned,
    locked: u.locked,
    backup_code_enabled: u.backupCodeEnabled,
    two_factor_enabled: u.twoFactorEnabled,
    totp_enabled: u.totpEnabled,
    password_enabled: u.passwordEnabled,
    create_organization_enabled: u.createOrganizationEnabled,
    delete_self_enabled: u.deleteSelfEnabled,
    last_active_at: u.lastActiveAt?.toISOString() ?? null,
    last_sign_in_at: u.lastSignInAt?.toISOString() ?? null,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
    is_deleted: u.isDeleted,
    is_admin: u.isAdmin,
    receives_daily_emails: u.receivesDailyEmails,
    palette_size: u.paletteSize,
    email_addresses: u.emailAddresses,
    phone_numbers: u.phoneNumbers,
    external_accounts: u.externalAccounts,
    public_metadata: u.publicMetadata,
  };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const query = parseAdminQuery<FilterKey>(req.nextUrl.searchParams, {
    sortable: SORTABLE,
    defaultSort: { field: "created_at", dir: "desc" },
    filterKeys: FILTER_KEYS,
  });

  const pageSize = query.format === "csv" ? CSV_ROW_LIMIT : query.pageSize;
  const page = query.format === "csv" ? 1 : query.page;

  const where: Prisma.UserWhereInput = { isDeleted: false };
  if (query.q) {
    where.OR = [
      { email: { contains: query.q, mode: "insensitive" } },
      { username: { contains: query.q, mode: "insensitive" } },
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
      { id: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const { status, two_factor, is_admin, created_from, created_to } =
    query.filters;

  if (status === "banned") where.banned = true;
  else if (status === "locked") where.locked = true;
  else if (status === "active") {
    where.banned = false;
    where.locked = false;
  }

  if (two_factor === "true") {
    const twoFaOr: Prisma.UserWhereInput[] = [
      { twoFactorEnabled: true },
      { totpEnabled: true },
    ];
    // Compose with existing OR without clobbering the search OR.
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: twoFaOr }];
      delete where.OR;
    } else {
      where.OR = twoFaOr;
    }
  } else if (two_factor === "false") {
    where.twoFactorEnabled = false;
    where.totpEnabled = false;
  }

  if (is_admin === "true") where.isAdmin = true;
  else if (is_admin === "false") where.isAdmin = false;

  if (created_from) {
    const d = new Date(created_from);
    if (!Number.isNaN(d.getTime())) {
      where.createdAt = { ...(where.createdAt as object), gte: d };
    }
  }
  if (created_to) {
    const d = new Date(created_to);
    if (!Number.isNaN(d.getTime())) {
      where.createdAt = { ...(where.createdAt as object), lte: d };
    }
  }

  // Nullable columns (email, username, last_*) support `nulls: "last"`; the
  // non-nullable `createdAt` column does not. Keep the option off to satisfy
  // Prisma's discriminated union, at the cost of nulls bubbling to the top
  // on desc sorts — acceptable since we default-sort by created_at.
  const orderBy: Prisma.UserOrderByWithRelationInput = {};
  if (query.sort) {
    const field = SORT_MAP[query.sort.field as (typeof SORTABLE)[number]];
    if (field) {
      (orderBy as Record<string, Prisma.SortOrder>)[field] = query.sort.dir;
    }
  }

  try {
    if (query.format === "csv") {
      // CSV export: stream the body chunk-by-chunk so the worker
      // never has to hold all 50k rows in memory at once. We also
      // tighten the projection down to the dozen columns that
      // actually appear in CSV_COLUMNS — the full row contains
      // four JSONB blobs (emailAddresses, phoneNumbers,
      // externalAccounts, publicMetadata) that exporters never need.
      return streamUsersCsv(where, orderBy);
    }

    // Explicit projection: keep `private_metadata` and `unsafe_metadata`
    // out of the SQL response entirely. Previously we fetched the
    // whole row and stripped them in JS — which left them sitting in
    // Prisma's wire payload + Node heap, and meant pulling the entire
    // JSONB blob across the connection for every list response. The
    // server-side strip in `serializeUser` is still a belt-and-braces
    // guard against accidental re-exposure.
    const [records, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          imageUrl: true,
          profileImageUrl: true,
          hasImage: true,
          primaryEmailAddressId: true,
          primaryPhoneNumberId: true,
          banned: true,
          locked: true,
          backupCodeEnabled: true,
          twoFactorEnabled: true,
          totpEnabled: true,
          passwordEnabled: true,
          createOrganizationEnabled: true,
          deleteSelfEnabled: true,
          lastActiveAt: true,
          lastSignInAt: true,
          createdAt: true,
          updatedAt: true,
          isDeleted: true,
          isAdmin: true,
          receivesDailyEmails: true,
          paletteSize: true,
          emailAddresses: true,
          phoneNumbers: true,
          externalAccounts: true,
          publicMetadata: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const rows = records.map(serializeUser);

    return NextResponse.json({
      rows,
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  } catch (err) {
    logger.error("admin.users.list_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}
