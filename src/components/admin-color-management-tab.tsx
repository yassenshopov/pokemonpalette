"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Palette, Wand2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  extractColorsFromImage,
  type ColorWithFrequency,
} from "@/lib/color-extractor";
import { PokemonPicker } from "@/components/admin/colors/pokemon-picker";
import { PokemonEditor } from "@/components/admin/colors/pokemon-editor";
import {
  MAX_PALETTE_SIZE,
  type EditorTab,
  type PokemonColorRow,
  type Variant,
  type VarietyKind,
} from "@/components/admin/colors/types";
import type { HintConfig } from "@/lib/game/hints";

interface AdminColorsApiVarietyRow {
  id: number;
  name: string;
  spriteUrl: string | null;
  shinySpriteUrl: string | null;
  staticColors?: string[];
  staticShinyColors?: string[];
  hintConfig?: HintConfig | null;
  varietyKind: VarietyKind;
  speciesId: number;
}

interface AdminColorsApiResponse {
  pokemon: Array<{
    id: number;
    name: string;
    spriteUrl: string | null;
    shinySpriteUrl: string | null;
    staticColors?: string[];
    staticShinyColors?: string[];
    hintConfig?: HintConfig | null;
    speciesId?: number;
    varieties?: AdminColorsApiVarietyRow[];
  }>;
}

function parseVariant(raw: string | null): Variant {
  return raw === "shiny" ? "shiny" : "normal";
}

function parseTab(raw: string | null): EditorTab {
  return raw === "hints" ? "hints" : "palette";
}

