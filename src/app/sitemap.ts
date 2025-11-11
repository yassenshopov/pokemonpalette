import { MetadataRoute } from "next";
import { getAllPokemonMetadata } from "@/lib/pokemon";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.pokemonpalette.com";
  const pokemon = getAllPokemonMetadata();

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
  ];

  // Add a route for each Pokemon (lowercase name)
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
