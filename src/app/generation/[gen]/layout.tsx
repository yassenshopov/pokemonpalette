import { Metadata } from "next";
import { getPokemonMetadataByGeneration } from "@/lib/pokemon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gen: string }>;
}): Promise<Metadata> {
  const { gen } = await params;
  const generation = parseInt(gen);
  const pokemon = getPokemonMetadataByGeneration(generation);
  const count = pokemon.length;

  return {
    title: `Generation ${generation} Pokémon - Color Palettes | PokémonPalette`,
    description: `Explore color palettes from ${count} Generation ${generation} Pokémon. Extract beautiful colors from Gen ${generation} Pokémon sprites and create custom color schemes for your design projects.`,
    keywords: [
      `generation ${generation} pokemon colors`,
      `gen ${generation} pokemon color palette`,
      `generation ${generation} pokemon hex codes`,
      `pokemon gen ${generation} color scheme`,
      `generation ${generation} pokemon design colors`,
    ],
    openGraph: {
      title: `Generation ${generation} Pokémon Color Palettes - PokémonPalette`,
      description: `Discover beautiful color palettes from ${count} Generation ${generation} Pokémon. Perfect for designers and artists.`,
      url: `https://www.pokemonpalette.com/generation/${generation}`,
      siteName: "PokémonPalette",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Generation ${generation} Pokémon Color Palettes`,
      description: `Explore ${count} Generation ${generation} Pokémon color palettes.`,
    },
    metadataBase: new URL("https://www.pokemonpalette.com"),
    alternates: {
      canonical: `https://www.pokemonpalette.com/generation/${generation}`,
    },
  };
}

export default function GenerationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

