import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/admin/audit";
import { getAllPokemonMetadata } from "@/lib/pokemon";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  HINT_CATEGORIES,
  type HintCategory,
  type HintConfig,
} from "@/lib/game/hints";

const ADMIN_POKEMON_COLORS_TAG = "admin-pokemon-colors";

// Pokemon JSON files are served from /public/data/pokemon/{id}.json. That
// directory is both the build-time static source AND the runtime public
// asset path, so reads here and browser fetches hit the same bytes.
const POKEMON_DATA_DIR = join(process.cwd(), "public", "data", "pokemon");

// Keep palettes sized to match the maximum player-selectable palette size
// in `/api/account/palette-preference` (3..6). Storage is capped at 6 so
// every variant always has "room" for the largest palette a player can
// render, padding trailing slots when the extractor returns fewer.
const MAX_PALETTE_SIZE = 6;
const HEX = /^#[0-9a-fA-F]{6}$/;
const HINT_OVERRIDE_MAX_LEN = 200;
const HINT_CATEGORY_SET = new Set<string>(HINT_CATEGORIES);

/**
 * Validates and normalizes a Pokemon ID from an untrusted source.
 * Returns null if the value is not a positive integer within the expected
 * range. This is the defense against path traversal below — `pokemonId` is
 * interpolated into a filesystem path, so we MUST ensure it's an integer.
 */
function parsePokemonId(raw: unknown): number | null {
  const id = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(id) || id < 1 || id > 100000) return null;
  return id;
}

function normalizeHighlights(palette: unknown): string[] {
  if (!palette || typeof palette !== "object") return [];
  const p = palette as Record<string, unknown>;
  const candidate = Array.isArray(p.highlights)
    ? (p.highlights as unknown[])
    : [p.primary, p.secondary, p.accent];
  const cleaned = candidate
    .filter((c): c is string => typeof c === "string" && HEX.test(c))
    .slice(0, MAX_PALETTE_SIZE);
  return cleaned;
}

function parseHintConfig(raw: unknown): HintConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const disabled: HintCategory[] = Array.isArray(input.disabled)
    ? (input.disabled as unknown[])
        .filter(
          (x): x is HintCategory =>
            typeof x === "string" && HINT_CATEGORY_SET.has(x),
        )
    : [];

  const overrides: Partial<Record<HintCategory, string | null>> = {};
  if (input.overrides && typeof input.overrides === "object") {
    for (const [key, value] of Object.entries(
      input.overrides as Record<string, unknown>,
    )) {
      if (!HINT_CATEGORY_SET.has(key)) continue;
      if (value === null || value === undefined) {
        overrides[key as HintCategory] = null;
        continue;
      }
      if (typeof value !== "string") continue;
      const trimmed = value.trim().slice(0, HINT_OVERRIDE_MAX_LEN);
      overrides[key as HintCategory] = trimmed.length > 0 ? trimmed : null;
    }
  }

  if (disabled.length === 0 && Object.keys(overrides).length === 0) {
    return null;
  }

  return { disabled, overrides };
}

// Variety classification used by the admin picker UI. Mirrors the
// `VarietyKind` union in `src/components/admin/colors/types.ts` — keep both
// in sync. Anything we don't recognise falls back to the catch-all "form"
// bucket so unusual entries (Deoxys-attack, Rotom-fan, Calyrex-shadow,
// etc.) still show up under their species.
type VarietyKind =
  | "mega"
  | "gigantamax"
  | "alolan"
  | "galarian"
  | "hisuian"
  | "paldean"
  | "form";

function classifyVarietyType(raw: unknown): VarietyKind {
  if (typeof raw !== "string") return "form";
  switch (raw.toLowerCase()) {
    case "mega":
      return "mega";
    case "gigantamax":
      return "gigantamax";
    case "alolan":
      return "alolan";
    case "galarian":
      return "galarian";
    case "hisuian":
      return "hisuian";
    case "paldean":
      return "paldean";
    default:
      return "form";
  }
}

