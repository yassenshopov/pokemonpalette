import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { parseAdminQuery, toCsv } from "@/lib/admin/query";
import { logger } from "@/lib/logger";

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

// Snake_case API field → Prisma model field.
const SORT_MAP: Record<(typeof SORTABLE)[number], keyof Prisma.SavedPaletteOrderByWithRelationInput> = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  pokemon_name: "pokemonName",
  pokemon_id: "pokemonId",
};

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
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const query = parseAdminQuery<FilterKey>(req.nextUrl.searchParams, {
    sortable: SORTABLE,
    defaultSort: { field: "created_at", dir: "desc" },
    filterKeys: FILTER_KEYS,
  });

  const pageSize = query.format === "csv" ? CSV_ROW_LIMIT : query.pageSize;
  const page = query.format === "csv" ? 1 : query.page;

  const { is_shiny, user_id, pokemon_id, has_image, created_from, created_to } =
    query.filters;

  const where: Prisma.SavedPaletteWhereInput = {};
  if (query.q) {
    where.OR = [
      { pokemonName: { contains: query.q, mode: "insensitive" } },
      { paletteName: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (is_shiny === "true") where.isShiny = true;
  else if (is_shiny === "false") where.isShiny = false;
  if (user_id) where.userId = user_id;
  if (pokemon_id) {
    const asNum = Number(pokemon_id);
    if (Number.isFinite(asNum)) where.pokemonId = asNum;
  }
  if (has_image === "true") where.imageUrl = { not: null };
  else if (has_image === "false") where.imageUrl = null;
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

  const orderBy: Prisma.SavedPaletteOrderByWithRelationInput = {};
  if (query.sort) {
    const field = SORT_MAP[query.sort.field as (typeof SORTABLE)[number]];
    if (field) orderBy[field] = query.sort.dir;
  }

  try {
    const [records, total] = await Promise.all([
      prisma.savedPalette.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.savedPalette.count({ where }),
    ]);

    const baseRows = records.map((r) => ({
      id: r.id,
      user_id: r.userId,
      pokemon_id: r.pokemonId,
      pokemon_name: r.pokemonName,
      pokemon_form: r.pokemonForm,
      is_shiny: r.isShiny,
      colors: r.colors,
      image_url: r.imageUrl,
      palette_name: r.paletteName,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    }));

    // Attach user info for the current page only (avoids joining at scale).
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
      rows = baseRows.map((row) => ({
        ...row,
        users: userMap.get(row.user_id) ?? null,
      }));
    }

    if (query.format === "csv") {
      const csvRows = baseRows.map((r) => ({
        ...r,
        colors: Array.isArray(r.colors) ? (r.colors as string[]).join(" ") : "",
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
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  } catch (err) {
    logger.error("admin.saved-palettes.list_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
