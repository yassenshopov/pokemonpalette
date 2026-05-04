"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SlidersHorizontal } from "lucide-react";

// Make the difference between selected and unselected unmistakable, even when
// every option is on (the default for gens). Off items fade out and desaturate;
// on items get a primary-tinted background and border. `shadow-none` strips
// the `shadow-xs` baked into the shadcn outline toggle variant so items read
// as flat surfaces.
const TOGGLE_ITEM_CLASSES =
  "shadow-none transition-[opacity,background-color,border-color] " +
  "data-[state=off]:opacity-40 data-[state=off]:grayscale " +
  "data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 " +
  "hover:data-[state=off]:opacity-100 hover:data-[state=off]:grayscale-0";

// The shadcn ToggleGroup root applies `data-[variant=outline]:shadow-xs`,
// and tailwind-merge treats data-prefixed and unprefixed shadow utilities as
// separate conflict groups — so a plain `shadow-none` does NOT cancel it.
// Match the prefix here so the override actually wins.
const TOGGLE_GROUP_CLASSES =
  "w-full shadow-none data-[variant=outline]:shadow-none";

type ShinyPreference = "both" | "shiny" | "normal";

interface UnlimitedModeSettings {
  shinyPreference: ShinyPreference;
  selectedGenerations: number[];
}

interface UnlimitedModeSettingsDialogProps {
  settings: UnlimitedModeSettings;
  onSettingsChange: (settings: UnlimitedModeSettings) => void;
  availableGenerations: number[];
}

const GEN_ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

// Grass-type starter from each generation — recognizable, evenly weighted
// across gens, and rendered as the standard 96px PokeAPI sprite.
const GEN_REPS: Record<number, { id: number; name: string }> = {
  1: { id: 1, name: "Bulbasaur" },
  2: { id: 152, name: "Chikorita" },
  3: { id: 252, name: "Treecko" },
  4: { id: 387, name: "Turtwig" },
  5: { id: 495, name: "Snivy" },
  6: { id: 650, name: "Chespin" },
  7: { id: 722, name: "Rowlet" },
  8: { id: 810, name: "Grookey" },
  9: { id: 906, name: "Sprigatito" },
};

const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const DEFAULT_SHINY: ShinyPreference = "both";

function spriteFor(id: number, shiny = false): string {
  return shiny
    ? `${SPRITE_BASE}/shiny/${id}.png`
    : `${SPRITE_BASE}/${id}.png`;
}

function sameSettings(a: UnlimitedModeSettings, b: UnlimitedModeSettings) {
  if (a.shinyPreference !== b.shinyPreference) return false;
  if (a.selectedGenerations.length !== b.selectedGenerations.length) return false;
  const aSet = new Set(a.selectedGenerations);
  return b.selectedGenerations.every((g) => aSet.has(g));
}

function isDefault(
  s: UnlimitedModeSettings,
  availableGens: number[]
): boolean {
  if (s.shinyPreference !== DEFAULT_SHINY) return false;
  if (s.selectedGenerations.length !== availableGens.length) return false;
  const set = new Set(s.selectedGenerations);
  return availableGens.every((g) => set.has(g));
}

