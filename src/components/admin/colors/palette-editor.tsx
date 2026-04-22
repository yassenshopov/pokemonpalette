"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  extractColorsFromImage,
  type ColorWithFrequency,
} from "@/lib/color-extractor";
import { MAX_PALETTE_SIZE, type Variant } from "./types";
import { SourcePicker } from "./source-picker";

interface PaletteEditorProps {
  /** The palette currently being edited (always length MAX_PALETTE_SIZE). */
  value: string[];
  /** The persisted/baseline palette for the active variant. Used by "Reset". */
  baseline: string[];
  /** The *other* variant's palette, used by "Copy from Normal → Shiny" etc. */
  otherVariant: string[];
  onChange: (next: string[]) => void;
  spriteUrl: string | null;
  /** High-res official artwork, when present. Same image is used for both
   * variants unless `officialShinyArtUrl` is supplied. */
  officialArtUrl?: string | null;
  officialShinyArtUrl?: string | null;
  variant: Variant;
  /** Forwarded to the announcement region when major actions happen. */
  onAnnounce?: (msg: string) => void;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function padPalette(colors: string[]): string[] {
  const out = colors.filter(Boolean).slice(0, MAX_PALETTE_SIZE);
  if (out.length === 0) {
    return Array.from({ length: MAX_PALETTE_SIZE }, () => "#94a3b8");
  }
  while (out.length < MAX_PALETTE_SIZE) {
    out.push(out[out.length - 1] ?? "#94a3b8");
  }
  return out;
}

function isValidHex(v: string): boolean {
  return HEX.test(v);
}

export function PaletteEditor({
  value,
  baseline,
  otherVariant,
  onChange,
  spriteUrl,
  officialArtUrl,
  officialShinyArtUrl,
  variant,
  onAnnounce,
}: PaletteEditorProps) {
  const [extracted, setExtracted] = React.useState<ColorWithFrequency[] | null>(
    null,
  );
  const [extracting, setExtracting] = React.useState(false);
  const [extractError, setExtractError] = React.useState<string | null>(null);

  // Reset extracted preview when the underlying sprite changes.
  React.useEffect(() => {
    setExtracted(null);
    setExtractError(null);
  }, [spriteUrl, variant]);

  const updateSlot = (idx: number, next: string) => {
    const updated = [...value];
    updated[idx] = next;
    onChange(updated);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= MAX_PALETTE_SIZE) return;
    const updated = [...value];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onChange(updated);
  };

  const resetSlot = (idx: number) => {
    const fallback = baseline[idx] ?? value[idx];
    if (!fallback) return;
    updateSlot(idx, fallback);
  };

  const resetAll = () => {
    onChange(padPalette(baseline));
    onAnnounce?.("Palette reset to stored values");
  };

  const copyFromOther = () => {
    if (otherVariant.length === 0) return;
    onChange(padPalette(otherVariant));
    onAnnounce?.(
      variant === "shiny"
        ? "Shiny palette copied from normal"
        : "Normal palette copied from shiny",
    );
  };

