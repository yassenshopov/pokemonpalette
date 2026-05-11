/**
 * SEO Content Component
 *
 * Renders accessible, unique content for each route into the server-rendered
 * HTML. Google's "Crawled - currently not indexed" verdict on the Pokemon
 * pages is driven by the fact that every interactive component below this
 * one is `ssr: false`, so the only Pokemon-specific text Googlebot sees in
 * the initial response comes from here. The block stays visually hidden via
 * `sr-only` so it doesn't interfere with the app UI, but the content is
 * real and unique per Pokemon (description, hex colors, abilities, stats)
 * rather than the templated boilerplate the previous version used.
 *
 * If the caller doesn't have the full Pokemon object (e.g. some category
 * pages still use the lighter metadata-only call sites), the component
 * gracefully degrades to a thinner description.
 */

import type { PokemonAbility } from "@/types/pokemon";

interface SEOContentProps {
  type: "home" | "pokemon" | "category";

  // Pokemon variant
  pokemonName?: string;
  pokemonType?: string[];
  pokemonGeneration?: number;
  pokemonDescription?: string;
  pokemonAbilities?: string[] | PokemonAbility[];
  pokemonHabitat?: string;
  pokemonRarity?: string;
  pokemonHeight?: number; // decimetres (PokeAPI convention)
  pokemonWeight?: number; // hectograms (PokeAPI convention)
  pokemonColors?: string[]; // hex strings
  pokemonShinyColors?: string[]; // hex strings
  isShiny?: boolean;

  // Category variant
  categoryType?: "type" | "generation" | "rarity";
  categoryName?: string;
  pokemonCount?: number;
}

function abilityNames(
  abilities: string[] | PokemonAbility[] | undefined,
): string[] {
  if (!abilities) return [];
  return abilities.map((a) => (typeof a === "string" ? a : a.name));
}

function formatHeight(decimetres?: number): string | null {
  if (!decimetres) return null;
  const m = decimetres / 10;
  return `${m.toFixed(1)} m`;
}

function formatWeight(hectograms?: number): string | null {
  if (!hectograms) return null;
  const kg = hectograms / 10;
  return `${kg.toFixed(1)} kg`;
}

export function SEOContent(props: SEOContentProps) {
  if (props.type === "home") {
    return (
      <div className="sr-only" aria-hidden="true">
        <h1>Pokémon Color Palette Generator</h1>
        <p>
          Extract beautiful color palettes from your favorite Pokémon sprites.
          Our free design tool generates custom color schemes from over 1000+
          Pokémon, including shiny variants. Perfect for designers, artists,
          and Pokémon fans looking for color inspiration for web design,
          graphic design, and digital art projects.
        </p>
        <h2>Features</h2>
        <ul>
          <li>Extract dominant colors from Pokémon sprites</li>
          <li>Browse all 1000+ Pokémon with official artwork</li>
          <li>Generate custom color palettes in HEX, RGB, and HSL formats</li>
          <li>Save and manage your favorite color schemes</li>
          <li>Play daily color guessing games</li>
          <li>Explore random Pokémon color palettes</li>
        </ul>
        <h2>How to Use</h2>
        <p>
          Search for any Pokémon by name or Pokédex number. Our tool extracts
          the top three dominant colors from the official artwork. Toggle
          between normal and shiny variants, save your favorite palettes, and
          export the colors as HEX, RGB, or HSL for your design projects.
        </p>
      </div>
    );
  }

  if (props.type === "pokemon" && props.pokemonName) {
    const {
      pokemonName,
      pokemonType = [],
      pokemonGeneration,
      pokemonDescription,
      pokemonAbilities,
      pokemonHabitat,
      pokemonRarity,
      pokemonHeight,
      pokemonWeight,
      pokemonColors = [],
      pokemonShinyColors = [],
      isShiny = false,
    } = props;

    const typeText = pokemonType.length > 0 ? pokemonType.join("/") : "Pokémon";
    const genText = pokemonGeneration
      ? ` introduced in Generation ${pokemonGeneration}`
      : "";
    const rarityText = pokemonRarity ? ` ${pokemonRarity.toLowerCase()}` : "";
    const habitatText = pokemonHabitat
      ? ` It is typically found in ${pokemonHabitat.toLowerCase()} habitats.`
      : "";

    const abilities = abilityNames(pokemonAbilities);
    const abilityText =
      abilities.length > 0
        ? ` ${pokemonName} can have the abilities ${abilities.join(", ")}.`
        : "";

    const height = formatHeight(pokemonHeight);
    const weight = formatWeight(pokemonWeight);
    const sizeText =
      height && weight ? ` Stands ${height} tall and weighs ${weight}.` : "";

    const activeColors = isShiny ? pokemonShinyColors : pokemonColors;
    const colorsText =
      activeColors.length > 0
        ? ` The dominant colors in ${isShiny ? "the shiny variant of " : ""}${pokemonName}'s official artwork are ${activeColors
            .slice(0, 3)
            .join(", ")}.`
        : "";

    return (
      <div className="sr-only" aria-hidden="true">
        <h1>
          {pokemonName} Color Palette
          {pokemonGeneration ? ` — Generation ${pokemonGeneration}` : ""}
        </h1>
        <p>
          {pokemonName} is a{rarityText} {typeText}-type Pokémon
          {genText}.{habitatText}
          {sizeText}
          {abilityText}
          {colorsText}
        </p>
        {pokemonDescription && (
          <>
            <h2>Pokédex Entry</h2>
            <p>{pokemonDescription}</p>
          </>
        )}
        {activeColors.length > 0 && (
          <>
            <h2>Color Palette</h2>
            <p>
              The {isShiny ? "shiny " : ""}color palette extracted from{" "}
              {pokemonName}&apos;s official artwork consists of the following
              hex values:
            </p>
            <ul>
              {activeColors.slice(0, 6).map((hex) => (
                <li key={hex}>{hex}</li>
              ))}
            </ul>
          </>
        )}
        <h2>About the Palette</h2>
        <p>
          Use these colors in web design, graphic design, branding, and
          digital art projects. Each color is provided as a HEX value, and the
          full palette can be exported as HEX, RGB, or HSL.
        </p>
      </div>
    );
  }

  if (
    props.type === "category" &&
    props.categoryName &&
    props.pokemonCount !== undefined
  ) {
    const { categoryName, categoryType, pokemonCount } = props;
    const categoryTypeText =
      categoryType === "type"
        ? "type"
        : categoryType === "generation"
          ? "generation"
          : "rarity";

    return (
      <div className="sr-only" aria-hidden="true">
        <h1>{categoryName} Pokémon Color Palettes</h1>
        <p>
          Browse {pokemonCount} {categoryName} Pokémon and explore their unique
          color palettes. Extract beautiful colors from {categoryName} Pokémon
          sprites and create custom color schemes for your design projects.
          Perfect for designers, artists, and Pokémon fans looking for{" "}
          {categoryTypeText}-specific color inspiration.
        </p>
        <h2>About {categoryName} Pokémon</h2>
        <p>
          Our color palette generator automatically extracts the dominant
          colors from each {categoryName} Pokémon&apos;s official artwork. Use
          these colors in web design, graphic design, digital art, and other
          creative projects.
        </p>
      </div>
    );
  }

  return null;
}
