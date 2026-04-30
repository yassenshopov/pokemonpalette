"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertCircle,
  Check,
  Loader2,
  Pin,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAllPokemonMetadata } from "@/lib/pokemon";
import type { PokemonMetadata } from "@/types/pokemon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export interface DailyOverrideValue {
  pokemonId: number;
  isShiny: boolean;
  note: string | null;
}

interface DailyOverrideDialogProps {
  /** ISO YYYY-MM-DD; the dialog edits the override for this date. */
  date: string;
  /** Current override row, or null if the day is on the algorithmic schedule. */
  current: DailyOverrideValue | null;
  /** The deterministic Pokemon id (shown for context — "today is normally X"). */
  algorithmicPokemonId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new override (or null on clear) after a successful save. */
  onChanged: (next: DailyOverrideValue | null) => void;
}

function officialArtworkUrl(pokemonId: number, shiny = false) {
  const suffix = shiny ? "/shiny" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${suffix}/${pokemonId}.png`;
}

function fullDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DailyOverrideDialog({
  date,
  current,
  algorithmicPokemonId,
  open,
  onOpenChange,
  onChanged,
}: DailyOverrideDialogProps) {
  const all = React.useMemo(() => getAllPokemonMetadata(), []);

  const [pokemonId, setPokemonId] = React.useState<number>(
    current?.pokemonId ?? algorithmicPokemonId,
  );
  const [isShiny, setIsShiny] = React.useState<boolean>(current?.isShiny ?? false);
  const [note, setNote] = React.useState<string>(current?.note ?? "");
  const [saving, setSaving] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when the dialog opens / target changes — the dialog is
  // long-lived in the React tree but the date can shift between sheet
  // navigations, so we re-seed every time it opens.
  React.useEffect(() => {
    if (!open) return;
    setPokemonId(current?.pokemonId ?? algorithmicPokemonId);
    setIsShiny(current?.isShiny ?? false);
    setNote(current?.note ?? "");
    setError(null);
  }, [open, current, algorithmicPokemonId]);

  const selected = React.useMemo(
    () => all.find((p) => p.id === pokemonId) ?? null,
    [all, pokemonId],
  );

  const dirty =
    !current ||
    current.pokemonId !== pokemonId ||
    current.isShiny !== isShiny ||
    (current.note ?? "") !== note.trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/daily-overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          pokemonId,
          isShiny,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      const data = (await res.json()) as {
        override: { pokemon_id: number; is_shiny: boolean; note: string | null };
      };
      toast.success(
        current ? "Override updated" : "Override scheduled",
      );
      onChanged({
        pokemonId: data.override.pokemon_id,
        isShiny: data.override.is_shiny,
        note: data.override.note,
      });
      onOpenChange(false);
    } catch (err) {
      const msg = (err as Error).message ?? "Couldn't save the override.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setClearing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/daily-overrides?date=${encodeURIComponent(date)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      toast.success("Override cleared — reverted to deterministic pick.");
      onChanged(null);
      setConfirmClearOpen(false);
      onOpenChange(false);
    } catch (err) {
      const msg = (err as Error).message ?? "Couldn't clear the override.";
      setError(msg);
      toast.error(msg);
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          // The combobox lives inside the dialog body and the dialog has a
          // soft inner scroll on small viewports. `overscroll-contain`
          // prevents momentum scrolling from chaining to the page.
          className="max-h-[min(85vh,42rem)] overflow-hidden overscroll-contain p-0 sm:max-w-2xl"
        >
          <DialogHeader className="border-b px-5 pb-3 pt-5">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pin className="size-4" aria-hidden="true" />
              {current ? "Edit override" : "Schedule override"}
            </DialogTitle>
            <DialogDescription>
              Manually pick the Pokémon and shiny mode for{" "}
              <span className="font-medium text-foreground">
                {fullDateLabel(date)}
              </span>
              . This takes precedence over the deterministic schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_18rem]">
            <PokemonCombobox
              all={all}
              selectedId={pokemonId}
              onSelect={setPokemonId}
              shiny={isShiny}
            />

            <div className="flex flex-col gap-4">
              <SelectedPreview
                pokemon={selected}
                shiny={isShiny}
                isAlgorithmic={
                  !current && pokemonId === algorithmicPokemonId && !isShiny
                }
              />

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <Label
                    htmlFor="override-shiny"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Sparkles
                      className="size-3.5 text-amber-500"
                      aria-hidden="true"
                    />
                    Shiny variant
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Use the shiny palette for this day.
                  </p>
                </div>
                <Switch
                  id="override-shiny"
                  checked={isShiny}
                  onCheckedChange={setIsShiny}
                  aria-label="Toggle shiny variant"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="override-note" className="text-sm font-medium">
                  Note <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="override-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={280}
                  placeholder="Pikachu Day, Community Day…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {note.length}/280
                </p>
              </div>

              {error ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"
                >
                  <AlertCircle
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 border-t bg-muted/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {current ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmClearOpen(true)}
                  disabled={saving || clearing}
                >
                  <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" />
                  Clear override
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Algorithmic pick:{" "}
                  <span className="font-mono tabular-nums" translate="no">
                    #{algorithmicPokemonId.toString().padStart(4, "0")}
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving || clearing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={saving || clearing || !dirty}
              >
                {saving ? (
                  <>
                    <Loader2
                      className="mr-1.5 size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                    {current ? "Save changes" : "Schedule override"}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this override?</AlertDialogTitle>
            <AlertDialogDescription>
              {fullDateLabel(date)} will revert to the deterministic pick (
              <span className="font-mono tabular-nums" translate="no">
                #{algorithmicPokemonId.toString().padStart(4, "0")}
              </span>
              ). Players who have already finished today&apos;s puzzle keep
              their recorded result.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                clear();
              }}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? (
                <>
                  <Loader2
                    className="mr-1.5 size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  Clearing…
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" />
                  Clear override
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pokemon combobox — searchable picker over the ~1,350 Pokemon metadata
// index. Uses content-visibility to skip offscreen rows (cheap virtualization
// per the web interface guidelines).
// ---------------------------------------------------------------------------

interface PokemonComboboxProps {
  all: PokemonMetadata[];
  selectedId: number;
  onSelect: (id: number) => void;
  shiny: boolean;
}

function PokemonCombobox({
  all,
  selectedId,
  onSelect,
  shiny,
}: PokemonComboboxProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    if (!q) return all;
    return all.filter((p) => {
      if (String(p.id).includes(q)) return true;
      if (p.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [all, query]);

  const listRef = React.useRef<HTMLUListElement | null>(null);

  // Keep the selected row visible when it shifts via parent props.
  React.useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-id="${selectedId}"]`,
    );
    if (node) node.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Label htmlFor="override-pokemon-search" className="text-sm font-medium">
        Pokémon
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="override-pokemon-search"
          type="search"
          inputMode="search"
          spellCheck={false}
          autoComplete="off"
          placeholder="Search by name or number, e.g. pikachu or 25…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Search Pokémon by name or ID"
          aria-controls="override-pokemon-list"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Clear search"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        {filtered.length === 0 ? (
          <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No Pokémon match that search.
          </div>
        ) : (
          <ul
            ref={listRef}
            id="override-pokemon-list"
            role="listbox"
            aria-label="Pokémon results"
            aria-activedescendant={`override-row-${selectedId}`}
            tabIndex={-1}
            className="h-64 overflow-y-auto overscroll-contain py-1"
          >
            {filtered.map((p) => (
              <ComboboxRow
                key={p.id}
                pokemon={p}
                selected={p.id === selectedId}
                shiny={shiny}
                onSelect={() => onSelect(p.id)}
              />
            ))}
          </ul>
        )}
      </div>
      <p
        className="text-[11px] text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {filtered.length.toLocaleString()} of {all.length.toLocaleString()}
      </p>
    </div>
  );
}