/** Pull a numeric Pokemon id out of a PokeAPI variety URL like
 * `https://pokeapi.co/api/v2/pokemon/10034/`. Returns null when the URL
 * doesn't match — defensive guard against ever path-traversing the
 * filesystem read below. */
function parseVarietyId(url: unknown): number | null {
  if (typeof url !== "string") return null;
  const match = url.match(/\/pokemon\/(\d+)\/?$/);
  if (!match) return null;
  const id = Number(match[1]);
  if (!Number.isInteger(id) || id < 1 || id > 100000) return null;
  return id;
}

interface VarietyRefRaw {
  is_default?: unknown;
  url?: unknown;
  type?: unknown;
}

interface VarietyRow {
  id: number;
  name: string;
  spriteUrl: string | null;
  shinySpriteUrl: string | null;
  staticColors: string[];
  staticShinyColors: string[];
  hintConfig: HintConfig | null;
  varietyKind: VarietyKind;
  speciesId: number;
}

/** Read a single alt-form Pokemon JSON and shape it for the admin UI.
 * Returns null when the file is missing or unreadable so we silently skip
 * stale variety references rather than poisoning the whole species row. */
async function readVarietyRow(
  varietyId: number,
  speciesId: number,
  varietyKind: VarietyKind,
  fallbackName: string,
): Promise<VarietyRow | null> {
  try {
    const filePath = join(POKEMON_DATA_DIR, `${varietyId}.json`);
    const fileContent = await readFile(filePath, "utf-8");
    const data = JSON.parse(fileContent) as Record<string, unknown>;

    const staticColors = normalizeHighlights(data.colorPalette);
    const staticShinyColors = normalizeHighlights(data.shinyColorPalette);
    const artwork = (data.artwork ?? {}) as Record<string, unknown>;
    const hintConfig = parseHintConfig(data.hintConfig);
    const name =
      typeof data.name === "string" && data.name.length > 0
        ? data.name
        : fallbackName;

    return {
      id: varietyId,
      name,
      spriteUrl: typeof artwork.front === "string" ? artwork.front : null,
      shinySpriteUrl: typeof artwork.shiny === "string" ? artwork.shiny : null,
      staticColors,
      staticShinyColors,
      hintConfig,
      varietyKind,
      speciesId,
    };
  } catch {
    return null;
  }
}

