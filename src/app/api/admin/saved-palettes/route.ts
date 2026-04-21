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
  "updated_at",
  "pokemon_name",
  "pokemon_id",
] as const;

const FILTER_KEYS = [
  "is_shiny",
  "user_id",
  "pokemon_id",
  "has_image",
  "created_from",
  "created_to",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

const SEARCH_COLUMNS = ["pokemon_name", "palette_name"];

const CSV_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "user_id", header: "User ID" },
  { key: "pokemon_id", header: "Pokemon ID" },
  { key: "pokemon_name", header: "Pokemon Name" },
  { key: "is_shiny", header: "Shiny" },
  { key: "palette_name", header: "Palette Name" },
  { key: "colors", header: "Colors" },
  { key: "created_at", header: "Created at" },
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
      query.format === "csv" ? CSV_ROW_LIMIT : query.pageSize;
    const page = query.format === "csv" ? 1 : query.page;
    const [from, to] = rangeFor(page, pageSize);

    let builder = supabaseAdmin
      .from("saved_palettes")
      .select(
        "id, user_id, pokemon_id, pokemon_name, pokemon_form, is_shiny, colors, image_url, palette_name, created_at, updated_at",
        { count: "exact" },
      );

    if (query.q) {
      builder = builder.or(buildIlikeOr(query.q, SEARCH_COLUMNS));
    }

    const { is_shiny, user_id, pokemon_id, has_image, created_from, created_to } =
      query.filters;

    if (is_shiny === "true") builder = builder.eq("is_shiny", true);
    else if (is_shiny === "false") builder = builder.eq("is_shiny", false);

    if (user_id) builder = builder.eq("user_id", user_id);

    if (pokemon_id) {
      const asNum = Number(pokemon_id);
      if (Number.isFinite(asNum)) {
        builder = builder.eq("pokemon_id", asNum);
      }
    }

    if (has_image === "true") builder = builder.not("image_url", "is", null);
    else if (has_image === "false") builder = builder.is("image_url", null);

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
      console.error("Error fetching saved palettes:", error);
      return NextResponse.json(
        { error: "Failed to fetch saved palettes" },
        { status: 500 },
      );
    }

    const rows = data ?? [];

    // Attach user info for the current page only (avoids joining at scale).
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

    if (query.format === "csv") {
      const csvRows = rows.map((r: any) => ({
        ...r,
        colors: Array.isArray(r.colors) ? r.colors.join(" ") : "",
      }));
      const csv = toCsv(csvRows, CSV_COLUMNS);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="saved-palettes-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      rows,
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    });
  } catch (err) {
    console.error("Unexpected error in GET /api/admin/saved-palettes:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
