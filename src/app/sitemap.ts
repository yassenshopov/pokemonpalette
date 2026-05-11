import { MetadataRoute } from "next";
import {
  getAllPokemonMetadata,
  getAllTypes,
  getAllGenerations,
  getAllRarities,
} from "@/lib/pokemon";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.pokemonpalette.com";
  const pokemon = getAllPokemonMetadata();
  const types = getAllTypes();
  const generations = getAllGenerations();

  // Home page
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/game`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/api-access`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  // Add category pages
  types.forEach((type) => {
    routes.push({
      url: `${baseUrl}/type/${type.toLowerCase()}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  generations.forEach((gen) => {
    routes.push({
      url: `${baseUrl}/generation/${gen}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  // Add rarity pages
  const rarities = getAllRarities();
  rarities.forEach((rarity) => {
    routes.push({
      url: `${baseUrl}/rarity/${rarity.toLowerCase()}`,
      lastModified: new Date(),
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
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });

  return routes;
}
