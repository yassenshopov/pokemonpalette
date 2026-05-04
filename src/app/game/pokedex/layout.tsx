import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pokedex - PokémonPalette Game",
  description:
    "Track every Pokémon you've caught across daily and unlimited modes — both normal and shiny variants.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "https://www.pokemonpalette.com/game/pokedex",
  },
};

export default function PokedexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
