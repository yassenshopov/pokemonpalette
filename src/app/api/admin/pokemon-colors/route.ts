import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAllPokemonMetadata } from "@/lib/pokemon";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

// Pokemon JSON files are served from /public/data/pokemon/{id}.json. That
// directory is both the build-time static source AND the runtime public
// asset path, so reads here and browser fetches hit the same bytes.
const POKEMON_DATA_DIR = join(process.cwd(), "public", "data", "pokemon");

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
        const pokemonData = JSON.parse(fileContent);

        const staticColors = pokemonData.colorPalette?.highlights ||
          [
            pokemonData.colorPalette?.primary,
            pokemonData.colorPalette?.secondary,
            pokemonData.colorPalette?.accent,
          ]
            .filter(Boolean)
            .slice(0, 3);

        const staticShinyColors = pokemonData.shinyColorPalette?.highlights ||
          [
            pokemonData.shinyColorPalette?.primary,
            pokemonData.shinyColorPalette?.secondary,
            pokemonData.shinyColorPalette?.accent,
          ]
            .filter(Boolean)
            .slice(0, 3);

        return {
          id: pokemon.id,
          name: pokemon.name,
          spriteUrl: pokemonData.artwork?.front || null,
          shinySpriteUrl: pokemonData.artwork?.shiny || null,
          staticColors: staticColors.slice(0, 3),
          staticShinyColors: staticShinyColors.slice(0, 3),
        };
      } catch {
        return null;
      }
    })
  );

  const validPokemon = pokemonWithColors.filter(
    (p): p is NonNullable<typeof p> => p !== null
  );

  return NextResponse.json({ pokemon: validPokemon });
}

// PUT — Update a Pokemon's stored palette (admin only)
//
// NOTE: on Vercel the function filesystem is read-only, so writes here only
// persist in local dev. A durable override path (DB table read at runtime)
// is planned as part of the Prisma migration.
export async function PUT(req: NextRequest) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const { pokemonId: rawPokemonId, colors, isShiny } = body ?? {};

  const pokemonId = parsePokemonId(rawPokemonId);
  if (pokemonId === null) {
    return NextResponse.json(
      { error: "Invalid pokemonId: must be a positive integer" },
      { status: 400 }
    );
  }

  if (!Array.isArray(colors) || colors.length === 0) {
    return NextResponse.json(
      { error: "Invalid request: colors array required" },
      { status: 400 }
    );
  }

  const HEX = /^#[0-9a-fA-F]{6}$/;
  const cleaned = colors.filter(
    (c): c is string => typeof c === "string" && HEX.test(c)
  );
  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "Invalid request: no valid hex colors (expected #RRGGBB)" },
      { status: 400 }
    );
  }

  const selectedColors = cleaned.slice(0, 3);
  while (selectedColors.length < 3) {
    selectedColors.push(selectedColors[selectedColors.length - 1] || "#94a3b8");
  }

  // Build path from the validated integer — no string interpolation of
  // untrusted input.
  const filePath = join(POKEMON_DATA_DIR, `${pokemonId}.json`);

  let pokemonData: Record<string, unknown> & {
    colorPalette?: Record<string, unknown>;
    shinyColorPalette?: Record<string, unknown>;
  };
  try {
    const fileContent = await readFile(filePath, "utf-8");
    pokemonData = JSON.parse(fileContent);
  } catch {
    return NextResponse.json(
      { error: `Pokemon ${pokemonId} not found` },
      { status: 404 }
    );
  }

  const paletteKey = isShiny ? "shinyColorPalette" : "colorPalette";
  if (!pokemonData[paletteKey]) {
    pokemonData[paletteKey] = {};
  }
  const palette = pokemonData[paletteKey] as Record<string, unknown>;

  palette.highlights = selectedColors;
  palette.primary = selectedColors[0];
  palette.secondary = selectedColors[1];
  palette.accent = selectedColors[2];

  try {
    await writeFile(filePath, JSON.stringify(pokemonData, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing palette override:", err);
    return NextResponse.json(
      {
        error:
          "Filesystem is read-only in this environment. Palette overrides cannot be persisted in production yet.",
      },
      { status: 501 }
    );
  }

  return NextResponse.json({
    message: `Pokemon ${isShiny ? "shiny " : ""}color palette updated successfully`,
    pokemonId,
    colors: selectedColors,
    isShiny: Boolean(isShiny),
  });
}