// Build the admin pokemon-colors response. Reads ~1,350 JSON files from
// `public/data/pokemon/` and resolves all alt-form varieties — ~30-60 ms
// in dev, much longer cold on Vercel's filesystem. Cached behind the
// `admin-pokemon-colors` tag so consecutive admin page visits share work
// and the PUT handler can invalidate after each save.
const buildAdminPokemonColors = unstable_cache(
  async () => {
    const allPokemon = getAllPokemonMetadata();

    const pokemonWithColors = await Promise.all(
      allPokemon.map(async (pokemon) => {
      try {
        const filePath = join(POKEMON_DATA_DIR, `${pokemon.id}.json`);
        const fileContent = await readFile(filePath, "utf-8");
        const pokemonData = JSON.parse(fileContent) as Record<string, unknown>;

        const staticColors = normalizeHighlights(pokemonData.colorPalette);
        const staticShinyColors = normalizeHighlights(
          pokemonData.shinyColorPalette,
        );

        const artwork = (pokemonData.artwork ?? {}) as Record<string, unknown>;

        const hintConfig = parseHintConfig(pokemonData.hintConfig);

        // Resolve alt-form varieties (megas, gmax, regionals, misc forms).
        // We deliberately drop the default-variety entry because it points
        // back at the species itself and the UI already has that row.
        const rawVarieties = Array.isArray(pokemonData.varieties)
          ? (pokemonData.varieties as VarietyRefRaw[])
          : [];
        const varietyTasks = rawVarieties
          .filter((v) => !v?.is_default)
          .map((v) => {
            const varietyId = parseVarietyId(v.url);
            if (varietyId === null || varietyId === pokemon.id) return null;
            const kind = classifyVarietyType(v.type);
            return readVarietyRow(
              varietyId,
              pokemon.id,
              kind,
              `${pokemon.name} ${kind}`,
            );
          })
          .filter((task): task is Promise<VarietyRow | null> => task !== null);

        const resolvedVarieties = (await Promise.all(varietyTasks)).filter(
          (row): row is VarietyRow => row !== null,
        );

        // Stable order — group by kind, then by id, so Mega X comes before
        // Mega Y and regional forms cluster together.
        const KIND_ORDER: VarietyKind[] = [
          "mega",
          "gigantamax",
          "alolan",
          "galarian",
          "hisuian",
          "paldean",
          "form",
        ];
        resolvedVarieties.sort((a, b) => {
          const ka = KIND_ORDER.indexOf(a.varietyKind);
          const kb = KIND_ORDER.indexOf(b.varietyKind);
          if (ka !== kb) return ka - kb;
          return a.id - b.id;
        });

        return {
          id: pokemon.id,
          name: pokemon.name,
          spriteUrl:
            typeof artwork.front === "string" ? artwork.front : null,
          shinySpriteUrl:
            typeof artwork.shiny === "string" ? artwork.shiny : null,
          staticColors,
          staticShinyColors,
          hintConfig,
          speciesId: pokemon.id,
          varieties: resolvedVarieties,
        };
      } catch {
        return null;
      }
    }),
  );

    const validPokemon = pokemonWithColors.filter(
      (p): p is NonNullable<typeof p> => p !== null,
    );

    return { pokemon: validPokemon };
  },
  ["admin-pokemon-colors-list"],
  { revalidate: 3600, tags: [ADMIN_POKEMON_COLORS_TAG] },
);

// GET — Return every Pokemon with its current stored palette (admin only)
export async function GET() {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

  const payload = await buildAdminPokemonColors();
  return NextResponse.json(payload);
}

