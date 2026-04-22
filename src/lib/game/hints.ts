import type { Pokemon } from "@/types/pokemon";

// Hint categories supported by the generator. The admin workbench exposes one
// row per category so mods can disable individual categories or override the
// auto-generated copy. Keep this list in sync with the switch in `buildCandidates`.
export const HINT_CATEGORIES = [
  "type",
  "evolution_stage",
  "generation",
  "species",
  "description",
] as const;

export type HintCategory = (typeof HINT_CATEGORIES)[number];

export type HintBucket = "vague" | "medium" | "specific";

/**
 * Optional per-Pokemon overrides stored on the Pokemon JSON as `hintConfig`.
 * - `disabled` removes a category from the candidate pool entirely.
 * - `overrides` replaces the auto-generated text for a category. Falsy values
 *   (empty string, null, undefined) fall back to auto text.
 */
export interface HintConfig {
  disabled?: HintCategory[];
  overrides?: Partial<Record<HintCategory, string | null>>;
}

export interface HintCandidate {
  category: HintCategory;
  bucket: HintBucket;
  /** The text that will actually be shown to the player. */
  text: string;
  /** The untouched auto-generated text, for admin preview + fallback. */
  autoText: string;
  /** True when `text` comes from `HintConfig.overrides`. */
  overridden: boolean;
}

export interface GenerateHintsOptions {
  /**
   * Include the "introduced in Generation X" hint. In daily mode this is
   * always true; in unlimited mode it's only meaningful when the player has
   * multiple generations selected.
   */
  includeGeneration?: boolean;
  hintConfig?: HintConfig | null;
}

