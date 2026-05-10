import { Fragment } from "react";
import { notFound } from "next/navigation";
import { PokemonType } from "@/types/pokemon";
import {
  getPokemonMetadataByType,
  getAllTypes,
  batchGetPokemonById,
} from "@/lib/pokemon";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PokemonPaletteExploreCard } from "@/components/pokemon-palette-explore-card";
import { AdUnit, ADSENSE_SLOTS } from "@/components/analytics/google-adsense";
import Link from "next/link";
import { SEOContent } from "@/components/seo-content";

export async function generateStaticParams() {
  const types = getAllTypes();
  return types.map((type) => ({
    type: type.toLowerCase(),
  }));
}

export default async function TypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const typeName = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  const pokemon = getPokemonMetadataByType(typeName as PokemonType);

  if (pokemon.length === 0) {
    notFound();
  }

  const pokemonDataMap = await batchGetPokemonById(pokemon.map((p) => p.id));

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Explore", href: "/explore" },
    { label: typeName, href: `/type/${type.toLowerCase()}` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <Breadcrumbs items={breadcrumbs} className="mb-6" />
        
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {typeName} Type Pokémon
          </h1>
          <p className="text-muted-foreground text-lg">
            Explore color palettes from {pokemon.length} {typeName}-type Pokémon
          </p>
        </div>

        <SEOContent
          type="category"
          categoryType="type"
          categoryName={typeName}
          pokemonCount={pokemon.length}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {pokemon.map((mon, i) => (
            <Fragment key={mon.id}>
              <PokemonPaletteExploreCard metadata={mon} pokemonData={pokemonDataMap.get(mon.id)} />
              {(i === 11 || (i === 35 && pokemon.length > 35)) && (
                <div className="col-span-full">
                  <AdUnit
                    slot={ADSENSE_SLOTS.listingInFeed}
                    style={{ display: "block", minHeight: 120 }}
                  />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">Browse Other Types</h2>
          <div className="flex flex-wrap gap-2">
            {getAllTypes()
              .filter((t) => t.toLowerCase() !== type.toLowerCase())
              .map((otherType) => (
                <Link
                  key={otherType}
                  href={`/type/${otherType.toLowerCase()}`}
                  className="px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-sm transition-colors"
                >
                  {otherType}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

