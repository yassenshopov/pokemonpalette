import { notFound } from "next/navigation";
import {
  getPokemonMetadataByName,
  getAllPokemonMetadata,
  getPokemonById,
} from "@/lib/pokemon";
import { PokemonPageClient } from "@/components/pokemon-page-client";
import { PokemonInfoSection } from "@/components/pokemon-info-section";
import { PokemonJsonLd } from "@/components/pokemon-json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";

// Fully statically generate all known Pokemon detail pages at build time.
// Unknown names still fall through to notFound() via dynamicParams.
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  return getAllPokemonMetadata().map((p) => ({
    name: p.name.toLowerCase(),
  }));
}

// Server Component — fetches the Pokemon record server-side so the entire
// info section (prose, palette breakdown, related-Pokémon links) ships in
// the initial HTML. The interactive palette UI still lives in the client
// component below, but Googlebot now has substantive, unique content per
// page without needing to render JS. This replaces the older
// `sr-only aria-hidden` SEO block that was getting discounted as hidden
// content and keeping these pages in "Crawled - currently not indexed".
export default async function PokemonPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const pokemonMetadata = getPokemonMetadataByName(name);

  if (!pokemonMetadata) {
    notFound();
  }

  const pokemon = await getPokemonById(pokemonMetadata.id);

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: pokemonMetadata.name, href: `/${name.toLowerCase()}` },
  ];

  return (
    <>
      {pokemon && <PokemonJsonLd pokemon={pokemon} />}
      <PokemonPageClient
        pokemonMetadata={pokemonMetadata}
        breadcrumbs={<Breadcrumbs items={breadcrumbs} />}
        infoSection={pokemon ? <PokemonInfoSection pokemon={pokemon} /> : null}
      />
    </>
  );
}
