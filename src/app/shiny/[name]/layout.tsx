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
  // Shiny variants are structurally identical to the normal Pokemon page
  // (same template, same data, just a different palette toggle). To stop
  // them competing for ranking signals and showing up in GSC's "Crawled -
  // not indexed" bucket, we (a) point the canonical to the normal page so
  // any inbound link equity flows to /[name], and (b) emit a robots
  // `noindex, follow` so Google drops the /shiny/ URL from the index but
  // still follows internal links.
  const canonicalUrl = `https://www.pokemonpalette.com/${name.toLowerCase()}`;

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
      canonical: canonicalUrl,
    },
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
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

