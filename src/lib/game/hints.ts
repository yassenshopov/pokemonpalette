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
  "first_letter",
  "weight_class",
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

/**
 * Facts the player has already learned from their previous guesses' relatedness
 * output. Used by `buildCandidates` to filter out hints that would just
 * regurgitate information the badges/toasts already revealed.
 *
 * - `sharedTypes` should be lowercase type names; aggregate the union across
 *   every prior guess that shared at least one type with the target.
 * - `sameEvolutionFamily` is true if any prior guess landed in the target's
 *   evolution family.
 * - `sameGeneration` is true if any prior guess was from the same generation
 *   as the target.
 */
export interface KnownFacts {
  sharedTypes: string[];
  sameEvolutionFamily: boolean;
  sameGeneration: boolean;
}

export interface GenerateHintsOptions {
  /**
   * Include the "introduced in Generation X" hint. In daily mode this is
   * always true; in unlimited mode it's only meaningful when the player has
   * multiple generations selected.
   */
  includeGeneration?: boolean;
  hintConfig?: HintConfig | null;
  /**
   * Facts the player already knows from prior guess relatedness. Hints that
   * would only restate these facts are skipped. Optional — when omitted the
   * generator behaves as it always has.
   */
  knownFacts?: KnownFacts | null;
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
  const { includeGeneration = true, hintConfig, knownFacts } = options;
  const disabled = new Set<HintCategory>(hintConfig?.disabled ?? []);
  const overrides = hintConfig?.overrides ?? {};

  // Normalize the player's known facts so casing differences (e.g. "Grass"
  // from a guess vs the target's `pokemon.type` array) don't cause us to miss
  // a redundancy.
  const knownTypes = new Set(
    (knownFacts?.sharedTypes ?? []).map((t) => t.toLowerCase()),
  );
  const knownsSameFamily = Boolean(knownFacts?.sameEvolutionFamily);
  const knownsSameGen = Boolean(knownFacts?.sameGeneration);

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

  // Type — vague. Skip when the type name the vague hint would mention is
  // already known from a same-type guess. For dual-types the vague variant
  // only mentions the primary type, so we only need that one to be known.
  const primaryType = pokemon.type?.[0];
  if (primaryType) {
    const primaryKnown = knownTypes.has(primaryType.toLowerCase());
    const vagueType =
      pokemon.type.length === 1
        ? `This Pokemon is a ${primaryType}-type Pokemon.`
        : `This Pokemon is a part-${primaryType} type Pokemon.`;
    if (!primaryKnown) {
      const c = apply("type", "vague", vagueType);
      if (c) out.push(c);
    }
  }