export function getGenerationFromId(id: number): number {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  if (id <= 1025) return 9;
  return 1;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"] as const;

/**
 * Builds every candidate hint line the current Pokemon can produce, grouped
 * by (category, bucket). Exposed so the admin UI can render the same auto
 * text players would see, even when picking overrides.
 */
export function buildCandidates(
  pokemon: Pokemon,
  options: GenerateHintsOptions = {},
): HintCandidate[] {
  const { includeGeneration = true, hintConfig } = options;
  const disabled = new Set<HintCategory>(hintConfig?.disabled ?? []);
  const overrides = hintConfig?.overrides ?? {};

  const apply = (
    category: HintCategory,
    bucket: HintBucket,
    autoText: string,
  ): HintCandidate | null => {
    if (disabled.has(category)) return null;
    const overrideRaw = overrides[category];
    const override =
      typeof overrideRaw === "string" && overrideRaw.trim().length > 0
        ? overrideRaw.trim()
        : null;
    return {
      category,
      bucket,
      text: override ?? autoText,
      autoText,
      overridden: Boolean(override),
    };
  };

  const out: HintCandidate[] = [];

  // Type — vague
  if (pokemon.type && pokemon.type.length > 0) {
    const vagueType =
      pokemon.type.length === 1
        ? `This Pokemon is a ${pokemon.type[0]}-type Pokemon.`
        : `This Pokemon is a part-${pokemon.type[0]} type Pokemon.`;
    const c = apply("type", "vague", vagueType);
    if (c) out.push(c);
  }

  // Evolution stage — vague
  if (pokemon.evolution?.stage) {
    const stage = pokemon.evolution.stage;
    const text =
      stage === 1
        ? "This Pokemon is a base-stage Pokemon."
        : stage === 2
          ? "This Pokemon is a middle-stage evolution."
          : "This Pokemon is a final-stage evolution.";
    const c = apply("evolution_stage", "vague", text);
    if (c) out.push(c);
  }

  // Type — medium (more specific than the vague variant)
  if (pokemon.type && pokemon.type.length > 0) {
    const mediumType =
      pokemon.type.length === 1
        ? `This Pokemon is a ${pokemon.type[0]}-type Pokemon.`
        : pokemon.type.length === 2
          ? `This Pokemon is a ${pokemon.type[0]}- and ${pokemon.type[1]}-type Pokemon.`
          : null;
    if (mediumType) {
      const c = apply("type", "medium", mediumType);
      if (c) out.push(c);
    }
  }

  // Generation — medium
  if (includeGeneration) {
    const gen = getGenerationFromId(pokemon.id);
    if (gen) {
      const roman = ROMAN[gen - 1] ?? String(gen);
      const c = apply(
        "generation",
        "medium",
        `This Pokemon was introduced in Generation ${roman}.`,
      );
      if (c) out.push(c);
    }
  }

  // Species — specific
  if (pokemon.species && pokemon.species !== "Pokémon") {
    const lower = pokemon.species.toLowerCase();
    const already = lower.includes("pokemon") || lower.includes("pokémon");
    const text = already
      ? `This Pokemon is known as the ${pokemon.species}.`
      : `This Pokemon is known as the ${pokemon.species} Pokemon.`;
    const c = apply("species", "specific", text);
    if (c) out.push(c);
  }

  // Description — specific (skipped if it leaks the name or runs too long)
  if (pokemon.description) {
    const desc = pokemon.description;
    if (
      desc.length < 200 &&
      !desc.toLowerCase().includes(pokemon.name.toLowerCase())
    ) {
      const c = apply("description", "specific", desc);
      if (c) out.push(c);
    }
  }

  return out;
}

/**
 * Returns one representative auto-generated line per category, regardless of
 * whether that category is currently enabled. Used by the admin workbench to
 * render the "Auto" preview for every row. Disabled + overridden categories
 * still show their auto text so the admin can compare.
 */
export function buildCategoryPreview(
  pokemon: Pokemon,
): Record<HintCategory, string | null> {
  const candidates = buildCandidates(pokemon, {
    includeGeneration: true,
    hintConfig: undefined,
  });
  const byCategory: Record<HintCategory, string | null> = {
    type: null,
    evolution_stage: null,
    generation: null,
    species: null,
    description: null,
  };
  // Prefer the most specific bucket per category so the preview matches what
  // a well-played game would surface (e.g. dual-type line over the vague one).
  const bucketScore: Record<HintBucket, number> = {
    vague: 0,
    medium: 1,
    specific: 2,
  };
  for (const c of candidates) {
    const current = byCategory[c.category];
    if (!current) {
      byCategory[c.category] = c.autoText;
      continue;
    }
    const currentCandidate = candidates.find(
      (x) => x.category === c.category && x.autoText === current,
    );
    if (
      currentCandidate &&
      bucketScore[c.bucket] > bucketScore[currentCandidate.bucket]
    ) {
      byCategory[c.category] = c.autoText;
    }
  }
  return byCategory;
}

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isTypeHint(text: string): boolean {
  return text.includes("-type Pokemon") || text.includes("part-");
}

function extractTypes(hint: string): string[] {
  const dual = hint.match(/([A-Za-z]+)-\s*and\s*([A-Za-z]+)-type/);
  if (dual) {
    return [dual[1].toLowerCase(), dual[2].toLowerCase()].sort();
  }
  const single = hint.match(/(?:part-)?([A-Za-z]+)(?:-type| type)/);
  if (single) return [single[1].toLowerCase()];
  return [];
}

function isSimilarHint(a: string, b: string): boolean {
  if (a === b) return true;
  if (isTypeHint(a) && isTypeHint(b)) {
    const t1 = extractTypes(a).join(",");
    const t2 = extractTypes(b).join(",");
    if (t1 && t2 && t1 === t2) return true;
  }
  return false;
}

function findUnique(hints: string[], exclude: string[]): string | null {
  for (const h of hints) {
    if (!exclude.some((e) => isSimilarHint(h, e))) return h;
  }
  return null;
}

/**
 * Player-facing hint generator. Produces exactly 3 strings: vague, medium,
 * and the always-terminal "Full palette shown".
 *
 * Keep behavior parity with the inline version that used to live in
 * `src/app/game/page.tsx`; the admin Hints tab relies on this being the
 * source of truth.
 */
export function generateHints(
  pokemon: Pokemon,
  options: GenerateHintsOptions = {},
): string[] {
  const candidates = buildCandidates(pokemon, options);

  const vague = candidates.filter((c) => c.bucket === "vague").map((c) => c.text);
  const medium = candidates.filter((c) => c.bucket === "medium").map((c) => c.text);
  const specific = candidates
    .filter((c) => c.bucket === "specific")
    .map((c) => c.text);

  const selected: string[] = [];

  const typeHints: string[] = [];
  const vagueType = vague.find(isTypeHint);
  if (vagueType) typeHints.push(vagueType);
  typeHints.push(...medium.filter(isTypeHint));

  // First: a vague hint, preferring a type line when available.
  if (vague.length > 0) {
    const shuffled = shuffle(vague);
    const pickType = shuffled.find(isTypeHint);
    selected.push(pickType && typeHints.length > 0 ? pickType : shuffled[0]);
  }

  // Second: a medium hint that's not similar to the first.
  if (medium.length > 0) {
    const shuffled = shuffle(medium);
    const unique = findUnique(shuffled, selected);
    selected.push(unique ?? shuffled[0]);
  }

  // Third: the palette reveal line is terminal.
  selected.push("Full palette shown");

  const hasType = selected.some(isTypeHint);
  if (!hasType && typeHints.length > 0) {
    const uniqueType = findUnique(typeHints, selected);
    if (uniqueType) {
      const replaceIdx = selected.findIndex(
        (h) => h !== "Full palette shown" && !isTypeHint(h),
      );
      if (replaceIdx >= 0) selected[replaceIdx] = uniqueType;
      else if (selected.length >= 1) selected[0] = uniqueType;
    }
  }

  const all = [...shuffle(vague), ...shuffle(medium), ...shuffle(specific)];
  while (selected.length < 3 && all.length > 0) {
    const hint = all.shift();
    if (!hint) break;
    if (!selected.some((e) => isSimilarHint(hint, e))) selected.push(hint);
  }
  while (selected.length < 3) {
    selected.push("This Pokemon is a mystery!");
  }

  return selected.slice(0, 3);
}

/** Human label for a category — used in the admin UI. */
export const HINT_CATEGORY_LABELS: Record<HintCategory, string> = {
  type: "Type",
  evolution_stage: "Evolution stage",
  generation: "Generation",
  species: "Species",
  description: "Pokédex description",
};

export const HINT_CATEGORY_BUCKETS: Record<HintCategory, HintBucket> = {
  type: "medium",
  evolution_stage: "vague",
  generation: "medium",
  species: "specific",
  description: "specific",
};
