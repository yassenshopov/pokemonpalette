"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Palette, 
  Trash2, 
  Sparkles, 
  Calendar,
  Loader2,
  Heart
} from "lucide-react";
import Image from "next/image";

interface SavedPalette {
  id: string;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_form?: string;
  is_shiny: boolean;
  colors: string[];
  image_url?: string;
  palette_name?: string;
  created_at: string;
}

interface SavedPalettesDialogProps {
  onPaletteSelect?: (palette: {
    pokemonId: number;
    isShiny: boolean;
    colors: string[];
  }) => void;
  trigger?: React.ReactNode;
}

export function SavedPalettesDialog({ 
  onPaletteSelect,
  trigger 
}: SavedPalettesDialogProps) {
  const [open, setOpen] = useState(false);
  const [palettes, setPalettes] = useState<SavedPalette[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user, isLoaded } = useUser();

  // Fetch saved palettes when dialog opens
  useEffect(() => {
    if (open && user) {
      fetchPalettes();
    }
  }, [open, user]);

  const fetchPalettes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/saved-palettes");
      const data = await response.json();

      if (response.ok) {
        setPalettes(data.palettes || []);
      } else if (response.status === 503) {
        toast.error("Authentication service is currently unavailable. Please try again later.");
      } else if (response.status === 401) {
        toast.error("Please sign in to view saved palettes");
      } else {
        toast.error(data.error || "Failed to fetch saved palettes");
      }
    } catch (error) {
      console.error("Error fetching palettes:", error);
      toast.error("Failed to fetch saved palettes");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePalette = async (paletteId: string) => {
    setDeletingId(paletteId);
    try {
      const response = await fetch(`/api/saved-palettes/${paletteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        setPalettes(palettes.filter(p => p.id !== paletteId));
        toast.success("Palette deleted successfully");
      } else if (response.status === 503) {
        toast.error("Authentication service is currently unavailable. Please try again later.");
      } else if (response.status === 401) {
        toast.error("Please sign in to delete palettes");
      } else {
        toast.error(result.error || "Failed to delete palette");
      }
    } catch (error) {
      console.error("Error deleting palette:", error);
      toast.error("Failed to delete palette");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectPalette = (palette: SavedPalette) => {
    onPaletteSelect?.({
      pokemonId: palette.pokemon_id,
      isShiny: palette.is_shiny,
      colors: palette.colors,
    });
    setOpen(false);
    toast.success(`Loaded ${palette.pokemon_name} palette`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isLoaded) {
    return null;
  }

  if (!user) {
    return (
      <Button variant="outline" disabled className="flex items-center gap-2 cursor-not-allowed">
        <Heart className="w-4 h-4" />
        Sign in to view saved palettes
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2 cursor-pointer">
            <Heart className="w-4 h-4" />
            Saved Palettes
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Your Saved Palettes
          </DialogTitle>
          <DialogDescription>
            Select a saved palette to load it, or delete palettes you no longer need.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading your saved palettes...</span>
            </div>
          ) : palettes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No saved palettes yet</p>
              <p className="text-sm">
                Save your first palette by clicking the &quot;Save Palette&quot; button when viewing a Pokémon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {palettes.map((palette) => (
                <Card 
                  key={palette.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleSelectPalette(palette)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {palette.image_url && (
                          <div className="w-12 h-12 relative">
                            <Image
                              src={palette.image_url}
                              alt={palette.pokemon_name}
                              width={48}
                              height={48}
                              className="w-full h-full object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold capitalize flex items-center gap-2">
                            {palette.pokemon_name}
                            {palette.is_shiny && (
                              <Sparkles className="w-4 h-4 text-yellow-500" />
                            )}
                          </h3>
                          {palette.pokemon_form && (
                            <p className="text-sm text-muted-foreground capitalize">
                              {palette.pokemon_form} form
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePalette(palette.id);
                        }}
                        disabled={deletingId === palette.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        {deletingId === palette.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Color palette preview */}
                    <div className="flex gap-2 mb-3">
                      {palette.colors.map((color, index) => (
                        <div
                          key={index}
                          className="w-8 h-8 rounded-md border-2 border-white shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(palette.created_at)}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {palette.colors.length} colors
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
