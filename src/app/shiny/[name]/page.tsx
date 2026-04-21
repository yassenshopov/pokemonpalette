import { notFound } from "next/navigation";
import { getPokemonMetadataByName, getAllPokemonMetadata } from "@/lib/pokemon";
import { ShinyPokemonPageClient } from "@/components/shiny-pokemon-page-client";
import { SEOContent } from "@/components/seo-content";
import { Breadcrumbs } from "@/components/breadcrumbs";

// Fully statically generate all known shiny Pokemon pages at build time.
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  return getAllPokemonMetadata().map((p) => ({
    name: p.name.toLowerCase(),
  }));
}

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

  // /shiny doesn't have a hub page — link directly to the normal Pokémon
  // page instead so the breadcrumb stays navigable.
  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: pokemonMetadata.name, href: `/${name.toLowerCase()}` },
    { label: `Shiny ${pokemonMetadata.name}`, href: `/shiny/${name.toLowerCase()}` },
  ];

  return (
    <>
      <div className="container mx-auto px-4 md:px-6 pt-4 pb-2">
        <Breadcrumbs items={breadcrumbs} />
      </div>
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

