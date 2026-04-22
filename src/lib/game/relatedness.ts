import type { Pokemon } from "@/types/pokemon";

// Signals we show on a wrong-but-warm guess. They are purely informational —
// none of them change the game's win state or similarity score. The goal is
// to make a near-miss feel like a near-miss ("you were in the right family")
// instead of a silent dead end.
export interface GuessRelatedness {
  // Intersection of the two Pokemon's types, preserving the guess's type
  // order so it reads naturally in the UI (e.g. "Water / Ground").
  sharedTypes: string[];
  // True if the guess appears in the target's evolution chain (or the target
  // appears in the guess's chain). Covers pre-evolutions, final evolutions,
  // and sibling branches (e.g. Vaporeon guessed for Flareon).
  sameEvolutionFamily: boolean;
  // True if both Pokemon belong to the same generation (derived from ID).
  sameGeneration: boolean;
}

// Mirrors getGenerationFromId in src/lib/game/hints.ts. Duplicated here to
// avoid a cyclic import between hints.ts (which may import from other game
// libs in the future) and this module.
function generationForId(id: number): number {
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

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// Extract the list of Pokemon names that make up a Pokemon's evolution
// chain. Our per-Pokemon JSON stores the chain as an array of
// `{ name, level, details }` entries, but the Pokemon type also allows a
// single-object shape (older data), so guard defensively.
function evolutionChainNames(pokemon: Pokemon): string[] {
  const evo = pokemon.evolution as unknown;
  if (!evo) return [];
  if (Array.isArray(evo)) {
    return evo
      .map((entry) =>
        entry && typeof entry === "object" && "name" in entry
          ? normalizeName(String((entry as { name: unknown }).name))
          : ""
      )
      .filter((name) => name.length > 0);
  }
  return [];
}

export function computeGuessRelatedness(
  guess: Pokemon,
  target: Pokemon
): GuessRelatedness {
  // Intersect on lowercase to avoid "Water" vs "water" mismatches, but keep
  // the original casing from the target for display.
  const targetTypesLower = new Set(target.type.map((t) => t.toLowerCase()));
  const sharedTypes = guess.type.filter((t) =>
    targetTypesLower.has(t.toLowerCase())
  );

  // Same-family check is symmetric: the guess is "in the family" if either
  // Pokemon's chain contains the other's name. Using both directions covers
  // imperfect data where only one side lists sibling branches (Eeveelutions,
  // Gallade/Gardevoir, etc).
  const guessNames = new Set(evolutionChainNames(guess));
  const targetNames = new Set(evolutionChainNames(target));
  const targetName = normalizeName(target.name);
  const guessName = normalizeName(guess.name);
  const sameEvolutionFamily =
    guess.id !== target.id &&
    (guessNames.has(targetName) || targetNames.has(guessName));

  return {
    sharedTypes,
    sameEvolutionFamily,
    sameGeneration: generationForId(guess.id) === generationForId(target.id),
  };
}
