import { notFound } from "next/navigation";
import { getPokemonMetadataByName } from "@/lib/pokemon";
import { ShinyPokemonPageClient } from "@/components/shiny-pokemon-page-client";
import { SEOContent } from "@/components/seo-content";

// Server Component - fetches data on server for SEO
// All interactivity is handled by PokemonPageClient component
// This page forces shiny mode to true
export default async function ShinyPokemonPage({
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
        pokemonName={`Shiny ${pokemonMetadata.name}`}
        pokemonType={pokemonMetadata.type}
        pokemonGeneration={pokemonMetadata.generation}
      />
      <ShinyPokemonPageClient pokemonMetadata={pokemonMetadata} />
    </>
  );
}

