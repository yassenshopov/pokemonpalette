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

  const ogImageUrl = `https://www.pokemonpalette.com/api/og/${name.toLowerCase()}`;

  return {
    title: `${pokemonMetadata.name} - PokémonPalette`,
    description: `Explore ${pokemonMetadata.name}'s color palette. Extract beautiful colors from ${pokemonMetadata.name}'s sprite and create custom color schemes.`,
    openGraph: {
      title: `${pokemonMetadata.name} - PokémonPalette`,
      description: `Explore ${pokemonMetadata.name}'s color palette and extract beautiful colors.`,
      url: `https://www.pokemonpalette.com/${name.toLowerCase()}`,
      siteName: "PokémonPalette",
      // Explicitly override root layout images by providing a new array
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 675,
          alt: `${pokemonMetadata.name} color palette`,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${pokemonMetadata.name} - PokémonPalette`,
      description: `Explore ${pokemonMetadata.name}'s color palette and extract beautiful colors.`,
      // Explicitly override root layout images
      images: [ogImageUrl],
    },
    // Explicitly set metadataBase to ensure absolute URLs work correctly
    metadataBase: new URL("https://www.pokemonpalette.com"),
  };
}

export default function PokemonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
