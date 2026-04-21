import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import {
  buildIlikeOr,
  parseAdminQuery,
  rangeFor,
  toCsv,
} from "@/lib/admin/query";

const SORTABLE = [
  "created_at",
  "last_active_at",
  "last_sign_in_at",
  "email",
  "username",
] as const;

const FILTER_KEYS = [
  "status",
  "two_factor",
  "is_admin",
  "created_from",
  "created_to",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

const SEARCH_COLUMNS = ["email", "username", "first_name", "last_name", "id"];

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

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const query = parseAdminQuery<FilterKey>(req.nextUrl.searchParams, {
      sortable: SORTABLE,
      defaultSort: { field: "created_at", dir: "desc" },
      filterKeys: FILTER_KEYS,
    });

    const pageSize =
      query.format === "csv"
        ? CSV_ROW_LIMIT
        : query.pageSize;
    const page = query.format === "csv" ? 1 : query.page;
    const [from, to] = rangeFor(page, pageSize);

    let builder = supabaseAdmin
      .from("users")
      .select("*", { count: "exact" })
      .eq("is_deleted", false);

    if (query.q) {
      builder = builder.or(buildIlikeOr(query.q, SEARCH_COLUMNS));
    }

    // Filters
    const { status, two_factor, is_admin, created_from, created_to } =
      query.filters;

    if (status === "banned") builder = builder.eq("banned", true);
    else if (status === "locked") builder = builder.eq("locked", true);
    else if (status === "active") {
      builder = builder.eq("banned", false).eq("locked", false);
    }

    if (two_factor === "true") {
      builder = builder.or("two_factor_enabled.eq.true,totp_enabled.eq.true");
    } else if (two_factor === "false") {
      builder = builder
        .eq("two_factor_enabled", false)
        .eq("totp_enabled", false);
    }

    if (is_admin === "true") builder = builder.eq("is_admin", true);
    else if (is_admin === "false") builder = builder.eq("is_admin", false);

    if (created_from) builder = builder.gte("created_at", created_from);
    if (created_to) builder = builder.lte("created_at", created_to);

    if (query.sort) {
      builder = builder.order(query.sort.field, {
        ascending: query.sort.dir === "asc",
        nullsFirst: false,
      });
    }

    builder = builder.range(from, to);

    const { data, error, count } = await builder;
    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    if (query.format === "csv") {
      const csv = toCsv(data ?? [], CSV_COLUMNS);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      rows: data ?? [],
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    });
  } catch (err) {
    console.error("Unexpected error in GET /api/admin/users:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
