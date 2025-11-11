import { notFound } from "next/navigation";
import { PokemonRarity } from "@/types/pokemon";
import { getPokemonMetadataByRarity, getAllRarities } from "@/lib/pokemon";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PokemonPaletteExploreCard } from "@/components/pokemon-palette-explore-card";
import Link from "next/link";
import { SEOContent } from "@/components/seo-content";

export async function generateStaticParams() {
  const rarities = getAllRarities();
  return rarities.map((rarity) => ({
    rarity: rarity.toLowerCase(),
  }));
}

export default async function RarityPage({
  params,
}: {
  params: Promise<{ rarity: string }>;
}) {
  const { rarity } = await params;
  const rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
  const pokemon = getPokemonMetadataByRarity(rarityName as PokemonRarity);

  if (pokemon.length === 0) {
    notFound();
  }

  // Get all unique rarities from the data
  const allRarities = getAllRarities();

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Rarity", href: "/rarity" },
    { label: rarityName, href: `/rarity/${rarity.toLowerCase()}` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <Breadcrumbs items={breadcrumbs} className="mb-6" />
        
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {rarityName} Pokémon
          </h1>
          <p className="text-muted-foreground text-lg">
            Explore color palettes from {pokemon.length} {rarityName} Pokémon
          </p>
        </div>

        <SEOContent
          type="category"
          categoryType="rarity"
          categoryName={rarityName}
          pokemonCount={pokemon.length}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {pokemon.map((mon) => (
            <PokemonPaletteExploreCard key={mon.id} metadata={mon} />
          ))}
        </div>

        <div className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">Browse Other Rarities</h2>
          <div className="flex flex-wrap gap-2">
            {allRarities
              .filter((r) => r.toLowerCase() !== rarity.toLowerCase())
              .map((otherRarity) => (
                <Link
                  key={otherRarity}
                  href={`/rarity/${otherRarity.toLowerCase()}`}
                  className="px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-sm transition-colors"
                >
                  {otherRarity}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

