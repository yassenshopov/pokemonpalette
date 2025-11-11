import { notFound } from "next/navigation";
import { getPokemonMetadataByName } from "@/lib/pokemon";
import { PokemonPageClient } from "@/components/pokemon-page-client";
import { SEOContent } from "@/components/seo-content";

// Server Component - fetches data on server for SEO
// All interactivity is handled by PokemonPageClient component
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

  return (
    <>
      <SEOContent
        type="pokemon"
        pokemonName={pokemonMetadata.name}
        pokemonType={pokemonMetadata.type}
        pokemonGeneration={pokemonMetadata.generation}
      />
      <PokemonPageClient pokemonMetadata={pokemonMetadata} />
    </>
  );
}