export function AdminColorManagementTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlId = searchParams.get("id");
  const urlVariant = parseVariant(searchParams.get("variant"));
  const urlTab = parseTab(searchParams.get("tab"));

  const [pokemonList, setPokemonList] = React.useState<PokemonColorRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Batch re-extract state — kept from the legacy implementation but
  // wired to MAX_PALETTE_SIZE (6) colors per variant instead of 3.
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [batchVariant, setBatchVariant] = React.useState<Variant>("normal");
  const [batchRunning, setBatchRunning] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState({
    current: 0,
    total: 0,
  });
  const batchAbortRef = React.useRef(false);

  const parsedId = urlId ? Number(urlId) : NaN;
  const selectedId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

  const [editorDirty, setEditorDirty] = React.useState(false);

  // Flat lookup keyed by id covering both species rows and their nested
  // variety rows (megas, gmax, regionals, misc forms). The picker shows a
  // tree, but the editor only ever needs to find one row by id, so this
  // saves a recursive search every render.
  const rowsById = React.useMemo(() => {
    const map = new Map<number, PokemonColorRow>();
    for (const species of pokemonList) {
      map.set(species.id, species);
      for (const variety of species.varieties ?? []) {
        map.set(variety.id, variety);
      }
    }
    return map;
  }, [pokemonList]);

  const selectedRow = React.useMemo(
    () => (selectedId !== null ? rowsById.get(selectedId) ?? null : null),
    [rowsById, selectedId],
  );

  React.useEffect(() => {
    let cancelled = false;
    const fetchPokemon = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/admin/pokemon-colors");
        if (!response.ok) {
          if (response.status === 403) {
            setError("Access denied. Admin privileges required.");
          } else if (response.status === 401) {
            setError("Unauthorized. Please sign in.");
          } else {
            setError("Failed to fetch Pokémon data.");
          }
          return;
        }
        const data = (await response.json()) as AdminColorsApiResponse;
        if (cancelled) return;
        const normalized: PokemonColorRow[] = data.pokemon.map((p) => ({
          id: p.id,
          name: p.name,
          spriteUrl: p.spriteUrl,
          shinySpriteUrl: p.shinySpriteUrl,
          staticColors: p.staticColors ?? [],
          staticShinyColors: p.staticShinyColors ?? [],
          hintConfig: p.hintConfig ?? null,
          speciesId: p.speciesId ?? p.id,
          varieties: (p.varieties ?? []).map((v) => ({
            id: v.id,
            name: v.name,
            spriteUrl: v.spriteUrl,
            shinySpriteUrl: v.shinySpriteUrl,
            staticColors: v.staticColors ?? [],
            staticShinyColors: v.staticShinyColors ?? [],
            hintConfig: v.hintConfig ?? null,
            varietyKind: v.varietyKind,
            speciesId: v.speciesId,
          })),
        }));
        normalized.sort((a, b) => a.id - b.id);
        setPokemonList(normalized);
      } catch (err) {
        console.error("Error fetching Pokémon:", err);
        if (!cancelled) setError("Failed to load Pokémon data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPokemon();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-select the first Pokémon once data arrives and nothing is in the
  // URL. Keeps the editor from sitting empty when an admin lands on the
  // page with no query params.
  React.useEffect(() => {
    if (loading || error || pokemonList.length === 0) return;
    if (selectedId !== null) return;
    const first = pokemonList[0];
    if (first) {
      updateUrl({ id: first.id, tab: urlTab, variant: urlVariant });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, pokemonList.length]);

  const updateUrl = React.useCallback(
    (patch: { id?: number | null; tab?: EditorTab; variant?: Variant }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (patch.id !== undefined) {
        if (patch.id === null) params.delete("id");
        else params.set("id", String(patch.id));
      }
      if (patch.tab !== undefined) {
        if (patch.tab === "palette") params.delete("tab");
        else params.set("tab", patch.tab);
      }
      if (patch.variant !== undefined) {
        if (patch.variant === "normal") params.delete("variant");
        else params.set("variant", patch.variant);
      }
      const qs = params.toString();
      router.replace(qs ? `/admin/colors?${qs}` : "/admin/colors", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const confirmIfDirty = (action: () => void) => {
    if (!editorDirty) {
      action();
      return;
    }
    const ok = window.confirm(
      "You have unsaved changes. Switch Pokémon and discard them?",
    );
    if (ok) action();
  };

  const handleSelect = (id: number) => {
    if (id === selectedId) return;
    confirmIfDirty(() => updateUrl({ id }));
  };
  const handleVariantChange = (variant: Variant) => updateUrl({ variant });
  const handleTabChange = (tab: EditorTab) => updateUrl({ tab });

  const handleRowSaved = (updated: PokemonColorRow) => {
    setPokemonList((prev) =>
      prev.map((species) => {
        if (species.id === updated.id) {
          // Preserve the species' nested varieties — the editor doesn't
          // know about them, so its `updated` payload omits the field.
          return { ...species, ...updated, varieties: species.varieties };
        }
        if (species.varieties?.some((v) => v.id === updated.id)) {
          return {
            ...species,
            varieties: species.varieties.map((v) =>
              v.id === updated.id
                ? { ...v, ...updated, varietyKind: v.varietyKind, speciesId: v.speciesId }
                : v,
            ),
          };
        }
        return species;
      }),
    );
  };

  const runBatchExtract = async () => {
    // Flatten species + their alt-form varieties so the batch covers
    // every row the picker exposes, not just default forms.
    const flattened: PokemonColorRow[] = [];
    for (const species of pokemonList) {
      flattened.push(species);
      for (const variety of species.varieties ?? []) {
        flattened.push(variety);
      }
    }
    const candidates = flattened.filter((p) =>
      batchVariant === "shiny" ? p.shinySpriteUrl : p.spriteUrl,
    );
    if (candidates.length === 0) {
      toast.error(
        `No Pokémon have ${batchVariant === "shiny" ? "shiny " : ""}sprites to process.`,
      );
      return;
    }
    batchAbortRef.current = false;
    setBatchRunning(true);
    setBatchProgress({ current: 0, total: candidates.length });
    let successCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      if (batchAbortRef.current) break;
      const pokemon = candidates[i];
      setBatchProgress({ current: i + 1, total: candidates.length });
      const sprite =
        batchVariant === "shiny" ? pokemon.shinySpriteUrl! : pokemon.spriteUrl!;
      try {
        const extracted = (await extractColorsFromImage(
          sprite,
          MAX_PALETTE_SIZE,
          true,
        )) as ColorWithFrequency[];
        if (extracted.length === 0) continue;
        const colors = extracted.map((c) => c.hex);
        const response = await fetch("/api/admin/pokemon-colors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pokemonId: pokemon.id,
            colors,
            isShiny: batchVariant === "shiny",
          }),
        });
        if (!response.ok) continue;
        const j = (await response.json().catch(() => null)) as
          | { colors?: string[] }
          | null;
        const persisted = j?.colors ?? colors;
        const patchRow = (p: PokemonColorRow): PokemonColorRow =>
          batchVariant === "shiny"
            ? { ...p, staticShinyColors: persisted }
            : { ...p, staticColors: persisted };
        setPokemonList((prev) =>
          prev.map((species) => {
            if (species.id === pokemon.id) {
              return { ...patchRow(species), varieties: species.varieties };
            }
            if (species.varieties?.some((v) => v.id === pokemon.id)) {
              return {
                ...species,
                varieties: species.varieties.map((v) =>
                  v.id === pokemon.id ? patchRow(v) : v,
                ),
              };
            }
            return species;
          }),
        );
        successCount++;
        await new Promise((resolve) => setTimeout(resolve, 60));
      } catch (err) {
        console.error(`Error processing ${pokemon.name}:`, err);
      }
    }

    setBatchRunning(false);
    setBatchProgress({ current: 0, total: 0 });
    const aborted = batchAbortRef.current;
    batchAbortRef.current = false;
    if (aborted) {
      toast.info(
        `Batch stopped after ${successCount} Pokémon.`,
      );
    } else {
      toast.success(
        `Batch complete — re-extracted ${successCount} Pokémon.`,
      );
    }
    setBatchOpen(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div
            className="flex items-center justify-center"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="size-5 animate-spin"
              aria-hidden="true"
            />
            <span className="ml-2 text-sm">Loading Pokémon data…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card role="alert" aria-live="polite">
        <CardContent className="p-6 text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Palette className="size-4" aria-hidden="true" />
          <span>
            Pick a Pokémon, then edit up to{" "}
            <span className="font-medium text-foreground tabular-nums">
              {MAX_PALETTE_SIZE}
            </span>{" "}
            colors per variant and control which daily hints appear.
          </span>
        </div>

        <AlertDialog open={batchOpen} onOpenChange={setBatchOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="gap-1.5">
              <Wand2 className="size-4" aria-hidden="true" />
              Batch re-extract
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Batch re-extract palettes</AlertDialogTitle>
              <AlertDialogDescription>
                Runs the extractor on every Pokémon with a{" "}
                {batchVariant === "shiny" ? "shiny" : "normal"} sprite and
                overwrites their stored palette with the 6 most frequent
                colors. This is destructive and will wipe manual edits for the
                chosen variant.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3">
              <div className="flex gap-2" role="radiogroup" aria-label="Variant">
                <Button
                  type="button"
                  size="sm"
                  variant={batchVariant === "normal" ? "default" : "outline"}
                  role="radio"
                  aria-checked={batchVariant === "normal"}
                  onClick={() => setBatchVariant("normal")}
                  disabled={batchRunning}
                >
                  Normal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={batchVariant === "shiny" ? "default" : "outline"}
                  role="radio"
                  aria-checked={batchVariant === "shiny"}
                  onClick={() => setBatchVariant("shiny")}
                  disabled={batchRunning}
                >
                  Shiny
                </Button>
              </div>

              {batchRunning ? (
                <div className="space-y-1.5" aria-live="polite">
                  <Progress
                    value={
                      batchProgress.total > 0
                        ? (batchProgress.current / batchProgress.total) * 100
                        : 0
                    }
                  />
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {batchProgress.current.toLocaleString()} /{" "}
                    {batchProgress.total.toLocaleString()} processed…
                  </p>
                </div>
              ) : null}
            </div>

            <AlertDialogFooter>
              {batchRunning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    batchAbortRef.current = true;
                  }}
                >
                  Stop
                </Button>
              ) : (
                <>
                  <AlertDialogCancel disabled={batchRunning}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      runBatchExtract();
                    }}
                    disabled={batchRunning}
                  >
                    Start re-extraction
                  </AlertDialogAction>
                </>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card className="overflow-visible p-0">
        <div className="flex flex-col lg:flex-row lg:items-start">
          <PokemonPicker
            pokemon={pokemonList}
            selectedId={selectedId}
            onSelect={handleSelect}
            variant={urlVariant}
          />
          {selectedRow ? (
            <PokemonEditor
              key={selectedRow.id}
              row={selectedRow}
              variant={urlVariant}
              onVariantChange={handleVariantChange}
              tab={urlTab}
              onTabChange={handleTabChange}
              onSaved={(updated) => {
                setEditorDirty(false);
                handleRowSaved(updated);
              }}
              onBack={() =>
                confirmIfDirty(() => updateUrl({ id: null }))
              }
              onDirtyChange={setEditorDirty}
            />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-sm space-y-2 text-muted-foreground">
                <Palette
                  className="mx-auto size-8 opacity-60"
                  aria-hidden="true"
                />
                <p className="text-sm">
                  Pick a Pokémon from the list to edit its palette and hint
                  configuration.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
