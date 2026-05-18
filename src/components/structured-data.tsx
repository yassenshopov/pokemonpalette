/**
 * JSON-LD structured data for SEO.
 *
 * Sitewide `StructuredData` (WebApplication + Organization) is rendered once
 * from the root layout. Page-specific schemas (Pokémon WebPage, VideoGame,
 * HowTo, BreadcrumbList) are built via the helpers in this file and injected
 * from the relevant page/layout using `<JsonLd data={...} />`.
 *
 * Why per-page schemas matter for PokémonPalette specifically: Google ranks
 * the site position-7 on 609k impressions/3mo for queries like "pokemon
 * palette" and "guess the pokemon" — the org-level schema alone doesn't
 * make any of those pages rich-result eligible. Adding `BreadcrumbList`,
 * `VideoGame`, `HowTo`, and per-Pokémon `WebPage`+`Thing` schemas unlocks
 * breadcrumb, how-to, and game rich snippets in the SERP.
 */

const SITE_URL = "https://www.pokemonpalette.com";
const SITE_NAME = "PokémonPalette";

type SchemaObject = Record<string, unknown>;

/**
 * Renders an arbitrary schema.org object as a `<script type="application/ld+json">`
 * tag. Use the schema builders below to generate `data` objects.
 */
export function JsonLd({ data }: { data: SchemaObject | SchemaObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Sitewide WebApplication + Organization. Rendered once in the root layout. */
export function StructuredData() {
  const webApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    description:
      "Generate beautiful color palettes from your favorite Pokémon sprites. Extract dominant colors, create custom palettes, and discover the perfect color schemes for your design projects.",
    url: SITE_URL,
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "Yassen Shopov",
      url: "https://github.com/yassenshopov",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      "https://github.com/yassenshopov/pokemonpalette",
      "https://twitter.com/yassenshopov",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      url: "https://github.com/yassenshopov/pokemonpalette/issues",
    },
  };

  return <JsonLd data={[webApplicationSchema, organizationSchema]} />;
}

/* -------------------------------------------------------------------------- */
/*  Schema builders                                                            */
/* -------------------------------------------------------------------------- */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * BreadcrumbList schema. Pass items in left-to-right reading order; the
 * helper assigns `position` automatically. Always include the homepage as
 * the first item so Google can render the full path.
 */
export function breadcrumbSchema(items: BreadcrumbItem[]): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * VideoGame schema for the daily color-guessing game. Game-type schemas
 * earn richer SERP treatment than generic WebPage on game queries — Google
 * recognizes the page as an interactive game and can surface play-in-SERP
 * affordances for eligible properties.
 */
export function gameSchema(): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Pokémon Color Guessing Game",
    description:
      "Guess the Pokémon from its color palette. Daily challenge, unlimited mode, and head-to-head multiplayer. Four attempts per round, with type and generation hints when you need them.",
    url: `${SITE_URL}/game`,
    image: `${SITE_URL}/og-image.png`,
    gamePlatform: "Web Browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    genre: ["Puzzle", "Trivia", "Quiz"],
    playMode: ["SinglePlayer", "MultiPlayer"],
    numberOfPlayers: {
      "@type": "QuantitativeValue",
      minValue: 1,
      maxValue: 2,
    },
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "Yassen Shopov",
      url: "https://github.com/yassenshopov",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/**
 * HowTo schema mirroring the in-game How-to-Play modal. Targets the
 * "how to play pokemon palette" / "how to guess the pokemon" query
 * family — these earn HowTo rich results when steps are clearly listed.
 */
export function howToPlaySchema(): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to play Pokémon Color Guessing Game",
    description:
      "Identify the target Pokémon using only its color palette. You have four attempts and three optional hints.",
    totalTime: "PT2M",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: "0",
    },
    supply: [
      {
        "@type": "HowToSupply",
        name: "Color palette displayed at the top of the page",
      },
    ],
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Read the palette",
        text: "Look at the color swatches at the top of the screen. These are the dominant colors extracted from the target Pokémon's official artwork.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Make your first guess",
        text: "Type any Pokémon name and submit. The game scores how close your guess's palette is to the target — green means very close, red means far off.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Use feedback to narrow down",
        text: "After each guess you'll see warm/cool hints when your guess shares a type, generation, or evolution line with the target.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Reveal hints if stuck",
        text: "You can reveal up to three hints — type, generation, and the full extracted palette. There's a short cooldown between hints to keep the puzzle fair.",
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: "Solve in four attempts",
        text: "You have four attempts total. Guess correctly to add the Pokémon to your Pokédex and keep your daily streak alive.",
      },
    ],
  };
}
