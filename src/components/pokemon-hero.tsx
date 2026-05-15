"use client";

import { useState, useEffect } from "react";
import { Pokemon } from "@/types/pokemon";
import { getPokemonById } from "@/lib/pokemon";
import { extractColorsFromImage } from "@/lib/color-extractor";
import { getOfficialArtworkUrl } from "@/lib/sprite-utils";
import Image from "next/image";
import { LoaderOverlay } from "@/components/loader-overlay";
import { Button } from "@/components/ui/button";
import { useUser, SignInButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { Bookmark, ExternalLink } from "lucide-react";
import { FaPinterestP } from "react-icons/fa";
import { track } from "@/lib/analytics";
import { SavedPalettesDialog } from "@/components/saved-palettes-dialog";
import { useSavedPalettes } from "@/hooks/use-saved-palettes";
import { getContrastHex as getTextColor } from "@/lib/game/colors";

interface PokemonHeroProps {
  pokemonId?: number | null;
  isShiny?: boolean;
  onImageSrcChange?: (imageSrc: string | null) => void;
  colors?: string[];
  onPaletteLoad?: (palette: {
    pokemonId: number;
    isShiny: boolean;
    colors: string[];
  }) => void;
  varietyId?: number | null;
  formName?: string | null;
}

export function PokemonHero({
  pokemonId,
  isShiny = false,
  onImageSrcChange,
  colors,
  onPaletteLoad,
  varietyId,
  formName,
}: PokemonHeroProps) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [, setExtractedColors] = useState<string[]>([]);
  const [savingPalette, setSavingPalette] = useState(false);
  const [existingPaletteId, setExistingPaletteId] = useState<string | null>(
    null
  );
  const { user, isLoaded } = useUser();
  const {
    palettes: savedPalettes,
    loading: checkingExisting,
    refetch: refetchSavedPalettes,
    mutate: mutateSavedPalettes,
  } = useSavedPalettes();

  useEffect(() => {
    if (pokemonId) {
      const startTime = Date.now();
      setLoading(true);
      setImageLoading(true);
      getPokemonById(pokemonId)
        .then((data) => {
          setPokemon(data);
        })
        .finally(() => {
          const elapsed = Date.now() - startTime;
          const minDisplayTime = 500; // 500ms minimum
          const remaining = minDisplayTime - elapsed;

          if (remaining > 0) {
            setTimeout(() => setLoading(false), remaining);
          } else {
            setLoading(false);
          }
        });
    } else {
      setPokemon(null);
      setCurrentImageSrc(null);
    }
  }, [pokemonId]);

  // Update image src when pokemon, shiny state, variety, or form changes
  useEffect(() => {
    // If a form is selected, use that form's official artwork.
    // Try local path first; the browser will fall back via the onError handler.
    if (formName && pokemon) {
      const newSrc = `/pokemon/${isShiny ? "shiny/" : ""}${pokemon.id}-${formName}.png`;

      if (newSrc !== currentImageSrc) {
        setImageLoading(true);
        setCurrentImageSrc(newSrc);
        onImageSrcChange?.(newSrc);
      }
    } else if (varietyId) {
      // If a variety is selected, use that variety's official artwork
      const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${
        isShiny ? "/shiny" : ""
      }/${varietyId}.png`;
      const newSrc = getOfficialArtworkUrl(varietyId, isShiny, fallbackUrl);
      
      if (newSrc !== currentImageSrc) {
        setImageLoading(true);
        setCurrentImageSrc(newSrc);
        onImageSrcChange?.(newSrc);
      }
    } else if (
      pokemon &&
      typeof pokemon.artwork === "object" &&
      "official" in pokemon.artwork
    ) {
      let newSrc = pokemon.artwork.official;
      if (isShiny) {
        // Handle both PokeAPI URLs and local paths
        if (newSrc.startsWith("/pokemon/") && !newSrc.includes("/shiny/")) {
          // Local path: /pokemon/10282.png -> /pokemon/shiny/10282.png
          newSrc = newSrc.replace("/pokemon/", "/pokemon/shiny/");
        } else if (newSrc.includes("/other/official-artwork/")) {
          // PokeAPI URL: replace the path segment
          newSrc = newSrc.replace(
            "/other/official-artwork/",
            "/other/official-artwork/shiny/"
          );
        }
      }

      if (newSrc !== currentImageSrc) {
        setImageLoading(true);
        setCurrentImageSrc(newSrc);
        onImageSrcChange?.(newSrc);
      }
    } else {
      if (currentImageSrc !== null) {
        setCurrentImageSrc(null);
        onImageSrcChange?.(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokemon, isShiny, varietyId, formName]);

  // Extract colors from the official artwork when image src changes.
  // Fast path (audit H6): use the pre-computed `colorPalette.highlights`
  // shipped with the Pokémon JSON so the default (non-shiny) hero image
  // never triggers a runtime canvas decode on the main thread. We only fall
  // back to extractColorsFromImage for shiny sprites, which don't have
  // stored palettes.
  useEffect(() => {
    if (!currentImageSrc) return;

    const storedHighlights = pokemon?.colorPalette?.highlights ?? [];
    if (!isShiny && storedHighlights.length >= 2) {
      setExtractedColors(storedHighlights.slice(0, 2));
      return;
    }

    const timer = setTimeout(() => {
      extractColorsFromImage(currentImageSrc, 2)
        .then((colors) => {
          const colorStrings = colors.map((c) =>
            typeof c === "string" ? c : c.hex
          );
          setExtractedColors(colorStrings);
        })
        .catch(() => {
          setExtractedColors([]);
        });
    }, 100);

    return () => clearTimeout(timer);
  }, [currentImageSrc, isShiny, pokemon?.colorPalette?.highlights]);

  // Get colors - use passed colors from pokemon menu (source of truth)
  const colorPalette = pokemon?.colorPalette;
  const primaryColor = colors?.[0] || colorPalette?.primary || "#94a3b8";
  const secondaryColor = colors?.[1] || colorPalette?.secondary || "#94a3b8";
  const highlightColors =
    colors && colors.length >= 2
      ? colors.slice(0, 2)
      : colorPalette?.highlights?.slice(0, 2) || [primaryColor, secondaryColor];

  // Check for existing palette whenever the cached saved-palettes list or the
  // current selection changes. No network request of our own - the shared
  // hook already fetches at most once per session.
  useEffect(() => {
    if (!user || !pokemon || !colors || colors.length === 0) {
      setExistingPaletteId(null);
      return;
    }
    const firstForm = pokemon.forms?.[0];
    const formName =
      typeof firstForm === "string" ? firstForm : firstForm?.name || null;
    const existing = savedPalettes.find(
      (p) =>
        p.pokemon_id === pokemon.id &&
        p.is_shiny === isShiny &&
        (p.pokemon_form || null) === formName
    );
    setExistingPaletteId(existing ? existing.id : null);
  }, [user, pokemon, isShiny, colors, savedPalettes]);

  // Save palette function
  const handleSavePalette = async () => {
    if (!user || !pokemon || !colors || colors.length === 0) {
      if (!user) {
        toast.error("Please sign in to save palettes");
      } else {
        toast.error("No palette to save");
      }
      return;
    }

    setSavingPalette(true);

    try {
      // Get form name - handle both string[] and PokemonForm[] types
      const firstForm = pokemon.forms?.[0];
      const formName =
        typeof firstForm === "string"
          ? firstForm
          : firstForm?.name || undefined;

      const paletteData = {
        pokemonId: pokemon.id,
        pokemonName: pokemon.name,
        pokemonForm: formName,
        isShiny,
        colors,
        imageUrl: currentImageSrc || undefined,
        paletteName: `${pokemon.name}${isShiny ? " (Shiny)" : ""} Palette`,
      };

      const response = await fetch("/api/saved-palettes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paletteData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || "Palette saved successfully!");
        // Invalidate the shared cache so all consumers see the new palette.
        refetchSavedPalettes();
      } else if (response.status === 503) {
        toast.error(
          "Authentication service is currently unavailable. Please try again later."
        );
      } else if (response.status === 401) {
        toast.error("Please sign in to save palettes");
      } else {
        toast.error(result.error || "Failed to save palette");
      }
    } catch (error) {
      console.error("Error saving palette:", error);
      toast.error("Failed to save palette");
    } finally {
      setSavingPalette(false);
    }
  };

  // Unsave palette function (kept for parity with the saved-palettes UI; not
  // wired into this hero anymore but the dialog passes through the same path)
  const _handleUnsavePalette = async () => {
    if (!existingPaletteId) return;

    setSavingPalette(true);

    try {
      const response = await fetch(`/api/saved-palettes/${existingPaletteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Palette removed successfully!");
        setExistingPaletteId(null);
        // Drop the removed palette from the shared cache optimistically.
        mutateSavedPalettes((prev) =>
          prev.filter((p) => p.id !== existingPaletteId)
        );
      } else if (response.status === 503) {
        toast.error(
          "Authentication service is currently unavailable. Please try again later."
        );
      } else if (response.status === 401) {
        toast.error("Please sign in to manage palettes");
      } else {
        toast.error(result.error || "Failed to remove palette");
      }
    } catch (error) {
      console.error("Error removing palette:", error);
      toast.error("Failed to remove palette");
    } finally {
      setSavingPalette(false);
    }
  };

  return (
    <div
      className="min-h-[400px] md:min-h-[600px] py-12 md:py-24 px-4 md:px-12 flex items-center justify-center relative overflow-hidden animated-gradient"
      style={{
        background: `radial-gradient(circle at top right, ${
          highlightColors[0] || primaryColor
        }70 0%, transparent 60%)`,
        transition: "background 1s ease-in-out",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes gradient-shift {
          0%, 100% { 
            background-size: 120% 120%;
          }
          50% { 
            background-size: 200% 200%;
          }
        }
        .animated-gradient {
          animation: gradient-shift 15s ease infinite;
        }
      `,
        }}
      />

      <LoaderOverlay loading={loading} text="Loading..." />

      <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-center relative z-10 text-center md:text-left">
        {/* Left: Hero text */}
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            {pokemon ? (
              <>
                Your website - inspired by{" "}
                <span
                  className="capitalize bg-clip-text text-transparent block mt-1"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${primaryColor}, #202020)`,
                  }}
                >
                  {pokemon.name}
                </span>
              </>
            ) : (
              "Your website - inspired by colours"
            )}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-6">
            This website allows you to enter a Pokemon&apos;s name (or simply
            its number in the Pokedex), and you can extract a palette of 3, 4, 5, or 6 colours.
          </p>

          {/* Action buttons row */}
          {pokemon && colors && colors.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {existingPaletteId ? (
                <SavedPalettesDialog
                  onPaletteSelect={onPaletteLoad}
                  trigger={
                    <Button
                      disabled={checkingExisting || !isLoaded}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{
                        backgroundColor: primaryColor,
                        color: getTextColor(primaryColor),
                      }}
                    >
                      {checkingExisting ? (
                        <>
                          <div
                            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{
                              borderColor: `${getTextColor(primaryColor)}40`,
                              borderTopColor: getTextColor(primaryColor),
                            }}
                          />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4 fill-current" />
                          Saved in collection!
                        </>
                      )}
                    </Button>
                  }
                />
              ) : (
                <>
                  {!user ? (
                    <SignInButton mode="modal">
                      <Button
                        disabled={checkingExisting || !isLoaded}
                        className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: primaryColor,
                          color: getTextColor(primaryColor),
                        }}
                      >
                        {checkingExisting ? (
                          <>
                            <div
                              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                              style={{
                                borderColor: `${getTextColor(primaryColor)}40`,
                                borderTopColor: getTextColor(primaryColor),
                              }}
                            />
                            Checking...
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-4 h-4" />
                            Save Palette
                          </>
                        )}
                      </Button>
                    </SignInButton>
                  ) : (
                    <Button
                      onClick={handleSavePalette}
                      disabled={savingPalette || checkingExisting || !isLoaded}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{
                        backgroundColor: primaryColor,
                        color: getTextColor(primaryColor),
                      }}
                    >
                      {savingPalette ? (
                        <>
                          <div
                            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{
                              borderColor: `${getTextColor(primaryColor)}40`,
                              borderTopColor: getTextColor(primaryColor),
                            }}
                          />
                          Saving...
                        </>
                      ) : checkingExisting ? (
                        <>
                          <div
                            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{
                              borderColor: `${getTextColor(primaryColor)}40`,
                              borderTopColor: getTextColor(primaryColor),
                            }}
                          />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4" />
                          Save Palette
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}

              <PinterestPinButton
                pokemonName={pokemon.name}
                isShiny={isShiny}
                colors={colors}
              />
            </div>
          )}
        </div>

        {/* Right: Pokemon image */}
        <div className="flex-shrink-0 relative w-[250px] h-[250px] md:w-[450px] md:h-[450px]">
          {pokemon &&
          !loading &&
          typeof pokemon.artwork === "object" &&
          "official" in pokemon.artwork &&
          currentImageSrc ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <HeroImage
                src={currentImageSrc}
                fallbackUrl={getFallbackUrl(pokemon, varietyId, formName, isShiny)}
                alt={pokemon.name}
                width={450}
                height={450}
                className={`w-full h-full object-contain transition-opacity duration-500 ${
                  imageLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoad={() => setImageLoading(false)}
                unoptimized
                priority
              />
            </div>
          ) : null}
        </div>
      </div>

      {!pokemon && !loading && (
        <div className="text-muted-foreground/60 text-center relative z-10">
          Select a Pokémon to get started
        </div>
      )}
    </div>
  );
}

// Helper function to get fallback URL for varieties/forms
function getFallbackUrl(
  pokemon: Pokemon | null,
  varietyId: number | null | undefined,
  formName: string | null | undefined,
  isShiny: boolean
): string | null {
  if (formName && pokemon) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${
      isShiny ? "/shiny" : ""
    }/${pokemon.id}-${formName}.png`;
  }
  if (varietyId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${
      isShiny ? "/shiny" : ""
    }/${varietyId}.png`;
  }
  return null;
}

// Component to handle hero image with fallback
function HeroImage({
  src,
  fallbackUrl,
  alt,
  width,
  height,
  className,
  onLoad,
  unoptimized,
  priority,
}: {
  src: string;
  fallbackUrl: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  onLoad?: () => void;
  unoptimized?: boolean;
  priority?: boolean;
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // Reset when src changes
  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (!hasError && fallbackUrl && imgSrc !== fallbackUrl && imgSrc.startsWith('/pokemon/')) {
      setHasError(true);
      setImgSrc(fallbackUrl);
    }
  };

  // Local /pokemon/** sprites are pre-sized static PNGs - no need to run them
  // through Next's optimizer (saves edge requests + optimization compute).
  const isLocalSprite =
    typeof imgSrc === "string" && imgSrc.startsWith("/pokemon/");
  const shouldUnoptimize = unoptimized || isLocalSprite;

  return (
    <Image
      key={imgSrc}
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onLoad={onLoad}
      unoptimized={shouldUnoptimize}
      onError={handleError}
      priority={priority}
    />
  );
}

function PinterestPinButton({
  pokemonName,
  isShiny,
  colors,
}: {
  pokemonName: string;
  isShiny: boolean;
  colors?: string[];
}) {
  const slug = pokemonName.toLowerCase();
  const pageUrl = isShiny
    ? `https://www.pokemonpalette.com/shiny/${slug}`
    : `https://www.pokemonpalette.com/${slug}`;

  // Forward whatever colors are currently on the page to the OG image so the
  // pin reflects what the user is actually seeing. Without this, the pin route
  // falls back to the static palette in the JSON file (which is sometimes only
  // 3 entries and ends up cycling).
  const validHex = (colors || [])
    .map((c) => (c || "").replace(/^#/, "").toLowerCase())
    .filter((c) => /^[0-9a-f]{6}$/.test(c))
    .slice(0, 6);
  const colorParam = validHex.length > 0 ? `?c=${validHex.join(",")}` : "";

  const pinImageUrl = isShiny
    ? `https://www.pokemonpalette.com/api/og/pin/shiny/${slug}${colorParam}`
    : `https://www.pokemonpalette.com/api/og/pin/${slug}${colorParam}`;
  const description = `${pokemonName} color palette — extract beautiful hex colors for your next design project. pokemonpalette.com`;

  const href =
    `https://pinterest.com/pin/create/button/` +
    `?url=${encodeURIComponent(pageUrl)}` +
    `&media=${encodeURIComponent(pinImageUrl)}` +
    `&description=${encodeURIComponent(description)}`;

  return (
    <Button
      asChild
      variant="outline"
      size="default"
      className="flex items-center gap-2 cursor-pointer"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          track("pinterest_pin_click", {
            pokemon: pokemonName,
            is_shiny: isShiny,
          })
        }
      >
        <FaPinterestP className="w-4 h-4" aria-hidden="true" />
        Pin It
        <ExternalLink className="w-3 h-3 opacity-60" />
      </a>
    </Button>
  );
}
