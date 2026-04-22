"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleCheck,
  Eye,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Pokemon } from "@/types/pokemon";
import {
  buildCandidates,
  generateHints as runGenerateHints,
  type HintConfig,
} from "@/lib/game/hints";
import { MAX_PALETTE_SIZE, type EditorTab, type PokemonColorRow, type Variant } from "./types";
import { PaletteEditor } from "./palette-editor";
import { PalettePreview } from "./palette-preview";
import { HintsEditor } from "./hints-editor";

interface PokemonEditorProps {
  row: PokemonColorRow;
  variant: Variant;
  onVariantChange: (variant: Variant) => void;
  tab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  onBack?: () => void;
  onSaved: (row: PokemonColorRow) => void;
  /** Let the parent know when the editor has unsaved changes so it can
   * intercept picker clicks / guard navigation. */
  onDirtyChange?: (dirty: boolean) => void;
}

function padPalette(colors: string[]): string[] {
  const out = colors.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, MAX_PALETTE_SIZE);
  if (out.length === 0) {
    return Array.from({ length: MAX_PALETTE_SIZE }, () => "#94a3b8");
  }
  while (out.length < MAX_PALETTE_SIZE) {
    out.push(out[out.length - 1] ?? "#94a3b8");
  }
  return out;
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a[i] ?? "").toLowerCase() !== (b[i] ?? "").toLowerCase()) return false;
  }
  return true;
}

function hintConfigsEqual(
  a: HintConfig | null,
  b: HintConfig | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) {
    // Treat an empty HintConfig as equal to null.
    const c = a ?? b!;
    const empty =
      (!c.disabled || c.disabled.length === 0) &&
      Object.values(c.overrides ?? {}).every(
        (v) => !v || (typeof v === "string" && v.length === 0),
      );
    return empty;
  }
  const da = [...(a.disabled ?? [])].sort();
  const db = [...(b.disabled ?? [])].sort();
  if (da.length !== db.length) return false;
  for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) return false;
  const keys = new Set([
    ...Object.keys(a.overrides ?? {}),
    ...Object.keys(b.overrides ?? {}),
  ]);
  for (const k of keys) {
    const va = (a.overrides?.[k as keyof typeof a.overrides] ?? "") || "";
    const vb = (b.overrides?.[k as keyof typeof b.overrides] ?? "") || "";
    if (va !== vb) return false;
  }
  return true;
}

