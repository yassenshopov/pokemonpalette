import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { parseAdminQuery, toCsv } from "@/lib/admin/query";
import { logger } from "@/lib/logger";

const SORTABLE = [
  "created_at",
  "date",
  "attempts",
  "hints_used",
  "target_pokemon_id",
] as const;

const SORT_MAP: Record<(typeof SORTABLE)[number], keyof Prisma.DailyGameAttemptOrderByWithRelationInput> = {
  created_at: "createdAt",
  date: "date",
  attempts: "attempts",
  hints_used: "hintsUsed",
  target_pokemon_id: "targetPokemonId",
};

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

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function listAttempts(req: NextRequest) {
  const query = parseAdminQuery<FilterKey>(req.nextUrl.searchParams, {
    sortable: SORTABLE,
    defaultSort: { field: "created_at", dir: "desc" },
    filterKeys: FILTER_KEYS,
  });

  const pageSize = query.format === "csv" ? CSV_ROW_LIMIT : query.pageSize;
  const page = query.format === "csv" ? 1 : query.page;

  const where: Prisma.DailyGameAttemptWhereInput = {};
  if (query.q) {
    where.userId = { contains: query.q, mode: "insensitive" };
  }
  const { won, user_id, target_pokemon_id, date_from, date_to, created_from, created_to } =
    query.filters;
  if (won === "true") where.won = true;
  else if (won === "false") where.won = false;
  if (user_id) where.userId = user_id;
  if (target_pokemon_id) {
    const n = Number(target_pokemon_id);
    if (Number.isFinite(n)) where.targetPokemonId = n;
  }
  if (date_from) {
    const d = parseYmd(date_from);
    if (d) where.date = { ...(where.date as object), gte: d };
  }
  if (date_to) {
    const d = parseYmd(date_to);
    if (d) where.date = { ...(where.date as object), lte: d };
  }
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

  const orderBy: Prisma.DailyGameAttemptOrderByWithRelationInput = {};
  if (query.sort) {
    const field = SORT_MAP[query.sort.field as (typeof SORTABLE)[number]];
    if (field) orderBy[field] = query.sort.dir;
  }

  const [records, total] = await Promise.all([
    prisma.dailyGameAttempt.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dailyGameAttempt.count({ where }),
  ]);

  const baseRows = records.map((r) => ({
    id: r.id,
    user_id: r.userId,
    date: r.date.toISOString().slice(0, 10),
    target_pokemon_id: r.targetPokemonId,
    is_shiny: r.isShiny,
    guesses: r.guesses,
    attempts: r.attempts,
    won: r.won,
    pokemon_guessed: r.pokemonGuessed,
    hints_used: r.hintsUsed,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }));

  let rows: Array<(typeof baseRows)[number] & { users?: unknown }> = baseRows;
  if (baseRows.length > 0 && query.format !== "csv") {
    const ids = Array.from(new Set(baseRows.map((r) => r.user_id)));
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        profileImageUrl: true,
      },
    });
    const userMap = new Map(
      users.map((u) => [
        u.id,
        {
          id: u.id,
          email: u.email,
          username: u.username,
          first_name: u.firstName,
          last_name: u.lastName,
          image_url: u.imageUrl,
          profile_image_url: u.profileImageUrl,
        },
      ]),
    );
    rows = baseRows.map((r) => ({ ...r, users: userMap.get(r.user_id) ?? null }));
  }

  return { rows, total, query };
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
    supabaseAdmin.rpc("admin_game_daily", { p_page: page, p_page_size: pageSize }),
    supabaseAdmin.rpc("admin_game_daily_count"),
  ]);

  if (rowsResp.error) throw rowsResp.error;
  if (countResp.error) throw countResp.error;

  const rows = (rowsResp.data ?? []) as Array<Record<string, unknown>>;
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
    supabaseAdmin.rpc("admin_game_by_user", { p_page: page, p_page_size: pageSize }),
    supabaseAdmin.rpc("admin_game_by_user_count"),
  ]);

  if (rowsResp.error) throw rowsResp.error;
  if (countResp.error) throw countResp.error;

  const rows = (rowsResp.data ?? []) as Array<Record<string, unknown>>;

  if (rows.length > 0 && query.format !== "csv") {
    const ids = rows.map((r) => r.user_id as string);
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        profileImageUrl: true,
      },
    });
    const userMap = new Map(
      users.map((u) => [
        u.id,
        {
          id: u.id,
          email: u.email,
          username: u.username,
          first_name: u.firstName,
          last_name: u.lastName,
          image_url: u.imageUrl,
          profile_image_url: u.profileImageUrl,
        },
      ]),
    );
    for (const row of rows) {
      row.users = userMap.get(row.user_id as string) ?? null;
    }
  }

  return { rows, total: Number(countResp.data ?? 0), query };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const view = req.nextUrl.searchParams.get("view") ?? "attempts";

  let result:
    | {
        rows: Array<Record<string, unknown>>;
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
    logger.error("admin.game-data.list_failed", {
      view,
      error: err instanceof Error ? err.message : String(err),
    });
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
}
