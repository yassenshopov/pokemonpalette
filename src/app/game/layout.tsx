import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pokémon Color Guessing Game - Daily Challenge | PokémonPalette",
  description:
    "Test your Pokémon knowledge with our daily color guessing game! Guess the Pokémon based on its color palette. Play daily challenges or unlimited mode. Compete on the leaderboard and improve your skills.",
  keywords: [
    "pokemon guessing game",
    "pokemon color game",
    "daily pokemon challenge",
    "pokemon quiz",
    "color palette game",
    "pokemon trivia",
  ],
  openGraph: {
    title: "Pokémon Color Guessing Game - Daily Challenge | PokémonPalette",
    description:
      "Test your Pokémon knowledge with our daily color guessing game! Guess the Pokémon based on its color palette.",
    url: "https://www.pokemonpalette.com/game",
    siteName: "PokémonPalette",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pokémon Color Guessing Game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokémon Color Guessing Game - Daily Challenge | PokémonPalette",
    description:
      "Test your Pokémon knowledge with our daily color guessing game! Guess the Pokémon based on its color palette.",
    images: ["/twitter-image.png"],
    creator: "@yassenshopov",
  },
  alternates: {
    canonical: "https://www.pokemonpalette.com/game",
  },
};

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

