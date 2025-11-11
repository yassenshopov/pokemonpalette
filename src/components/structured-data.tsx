export function StructuredData() {
  const webApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "PokémonPalette",
    description:
      "Generate beautiful color palettes from your favorite Pokémon sprites. Extract dominant colors, create custom palettes, and discover the perfect color schemes for your design projects.",
    url: "https://www.pokemonpalette.com",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "Yassen Shopov",
      url: "https://github.com/yassenshopov",
    },
    publisher: {
      "@type": "Organization",
      name: "PokémonPalette",
      url: "https://www.pokemonpalette.com",
    },
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PokémonPalette",
    url: "https://www.pokemonpalette.com",
    logo: "https://www.pokemonpalette.com/logo.png",
    sameAs: [
      "https://github.com/yassenshopov/pokemonpalette",
      "https://twitter.com/yassenshopov",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      url: "https://github.com/yassenshopov/pokemonpalette/issues",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
    </>
  );
}

