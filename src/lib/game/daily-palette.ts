import {
  DAILY_POOL_SIZE,
  getDailyPokemonIdForDate,
  getDailyShinyStatus,
} from "@/lib/game/similarity";
import { getPokemonById } from "@/lib/pokemon";

export interface DailyPaletteInfo {
  pokemonId: number;
  pokemonName: string;
  isShiny: boolean;
  /** Three-color teaser triad, ordered most → least dominant. */
  colors: [string, string, string];
}

const FALLBACK_COLORS: [string, string, string] = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

/**
 * Resolve the canonical daily Pokémon palette for a given UTC date.
 *
 * Uses the same deterministic seed as the in-game daily mode (see
 * `getDailyPokemonIdForDate`) so the colors in an outgoing email match
 * exactly what `/game` will render that day.
 *
 * Falls back to the precomputed `colorPalette.highlights` from the
 * Pokémon JSON file. The runtime sprite extraction the game performs
 * client-side isn't available here (no canvas), so the JSON values are
 * the authoritative server-side palette.
 */
export async function getDailyPaletteForDate(
  date: Date = new Date(),
): Promise<DailyPaletteInfo | null> {
  const isShiny = getDailyShinyStatus();
  const id = getDailyPokemonIdForDate(date, DAILY_POOL_SIZE, isShiny);
  const pokemon = await getPokemonById(id);
  if (!pokemon) return null;

  const palette = pokemon.colorPalette;
  const highlights = palette?.highlights ?? [];

  const colors: [string, string, string] = [
    highlights[0] ?? palette?.primary ?? FALLBACK_COLORS[0],
    highlights[1] ?? palette?.secondary ?? FALLBACK_COLORS[1],
    highlights[2] ?? palette?.accent ?? FALLBACK_COLORS[2],
  ];

  return {
    pokemonId: id,
    pokemonName: pokemon.name,
    isShiny,
    colors,
  };
}
