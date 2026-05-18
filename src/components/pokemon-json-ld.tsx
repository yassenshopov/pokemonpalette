/**
 * Per-Pokemon JSON-LD structured data.
 *
 * Emits two pieces of Schema.org JSON-LD into the page's <head>:
 *   1. A `CreativeWork` describing the color palette page itself, with the
 *      Pokemon's hex colors as `additionalProperty` entries so they show up
 *      in rich results.
 *   2. A `BreadcrumbList` matching the in-page breadcrumbs so Google can
 *      render the breadcrumb trail in SERPs.
 *
 * This is the strongest unique signal we can give Google for these pages.
 * Combined with the visible per-Pokemon content in `SEOContent`, it gives
 * the crawler enough differentiation to flip pages out of "Crawled - not
 * indexed" into the index proper.
 */

import type { Pokemon, PokemonAbility } from "@/types/pokemon";

interface PokemonJsonLdProps {
  pokemon: Pokemon;
  isShiny?: boolean;
}

function abilityNames(
  abilities: string[] | PokemonAbility[] | undefined,
): string[] {
  if (!abilities) return [];
  return abilities.map((a) => (typeof a === "string" ? a : a.name));
}

export function PokemonJsonLd({ pokemon, isShiny = false }: PokemonJsonLdProps) {
  const baseUrl = "https://www.pokemonpalette.com";
  const displayName = isShiny ? `Shiny ${pokemon.name}` : pokemon.name;
  const pageUrl = isShiny
    ? `${baseUrl}/shiny/${pokemon.name.toLowerCase()}`
    : `${baseUrl}/${pokemon.name.toLowerCase()}`;

  const palette = isShiny ? pokemon.shinyColorPalette : pokemon.colorPalette;
  const colors = palette?.highlights ?? [
    palette?.primary,
    palette?.secondary,
    palette?.accent,
  ].filter((c): c is string => Boolean(c));

  const abilities = abilityNames(pokemon.abilities);

  const creativeWork = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: `${displayName} Color Palette`,
    headline: `${displayName} Color Palette — Generation ${pokemon.generation}`,
    description:
      pokemon.description ||
      `Color palette extracted from ${displayName}'s official artwork.`,
    url: pageUrl,
    image: `${baseUrl}/api/og/${isShiny ? "shiny/" : ""}${pokemon.name.toLowerCase()}`,
    inLanguage: "en",
    isAccessibleForFree: true,
    author: {
      "@type": "Organization",
      name: "PokémonPalette",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "PokémonPalette",
      url: baseUrl,
    },
    about: {
      "@type": "Thing",
      name: displayName,
      description: pokemon.description,
      identifier: pokemon.id,
    },
    keywords: [
      displayName,
      `${displayName} color palette`,
      ...pokemon.type.map((t) => `${t} type`),
      `Generation ${pokemon.generation}`,
      pokemon.rarity,
      ...colors,
    ].join(", "),
    additionalProperty: [
      ...pokemon.type.map((t) => ({
        "@type": "PropertyValue",
        name: "Type",
        value: t,
      })),
      {
        "@type": "PropertyValue",
        name: "Generation",
        value: pokemon.generation,
      },
      {
        "@type": "PropertyValue",
        name: "Rarity",
        value: pokemon.rarity,
      },
      ...(pokemon.habitat
        ? [
            {
              "@type": "PropertyValue",
              name: "Habitat",
              value: pokemon.habitat,
            },
          ]
        : []),
      ...(pokemon.height
        ? [
            {
              "@type": "PropertyValue",
              name: "Height",
              value: `${(pokemon.height / 10).toFixed(1)} m`,
            },
          ]
        : []),
      ...(pokemon.weight
        ? [
            {
              "@type": "PropertyValue",
              name: "Weight",
              value: `${(pokemon.weight / 10).toFixed(1)} kg`,
            },
          ]
        : []),
      ...abilities.map((a) => ({
        "@type": "PropertyValue",
        name: "Ability",
        value: a,
      })),
      ...colors.map((hex, i) => ({
        "@type": "PropertyValue",
        name: i === 0 ? "Primary color" : i === 1 ? "Secondary color" : `Color ${i + 1}`,
        value: hex,
      })),
    ],
  };

  // Include the primary type in the breadcrumb so Google sees the taxonomy
  // path (Home → Fire type Pokémon → Charizard) instead of a flat (Home →
  // Charizard). Exposes the /type/[type] hub pages to the rich-result crawl
  // path. Only the first type is used — dual-types would emit two crumbs at
  // the same level which Google rejects.
  const primaryType = pokemon.type?.[0];
  const typeCrumb = primaryType
    ? {
        "@type": "ListItem" as const,
        position: 2,
        name: `${primaryType} type Pokémon`,
        item: `${baseUrl}/type/${primaryType.toLowerCase()}`,
      }
    : null;
  const pokemonCrumbPosition = typeCrumb ? 3 : 2;
  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      ...(typeCrumb ? [typeCrumb] : []),
      ...(isShiny
        ? [
            {
              "@type": "ListItem" as const,
              position: pokemonCrumbPosition,
              name: pokemon.name,
              item: `${baseUrl}/${pokemon.name.toLowerCase()}`,
            },
            {
              "@type": "ListItem" as const,
              position: pokemonCrumbPosition + 1,
              name: displayName,
              item: pageUrl,
            },
          ]
        : [
            {
              "@type": "ListItem" as const,
              position: pokemonCrumbPosition,
              name: pokemon.name,
              item: pageUrl,
            },
          ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWork) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList) }}
      />
    </>
  );
}
