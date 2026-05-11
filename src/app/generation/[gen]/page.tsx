import { Fragment } from "react";
import { notFound } from "next/navigation";
import { getPokemonMetadataByGeneration, getAllGenerations, batchGetPokemonById } from "@/lib/pokemon";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PokemonPaletteExploreCard } from "@/components/pokemon-palette-explore-card";
import { AdUnit, ADSENSE_SLOTS } from "@/components/analytics/google-adsense";
import Link from "next/link";
import { SEOContent } from "@/components/seo-content";

export async function generateStaticParams() {
  const generations = getAllGenerations();
  return generations.map((gen) => ({
    gen: gen.toString(),
  }));
}

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ gen: string }>;
}) {
  const { gen } = await params;
  const generation = parseInt(gen);
  const pokemon = getPokemonMetadataByGeneration(generation);

  if (pokemon.length === 0 || isNaN(generation)) {
    notFound();
  }

  const pokemonDataMap = await batchGetPokemonById(pokemon.map((p) => p.id));

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Explore", href: "/explore" },
    { label: `Generation ${generation}`, href: `/generation/${generation}` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <Breadcrumbs items={breadcrumbs} className="mb-6" />
        
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Generation {generation} Pokémon
          </h1>
          <p className="text-muted-foreground text-lg">
            Explore color palettes from {pokemon.length} Generation {generation} Pokémon
          </p>
        </div>

        <SEOContent
          type="category"
          categoryType="generation"
          categoryName={`Generation ${generation}`}
          pokemonCount={pokemon.length}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {pokemon.map((mon, i) => (
            <Fragment key={mon.id}>
              <PokemonPaletteExploreCard metadata={mon} pokemonData={pokemonDataMap.get(mon.id)} />
              {(i === 11 || (i === 35 && pokemon.length > 35)) && (
                <div className="col-span-full">
                  {/* Shares the listing in-feed slot with rarity and
                      type pages. See rarity/[rarity]/page.tsx for
                      layoutKey context. */}
                  <AdUnit
                    slot={ADSENSE_SLOTS.listingInFeed}
                    format="fluid"
                    layoutKey="-6t+ed+2i-1n-4w"
                    style={{ display: "block", minHeight: 120 }}
                  />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">Browse Other Generations</h2>
          <div className="flex flex-wrap gap-2">
            {getAllGenerations()
              .filter((g) => g !== generation)
              .map((otherGen) => (
                <Link
                  key={otherGen}
                  href={`/generation/${otherGen}`}
                  className="px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-sm transition-colors"
                >
                  Generation {otherGen}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

