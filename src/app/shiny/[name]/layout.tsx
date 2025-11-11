import { Metadata } from "next";
import { getPokemonMetadataByName } from "@/lib/pokemon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const pokemonMetadata = getPokemonMetadataByName(name);

  if (!pokemonMetadata) {
    return {
      title: "Pokemon Not Found",
    };
  }

  const ogImageUrl = `https://www.pokemonpalette.com/api/og/shiny/${name.toLowerCase()}`;

  return {
    title: `Shiny ${pokemonMetadata.name} - PokémonPalette`,
    description: `Explore Shiny ${pokemonMetadata.name}'s color palette. Extract beautiful colors from Shiny ${pokemonMetadata.name}'s sprite and create custom color schemes.`,
    openGraph: {
      title: `Shiny ${pokemonMetadata.name} - PokémonPalette`,
      description: `Explore Shiny ${pokemonMetadata.name}'s color palette and extract beautiful colors.`,
      url: `https://www.pokemonpalette.com/shiny/${name.toLowerCase()}`,
      siteName: "PokémonPalette",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 675,
          alt: `Shiny ${pokemonMetadata.name} color palette`,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Shiny ${pokemonMetadata.name} - PokémonPalette`,
      description: `Explore Shiny ${pokemonMetadata.name}'s color palette and extract beautiful colors.`,
      images: [ogImageUrl],
    },
    metadataBase: new URL("https://www.pokemonpalette.com"),
    alternates: {
      canonical: `https://www.pokemonpalette.com/shiny/${name.toLowerCase()}`,
    },
  };
}

export default function ShinyPokemonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

