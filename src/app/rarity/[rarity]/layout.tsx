import { Metadata } from "next";
import { PokemonRarity } from "@/types/pokemon";
import { getPokemonMetadataByRarity } from "@/lib/pokemon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rarity: string }>;
}): Promise<Metadata> {
  const { rarity } = await params;
  const rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
  const pokemon = getPokemonMetadataByRarity(rarityName as PokemonRarity);
  const count = pokemon.length;

  return {
    title: `${rarityName} Pokémon - Color Palettes | PokémonPalette`,
    description: `Explore color palettes from ${count} ${rarityName} Pokémon. Extract beautiful colors from ${rarityName} Pokémon sprites and create custom color schemes for your design projects.`,
    keywords: [
      `${rarityName.toLowerCase()} pokemon colors`,
      `${rarityName.toLowerCase()} pokemon color palette`,
      `${rarityName.toLowerCase()} pokemon hex codes`,
      `pokemon ${rarityName.toLowerCase()} color scheme`,
      `${rarityName.toLowerCase()} pokemon design colors`,
    ],
    openGraph: {
      title: `${rarityName} Pokémon Color Palettes - PokémonPalette`,
      description: `Discover beautiful color palettes from ${count} ${rarityName} Pokémon. Perfect for designers and artists.`,
      url: `https://www.pokemonpalette.com/rarity/${rarity.toLowerCase()}`,
      siteName: "PokémonPalette",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${rarityName} Pokémon Color Palettes`,
      description: `Explore ${count} ${rarityName} Pokémon color palettes.`,
    },
    metadataBase: new URL("https://www.pokemonpalette.com"),
    alternates: {
      canonical: `https://www.pokemonpalette.com/rarity/${rarity.toLowerCase()}`,
    },
  };
}

export default function RarityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

