import { Suspense } from "react";

import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { ExploreClient } from "@/components/explore-client";
import { Footer } from "@/components/footer";
import { SEOContent } from "@/components/seo-content";
import {
  batchGetPokemonById,
  getAllPokemonMetadata,
  getAllRarities,
} from "@/lib/pokemon";

// Pre-load the first page of cards on the server. Anything beyond this
// streams in via the card's IntersectionObserver — the user only pays the
// per-card JSON fetch when they actually scroll to it.
const INITIAL_PAGE_SIZE = 60;

export default async function ExplorePage() {
  const allMetadata = getAllPokemonMetadata();
  const rarities = getAllRarities();

  // Default sort is dex-number ascending, so preloading the first
  // INITIAL_PAGE_SIZE entries by ID matches the initial visible set.
  const initialIds = allMetadata
    .slice()
    .sort((a, b) => a.id - b.id)
    .slice(0, INITIAL_PAGE_SIZE)
    .map((m) => m.id);

  const initialDataMap = await batchGetPokemonById(initialIds);
  const initialPokemonData = Array.from(initialDataMap.entries());

  return (
    <div className="flex h-screen overflow-hidden">
      <CollapsibleSidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        <main id="main" className="flex-1">
          <SEOContent type="home" />
          <Suspense
            fallback={
              <div className="container mx-auto px-4 py-10 md:px-6">
                <div className="h-8 w-64 animate-pulse rounded bg-muted" />
              </div>
            }
          >
            <ExploreClient
              allMetadata={allMetadata}
              rarities={rarities}
              initialPokemonData={initialPokemonData}
            />
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
}
