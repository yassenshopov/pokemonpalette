import { notFound } from "next/navigation";
import {
  getPokemonMetadataByName,
  getAllPokemonMetadata,
  getPokemonById,
} from "@/lib/pokemon";
import { PokemonPageClient } from "@/components/pokemon-page-client";
import { SEOContent } from "@/components/seo-content";
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

// Server Component - fetches data on server for SEO.
// All interactivity is handled by PokemonPageClient component, but we render
// the Pokemon's real description, palette, abilities, etc. in the initial
// HTML via SEOContent + PokemonJsonLd. Googlebot was previously seeing only
// the templated boilerplate from those components (because every interactive
// child is `ssr: false`), which is what put these pages in the "Crawled -
// currently not indexed" bucket.
export default async function PokemonPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const pokemonMetadata = getPokemonMetadataByName(name);

  // Handle 404 on server side for better SEO
  if (!pokemonMetadata) {
    notFound();
  }

  // Load the full Pokemon record. This is the same on-disk JSON the OG image
  // route already reads at build / request time; with `revalidate = false`
  // and `generateStaticParams`, the read happens once per Pokemon at build.
  const pokemon = await getPokemonById(pokemonMetadata.id);

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: pokemonMetadata.name, href: `/${name.toLowerCase()}` },
  ];

  return (
    <>
      {pokemon && <PokemonJsonLd pokemon={pokemon} />}
      <SEOContent
        type="pokemon"
        pokemonName={pokemonMetadata.name}
        pokemonType={pokemonMetadata.type}
        pokemonGeneration={pokemonMetadata.generation}
        pokemonRarity={pokemonMetadata.rarity}
        pokemonDescription={pokemon?.description}
        pokemonAbilities={pokemon?.abilities}
        pokemonHabitat={pokemon?.habitat}
        pokemonHeight={pokemon?.height}
        pokemonWeight={pokemon?.weight}
        pokemonColors={pokemon?.colorPalette?.highlights}
        pokemonShinyColors={pokemon?.shinyColorPalette?.highlights}
      />
      <PokemonPageClient
        pokemonMetadata={pokemonMetadata}
        breadcrumbs={<Breadcrumbs items={breadcrumbs} />}
      />
    </>
  );
}