export function PokemonEditor({
  row,
  variant,
  onVariantChange,
  tab,
  onTabChange,
  onBack,
  onSaved,
  onDirtyChange,
}: PokemonEditorProps) {
  // Baselines are what's on disk. Drafts are what the admin is editing.
  const normalBaseline = React.useMemo(
    () => padPalette(row.staticColors),
    [row.staticColors],
  );
  const shinyBaseline = React.useMemo(
    () => padPalette(row.staticShinyColors),
    [row.staticShinyColors],
  );

  const [normalDraft, setNormalDraft] =
    React.useState<string[]>(normalBaseline);
  const [shinyDraft, setShinyDraft] = React.useState<string[]>(shinyBaseline);
  const [hintsDraft, setHintsDraft] = React.useState<HintConfig | null>(
    row.hintConfig,
  );

  // Reset drafts when the selected row changes.
  React.useEffect(() => {
    setNormalDraft(normalBaseline);
    setShinyDraft(shinyBaseline);
    setHintsDraft(row.hintConfig);
  }, [row.id, normalBaseline, shinyBaseline, row.hintConfig]);

  // Full Pokemon data is loaded from the public JSON so the editor can
  // render the real sprite/types and compute hint previews without a
  // privileged admin round-trip.
  const [pokemonData, setPokemonData] = React.useState<Pokemon | null>(null);
  const [pokemonLoading, setPokemonLoading] = React.useState(true);

  React.useEffect(() => {
    const ctrl = new AbortController();
    setPokemonLoading(true);
    setPokemonData(null);
    fetch(`/data/pokemon/${row.id}.json`, {
      signal: ctrl.signal,
      cache: "force-cache",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Pokemon | null) => {
        setPokemonData(data);
        setPokemonLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        console.error("Failed to load Pokemon JSON:", err);
        setPokemonLoading(false);
      });
    return () => ctrl.abort();
  }, [row.id]);

  const normalDirty = !arraysEqual(normalDraft, normalBaseline);
  const shinyDirty = !arraysEqual(shinyDraft, shinyBaseline);
  const paletteDirty = normalDirty || shinyDirty;
  const hintsDirty = !hintConfigsEqual(hintsDraft, row.hintConfig);
  const anyDirty = paletteDirty || hintsDirty;

  // Save status, announced via the page-level live region.
  const [saving, setSaving] = React.useState<
    null | "palette-normal" | "palette-shiny" | "hints" | "all"
  >(null);
  const [announcement, setAnnouncement] = React.useState("");

  // Router guard: warn before reloading/closing if there are unsaved changes.
  React.useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  // Surface dirty state to the workbench so it can intercept row changes.
  React.useEffect(() => {
    onDirtyChange?.(anyDirty);
  }, [anyDirty, onDirtyChange]);

  const activePalette = variant === "shiny" ? shinyDraft : normalDraft;
  const activeBaseline = variant === "shiny" ? shinyBaseline : normalBaseline;
  const otherVariant = variant === "shiny" ? normalDraft : shinyDraft;
  const setActivePalette = variant === "shiny" ? setShinyDraft : setNormalDraft;
  const activeSprite =
    variant === "shiny" ? row.shinySpriteUrl : row.spriteUrl;

  // Official artwork URLs (when present on the Pokemon JSON) — used by the
  // source picker to let the admin sample colors from a high-res image.
  const artwork = pokemonData?.artwork as
    | {
        official?: string;
        shiny?: string | null;
        front_shiny?: string | null;
      }
    | undefined;
  const officialArtUrl = artwork?.official ?? null;
  const officialShinyArtUrl =
    (artwork as { official_shiny?: string | null } | undefined)?.official_shiny ??
    null;

  // Combine the draft hintConfig with the draft palette to show the preview
  // exactly as the game would render it.
  const previewPokemon: Pokemon | null = React.useMemo(() => {
    if (!pokemonData) return null;
    return {
      ...pokemonData,
      colorPalette: {
        ...pokemonData.colorPalette,
        highlights: normalDraft,
        primary: normalDraft[0] ?? pokemonData.colorPalette.primary,
        secondary: normalDraft[1] ?? pokemonData.colorPalette.secondary,
        accent: normalDraft[2] ?? pokemonData.colorPalette.accent,
      },
      shinyColorPalette: {
        ...(pokemonData.shinyColorPalette ?? pokemonData.colorPalette),
        highlights: shinyDraft,
        primary: shinyDraft[0] ?? pokemonData.colorPalette.primary,
        secondary: shinyDraft[1] ?? pokemonData.colorPalette.secondary,
        accent: shinyDraft[2] ?? pokemonData.colorPalette.accent,
      },
    };
  }, [pokemonData, normalDraft, shinyDraft]);

  // Deterministic preview hints: we take the same candidate pool the real
  // game would see but skip the randomized selection so the admin sees a
  // stable order as they toggle things.
  const previewHints = React.useMemo(() => {
    if (!previewPokemon) return [];
    const candidates = buildCandidates(previewPokemon, {
      includeGeneration: true,
      hintConfig: hintsDraft,
    });
    const pick = (bucket: "vague" | "medium") =>
      candidates.find((c) => c.bucket === bucket)?.text;
    const out: string[] = [];
    const vague = pick("vague");
    if (vague) out.push(vague);
    const medium = pick("medium");
    if (medium && medium !== vague) out.push(medium);
    out.push("Full palette shown");
    return out;
  }, [previewPokemon, hintsDraft]);

  const savePalette = async (target: Variant): Promise<boolean> => {
    const colors = target === "shiny" ? shinyDraft : normalDraft;
    const sprite = target === "shiny" ? row.shinySpriteUrl : row.spriteUrl;
    if (!sprite) {
      toast.error(
        `${target === "shiny" ? "Shiny" : "Normal"} palette can't save — no sprite on file.`,
      );
      return false;
    }
    try {
      const response = await fetch("/api/admin/pokemon-colors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pokemonId: row.id,
          colors,
          isShiny: target === "shiny",
        }),
      });
      if (!response.ok) {
        const j = await response.json().catch(() => null);
        throw new Error(j?.error ?? `Failed (${response.status})`);
      }
      return true;
    } catch (err) {
      console.error("Failed to save palette:", err);
      toast.error((err as Error).message || "Failed to save palette");
      return false;
    }
  };

  const saveHints = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/admin/pokemon-colors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pokemonId: row.id,
          hintConfig: hintsDraft,
        }),
      });
      if (!response.ok) {
        const j = await response.json().catch(() => null);
        throw new Error(j?.error ?? `Failed (${response.status})`);
      }
      return true;
    } catch (err) {
      console.error("Failed to save hints:", err);
      toast.error((err as Error).message || "Failed to save hints");
      return false;
    }
  };

  const handleSaveAll = async () => {
    if (!anyDirty || saving !== null) return;
    setSaving("all");
    setAnnouncement("Saving…");
    const results: Array<{ kind: string; ok: boolean }> = [];
    if (normalDirty) {
      results.push({ kind: "normal", ok: await savePalette("normal") });
    }
    if (shinyDirty) {
      results.push({ kind: "shiny", ok: await savePalette("shiny") });
    }
    if (hintsDirty) {
      results.push({ kind: "hints", ok: await saveHints() });
    }

    const allOk = results.every((r) => r.ok);
    if (allOk) {
      toast.success("Saved");
      setAnnouncement("Saved");
      onSaved({
        ...row,
        staticColors: normalDraft,
        staticShinyColors: shinyDraft,
        hintConfig: hintsDraft,
      });
    } else {
      setAnnouncement("Save failed");
    }
    setSaving(null);
  };

  const handleDiscard = () => {
    setNormalDraft(normalBaseline);
    setShinyDraft(shinyBaseline);
    setHintsDraft(row.hintConfig);
    setAnnouncement("Discarded unsaved changes");
  };

  return (
    <section
      className="flex min-w-0 flex-1 flex-col bg-background"
      aria-label="Pokémon editor"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <Tabs
        value={tab}
        onValueChange={(v) => onTabChange(v as EditorTab)}
        className="flex flex-col"
      >
        {/* Header + tabs list stay pinned to the top of the viewport while
         * the right pane scrolls with the page, so the admin always has
         * Save / Discard / variant toggle in reach. */}
        <div className="sticky top-14 z-10 bg-background/90 backdrop-blur-sm">
          <EditorHeader
            row={row}
            variant={variant}
            onVariantChange={onVariantChange}
            dirty={anyDirty}
            saving={saving !== null}
            onSaveAll={handleSaveAll}
            onDiscard={handleDiscard}
            onBack={onBack}
            pokemon={pokemonData}
          />
          <div className="border-b px-4 py-2">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="palette" className="gap-1.5">
                Palette
                {paletteDirty ? (
                  <span
                    className="size-1.5 rounded-full bg-amber-500"
                    aria-label="Unsaved changes"
                  />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="hints" className="gap-1.5">
                Hints
                {hintsDirty ? (
                  <span
                    className="size-1.5 rounded-full bg-amber-500"
                    aria-label="Unsaved changes"
                  />
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="palette" className="mt-0 p-4">
          <PaletteEditor
            key={`${row.id}-${variant}`}
            value={activePalette}
            baseline={activeBaseline}
            otherVariant={otherVariant}
            onChange={setActivePalette}
            spriteUrl={activeSprite}
            officialArtUrl={officialArtUrl}
            officialShinyArtUrl={officialShinyArtUrl}
            variant={variant}
            onAnnounce={setAnnouncement}
          />
        </TabsContent>

        <TabsContent value="hints" className="mt-0 p-4">
          {pokemonLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading Pokémon data…
            </div>
          ) : (
            <HintsEditor
              pokemon={pokemonData}
              value={hintsDraft}
              onChange={setHintsDraft}
              onAnnounce={setAnnouncement}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Preview sits below the active tab at full width so both the
       * palette and hint previews feel like one combined "as players see
       * it" reading, instead of splitting focus into a side column. */}
      <div className="mt-2 border-t bg-muted/20 p-4 space-y-4">
        <PalettePreview
          colors={activePalette}
          spriteUrl={activeSprite}
          pokemonName={row.name}
          pokemonId={row.id}
          hints={previewHints}
          isShiny={variant === "shiny"}
        />
        {tab === "hints" && pokemonData ? (
          <ShuffleCheckCard
            pokemon={previewPokemon ?? pokemonData}
            hintConfig={hintsDraft}
          />
        ) : null}
      </div>
    </section>
  );
}

interface EditorHeaderProps {
  row: PokemonColorRow;
  variant: Variant;
  onVariantChange: (variant: Variant) => void;
  dirty: boolean;
  saving: boolean;
  onSaveAll: () => void;
  onDiscard: () => void;
  onBack?: () => void;
  pokemon: Pokemon | null;
}

function EditorHeader({
  row,
  variant,
  onVariantChange,
  dirty,
  saving,
  onSaveAll,
  onDiscard,
  onBack,
  pokemon,
}: EditorHeaderProps) {
  const sprite = variant === "shiny" ? row.shinySpriteUrl : row.spriteUrl;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-card/60 px-4 py-3">
      {onBack ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 lg:hidden"
          onClick={onBack}
          aria-label="Back to picker"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-muted/40">
          {sprite ? (
            <Image
              src={sprite}
              alt={`${row.name} ${variant === "shiny" ? "shiny " : ""}sprite`}
              fill
              sizes="56px"
              className="object-contain"
              style={{ imageRendering: "pixelated" }}
              unoptimized
              priority
            />
          ) : (
            <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
              No sprite
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2
              className="truncate text-lg font-semibold capitalize"
              translate="no"
            >
              {row.name}
            </h2>
            <span
              className="font-mono text-xs tabular-nums text-muted-foreground"
              translate="no"
            >
              #{row.id}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {pokemon?.type?.map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="h-5 px-1.5 text-[10px]"
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Sparkles
              className={cn(
                "size-3.5",
                variant === "shiny" ? "text-amber-500" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            Shiny
          </span>
          <Switch
            checked={variant === "shiny"}
            onCheckedChange={(c) => onVariantChange(c ? "shiny" : "normal")}
            aria-label="Toggle shiny variant"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          disabled={!dirty || saving}
          className="h-8 gap-1 text-xs"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Discard
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSaveAll}
          disabled={!dirty || saving}
          className="h-8 gap-1.5"
        >
          {saving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : dirty ? (
            <>
              <Save className="size-3.5" aria-hidden="true" />
              Save changes
            </>
          ) : (
            <>
              <CircleCheck className="size-3.5" aria-hidden="true" />
              Saved
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders three consecutive runs of `generateHints` so the admin can spot
 * whether their override/toggle combo produces stable results. Hidden by
 * default behind an "Inspect shuffle" button to keep the editor quiet.
 */
function ShuffleCheckCard({
  pokemon,
  hintConfig,
}: {
  pokemon: Pokemon;
  hintConfig: HintConfig | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [rolls, setRolls] = React.useState<string[][]>([]);

  const roll = () => {
    const out: string[][] = [];
    for (let i = 0; i < 3; i++) {
      out.push(
        runGenerateHints(pokemon, { includeGeneration: true, hintConfig }),
      );
    }
    setRolls(out);
  };

  return (
    <div className="mt-3 rounded-md border bg-muted/30 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Eye className="size-3" aria-hidden="true" />
          Shuffle check
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen((v) => !v);
              if (!open) roll();
            }}
            className="h-6 px-2 text-[11px]"
            aria-expanded={open}
          >
            {open ? "Hide" : "Inspect"}
          </Button>
          {open ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={roll}
              className="h-6 px-2 text-[11px]"
            >
              Re-roll
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <ol className="mt-2 space-y-1.5">
          {rolls.map((r, i) => (
            <li
              key={i}
              className="rounded border bg-background/50 p-1.5 text-[11px]"
            >
              <span className="font-mono text-muted-foreground">
                Run {i + 1}:
              </span>
              <ol className="mt-0.5 list-inside list-decimal space-y-0.5">
                {r.map((line, j) => (
                  <li key={j} className="truncate" title={line}>
                    {line}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
