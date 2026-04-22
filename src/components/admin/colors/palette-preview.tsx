"use client";

import * as React from "react";
import Image from "next/image";
import { Eye, EyeOff, Lightbulb, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getContrastHex, getDimmedColor } from "@/lib/game/colors";
import { cn } from "@/lib/utils";

interface PalettePreviewProps {
  /** Live palette the admin is editing. Deduped + trimmed to 6 here. */
  colors: string[];
  spriteUrl: string | null;
  pokemonName: string;
  pokemonId: number;
  hints: string[];
  isShiny: boolean;
}

/**
 * Approximates the width distribution produced by the sprite color extractor
 * at game time. Players always see the palette weighted by prevalence rather
 * than evenly, so an equal-width strip would misrepresent the challenge.
 */
function weightedWidths(count: number): number[] {
  const raw = Array.from({ length: count }, (_, i) => 1 / (i + 1.2));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => (r / sum) * 100);
}

function dedupe(colors: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of colors) {
    const v = (c ?? "").toLowerCase();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

export function PalettePreview({
  colors,
  spriteUrl,
  pokemonName,
  pokemonId,
  hints,
  isShiny,
}: PalettePreviewProps) {
  const [revealed, setRevealed] = React.useState(false);

  const swatches = React.useMemo(() => dedupe(colors, 6), [colors]);
  const widths = React.useMemo(
    () => weightedWidths(swatches.length),
    [swatches.length],
  );

  const primary = swatches[0] ?? "#e5e7eb";
  const onPrimary = getContrastHex(primary);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-card"
      aria-label="Player preview"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Target
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            As players see it
          </h3>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            Live preview
          </Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-[11px]"
          onClick={() => setRevealed((r) => !r)}
          aria-pressed={revealed}
        >
          {revealed ? (
            <>
              <EyeOff className="size-3" aria-hidden="true" />
              Hide answer
            </>
          ) : (
            <>
              <Eye className="size-3" aria-hidden="true" />
              Reveal answer
            </>
          )}
        </Button>
      </div>

      <div className="m-3 overflow-hidden rounded-md border bg-card">
        <div
          className="relative flex h-16 w-full overflow-hidden"
          aria-label="Weighted color bar players see"
          role="img"
        >
          {swatches.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Add colors to see the preview
            </div>
          ) : (
            swatches.map((hex, i) => (
              <div
                key={`${hex}-${i}`}
                className="h-full"
                style={{ backgroundColor: hex, width: `${widths[i]}%` }}
                title={hex.toUpperCase()}
              />
            ))
          )}
        </div>

        <div className="space-y-3 p-3">
          <ul
            className="flex flex-col items-end gap-1"
            aria-label="Hints players would see"
          >
            {hints.length === 0 ? (
              <li className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lightbulb className="size-3" aria-hidden="true" />
                No hints yet — all categories disabled.
              </li>
            ) : (
              hints.map((hint, i) => (
                <li key={`${hint}-${i}`}>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-6 max-w-full whitespace-normal rounded-full border-2 px-2 text-right text-[11px] font-normal leading-tight",
                    )}
                    style={{
                      borderColor: primary,
                      backgroundColor: getDimmedColor(primary, 0.12),
                      color: primary,
                    }}
                  >
                    {hint}
                  </Badge>
                </li>
              ))
            )}
          </ul>

          {revealed ? (
            <div className="flex items-center gap-3 border-t pt-3">
              <div className="relative size-20 shrink-0">
                {spriteUrl ? (
                  <Image
                    src={spriteUrl}
                    alt={`${pokemonName} sprite`}
                    fill
                    sizes="80px"
                    className="object-contain"
                    style={{ imageRendering: "pixelated" }}
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                    No sprite
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4
                  className="text-base font-bold capitalize"
                  translate="no"
                >
                  {pokemonName}
                </h4>
                <div
                  className="mt-0.5 text-xs text-muted-foreground tabular-nums"
                  translate="no"
                >
                  #{pokemonId.toString().padStart(3, "0")}
                  {isShiny ? " · Shiny" : ""}
                </div>
                <div
                  className="mt-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: primary,
                    color: onPrimary,
                  }}
                  translate="no"
                >
                  {primary.toUpperCase()}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 border-t py-2 text-[11px] text-muted-foreground">
              <span>Pokémon hidden while players are guessing.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
