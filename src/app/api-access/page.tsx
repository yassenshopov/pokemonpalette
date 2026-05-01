import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ApiAccessContent } from "@/components/api-access-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pokémon Color Palette API — Lifetime Access | PokémonPalette",
  description:
    "Get lifetime access to the PokémonPalette API. Fetch curated color palettes, Tailwind configs, and CSS variables for all 1,350+ Pokémon. One-time $29 payment.",
  keywords: [
    "pokemon color palette api",
    "pokemon colors api",
    "color palette api",
    "tailwind color palette",
    "pokemon design tokens",
    "pokemon css variables",
    "pokemon sprite colors",
    "developer api",
    "color extraction api",
  ],
  openGraph: {
    title: "Pokémon Color Palette API — Lifetime Access",
    description:
      "Curated color palettes for 1,350+ Pokémon delivered as JSON, Tailwind configs, and CSS variables. One-time purchase, lifetime access.",
    url: "https://www.pokemonpalette.com/api-access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokémon Color Palette API — Lifetime Access",
    description:
      "Curated color palettes for 1,350+ Pokémon delivered as JSON, Tailwind configs, and CSS variables. One-time purchase, lifetime access.",
  },
  alternates: {
    canonical: "https://www.pokemonpalette.com/api-access",
  },
};

export default async function ApiAccessPage() {
  let hasPurchased = false;

  try {
    const { userId } = await auth();
    if (userId) {
      const customer = await prisma.apiCustomer.findUnique({
        where: { userId },
      });
      hasPurchased = customer?.status === "active";
    }
  } catch {
    // Not signed in or auth unavailable
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "PokémonPalette API — Lifetime Access",
            description:
              "Programmatic access to curated color palettes for all 1,350+ Pokémon. Includes Tailwind configs, CSS variables, and hex values.",
            url: "https://www.pokemonpalette.com/api-access",
            brand: {
              "@type": "Organization",
              name: "PokémonPalette",
            },
            offers: {
              "@type": "Offer",
              price: "29.00",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: "https://www.pokemonpalette.com/api-access",
            },
          }),
        }}
      />
      <ApiAccessContent hasPurchased={hasPurchased} />
    </>
  );
}
