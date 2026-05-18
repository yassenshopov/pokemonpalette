import { Metadata } from "next";
import { getPokemonMetadataByName, getPokemonById } from "@/lib/pokemon";
import { describeHex } from "@/lib/color-name";

/**
 * Per-Pokemon metadata. The previous version used a single template
 * (`"<Name> - PokémonPalette"` / `"Explore <Name>'s color palette..."`)
 * across all ~1,350 routes, which gave Google near-identical title/description
 * signals and contributed to the "Crawled - currently not indexed" verdict.
 *
 * The current version composes title and description from actual per-Pokemon
 * data — type, generation, and the leading palette color described in plain
 * English (e.g. "a warm yellow"). The result is unique strings on every
 * route, with the keyword most users actually search ("<Name> color palette")
 * placed first in the title.
 */
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

  const pokemon = await getPokemonById(pokemonMetadata.id);
  const ogImageUrl = `https://www.pokemonpalette.com/api/og/${name.toLowerCase()}`;
  const typeText =
    pokemonMetadata.type.length > 1
      ? pokemonMetadata.type.join("/")
      : (pokemonMetadata.type[0] ?? "Pokémon");
  const genText = pokemonMetadata.generation
    ? `Gen ${pokemonMetadata.generation}`
    : null;

  const highlights = pokemon?.colorPalette?.highlights ?? [];
  const primaryHex = highlights[0] ?? pokemon?.colorPalette?.primary;
  const secondaryHex = highlights[1] ?? pokemon?.colorPalette?.secondary;
  const primaryDescriptor = primaryHex ? describeHex(primaryHex) : null;

  const titleSuffix = genText
    ? ` (${typeText} type, ${genText})`
    : ` (${typeText} type)`;
  const title = `${pokemonMetadata.name} color palette${titleSuffix}`;

  const descriptionParts: string[] = [];
  descriptionParts.push(
    `Color palette extracted from ${pokemonMetadata.name}'s official artwork`,
  );
  if (primaryHex && primaryDescriptor) {
    descriptionParts.push(`led by ${primaryHex} (${primaryDescriptor})`);
  } else if (primaryHex) {
    descriptionParts.push(`led by ${primaryHex}`);
  }
  if (secondaryHex) {
    descriptionParts.push(`with accents in ${secondaryHex}`);
  }
  descriptionParts.push(
    `Copy HEX, RGB, or HSL values for ${pokemonMetadata.name}'s palette and explore related ${typeText}-type Pokémon`,
  );
  // Clamp to a comfortable SERP length (~155 chars) so Google doesn't
  // truncate mid-sentence on the most useful part.
  const description = descriptionParts.join(", ").replace(/\s+/g, " ").trim();
  const trimmedDescription =
    description.length > 158
      ? description.slice(0, 155).replace(/\s+\S*$/, "") + "…"
      : description;

  return {
    title,
    description: trimmedDescription,
    openGraph: {
      title,
      description: trimmedDescription,
      url: `https://www.pokemonpalette.com/${name.toLowerCase()}`,
      siteName: "PokémonPalette",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 675,
          alt: `${pokemonMetadata.name} color palette`,
        },
      ],
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: trimmedDescription,
      images: [ogImageUrl],
    },
    metadataBase: new URL("https://www.pokemonpalette.com"),
    alternates: {
      canonical: `https://www.pokemonpalette.com/${name.toLowerCase()}`,
    },
  };
}

export default function PokemonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
