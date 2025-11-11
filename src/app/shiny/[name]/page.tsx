import { notFound } from "next/navigation";
import { getPokemonMetadataByName } from "@/lib/pokemon";
import { ShinyPokemonPageClient } from "@/components/shiny-pokemon-page-client";
import { SEOContent } from "@/components/seo-content";
import { Breadcrumbs } from "@/components/breadcrumbs";

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

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Shiny", href: "/shiny" },
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

