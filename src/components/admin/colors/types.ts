import type { HintConfig } from "@/lib/game/hints";

/** Maximum palette slots every variant is stored with. Mirrors the cap in
 * `src/app/api/admin/pokemon-colors/route.ts` — any change there must be
 * reflected here or the UI will fall out of sync. */
export const MAX_PALETTE_SIZE = 6;

export interface PokemonColorRow {
  id: number;
  name: string;
  spriteUrl: string | null;
  shinySpriteUrl: string | null;
  staticColors: string[];
  staticShinyColors: string[];
  hintConfig: HintConfig | null;
}

export type Variant = "normal" | "shiny";

export type EditorTab = "palette" | "hints";
