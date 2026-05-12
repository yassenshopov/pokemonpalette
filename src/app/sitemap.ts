import { MetadataRoute } from "next";
import {
  getAllPokemonMetadata,
  getAllTypes,
  getAllGenerations,
  getAllRarities,
} from "@/lib/pokemon";

// Bake `lastModified` at *build time* (module evaluation), not on every
// request. Sitemaps that mint a fresh `new Date()` per row on each request
// give Google a different `lastmod` for every URL on every fetch, which
// teaches them to ignore the field entirely (and adds work to recrawl
// "changed" pages that haven't actually changed). Capturing one shared
// timestamp when the build runs means every entry in the sitemap shares
// the same deploy-anchored mtime, which is the honest signal: "these
// pages were last published in this build."
const BUILD_LAST_MODIFIED = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.pokemonpalette.com";
  const pokemon = getAllPokemonMetadata();
  const types = getAllTypes();
  const generations = getAllGenerations();

  const lastModified = BUILD_LAST_MODIFIED;

  // Home page
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/game`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/api-access`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  // Add category pages
  types.forEach((type) => {
    routes.push({
      url: `${baseUrl}/type/${type.toLowerCase()}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  generations.forEach((gen) => {
    routes.push({
      url: `${baseUrl}/generation/${gen}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  // Add rarity pages
  const rarities = getAllRarities();
  rarities.forEach((rarity) => {
    routes.push({
      url: `${baseUrl}/rarity/${rarity.toLowerCase()}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  // Add a route for each Pokemon (lowercase name).
  // We deliberately do NOT include /shiny/[name] URLs here. Shiny pages are
  // structurally identical to /[name] and now carry rel="canonical" pointing
  // back to the normal page plus a `noindex, follow` robots directive.
  // Listing them in the sitemap would send Google a conflicting signal
  // ("please index this") that contradicts the canonical + noindex hints, so
  // we leave them out and let crawlers reach them organically through
  // internal links.
  pokemon.forEach((mon) => {
    routes.push({
      url: `${baseUrl}/${mon.name.toLowerCase()}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });

  return routes;
}