interface ComboboxRowProps {
  pokemon: PokemonMetadata;
  selected: boolean;
  shiny: boolean;
  onSelect: () => void;
}

function ComboboxRow({ pokemon, selected, shiny, onSelect }: ComboboxRowProps) {
  return (
    <li
      id={`override-row-${pokemon.id}`}
      data-id={pokemon.id}
      role="option"
      aria-selected={selected}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "44px",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          "hover:bg-muted/60",
          selected && "bg-muted",
        )}
        style={{ touchAction: "manipulation" }}
        aria-label={`${pokemon.name}, number ${pokemon.id}`}
      >
        <div className="relative size-8 shrink-0 overflow-hidden rounded">
          <Image
            src={officialArtworkUrl(pokemon.id, shiny)}
            alt=""
            fill
            sizes="32px"
            className="object-contain"
            unoptimized
            loading="lazy"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="min-w-0 truncate text-sm font-medium"
              translate="no"
            >
              {pokemon.name}
            </span>
            <span
              className="font-mono text-[10px] tabular-nums text-muted-foreground"
              translate="no"
            >
              #{pokemon.id.toString().padStart(4, "0")}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            {pokemon.type.slice(0, 2).map((t) => (
              <Badge
                key={t}
                variant="outline"
                className="h-4 px-1 text-[9px] font-normal"
              >
                {t}
              </Badge>
            ))}
            <span
              className="text-[10px] text-muted-foreground"
              translate="no"
            >
              Gen {pokemon.generation}
            </span>
          </div>
        </div>
        {selected ? (
          <Check
            className="size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
        ) : null}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Selected preview — large artwork + name shown beside the form, so admins
// can confirm visually that they picked the right Pokemon (and shiny variant
// if applicable).
// ---------------------------------------------------------------------------

function SelectedPreview({
  pokemon,
  shiny,
  isAlgorithmic,
}: {
  pokemon: PokemonMetadata | null;
  shiny: boolean;
  isAlgorithmic: boolean;
}) {
  if (!pokemon) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
        No Pokémon selected.
      </div>
    );
  }
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0">
          <Image
            src={officialArtworkUrl(pokemon.id, shiny)}
            alt={`${pokemon.name} artwork`}
            fill
            sizes="64px"
            className="object-contain"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="truncate text-sm font-semibold"
              translate="no"
            >
              {pokemon.name}
            </span>
            {shiny ? (
              <Sparkles
                className="size-3 text-amber-500"
                aria-label="Shiny"
              />
            ) : null}
          </div>
          <div
            className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
            translate="no"
          >
            #{pokemon.id.toString().padStart(4, "0")} · Gen{" "}
            {pokemon.generation}
          </div>
          {isAlgorithmic ? (
            <Badge
              variant="outline"
              className="mt-1.5 h-4 gap-0.5 px-1 text-[9px]"
            >
              Matches algorithmic pick
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
