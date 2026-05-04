import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Palettes - PokémonPalette",
  description:
    "View, search, and manage your saved Pokémon color palettes. Quickly jump back to any palette you've bookmarked.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "https://www.pokemonpalette.com/saved-palettes",
  },
};

export default function SavedPalettesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