  const handleExtract = async () => {
    if (!spriteUrl || extracting) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const colors = (await extractColorsFromImage(
        spriteUrl,
        MAX_PALETTE_SIZE,
        true,
      )) as ColorWithFrequency[];
      setExtracted(colors);
      onAnnounce?.(
        `Extracted ${colors.length} color${colors.length === 1 ? "" : "s"} from sprite`,
      );
    } catch (err) {
      console.error("Failed to extract colors:", err);
      setExtractError("Extraction failed. Try again.");
    } finally {
      setExtracting(false);
    }
  };

  const applyExtracted = () => {
    if (!extracted || extracted.length === 0) return;
    onChange(padPalette(extracted.map((c) => c.hex)));
    onAnnounce?.("Applied extracted palette");
  };

  const applyExtractedSlot = (slotIdx: number, hex: string) => {
    updateSlot(slotIdx, hex);
    onAnnounce?.(`Slot ${slotIdx + 1} set to ${hex.toUpperCase()}`);
  };

  const assignPicked = (slotIdx: number, hex: string) => {
    updateSlot(slotIdx, hex);
  };

  return (
    <div className="space-y-5" aria-label="Palette editor">
      <SourcePicker
        spriteUrl={spriteUrl}
        officialArtUrl={officialArtUrl ?? null}
        officialShinyArtUrl={officialShinyArtUrl ?? null}
        variant={variant}
        onAssign={assignPicked}
        onAnnounce={onAnnounce}
      />

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">
              {variant === "shiny" ? "Shiny palette" : "Palette"}
            </h3>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {MAX_PALETTE_SIZE} slots
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={copyFromOther}
              disabled={otherVariant.length === 0}
              className="h-7 gap-1 text-xs"
            >
              <Copy className="size-3" aria-hidden="true" />
              Copy from {variant === "shiny" ? "normal" : "shiny"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetAll}
              className="h-7 gap-1 text-xs"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Reset all
            </Button>
          </div>
        </div>
        <ul
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          aria-label="Color slots"
        >
          {value.map((hex, idx) => (
            <SlotRow
              key={idx}
              index={idx}
              hex={hex}
              baselineHex={baseline[idx]}
              onHexChange={(next) => updateSlot(idx, next)}
              onMoveUp={() => move(idx, -1)}
              onMoveDown={() => move(idx, 1)}
              onReset={() => resetSlot(idx)}
              canMoveUp={idx > 0}
              canMoveDown={idx < MAX_PALETTE_SIZE - 1}
            />
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">Extract from sprite</h4>
            {variant === "shiny" ? (
              <Sparkles
                className="size-3.5 text-amber-500"
                aria-label="Uses shiny sprite"
              />
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExtract}
              disabled={!spriteUrl || extracting}
              className="h-7 gap-1 text-xs"
            >
              {extracting ? (
                <>
                  <Loader2
                    className="size-3 animate-spin"
                    aria-hidden="true"
                  />
                  Extracting…
                </>
              ) : (
                <>
                  <Wand2 className="size-3" aria-hidden="true" />
                  Re-extract
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={applyExtracted}
              disabled={!extracted || extracted.length === 0 || extracting}
              className="h-7 text-xs"
            >
              Apply all
            </Button>
          </div>
        </div>

        {extractError ? (
          <p
            role="alert"
            aria-live="polite"
            className="mt-2 text-xs text-destructive"
          >
            {extractError}
          </p>
        ) : null}

        <div className="mt-3">
          {extracted === null ? (
            <p className="text-xs text-muted-foreground">
              Extract to preview what the algorithm would produce, then click a
              swatch to drop it into a specific slot.
            </p>
          ) : extracted.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              The extractor returned no colors — the sprite may be fully
              transparent.
            </p>
          ) : (
            <ul
              className="flex flex-wrap gap-1.5"
              aria-label="Extracted colors"
            >
              {extracted.map((c, i) => (
                <li key={`${c.hex}-${i}`}>
                  <ExtractedChip
                    hex={c.hex}
                    percentage={c.percentage ?? c.frequency}
                    onAssign={(slot) => applyExtractedSlot(slot, c.hex)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface SlotRowProps {
  index: number;
  hex: string;
  baselineHex: string | undefined;
  onHexChange: (hex: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReset: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function SlotRow({
  index,
  hex,
  baselineHex,
  onHexChange,
  onMoveUp,
  onMoveDown,
  onReset,
  canMoveUp,
  canMoveDown,
}: SlotRowProps) {
  // Local draft lets the admin freely type invalid hex strings without
  // fighting a controlled input. We commit upstream only once the value
  // becomes a valid 6-digit hex.
  const [draft, setDraft] = React.useState(hex);
  React.useEffect(() => {
    setDraft(hex);
  }, [hex]);

  const valid = isValidHex(draft);
  const dirty = baselineHex ? baselineHex.toLowerCase() !== hex.toLowerCase() : false;

  const commit = (v: string) => {
    const trimmed = v.trim();
    const normalized =
      trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (isValidHex(normalized)) {
      onHexChange(normalized.toLowerCase());
    }
  };

  return (
    <li
      className={cn(
        "group flex items-center gap-2 rounded-md border bg-card p-2",
        "transition-colors focus-within:ring-2 focus-within:ring-ring/50",
      )}
    >
      <label className="sr-only" htmlFor={`slot-input-${index}`}>
        Hex for color slot {index + 1}
      </label>
      <div
        className="relative size-10 shrink-0 overflow-hidden rounded-md border"
        aria-label={`Color ${index + 1} swatch, ${hex.toUpperCase()}`}
      >
        <span
          className="absolute inset-0"
          style={{ backgroundColor: valid ? draft : hex }}
          aria-hidden="true"
        />
        <input
          type="color"
          value={valid ? draft : hex}
          onChange={(e) => {
            setDraft(e.target.value);
            onHexChange(e.target.value.toLowerCase());
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Pick color for slot ${index + 1}`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span className="font-mono tabular-nums" translate="no">
            Slot {index + 1}
          </span>
          {dirty ? (
            <span
              className="size-1.5 rounded-full bg-amber-500"
              aria-label="Unsaved change in this slot"
              title="Unsaved"
            />
          ) : null}
        </div>
        <Input
          id={`slot-input-${index}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            commit(e.target.value);
            setDraft((d) => (isValidHex(d.startsWith("#") ? d : `#${d}`) ? d : hex));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
          pattern="^#?[0-9a-fA-F]{6}$"
          className={cn(
            "h-7 font-mono text-xs tabular-nums",
            !valid && "border-destructive focus-visible:ring-destructive/30",
          )}
          placeholder="#RRGGBB…"
          translate="no"
          aria-invalid={!valid}
          aria-describedby={
            !valid ? `slot-error-${index}` : undefined
          }
        />
        {!valid ? (
          <span
            id={`slot-error-${index}`}
            className="mt-0.5 block text-[10px] text-destructive"
          >
            Enter a valid #RRGGBB hex.
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Move slot ${index + 1} up`}
        >
          <ArrowUp className="size-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Move slot ${index + 1} down`}
        >
          <ArrowDown className="size-3" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={!dirty}
        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={`Reset slot ${index + 1} to stored value`}
      >
        <RotateCcw className="size-3" aria-hidden="true" />
      </button>
    </li>
  );
}

interface ExtractedChipProps {
  hex: string;
  percentage: number;
  onAssign: (slot: number) => void;
}

function ExtractedChip({ hex, percentage, onAssign }: ExtractedChipProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-1 text-[11px] font-mono tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Assign ${hex.toUpperCase()} (${percentage.toFixed(1)}%) to a slot`}
        translate="no"
      >
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded border"
          style={{ backgroundColor: hex }}
        />
        <span>{hex.toUpperCase()}</span>
        <span className="text-muted-foreground">
          {percentage.toFixed(1)}%
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 flex w-max gap-1 rounded-md border bg-popover p-1 text-xs shadow-md"
        >
          <span className="px-1.5 py-1 text-muted-foreground">Assign to:</span>
          {Array.from({ length: MAX_PALETTE_SIZE }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                onAssign(i);
                setOpen(false);
              }}
              className="flex size-6 items-center justify-center rounded font-mono tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Slot ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
