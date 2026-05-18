/**
 * Pokemon Info Section — the **visible**, server-rendered SEO content for
 * each /[name] route.
 *
 * Background: Google was keeping every Pokemon page in "Crawled - currently
 * not indexed" because the only Pokemon-specific text in the initial HTML
 * was buried in a `sr-only aria-hidden="true"` block (see seo-content.tsx).
 * Google heavily discounts content that is both visually hidden and marked
 * aria-hidden, so the canonical pages looked thin and templated — title,
 * description, and visible body were near-identical across all ~1,350
 * routes.
 *
 * This component fixes that by rendering, **visibly and server-side**, a
 * dedicated content section per Pokemon:
 *
 *   - Unique H1 with the Pokemon's name and palette descriptor
 *   - Lead paragraph using actual type, generation, rarity, and a
 *     human-readable description of the dominant palette color
 *   - Pokédex flavor text quote
 *   - Structured palette breakdown with named hex codes
 *   - Definition list of biological/game metadata (type/gen/rarity/etc.)
 *   - ~30+ internal links to related routes (same type, same generation,
 *     same rarity, individual related Pokemon) so PageRank flows through
 *     the site and Google sees this page as part of a larger, well-linked
 *     resource rather than an island
 *
 * Renders as a true server component (no `"use client"`), so the content
 * appears in the initial HTML response Googlebot fetches, without any
 * JS-rendering requirement.
 */

import Link from "next/link";
import type { Pokemon, PokemonAbility } from "@/types/pokemon";
import { getAllPokemonMetadata } from "@/lib/pokemon";
import { describeHex, colorTemperature } from "@/lib/color-name";

interface PokemonInfoSectionProps {
  pokemon: Pokemon;
}

function abilityNames(
  abilities: string[] | PokemonAbility[] | undefined,
): string[] {
  if (!abilities) return [];
  return abilities.map((a) => (typeof a === "string" ? a : a.name));
}

function formatHeight(decimetres?: number): string | null {
  if (!decimetres) return null;
  return `${(decimetres / 10).toFixed(1)} m`;
}

function formatWeight(hectograms?: number): string | null {
  if (!hectograms) return null;
  return `${(hectograms / 10).toFixed(1)} kg`;
}

function paletteMoodDescriptor(colors: string[]): string {
  if (colors.length === 0) return "balanced";
  const counts = { warm: 0, cool: 0, neutral: 0 };
  for (const c of colors) counts[colorTemperature(c)]++;
  if (counts.warm > counts.cool && counts.warm >= counts.neutral) return "warm";
  if (counts.cool > counts.warm && counts.cool >= counts.neutral) return "cool";
  return "balanced";
}

/**
 * Compute the visible 6-color palette to write prose about. Prefer the
 * curated `highlights` list (admin-locked when present), falling back to
 * the deterministic primary/secondary/accent triplet so legacy entries
 * still render content even without highlights.
 */
function activePalette(pokemon: Pokemon): string[] {
  const highlights = pokemon.colorPalette?.highlights;
  if (highlights && highlights.length > 0) return highlights.slice(0, 6);
  const fallback = [
    pokemon.colorPalette?.primary,
    pokemon.colorPalette?.secondary,
    pokemon.colorPalette?.accent,
  ].filter((c): c is string => Boolean(c));
  return fallback;
}

/**
 * Pick up to N related Pokemon for the in-body internal-link grid.
 * Filters out the current Pokemon, prefers entries close in Pokédex
 * order so the "related" links feel intuitive (Charmander → Charmeleon,
 * Charizard, etc.) rather than alphabetical noise.
 */
function pickRelated(
  all: ReturnType<typeof getAllPokemonMetadata>,
  options: {
    excludeId: number;
    type?: string;
    generation?: number;
    rarity?: string;
    proximityId?: number;
    limit: number;
  },
): ReturnType<typeof getAllPokemonMetadata> {
  const filtered = all.filter((p) => {
    if (p.id === options.excludeId) return false;
    if (options.type && !p.type.includes(options.type)) return false;
    if (options.generation && p.generation !== options.generation) return false;
    if (options.rarity && p.rarity !== options.rarity) return false;
    return true;
  });

  if (options.proximityId) {
    const anchor = options.proximityId;
    filtered.sort((a, b) => Math.abs(a.id - anchor) - Math.abs(b.id - anchor));
  }

  return filtered.slice(0, options.limit);
}