  // Evolution stage — vague. Skip when the player already has a same-family
  // guess; once they're in the family the stage is essentially implied and
  // surfacing it adds nothing on top of the badge they saw.
  if (pokemon.evolution?.stage && !knownsSameFamily) {
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

  // Type — medium. The medium variant lists every type, so we only skip when
  // *every* type is already known from prior guesses.
  if (pokemon.type && pokemon.type.length > 0) {
    const allTypesKnown = pokemon.type.every((t) =>
      knownTypes.has(t.toLowerCase()),
    );
    const mediumType =
      pokemon.type.length === 1
        ? `This Pokemon is a ${pokemon.type[0]}-type Pokemon.`
        : pokemon.type.length === 2
          ? `This Pokemon is a ${pokemon.type[0]}- and ${pokemon.type[1]}-type Pokemon.`
          : null;
    if (mediumType && !allTypesKnown) {
      const c = apply("type", "medium", mediumType);
      if (c) out.push(c);
    }
  }

  // Generation — medium. Skipped when a previous guess shared the target's
  // generation: the same-generation badge already conveys this.
  if (includeGeneration && !knownsSameGen) {
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

  // Fallback pool — surfaced when the obvious type/generation/evolution hints
  // have been filtered out by `knownFacts`. Both are safe (no name leak) and
  // available for every Pokemon, so they keep us at three hints in tough
  // edge cases (e.g. dual-type filtered + generation filtered).
  if (pokemon.name && pokemon.name.length > 0) {
    const letter = pokemon.name.trim().charAt(0).toUpperCase();
    if (letter) {
      const c = apply(
        "first_letter",
        "vague",
        `This Pokemon's name starts with the letter ${letter}.`,
      );
      if (c) out.push(c);
    }
  }

  if (typeof pokemon.weight === "number" && pokemon.weight > 0) {
    const text = describeWeightClass(pokemon.weight);
    if (text) {
      const c = apply("weight_class", "vague", text);
      if (c) out.push(c);
    }
  }

  return out;
}

/**
 * Buckets a Pokemon's weight (in kilograms) into a coarse description. The
 * thresholds are chosen so each bucket has a meaningful population across the
 * full Pokedex — most starters land in the lightweight/midweight buckets,
 * pseudo-legendaries in the heavy bucket, and the truly massive (Wailord,
 * Steelix, etc.) in the very-heavy bucket.
 */
function describeWeightClass(weightKg: number): string | null {
  if (weightKg < 10) {
    return "This Pokemon weighs less than 10 kilograms.";
  }
  if (weightKg < 50) {
    return "This Pokemon weighs between 10 and 50 kilograms.";
  }
  if (weightKg < 100) {
    return "This Pokemon weighs between 50 and 100 kilograms.";
  }
  if (weightKg < 250) {
    return "This Pokemon weighs between 100 and 250 kilograms.";
  }
  return "This Pokemon weighs more than 250 kilograms.";
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
    first_letter: null,
    weight_class: null,
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
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

function isTypeHint(text: string): boolean {
  return text.includes("-type Pokemon") || text.includes("part-");
}

function extractTypes(hint: string): string[] {
  const dual = hint.match(/([A-Za-z]+)-\s*and\s*([A-Za-z]+)-type/);
  if (dual && dual[1] && dual[2]) {
    return [dual[1].toLowerCase(), dual[2].toLowerCase()].sort();
  }
  const single = hint.match(/(?:part-)?([A-Za-z]+)(?:-type| type)/);
  if (single && single[1]) return [single[1].toLowerCase()];
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

  const typeHints: string[] = [];
  const vagueType = vague.find(isTypeHint);
  if (vagueType) typeHints.push(vagueType);
  typeHints.push(...medium.filter(isTypeHint));

  // We build the two "informative" slots first, then append the always-
  // terminal palette reveal. Doing it in this order means the fallback loop
  // below can't accidentally push the palette line into slot 1 when knownFacts
  // (or rare data shapes) leave the medium bucket empty.
  const informative: string[] = [];

  // First slot: a vague hint, preferring a type line when available.
  if (vague.length > 0) {
    const shuffled = shuffle(vague);
    const pickType = shuffled.find(isTypeHint);
    const first = shuffled[0];
    if (first !== undefined) {
      informative.push(pickType && typeHints.length > 0 ? pickType : first);
    }
  }

  // Second slot: a medium hint that's not similar to the first.
  if (medium.length > 0) {
    const shuffled = shuffle(medium);
    const unique = findUnique(shuffled, informative);
    const fallback = shuffled[0];
    if (unique !== null) {
      informative.push(unique);
    } else if (fallback !== undefined) {
      informative.push(fallback);
    }
  }

  // Type-hint guarantee. When type candidates exist but neither informative
  // slot ended up as a type hint, swap one in. This silently no-ops when
  // knownFacts has filtered every type candidate out (`typeHints` is empty).
  const hasType = informative.some(isTypeHint);
  if (!hasType && typeHints.length > 0) {
    const uniqueType = findUnique(typeHints, informative);
    if (uniqueType) {
      const replaceIdx = informative.findIndex((h) => !isTypeHint(h));
      if (replaceIdx >= 0) informative[replaceIdx] = uniqueType;
      else if (informative.length >= 1) informative[0] = uniqueType;
    }
  }

  // Fill remaining informative slots from the broader pool (vague →
  // medium → specific). This is what surfaces fallback hints like
  // first-letter / weight-class when knownFacts removed the obvious picks.
  const all = [...shuffle(vague), ...shuffle(medium), ...shuffle(specific)];
  while (informative.length < 2 && all.length > 0) {
    const hint = all.shift();
    if (!hint) break;
    if (!informative.some((e) => isSimilarHint(hint, e))) informative.push(hint);
  }
  while (informative.length < 2) {
    informative.push("This Pokemon is a mystery!");
  }

  return [...informative.slice(0, 2), "Full palette shown"];
}

/** Human label for a category — used in the admin UI. */
export const HINT_CATEGORY_LABELS: Record<HintCategory, string> = {
  type: "Type",
  evolution_stage: "Evolution stage",
  generation: "Generation",
  species: "Species",
  description: "Pokédex description",
  first_letter: "First letter",
  weight_class: "Weight class",
};

export const HINT_CATEGORY_BUCKETS: Record<HintCategory, HintBucket> = {
  type: "medium",
  evolution_stage: "vague",
  generation: "medium",
  species: "specific",
  description: "specific",
  first_letter: "vague",
  weight_class: "vague",
};