export function UnlimitedModeSettingsDialog({
  settings,
  onSettingsChange,
  availableGenerations,
}: UnlimitedModeSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  // Keep a draft so toggling individual options doesn't reset the in-progress
  // game on every click — we only commit when the dialog closes.
  const [draft, setDraft] = useState<UnlimitedModeSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings, open]);

  const allSelected =
    draft.selectedGenerations.length === availableGenerations.length;
  const filtersActive = !isDefault(settings, availableGenerations);

  const handleOpenChange = (next: boolean) => {
    if (!next && !sameSettings(draft, settings)) {
      onSettingsChange(draft);
    }
    setOpen(next);
  };

  const onShinyChange = (value: string) => {
    if (!value) return;
    setDraft((prev) => ({ ...prev, shinyPreference: value as ShinyPreference }));
  };

  const onGensChange = (values: string[]) => {
    if (values.length === 0) return;
    setDraft((prev) => ({
      ...prev,
      selectedGenerations: values.map((v) => Number(v)),
    }));
  };

  const toggleAll = () => {
    setDraft((prev) => ({
      ...prev,
      selectedGenerations: allSelected
        ? [availableGenerations[0]]
        : [...availableGenerations],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          aria-label={
            filtersActive
              ? "Open game filters (filters active)"
              : "Open game filters"
          }
          className="cursor-pointer shadow-none relative"
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          Filters
          {filtersActive && (
            <span
              className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-background"
              aria-hidden="true"
            />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Game Filters</DialogTitle>
          <DialogDescription>
            Choose which Pokémon can appear in unlimited mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label
              htmlFor="variant-toggle"
              className="text-sm font-heading font-medium"
            >
              Variant
            </Label>
            <ToggleGroup
              id="variant-toggle"
              type="single"
              variant="outline"
              value={draft.shinyPreference}
              onValueChange={onShinyChange}
              className={TOGGLE_GROUP_CLASSES}
            >
              <ToggleGroupItem
                value="both"
                aria-label="Any variant"
                className={`h-24 flex-col gap-1 py-2 ${TOGGLE_ITEM_CLASSES}`}
              >
                <div className="flex items-center -space-x-4">
                  <Image
                    src={spriteFor(25, false)}
                    alt=""
                    width={48}
                    height={48}
                    className="[image-rendering:pixelated]"
                    unoptimized
                  />
                  <Image
                    src={spriteFor(25, true)}
                    alt=""
                    width={48}
                    height={48}
                    className="[image-rendering:pixelated]"
                    unoptimized
                  />
                </div>
                <span className="text-xs">Any</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="normal"
                aria-label="Normal only"
                className={`h-24 flex-col gap-1 py-2 ${TOGGLE_ITEM_CLASSES}`}
              >
                <Image
                  src={spriteFor(25, false)}
                  alt=""
                  width={60}
                  height={60}
                  className="[image-rendering:pixelated]"
                  unoptimized
                />
                <span className="text-xs">Normal</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="shiny"
                aria-label="Shiny only"
                className={`h-24 flex-col gap-1 py-2 data-[state=on]:text-amber-600 dark:data-[state=on]:text-amber-400 ${TOGGLE_ITEM_CLASSES}`}
              >
                <Image
                  src={spriteFor(25, true)}
                  alt=""
                  width={60}
                  height={60}
                  className="[image-rendering:pixelated]"
                  unoptimized
                />
                <span className="text-xs">Shiny</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="gen-toggle"
                className="text-sm font-heading font-medium"
              >
                Generations
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="h-7 px-2 text-xs cursor-pointer"
              >
                {allSelected ? "Clear" : "Select all"}
              </Button>
            </div>
            <ToggleGroup
              id="gen-toggle"
              type="multiple"
              variant="outline"
              value={draft.selectedGenerations.map(String)}
              onValueChange={onGensChange}
              className={TOGGLE_GROUP_CLASSES}
            >
              {availableGenerations.map((gen) => {
                const rep = GEN_REPS[gen];
                const roman = GEN_ROMAN[gen - 1] ?? String(gen);
                return (
                  <ToggleGroupItem
                    key={gen}
                    value={String(gen)}
                    aria-label={`Generation ${roman}${
                      rep ? ` — ${rep.name}` : ""
                    }`}
                    className={`h-24 flex-col gap-1 px-0.5 py-2 ${TOGGLE_ITEM_CLASSES}`}
                  >
                    {rep ? (
                      <Image
                        src={spriteFor(rep.id)}
                        alt=""
                        width={56}
                        height={56}
                        className="[image-rendering:pixelated]"
                        unoptimized
                      />
                    ) : (
                      <span className="h-14" />
                    )}
                    <span className="text-[11px] font-heading tabular-nums leading-none">
                      {roman}
                    </span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <p
              className="text-xs text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {draft.selectedGenerations.length} of{" "}
              {availableGenerations.length} selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => handleOpenChange(false)}
            className="cursor-pointer shadow-none"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
