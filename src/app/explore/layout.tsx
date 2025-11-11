import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Pokémon Color Palettes - PokémonPalette",
  description:
    "Discover beautiful color palettes from randomly selected Pokémon. Browse through hundreds of unique color schemes extracted from Pokémon sprites. Perfect for designers, artists, and Pokémon fans looking for inspiration.",
  keywords: [
    "pokemon color palettes",
    "explore pokemon colors",
    "pokemon color schemes",
    "pokemon palette gallery",
    "color inspiration",
    "pokemon design",
  ],
  openGraph: {
    title: "Explore Pokémon Color Palettes - PokémonPalette",
    description:
      "Discover beautiful color palettes from randomly selected Pokémon. Browse through hundreds of unique color schemes.",
    url: "https://www.pokemonpalette.com/explore",
    siteName: "PokémonPalette",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Explore Pokémon Color Palettes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore Pokémon Color Palettes - PokémonPalette",
    description:
      "Discover beautiful color palettes from randomly selected Pokémon. Browse through hundreds of unique color schemes.",
    images: ["/twitter-image.png"],
    creator: "@yassenshopov",
  },
  alternates: {
    canonical: "https://www.pokemonpalette.com/explore",
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

