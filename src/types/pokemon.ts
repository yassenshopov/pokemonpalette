export interface PokemonMetadata {
  id: number;
  name: string;
  species: string;
  type: string[];
  generation: number;
  rarity: PokemonRarity;
}

export interface PokemonMove {
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  category: "Physical" | "Special" | "Status";
  priority?: number;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  highlights: string[];
}

export interface PokemonArtwork {
  official: string;
  front: string;
  back: string;
  shiny: string;
}

export interface PokemonEvolution {
  stage: number;
  evolvesFrom?: number;
  evolvesTo?: number;
  evolutionMethod?:
    | "level"
    | "stone"
    | "trade"
    | "friendship"
    | "item"
    | "other";
  evolutionLevel?: number;
  evolutionItem?: string;
}

export interface Pokemon {
  id: number;
  name: string;
  species: string;
  type: string[];
  height: number;
  weight: number;
  abilities: string[];
  baseStats: PokemonStats;
  description: string;
  colorPalette: PokemonColorPalette;
  artwork: PokemonArtwork;
  evolution: PokemonEvolution;
  moves: PokemonMove[];
  habitat: string;
  generation: number;
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythical";
}

export type PokemonType =
  | "Normal"
  | "Fire"
  | "Water"
  | "Electric"
  | "Grass"
  | "Ice"
  | "Fighting"
  | "Poison"
  | "Ground"
  | "Flying"
  | "Psychic"
  | "Bug"
  | "Rock"
  | "Ghost"
  | "Dragon"
  | "Dark"
  | "Steel"
  | "Fairy";

export type PokemonRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary"
  | "Mythical";

export type MoveCategory = "Physical" | "Special" | "Status";

export type EvolutionMethod =
  | "level"
  | "stone"
  | "trade"
  | "friendship"
  | "item"
  | "other";
