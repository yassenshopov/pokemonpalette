"use client";

import { useState } from "react";
import { Pokemon } from "@/types/pokemon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Palette,
  Volume2,
  Sparkles,
  Shield,
  Sword,
  Zap,
  Home,
  Crown,
  Flower2,
  Image as ImageIcon,
  Users,
  Box,
  Star,
} from "lucide-react";

interface PokemonExpandedViewProps {
  pokemon: Pokemon;
  onEvolutionClick?: (pokemonName: string) => void;
  onVarietyClick?: (varietyId: number) => void;
  availablePokemonIds?: number[];
  pokemonNameToId?: (name: string) => number | undefined;
}

export function PokemonExpandedView({
  pokemon,
  onEvolutionClick,
  onVarietyClick,
  availablePokemonIds = [],
  pokemonNameToId,
}: PokemonExpandedViewProps) {
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [isShiny, setIsShiny] = useState(false);
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | null>(
    null
  );

  const playCry = (cryUrl: string, type: string) => {
    setPlayingAudio(type);
    const audio = new Audio(cryUrl);
    audio.play();
    audio.onended = () => setPlayingAudio(null);
  };

  // Get sprite URL based on shiny state and selected variety
  const getSpriteUrl = (type: "front" | "back" | "official"): string | null => {
    if (type === "official") {
      // If a variety is selected, use that variety's artwork
      const pokemonId = selectedVarietyId ?? pokemon.id;

      let officialUrl: string | null = null;

      // Construct the official artwork URL for the selected Pokemon
      const shinyPath = isShiny ? "/shiny" : "";
      officialUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${shinyPath}/${pokemonId}.png`;

      return officialUrl;
    }

    // Get the base sprite URL
    const baseUrl =
      type === "front"
        ? "front" in pokemon.artwork
          ? pokemon.artwork.front
          : null
        : "back" in pokemon.artwork
        ? pokemon.artwork.back
        : null;

    if (!baseUrl) return null;

    // If shiny, check if there's a dedicated shiny field, otherwise modify the URL
    if (isShiny) {
      // Check for dedicated shiny fields first
      if (
        type === "front" &&
        "front_shiny" in pokemon.artwork &&
        pokemon.artwork.front_shiny
      ) {
        return pokemon.artwork.front_shiny as string;
      }
      if (
        type === "back" &&
        "back_shiny" in pokemon.artwork &&
        pokemon.artwork.back_shiny
      ) {
        return pokemon.artwork.back_shiny as string;
      }

      // Otherwise, inject '/shiny' into the URL path
      return baseUrl.replace("/sprites/pokemon/", "/sprites/pokemon/shiny/");
    }

    return baseUrl;
  };

  const isAbilityObject = (
    ability: string | any
  ): ability is { name: string; is_hidden: boolean; slot: number } => {
    return typeof ability === "object" && "name" in ability;
  };

  const abilitiesArray = pokemon.abilities.map((ability) =>
    isAbilityObject(ability)
      ? ability
      : { name: ability, is_hidden: false, slot: 1 }
  );

  const isFormObject = (
    form: string | any
  ): form is { name: string; sprites?: any } => {
    return typeof form === "object" && "name" in form;
  };

  const evolutionChain = Array.isArray(pokemon.evolution)
    ? pokemon.evolution
    : [];

  return (
    <div className="space-y-6">
      {/* Header with Artwork */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl flex items-center gap-3">
                {pokemon.name}
                <Badge variant="secondary" className="text-lg">
                  #{pokemon.id}
                </Badge>
              </CardTitle>
              <CardDescription className="text-lg mt-1">
                {pokemon.species}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {/* Shiny Toggle */}
              {"shiny" in pokemon.artwork && pokemon.artwork.shiny && (
                <Button
                  variant={isShiny ? "default" : "outline"}
                  size="icon"
                  onClick={() => setIsShiny(!isShiny)}
                  title={isShiny ? "Show Normal" : "Show Shiny"}
                >
                  <Star
                    className={`h-4 w-4 ${
                      isShiny ? "fill-yellow-400 text-yellow-400" : ""
                    }`}
                  />
                </Button>
              )}
              {/* Audio Buttons */}
              {(pokemon.cries?.latest || pokemon.cries?.legacy) && (
                <>
                  {pokemon.cries.latest && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => playCry(pokemon.cries!.latest, "latest")}
                      disabled={playingAudio === "latest"}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  )}
                  {pokemon.cries.legacy && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => playCry(pokemon.cries!.legacy, "legacy")}
                      disabled={playingAudio === "legacy"}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Official Artwork */}
            <div className="flex items-center justify-center bg-muted rounded-lg p-6">
              {(() => {
                const artworkUrl = getSpriteUrl("official");
                if (!artworkUrl) return null;
                return (
                  <img
                    src={artworkUrl}
                    alt={`${pokemon.name}${isShiny ? " (Shiny)" : ""}`}
                    className="max-h-64 w-auto"
                  />
                );
              })()}
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Types</h4>
                <div className="flex flex-wrap gap-2">
                  {pokemon.type.map((type) => (
                    <Badge key={type} variant="outline" className="text-sm">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Height</h4>
                  <p className="text-sm text-muted-foreground">
                    {pokemon.height}m
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">Weight</h4>
                  <p className="text-sm text-muted-foreground">
                    {pokemon.weight}kg
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Abilities</h4>
                <div className="flex flex-wrap gap-2">
                  {abilitiesArray.map((ability, idx) => (
                    <Badge
                      key={idx}
                      variant={ability.is_hidden ? "default" : "outline"}
                    >
                      {ability.name}
                      {ability.is_hidden && (
                        <Sparkles className="ml-1 h-3 w-3 inline" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Rarity</h4>
                <Badge variant="secondary">{pokemon.rarity}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stats">Stats & Battle</TabsTrigger>
          <TabsTrigger value="forms">Forms & Varieties</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flower2 className="h-5 w-5" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {pokemon.description}
              </p>
              {pokemon.flavorTexts && pokemon.flavorTexts.length > 0 && (
                <Accordion type="single" collapsible className="mt-4">
                  <AccordionItem value="flavor-texts">
                    <AccordionTrigger className="text-sm">
                      View flavor texts from different games (
                      {pokemon.flavorTexts.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {pokemon.flavorTexts.map((ft, idx) => (
                          <div
                            key={idx}
                            className="border-l-2 border-primary pl-3 py-2"
                          >
                            <p className="text-sm text-muted-foreground">
                              {ft.text}
                            </p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {ft.version}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* Base Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sword className="h-5 w-5" />
                Base Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(pokemon.baseStats).map(([stat, value]) => (
                  <div key={stat} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{stat}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                    <Progress value={(value / 200) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Evolution Chain */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Evolution Chain
              </CardTitle>
            </CardHeader>
            <CardContent>
              {evolutionChain.length > 0 ? (
                <div className="flex items-center gap-6 overflow-x-auto pb-4">
                  {evolutionChain.map((evo, idx) => {
                    // Get Pokemon ID from the name lookup function
                    const evoId = pokemonNameToId
                      ? pokemonNameToId(evo.name)
                      : undefined;

                    return (
                      <div key={idx} className="flex items-center gap-6">
                        <div
                          className={`text-center transition-all ${
                            onEvolutionClick
                              ? "cursor-pointer hover:scale-105"
                              : ""
                          }`}
                          onClick={() => onEvolutionClick?.(evo.name)}
                        >
                          <div className="bg-muted rounded-lg p-3 mb-2">
                            {evoId ? (
                              <img
                                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
                                  isShiny ? "shiny/" : ""
                                }${evoId}.png`}
                                alt={evo.name}
                                className={`w-20 h-20 mx-auto transition-all ${
                                  onEvolutionClick ? "hover:scale-110" : ""
                                }`}
                              />
                            ) : (
                              <div className="w-20 h-20 mx-auto flex items-center justify-center">
                                <span className="text-2xl">?</span>
                              </div>
                            )}
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-sm font-medium"
                          >
                            {evo.name}
                          </Badge>
                          {evo.details && evo.details.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              {evo.details.map((detail, dIdx) => (
                                <div key={dIdx}>
                                  {detail.min_level && (
                                    <span>Lv.{detail.min_level} </span>
                                  )}
                                  {detail.trigger && (
                                    <span className="capitalize">
                                      {detail.trigger}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {idx < evolutionChain.length - 1 && (
                          <span className="text-3xl text-muted-foreground">
                            →
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {"stage" in pokemon.evolution
                    ? `Stage ${pokemon.evolution.stage}`
                    : "Evolution data not available"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Habitat & Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Habitat & Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Habitat</h4>
                  <Badge variant="outline">{pokemon.habitat}</Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Generation</h4>
                  <Badge variant="outline">{pokemon.generation}</Badge>
                </div>
                {pokemon.captureRate && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Capture Rate</h4>
                    <p className="text-sm text-muted-foreground">
                      {pokemon.captureRate} / 255
                    </p>
                  </div>
                )}
                {pokemon.baseHappiness && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Base Happiness</h4>
                    <p className="text-sm text-muted-foreground">
                      {pokemon.baseHappiness} / 255
                    </p>
                  </div>
                )}
                {pokemon.growthRate && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Growth Rate</h4>
                    <p className="text-sm text-muted-foreground capitalize">
                      {pokemon.growthRate}
                    </p>
                  </div>
                )}
                {pokemon.baseExperience && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">
                      Base Experience
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {pokemon.baseExperience}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats & Battle Tab */}
        <TabsContent value="stats" className="space-y-4">
          {/* Detailed Stats Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Base Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(pokemon.baseStats).map(([stat, value]) => (
                  <div key={stat} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm capitalize font-medium">
                        {stat}
                      </span>
                      <Badge variant="secondary">{value}</Badge>
                    </div>
                    <Progress value={(value / 200) * 100} className="h-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Moves */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Moves ({pokemon.moves.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {pokemon.moves.map((move, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{move.name}</h4>
                      {move.type && (
                        <Badge variant="outline" className="text-xs">
                          {move.type}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                      {move.power !== null && move.power !== undefined && (
                        <div>
                          <span className="font-medium">Power:</span>{" "}
                          {move.power}
                        </div>
                      )}
                      {move.accuracy && (
                        <div>
                          <span className="font-medium">Acc:</span>{" "}
                          {move.accuracy}%
                        </div>
                      )}
                      {move.pp && (
                        <div>
                          <span className="font-medium">PP:</span> {move.pp}
                        </div>
                      )}
                      {move.damage_class && (
                        <div>
                          <span className="font-medium">Class:</span>{" "}
                          <Badge variant="outline" className="ml-1 text-xs">
                            {move.damage_class}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Held Items */}
          {pokemon.heldItems && pokemon.heldItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5" />
                  Held Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {pokemon.heldItems.map((item, idx) => (
                    <Badge key={idx} variant="outline">
                      {item.name} (Rarity: {item.rarity})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Forms & Varieties Tab */}
        <TabsContent value="forms" className="space-y-4">
          {/* Varieties */}
          {pokemon.varieties && pokemon.varieties.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Varieties ({pokemon.varieties.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pokemon.varieties.map((variety, idx) => {
                    // Extract Pokemon ID from URL
                    const urlMatch = variety.url?.match(/\/(\d+)\/?$/);
                    const varietyId = urlMatch ? parseInt(urlMatch[1]) : null;
                    const isSelected =
                      selectedVarietyId === varietyId ||
                      (selectedVarietyId === null && variety.is_default);

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (varietyId) {
                            if (onVarietyClick) {
                              onVarietyClick(varietyId);
                            } else {
                              setSelectedVarietyId(varietyId);
                            }
                          }
                        }}
                        className={`flex items-center justify-between p-3 border rounded-lg gap-4 cursor-pointer transition-all hover:bg-muted/50 ${
                          isSelected ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {varietyId && (
                            <img
                              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
                                isShiny ? "shiny/" : ""
                              }${varietyId}.png`}
                              alt={`${variety.name}${
                                isShiny ? " (Shiny)" : ""
                              }`}
                              className="w-16 h-16"
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{variety.name}</span>
                            {variety.type && (
                              <Badge variant="secondary">{variety.type}</Badge>
                            )}
                            {variety.is_default && (
                              <Badge variant="default">Default</Badge>
                            )}
                            {isSelected && (
                              <Badge variant="outline" className="text-xs">
                                Viewing
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Forms */}
          {pokemon.forms && pokemon.forms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Forms ({pokemon.forms.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {pokemon.forms.map((form, idx) => {
                    const formData = isFormObject(form) ? form : null;
                    if (!formData) return null;

                    return (
                      <div
                        key={idx}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{formData.name}</h4>
                          <div className="flex gap-2">
                            {formData.is_mega && (
                              <Badge variant="default">Mega</Badge>
                            )}
                            {formData.is_gigantamax && (
                              <Badge variant="default">G-Max</Badge>
                            )}
                            {formData.is_battle_only && (
                              <Badge variant="outline">Battle Only</Badge>
                            )}
                            {formData.is_default && (
                              <Badge variant="secondary">Default</Badge>
                            )}
                          </div>
                        </div>
                        {formData.sprites && (
                          <div className="grid grid-cols-2 gap-2">
                            {(() => {
                              const frontSprite = isShiny
                                ? formData.sprites.front_shiny ||
                                  formData.sprites.front_default
                                : formData.sprites.front_default;
                              const backSprite = isShiny
                                ? formData.sprites.back_shiny ||
                                  formData.sprites.back_default
                                : formData.sprites.back_default;

                              return (
                                <>
                                  {frontSprite && (
                                    <div className="text-center">
                                      <img
                                        src={frontSprite}
                                        alt={isShiny ? "Shiny Front" : "Front"}
                                        className="w-16 h-16 mx-auto"
                                      />
                                      <p className="text-xs mt-1">
                                        {isShiny ? "Shiny " : ""}Front
                                      </p>
                                    </div>
                                  )}
                                  {backSprite && (
                                    <div className="text-center">
                                      <img
                                        src={backSprite}
                                        alt={isShiny ? "Shiny Back" : "Back"}
                                        className="w-16 h-16 mx-auto"
                                      />
                                      <p className="text-xs mt-1">
                                        {isShiny ? "Shiny " : ""}Back
                                      </p>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          {/* Color Palette */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Color Palette
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Primary Colors</h4>
                  <div className="flex gap-2">
                    <div
                      className="w-16 h-16 rounded border"
                      style={{ backgroundColor: pokemon.colorPalette.primary }}
                      title={pokemon.colorPalette.primary}
                    />
                    <div
                      className="w-16 h-16 rounded border"
                      style={{
                        backgroundColor: pokemon.colorPalette.secondary,
                      }}
                      title={pokemon.colorPalette.secondary}
                    />
                    <div
                      className="w-16 h-16 rounded border"
                      style={{ backgroundColor: pokemon.colorPalette.accent }}
                      title={pokemon.colorPalette.accent}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Highlights</h4>
                  <div className="flex flex-wrap gap-2">
                    {pokemon.colorPalette.highlights.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-12 rounded border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Artwork Gallery */}
          {"official" in pokemon.artwork && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Artwork & Sprites
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(() => {
                    const frontUrl = getSpriteUrl("front");
                    const backUrl = getSpriteUrl("back");
                    return (
                      <>
                        {frontUrl && (
                          <div className="text-center space-y-2">
                            <img
                              src={frontUrl}
                              alt={`${isShiny ? "Shiny " : ""}Front`}
                              className="w-24 h-24 mx-auto"
                            />
                            <p className="text-xs">
                              {isShiny ? "Shiny " : ""}Front
                            </p>
                          </div>
                        )}
                        {backUrl && (
                          <div className="text-center space-y-2">
                            <img
                              src={backUrl}
                              alt={`${isShiny ? "Shiny " : ""}Back`}
                              className="w-24 h-24 mx-auto"
                            />
                            <p className="text-xs">
                              {isShiny ? "Shiny " : ""}Back
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Type Details */}
          {pokemon.typeDetails && pokemon.typeDetails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Type Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {pokemon.typeDetails.map((typeDetail, idx) => (
                    <Badge key={idx} variant="outline">
                      {typeDetail.name} (Slot {typeDetail.slot})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Abilities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Abilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {abilitiesArray.map((ability, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ability.name}</span>
                      {ability.is_hidden && (
                        <Badge variant="default" className="text-xs">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <Badge variant="secondary">Slot {ability.slot}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
