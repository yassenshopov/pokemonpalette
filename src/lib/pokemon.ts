import {
  Pokemon,
  PokemonMetadata,
  PokemonType,
  PokemonRarity,
} from "@/types/pokemon";
import pokemonIndex from "@/data/pokemon/index.json";

// Type assertion for the index data
const pokemonMetadata: PokemonMetadata[] = pokemonIndex as PokemonMetadata[];

// Cache for loaded Pokemon data
const pokemonCache = new Map<number, Pokemon>();

/**
 * Load Pokemon data by ID (with caching)
 */
export async function getPokemonById(id: number): Promise<Pokemon | null> {
  // Check cache first
  if (pokemonCache.has(id)) {
    return pokemonCache.get(id)!;
  }

  try {
    // Dynamic import of individual Pokemon file
    const pokemonModule = await import(`@/data/pokemon/${id}.json`);
    const pokemon = pokemonModule.default as Pokemon;

    // Cache the result
    pokemonCache.set(id, pokemon);

    return pokemon;
  } catch (error) {
    console.error(`Failed to load Pokemon ${id}:`, error);
    return null;
  }
}

/**
 * Get Pokemon metadata by ID (synchronous)
 */
export function getPokemonMetadataById(
  id: number
): PokemonMetadata | undefined {
  return pokemonMetadata.find((p) => p.id === id);
}

/**
 * Get Pokemon metadata by name (case insensitive)
 */
export function getPokemonMetadataByName(
  name: string
): PokemonMetadata | undefined {
  return pokemonMetadata.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all Pokemon metadata (synchronous)
 */
export function getAllPokemonMetadata(): PokemonMetadata[] {
  return pokemonMetadata;
}

/**
 * Get Pokemon metadata by type
 */
export function getPokemonMetadataByType(type: PokemonType): PokemonMetadata[] {
  return pokemonMetadata.filter((p) => p.type.includes(type));
}

/**
 * Get Pokemon metadata by rarity
 */
export function getPokemonMetadataByRarity(
  rarity: PokemonRarity
): PokemonMetadata[] {
  return pokemonMetadata.filter((p) => p.rarity === rarity);
}

/**
 * Get Pokemon metadata by generation
 */
export function getPokemonMetadataByGeneration(
  generation: number
): PokemonMetadata[] {
  return pokemonMetadata.filter((p) => p.generation === generation);
}

/**
 * Search Pokemon metadata by name (partial match)
 */
export function searchPokemonMetadata(query: string): PokemonMetadata[] {
  const lowercaseQuery = query.toLowerCase();
  return pokemonMetadata.filter(
    (p) =>
      p.name.toLowerCase().includes(lowercaseQuery) ||
      p.species.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Get Pokemon by name (async)
 */
export async function getPokemonByName(name: string): Promise<Pokemon | null> {
  const metadata = getPokemonMetadataByName(name);
  if (!metadata) return null;

  return getPokemonById(metadata.id);
}

/**
 * Search Pokemon by name (partial match, async)
 */
export async function searchPokemon(query: string): Promise<Pokemon[]> {
  const metadataList = searchPokemonMetadata(query);
  const pokemonPromises = metadataList.map((metadata) =>
    getPokemonById(metadata.id)
  );
  const results = await Promise.all(pokemonPromises);

  return results.filter((pokemon): pokemon is Pokemon => pokemon !== null);
}

/**
 * Get Pokemon color palette by ID
 */
export async function getPokemonColorPalette(id: number) {
  const pokemon = await getPokemonById(id);
  return pokemon?.colorPalette;
}

/**
 * Get Pokemon artwork URLs by ID
 */
export async function getPokemonArtwork(id: number) {
  const pokemon = await getPokemonById(id);
  return pokemon?.artwork;
}

/**
 * Get random Pokemon
 */
export async function getRandomPokemon(): Promise<Pokemon | null> {
  const randomIndex = Math.floor(Math.random() * pokemonMetadata.length);
  const randomMetadata = pokemonMetadata[randomIndex];

  return getPokemonById(randomMetadata.id);
}

/**
 * Get all unique types
 */
export function getAllTypes(): PokemonType[] {
  const types = new Set<PokemonType>();
  pokemonMetadata.forEach((p) =>
    p.type.forEach((t) => types.add(t as PokemonType))
  );
  return Array.from(types);
}

/**
 * Get all unique generations
 */
export function getAllGenerations(): number[] {
  const generations = new Set<number>();
  pokemonMetadata.forEach((p) => generations.add(p.generation));
  return Array.from(generations).sort();
}

/**
 * Get all unique rarities
 */
export function getAllRarities(): PokemonRarity[] {
  const rarities = new Set<PokemonRarity>();
  pokemonMetadata.forEach((p) => rarities.add(p.rarity));
  return Array.from(rarities);
}