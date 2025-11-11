import { Metadata } from "next";
import { PokemonType } from "@/types/pokemon";
import { getPokemonMetadataByType } from "@/lib/pokemon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  const typeName = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  const pokemon = getPokemonMetadataByType(typeName as PokemonType);
  const count = pokemon.length;

  return {
    title: `${typeName} Type Pokémon - Color Palettes | PokémonPalette`,
    description: `Explore color palettes from ${count} ${typeName}-type Pokémon. Extract beautiful colors from ${typeName}-type Pokémon sprites and create custom color schemes for your design projects.`,
    keywords: [
      `${typeName.toLowerCase()} type pokemon colors`,
      `${typeName.toLowerCase()} pokemon color palette`,
      `${typeName.toLowerCase()} type pokemon hex codes`,
      `pokemon ${typeName.toLowerCase()} color scheme`,
      `${typeName.toLowerCase()} pokemon design colors`,
    ],
    openGraph: {
      title: `${typeName} Type Pokémon Color Palettes - PokémonPalette`,
      description: `Discover beautiful color palettes from ${count} ${typeName}-type Pokémon. Perfect for designers and artists.`,
      url: `https://www.pokemonpalette.com/type/${type.toLowerCase()}`,
      siteName: "PokémonPalette",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${typeName} Type Pokémon Color Palettes`,
      description: `Explore ${count} ${typeName}-type Pokémon color palettes.`,
    },
    metadataBase: new URL("https://www.pokemonpalette.com"),
    alternates: {
      canonical: `https://www.pokemonpalette.com/type/${type.toLowerCase()}`,
    },
  };
}

export default function TypeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