// PUT — Update a Pokemon's stored palette and/or hint config (admin only)
//
// NOTE: on Vercel the function filesystem is read-only, so writes here only
// persist in local dev. A durable override path (DB table read at runtime)
// is planned as part of the Prisma migration.
export async function PUT(req: NextRequest) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;
  const adminUserId = authResult.adminUserId;

  const body = await req.json();
  const {
    pokemonId: rawPokemonId,
    colors,
    isShiny,
    hintConfig: rawHintConfig,
  } = body ?? {};

  const pokemonId = parsePokemonId(rawPokemonId);
  if (pokemonId === null) {
    return NextResponse.json(
      { error: "Invalid pokemonId: must be a positive integer" },
      { status: 400 },
    );
  }

  const hasColors = Array.isArray(colors) && colors.length > 0;
  const hasHintConfig = rawHintConfig !== undefined;

  if (!hasColors && !hasHintConfig) {
    return NextResponse.json(
      {
        error:
          "Invalid request: supply at least one of `colors` or `hintConfig`",
      },
      { status: 400 },
    );
  }

  let selectedColors: string[] | null = null;
  if (hasColors) {
    const cleaned = (colors as unknown[]).filter(
      (c): c is string => typeof c === "string" && HEX.test(c),
    );
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: no valid hex colors (expected #RRGGBB)" },
        { status: 400 },
      );
    }
    const sliced = cleaned.slice(0, MAX_PALETTE_SIZE);
    // Pad trailing slots so every variant has exactly MAX_PALETTE_SIZE
    // entries on disk — this mirrors what /account players with
    // paletteSize=6 expect to render.
    while (sliced.length < MAX_PALETTE_SIZE) {
      sliced.push(sliced[sliced.length - 1] ?? "#94a3b8");
    }
    selectedColors = sliced;
  }

  let hintConfigUpdate:
    | { mode: "set"; value: HintConfig }
    | { mode: "clear" }
    | null = null;

  if (hasHintConfig) {
    if (rawHintConfig === null) {
      hintConfigUpdate = { mode: "clear" };
    } else {
      const parsed = parseHintConfig(rawHintConfig);
      if (parsed === null) {
        hintConfigUpdate = { mode: "clear" };
      } else {
        hintConfigUpdate = { mode: "set", value: parsed };
      }
    }
  }

  // Build path from the validated integer — no string interpolation of
  // untrusted input.
  const filePath = join(POKEMON_DATA_DIR, `${pokemonId}.json`);

  let pokemonData: Record<string, unknown> & {
    colorPalette?: Record<string, unknown>;
    shinyColorPalette?: Record<string, unknown>;
    hintConfig?: HintConfig | null;
  };
  try {
    const fileContent = await readFile(filePath, "utf-8");
    pokemonData = JSON.parse(fileContent);
  } catch {
    return NextResponse.json(
      { error: `Pokemon ${pokemonId} not found` },
      { status: 404 },
    );
  }

  // Snapshot the palette + hint fields BEFORE applying any mutation
  // so the audit row can record what the palette looked like before
  // an admin override. We only capture the structured shape consumed
  // by the game / saved palettes — not the full file blob — to keep
  // the audit payload bounded.
  const auditBefore = {
    pokemonId,
    isShiny: Boolean(isShiny),
    colorPalette: pokemonData.colorPalette,
    shinyColorPalette: pokemonData.shinyColorPalette,
    hintConfig: pokemonData.hintConfig ?? null,
  };

  if (selectedColors) {
    const paletteKey = isShiny ? "shinyColorPalette" : "colorPalette";
    if (!pokemonData[paletteKey]) {
      pokemonData[paletteKey] = {};
    }
    const palette = pokemonData[paletteKey] as Record<string, unknown>;

    palette.highlights = selectedColors;
    // Legacy primary/secondary/accent fields are still read by a handful of
    // consumers (saved palettes, seo pages). Keep them in sync with the
    // first three slots so nothing regresses.
    palette.primary = selectedColors[0];
    palette.secondary = selectedColors[1];
    palette.accent = selectedColors[2];
    // Mark this variant's palette as authoritative — the game reads this
    // flag to skip runtime sprite extraction and use these admin-curated
    // colors directly. Set on every admin save (single edit and batch
    // re-extract alike) since both originate from an admin action.
    palette.locked = true;
  }

  if (hintConfigUpdate) {
    if (hintConfigUpdate.mode === "clear") {
      delete pokemonData.hintConfig;
    } else {
      pokemonData.hintConfig = hintConfigUpdate.value;
    }
  }

  try {
    await writeFile(filePath, JSON.stringify(pokemonData, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing palette override:", err);
    return NextResponse.json(
      {
        error:
          "Filesystem is read-only in this environment. Palette overrides cannot be persisted in production yet.",
      },
      { status: 501 },
    );
  }

  // Drop the cached list response so the admin UI sees the new palette
  // on its next refresh. Without this the workbench can show stale
  // colors for up to an hour after a save.
  revalidateTag(ADMIN_POKEMON_COLORS_TAG);

  void recordAudit({
    actorUserId: adminUserId,
    action: "pokemon_colors.update",
    targetType: "pokemon_colors",
    targetId: String(pokemonId),
    before: auditBefore,
    after: {
      pokemonId,
      isShiny: Boolean(isShiny),
      colorPalette: pokemonData.colorPalette,
      shinyColorPalette: pokemonData.shinyColorPalette,
      hintConfig: pokemonData.hintConfig ?? null,
    },
  });

  return NextResponse.json({
    message: "Pokemon entry updated successfully",
    pokemonId,
    colors: selectedColors,
    isShiny: Boolean(isShiny),
    hintConfig: hintConfigUpdate
      ? hintConfigUpdate.mode === "clear"
        ? null
        : hintConfigUpdate.value
      : undefined,
  });
}
