"use client";

import dynamic from "next/dynamic";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Sparkles } from "lucide-react";
import { Footer } from "@/components/footer";

// GridPattern pulls in gsap + the full Pokemon index. Load it on demand so
// the /explore route ships a tiny shell first and streams the grid in.
const GridPattern = dynamic(
  () =>
    import("@/components/grid-pattern").then((m) => ({ default: m.GridPattern })),
  { ssr: false }
);

export default function ExplorePage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <CollapsibleSidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">
                Explore Palettes
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Discover beautiful color palettes from randomly selected Pokémon
            </p>
          </div>
        </div>

        {/* Grid Content */}
        <div className="flex-1 overflow-auto">
          <div className="w-full h-full">
            <GridPattern />
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}

