import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAllPokemonMetadata } from "@/lib/pokemon";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  HINT_CATEGORIES,
  type HintCategory,
  type HintConfig,
} from "@/lib/game/hints";

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

// GET — Return every Pokemon with its current stored palette (admin only)
export async function GET() {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

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
        };
      } catch {
        return null;
      }
    }),
  );

  const validPokemon = pokemonWithColors.filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );

  return NextResponse.json({ pokemon: validPokemon });
}

// PUT — Update a Pokemon's stored palette and/or hint config (admin only)
//
// NOTE: on Vercel the function filesystem is read-only, so writes here only
// persist in local dev. A durable override path (DB table read at runtime)
// is planned as part of the Prisma migration.
export async function PUT(req: NextRequest) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

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