export function PokemonInfoSection({ pokemon }: PokemonInfoSectionProps) {
  const palette = activePalette(pokemon);
  const primaryHex = palette[0];
  const primaryDescriptor = primaryHex ? describeHex(primaryHex) : null;
  const mood = paletteMoodDescriptor(palette);
  const abilities = abilityNames(pokemon.abilities);
  const height = formatHeight(pokemon.height);
  const weight = formatWeight(pokemon.weight);
  const primaryType = pokemon.type[0];
  const typeJoined =
    pokemon.type.length > 1 ? pokemon.type.join("/") : (primaryType ?? "Unknown");
  const rarityLower = pokemon.rarity?.toLowerCase() ?? "common";

  const all = getAllPokemonMetadata();
  const sameTypeNeighbours = primaryType
    ? pickRelated(all, {
        excludeId: pokemon.id,
        type: primaryType,
        proximityId: pokemon.id,
        limit: 8,
      })
    : [];
  const sameGenerationNeighbours = pickRelated(all, {
    excludeId: pokemon.id,
    generation: pokemon.generation,
    proximityId: pokemon.id,
    limit: 8,
  });
  const sameRarityNeighbours = pickRelated(all, {
    excludeId: pokemon.id,
    rarity: pokemon.rarity,
    proximityId: pokemon.id,
    limit: 6,
  });

  return (
    <section
      aria-labelledby={`${pokemon.name.toLowerCase()}-info-heading`}
      className="mt-4 mb-12 px-4 md:px-12"
    >
      <article className="max-w-3xl">
        <h1
          id={`${pokemon.name.toLowerCase()}-info-heading`}
          className="mb-3 text-2xl md:text-3xl font-bold font-heading text-foreground"
        >
          {pokemon.name} color palette
          {primaryDescriptor ? ` — a ${primaryDescriptor} ${mood} scheme` : ""}
        </h1>
        <p className="mt-2 text-base md:text-lg leading-relaxed text-muted-foreground">
          {pokemon.name} is a {rarityLower} {typeJoined}-type Pokémon
          {pokemon.generation
            ? ` introduced in Generation ${pokemon.generation}`
            : ""}
          {pokemon.habitat
            ? `, native to ${pokemon.habitat.toLowerCase()} habitats`
            : ""}
          .{" "}
          {palette.length > 0 ? (
            <>
              Its official artwork yields a {mood} palette of {palette.length}{" "}
              colours led by{" "}
              <code className="font-mono text-sm">{primaryHex}</code>
              {primaryDescriptor ? ` (a ${primaryDescriptor})` : ""}
              {palette[1]
                ? ` and supported by ${describeHex(palette[1])} tones at `
                : ""}
              {palette[1] ? (
                <code className="font-mono text-sm">{palette[1]}</code>
              ) : null}
              {palette[1] ? "." : ""}{" "}
              The full palette is ready to copy as HEX, RGB, or HSL for design
              work, branding, or digital art.
            </>
          ) : (
            <>
              Its dominant colours are extracted live from the official
              artwork — toggle to the shiny variant or copy the full palette
              in HEX, RGB, or HSL formats.
            </>
          )}
        </p>

        {pokemon.description ? (
          <>
            <h2 className="mt-8 mb-3 text-xl font-semibold font-heading text-foreground">
              About {pokemon.name}
            </h2>
            <blockquote className="my-3 border-l-4 border-border pl-4 italic text-muted-foreground">
              {pokemon.description}
            </blockquote>
          </>
        ) : null}

        {palette.length > 0 ? (
          <>
            <h2 className="mt-8 mb-3 text-xl font-semibold font-heading text-foreground">
              The {pokemon.name} palette in hex
            </h2>
            <ul className="my-3 grid grid-cols-2 sm:grid-cols-3 gap-3 list-none pl-0">
              {palette.map((hex, i) => (
                <li
                  key={hex + i}
                  className="flex items-center gap-3 p-2 rounded-md border bg-card"
                >
                  <span
                    aria-hidden="true"
                    className="block w-8 h-8 rounded shrink-0 ring-1 ring-border"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="flex flex-col min-w-0">
                    <code className="font-mono text-sm">{hex}</code>
                    <span className="text-xs text-muted-foreground capitalize">
                      {describeHex(hex)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h2 className="mt-8 mb-3 text-xl font-semibold font-heading text-foreground">
          {pokemon.name} at a glance
        </h2>
        <dl className="my-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b pb-1">
            <dt className="font-medium">Type</dt>
            <dd className="text-muted-foreground">
              {pokemon.type.map((t, i) => (
                <span key={t}>
                  <Link
                    href={`/type/${t.toLowerCase()}`}
                    className="hover:underline"
                  >
                    {t}
                  </Link>
                  {i < pokemon.type.length - 1 ? " / " : ""}
                </span>
              ))}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b pb-1">
            <dt className="font-medium">Generation</dt>
            <dd className="text-muted-foreground">
              <Link
                href={`/generation/${pokemon.generation}`}
                className="hover:underline"
              >
                Generation {pokemon.generation}
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b pb-1">
            <dt className="font-medium">Rarity</dt>
            <dd className="text-muted-foreground">
              <Link
                href={`/rarity/${rarityLower}`}
                className="hover:underline capitalize"
              >
                {pokemon.rarity}
              </Link>
            </dd>
          </div>
          {pokemon.species ? (
            <div className="flex justify-between gap-4 border-b pb-1">
              <dt className="font-medium">Species</dt>
              <dd className="text-muted-foreground">{pokemon.species}</dd>
            </div>
          ) : null}
          {height ? (
            <div className="flex justify-between gap-4 border-b pb-1">
              <dt className="font-medium">Height</dt>
              <dd className="text-muted-foreground">{height}</dd>
            </div>
          ) : null}
          {weight ? (
            <div className="flex justify-between gap-4 border-b pb-1">
              <dt className="font-medium">Weight</dt>
              <dd className="text-muted-foreground">{weight}</dd>
            </div>
          ) : null}
          {pokemon.habitat ? (
            <div className="flex justify-between gap-4 border-b pb-1">
              <dt className="font-medium">Habitat</dt>
              <dd className="text-muted-foreground capitalize">
                {pokemon.habitat}
              </dd>
            </div>
          ) : null}
          {abilities.length > 0 ? (
            <div className="flex justify-between gap-4 border-b pb-1">
              <dt className="font-medium">Abilities</dt>
              <dd className="text-muted-foreground">{abilities.join(", ")}</dd>
            </div>
          ) : null}
        </dl>

        <h2 className="mt-8 mb-3 text-xl font-semibold font-heading text-foreground">
          Related Pokémon palettes
        </h2>
        <p className="text-muted-foreground">
          Explore more colour schemes from Pokémon with shared traits — same
          type, same generation, or same rarity tier.
        </p>

        {primaryType && sameTypeNeighbours.length > 0 ? (
          <>
            <h3 className="mt-5 mb-2 text-base font-semibold text-foreground">
              Other {primaryType}-type palettes
            </h3>
            <ul className="my-2 flex flex-wrap gap-2 list-none pl-0">
              {sameTypeNeighbours.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/${p.name.toLowerCase()}`}
                    className="inline-flex px-3 py-1 rounded-full border bg-card hover:bg-muted text-sm transition-colors"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-sm">
              <Link
                href={`/type/${primaryType.toLowerCase()}`}
                className="hover:underline"
              >
                Browse all {primaryType}-type Pokémon palettes →
              </Link>
            </p>
          </>
        ) : null}

        {sameGenerationNeighbours.length > 0 ? (
          <>
            <h3 className="mt-5 mb-2 text-base font-semibold text-foreground">
              More from Generation {pokemon.generation}
            </h3>
            <ul className="my-2 flex flex-wrap gap-2 list-none pl-0">
              {sameGenerationNeighbours.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/${p.name.toLowerCase()}`}
                    className="inline-flex px-3 py-1 rounded-full border bg-card hover:bg-muted text-sm transition-colors"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-sm">
              <Link
                href={`/generation/${pokemon.generation}`}
                className="hover:underline"
              >
                Browse all Generation {pokemon.generation} palettes →
              </Link>
            </p>
          </>
        ) : null}

        {sameRarityNeighbours.length > 0 ? (
          <>
            <h3 className="mt-5 mb-2 text-base font-semibold text-foreground">
              Other {rarityLower} Pokémon
            </h3>
            <ul className="my-2 flex flex-wrap gap-2 list-none pl-0">
              {sameRarityNeighbours.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/${p.name.toLowerCase()}`}
                    className="inline-flex px-3 py-1 rounded-full border bg-card hover:bg-muted text-sm transition-colors"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-sm">
              <Link
                href={`/rarity/${rarityLower}`}
                className="hover:underline capitalize"
              >
                Browse all {pokemon.rarity} Pokémon palettes →
              </Link>
            </p>
          </>
        ) : null}

        <p className="mt-8 text-sm text-muted-foreground">
          Looking for a different look? Try the{" "}
          <Link
            href={`/shiny/${pokemon.name.toLowerCase()}`}
            className="hover:underline"
          >
            shiny {pokemon.name} palette
          </Link>{" "}
          for an alternate colour treatment.
        </p>
      </article>
    </section>
  );
}
