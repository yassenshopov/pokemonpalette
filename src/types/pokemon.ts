export interface PokemonMetadata {
  id: number;
  name: string;
  species: string;
  type: string[];
  generation: number;
  rarity: PokemonRarity;
}

export interface PokemonTypeDetail {
  name: string;
  slot: number;
}

export interface PokemonAbility {
  name: string;
  url: string;
  is_hidden: boolean;
  slot: number;
}

export interface PokemonMove {
  name: string;
  url: string;
  type?: string;
  power?: number | null;
  accuracy?: number | null;
  pp?: number | null;
  damage_class?: string;
  priority?: number;
  category?: string;
}

export interface FlavorText {
  text: string;
  version: string;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  highlights: string[];
}

export interface PokemonArtworkExpanded {
  official: string;
  front: string | null;
  back: string | null;
  shiny: string | null;
  back_shiny: string | null;
  front_female: string | null;
  back_female: string | null;
  front_shiny_female: string | null;
  back_shiny_female: string | null;
}

export interface EvolutionDetail {
  gender?: number | null;
  held_item?: string | null;
  item?: string | null;
  min_level?: number | null;
  trigger?: string | null;
}

export interface EvolutionChainEntry {
  name: string;
  level: number;
  details: EvolutionDetail[];
}

export interface PokemonForm {
  name: string;
  raw_name: string;
  form_name?: string;
  is_mega?: boolean;
  is_gigantamax?: boolean;
  is_battle_only?: boolean;
  is_default?: boolean;
  sprites?: {
    front_default: string | null;
    back_default: string | null;
    front_shiny: string | null;
    back_shiny: string | null;
    front_female?: string | null;
    back_female?: string | null;
  };
}

export interface PokemonVariety {
  name: string;
  raw_name: string;
  is_default: boolean;
  url: string;
  type: string;
}

export interface HeldItem {
  name: string;
  rarity: number;
}

export interface Cries {
  latest: string;
  legacy: string;
}

export interface PokemonEvolution {
  stage?: number;
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
  generation?: number;
  // Enhanced with full chain
  [key: string]: any;
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

export interface Pokemon {
  id: number;
  name: string;
  species: string;
  type: string[];
  typeDetails?: PokemonTypeDetail[];
  height: number;
  weight: number;
  abilities: string[] | PokemonAbility[];
  baseStats: PokemonStats;
  description: string;
  colorPalette: PokemonColorPalette;
  artwork: PokemonArtwork | PokemonArtworkExpanded;
  evolution: PokemonEvolution;
  moves: PokemonMove[];
  habitat: string;
  generation: number;
  rarity:
    | "Common"
    | "Uncommon"
    | "Rare"
    | "Epic"
    | "Legendary"
    | "Mythical"
    | "Baby";
  // Enhanced fields
  baseExperience?: number;
  order?: number;
  isDefault?: boolean;
  captureRate?: number;
  baseHappiness?: number;
  growthRate?: string;
  hatchCounter?: number;
  hasGenderDifferences?: boolean;
  genderRate?: number;
  forms?: string[] | PokemonForm[];
  varieties?: PokemonVariety[];
  heldItems?: HeldItem[];
  cries?: Cries;
  flavorTexts?: FlavorText[];
  // Language names (mapping language code to Pokemon name)
  names?: Record<string, string>;
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
