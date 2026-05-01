import type { HintConfig } from "@/lib/game/hints";

/** Maximum palette slots every variant is stored with. Mirrors the cap in
 * `src/app/api/admin/pokemon-colors/route.ts` — any change there must be
 * reflected here or the UI will fall out of sync. */
export const MAX_PALETTE_SIZE = 6;

/**
 * Classification for an alt-form variety — drives the badge label in the
 * picker and the grouping order. "form" is the catch-all for anything that
 * isn't a mega / gmax / regional variant (e.g. Deoxys-attack, Rotom-fan,
 * Wormadam-sandy, Calyrex-shadow). The string literals match the `type`
 * field PokeAPI emits on `varieties[]` in the species JSON, lowercased,
 * with `""` and unrecognised values bucketed into "form".
 */
export type VarietyKind =
  | "mega"
  | "gigantamax"
  | "alolan"
  | "galarian"
  | "hisuian"
  | "paldean"
  | "form";

export interface PokemonColorRow {
  id: number;
  name: string;
  spriteUrl: string | null;
  shinySpriteUrl: string | null;
  staticColors: string[];
  staticShinyColors: string[];
  hintConfig: HintConfig | null;
  /**
   * Alt-form children indexed off the species' `varieties` array (Mega,
   * Gigantamax, regional, misc forms). Always present on species rows and
   * empty on variety rows themselves so we never accidentally recurse.
   */
  varieties?: PokemonColorRow[];
  /**
   * Set on alt-form rows; classifies the form so the picker can render a
   * coloured badge. `undefined` on species (default) rows.
   */
  varietyKind?: VarietyKind;
  /**
   * Numeric id of the species this row belongs to. Equal to `id` on
   * species rows; the parent species id on variety rows. Lets the picker
   * group a variety match back under the right species when filtering.
   */
  speciesId?: number;
}

export type Variant = "normal" | "shiny";

export type EditorTab = "palette" | "hints";
