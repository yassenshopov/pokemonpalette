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
  "date",
  "attempts",
  "hints_used",
  "target_pokemon_id",
] as const;

const FILTER_KEYS = [
  "won",
  "user_id",
  "target_pokemon_id",
  "date_from",
  "date_to",
  "created_from",
  "created_to",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

const CSV_ROW_LIMIT = 50_000;

const ATTEMPT_CSV_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "user_id", header: "User ID" },
  { key: "date", header: "Date" },
  { key: "target_pokemon_id", header: "Target Pokemon ID" },
  { key: "won", header: "Won" },
  { key: "attempts", header: "Attempts" },
  { key: "hints_used", header: "Hints Used" },
  { key: "created_at", header: "Created at" },
];

const DAILY_CSV_COLUMNS = [
  { key: "date", header: "Date" },
  { key: "target_pokemon_id", header: "Target Pokemon ID" },
  { key: "attempts_count", header: "Total Attempts" },
  { key: "wins", header: "Wins" },
  { key: "avg_attempts", header: "Avg Attempts" },
  { key: "avg_hints", header: "Avg Hints" },
];

const BY_USER_CSV_COLUMNS = [
  { key: "user_id", header: "User ID" },
  { key: "attempts_count", header: "Attempts" },
  { key: "wins", header: "Wins" },
  { key: "last_played", header: "Last Played" },
];

async function listAttempts(req: NextRequest) {
  const query = parseAdminQuery<FilterKey>(req.nextUrl.searchParams, {
    sortable: SORTABLE,
    defaultSort: { field: "created_at", dir: "desc" },
    filterKeys: FILTER_KEYS,
  });

  const pageSize = query.format === "csv" ? CSV_ROW_LIMIT : query.pageSize;
  const page = query.format === "csv" ? 1 : query.page;
  const [from, to] = rangeFor(page, pageSize);

  let builder = supabaseAdmin
    .from("daily_game_attempts")
    .select("*", { count: "exact" });

  if (query.q) {
    // Searchable: target_pokemon_id (numeric) or user_id (text) ILIKE.
    builder = builder.or(buildIlikeOr(query.q, ["user_id"]));
  }

  const {
    won,
    user_id,
    target_pokemon_id,
    date_from,
    date_to,
    created_from,
    created_to,
  } = query.filters;

  if (won === "true") builder = builder.eq("won", true);
  else if (won === "false") builder = builder.eq("won", false);

  if (user_id) builder = builder.eq("user_id", user_id);

  if (target_pokemon_id) {
    const asNum = Number(target_pokemon_id);
    if (Number.isFinite(asNum)) {
      builder = builder.eq("target_pokemon_id", asNum);
    }
  }

  if (date_from) builder = builder.gte("date", date_from);
  if (date_to) builder = builder.lte("date", date_to);
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
  if (error) throw error;
  const rows = data ?? [];

  // Attach user info for the current page.
  if (rows.length > 0 && query.format !== "csv") {
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
    const { data: users } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, username, first_name, last_name, image_url, profile_image_url",
      )
      .in("id", ids);
    const userMap = new Map((users ?? []).map((u) => [u.id, u]));
    for (const row of rows as any[]) {
      row.users = userMap.get(row.user_id) ?? null;
    }
  }

  return { rows, total: count ?? 0, query };
}

async function listDaily(req: NextRequest) {
  const query = parseAdminQuery<FilterKey>(req.nextUrl.searchParams, {
    sortable: ["date"],
    defaultSort: { field: "date", dir: "desc" },
    filterKeys: FILTER_KEYS,
  });
  const pageSize = query.format === "csv" ? CSV_ROW_LIMIT : query.pageSize;
  const page = query.format === "csv" ? 1 : query.page;

  const [rowsResp, countResp] = await Promise.all([
    supabaseAdmin.rpc("admin_game_daily", {
      p_page: page,
      p_page_size: pageSize,
    }),
    supabaseAdmin.rpc("admin_game_daily_count"),
  ]);

  if (rowsResp.error) throw rowsResp.error;
  if (countResp.error) throw countResp.error;

  const rows = (rowsResp.data ?? []) as any[];
  const total = Number(countResp.data ?? 0);
  return { rows, total, query };
}

async function listByUser(req: NextRequest) {
  const query = parseAdminQuery<FilterKey>(req.nextUrl.searchParams, {
    sortable: ["attempts_count"],
    defaultSort: { field: "attempts_count", dir: "desc" },
    filterKeys: FILTER_KEYS,
  });
  const pageSize = query.format === "csv" ? CSV_ROW_LIMIT : query.pageSize;
  const page = query.format === "csv" ? 1 : query.page;

  const [rowsResp, countResp] = await Promise.all([
    supabaseAdmin.rpc("admin_game_by_user", {
      p_page: page,
      p_page_size: pageSize,
    }),
    supabaseAdmin.rpc("admin_game_by_user_count"),
  ]);

  if (rowsResp.error) throw rowsResp.error;
  if (countResp.error) throw countResp.error;

  const rows = (rowsResp.data ?? []) as any[];

  if (rows.length > 0 && query.format !== "csv") {
    const ids = rows.map((r) => r.user_id);
    const { data: users } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, username, first_name, last_name, image_url, profile_image_url",
      )
      .in("id", ids);
    const userMap = new Map((users ?? []).map((u) => [u.id, u]));
    for (const row of rows) {
      row.users = userMap.get(row.user_id) ?? null;
    }
  }

  return { rows, total: Number(countResp.data ?? 0), query };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const view = req.nextUrl.searchParams.get("view") ?? "attempts";

    let result:
      | {
          rows: any[];
          total: number;
          query: ReturnType<typeof parseAdminQuery>;
        }
      | null = null;
    let csvColumns: Array<{ key: string; header: string }> = [];
    let csvFilenamePrefix = "game-attempts";

    try {
      if (view === "daily") {
        result = await listDaily(req);
        csvColumns = DAILY_CSV_COLUMNS;
        csvFilenamePrefix = "game-daily";
      } else if (view === "by_user") {
        result = await listByUser(req);
        csvColumns = BY_USER_CSV_COLUMNS;
        csvFilenamePrefix = "game-by-user";
      } else {
        result = await listAttempts(req);
        csvColumns = ATTEMPT_CSV_COLUMNS;
        csvFilenamePrefix = "game-attempts";
      }
    } catch (err) {
      console.error(`Error fetching game view=${view}:`, err);
      return NextResponse.json(
        { error: "Failed to fetch game data" },
        { status: 500 },
      );
    }

    const { rows, total, query } = result;

    if (query.format === "csv") {
      const csv = toCsv(rows, csvColumns);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${csvFilenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      rows,
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  } catch (err) {
    console.error("Unexpected error in GET /api/admin/game-data:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
