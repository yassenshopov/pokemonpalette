import { MetadataRoute } from "next";
import { getAllPokemonMetadata } from "@/lib/pokemon";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://pokemonpalette.vercel.app";
  const pokemon = getAllPokemonMetadata();

  // Home page
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
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
