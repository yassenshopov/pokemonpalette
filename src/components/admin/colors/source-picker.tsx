"use client";

import * as React from "react";
import { Crosshair, ImageOff, Loader2, Pipette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_PALETTE_SIZE, type Variant } from "./types";

type Source = "sprite" | "official";

interface SourcePickerProps {
  /** The active variant's sprite (PokéAPI pixel art). */
  spriteUrl: string | null;
  /** Official artwork — same for both variants; we gray out shiny when
   * official shiny artwork isn't on file (it usually isn't). */
  officialArtUrl: string | null;
  /** Optional shiny official artwork; if present we let the admin
   * preview it on the shiny variant. */
  officialShinyArtUrl?: string | null;
  variant: Variant;
  onAssign: (slot: number, hex: string) => void;
  onAnnounce?: (msg: string) => void;
}

interface NativeEyeDropper {
  open: () => Promise<{ sRGBHex: string }>;
}

declare global {
  interface Window {
    EyeDropper?: new () => NativeEyeDropper;
  }
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function SourcePicker({
  spriteUrl,
  officialArtUrl,
  officialShinyArtUrl,
  variant,
  onAssign,
  onAnnounce,
}: SourcePickerProps) {
  const [source, setSource] = React.useState<Source>("sprite");
  const [picking, setPicking] = React.useState(false);
  const [hoverHex, setHoverHex] = React.useState<string | null>(null);
  const [pickedHex, setPickedHex] = React.useState<string | null>(null);
  const [loadState, setLoadState] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  // Prefer whichever URL is populated. If the requested source is missing we
  // still render the fallback so the admin never hits a blank panel.
  const resolvedUrl = React.useMemo(() => {
    if (source === "sprite") {
      return spriteUrl ?? (variant === "shiny" ? officialShinyArtUrl : officialArtUrl) ?? null;
    }
    if (variant === "shiny") {
      return officialShinyArtUrl ?? officialArtUrl ?? spriteUrl ?? null;
    }
    return officialArtUrl ?? spriteUrl ?? null;
  }, [source, variant, spriteUrl, officialArtUrl, officialShinyArtUrl]);

  const hasOfficialArt = Boolean(
    variant === "shiny" ? officialShinyArtUrl ?? officialArtUrl : officialArtUrl,
  );

  // Decode the resolved URL into an offscreen canvas so we can read pixel
  // colors cheaply on pointer move/click. Bailing to the native browser
  // cache keeps this light for repeated toggles.
  React.useEffect(() => {
    if (!resolvedUrl) {
      setLoadState("idle");
      return;
    }
    setLoadState("loading");
    setPickedHex(null);
    let aborted = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (aborted) return;
      try {
        const canvas = canvasRef.current ?? document.createElement("canvas");
        canvasRef.current = canvas;
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas 2D unavailable");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        // Touch a pixel so we fail here (rather than later) if the server
        // didn't return the CORS headers that permit pixel reads.
        ctx.getImageData(0, 0, 1, 1);
        setLoadState("ready");
      } catch (err) {
        console.warn("SourcePicker canvas decode failed:", err);
        setLoadState("error");
      }
    };
    img.onerror = () => {
      if (!aborted) setLoadState("error");
    };
    img.src = resolvedUrl;
    return () => {
      aborted = true;
    };
  }, [resolvedUrl]);

  React.useEffect(() => {
    // Exit pick mode whenever the underlying image or source switches so
    // the admin isn't stuck in a stale "picking" state against a blank canvas.
    setPicking(false);
    setHoverHex(null);
  }, [resolvedUrl]);

  const sampleAt = React.useCallback(
    (clientX: number, clientY: number): string | null => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return null;
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      // The rendered image letterboxes its natural aspect ratio inside the
      // container via `object-contain`. Work out the on-screen content box
      // before translating into canvas coordinates.
      const natural = { w: canvas.width, h: canvas.height };
      const scale = Math.min(
        rect.width / natural.w,
        rect.height / natural.h,
      );
      const renderedW = natural.w * scale;
      const renderedH = natural.h * scale;
      const offsetX = rect.left + (rect.width - renderedW) / 2;
      const offsetY = rect.top + (rect.height - renderedH) / 2;
      const cx = Math.floor(((clientX - offsetX) / renderedW) * natural.w);
      const cy = Math.floor(((clientY - offsetY) / renderedH) * natural.h);
      if (cx < 0 || cx >= natural.w || cy < 0 || cy >= natural.h) return null;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      const data = ctx.getImageData(cx, cy, 1, 1).data;
      const r = data[0];
      const g = data[1];
      const b = data[2];
      const a = data[3];
      if (r === undefined || g === undefined || b === undefined || a === undefined) {
        return null;
      }
      if (a < 20) return null;
      return toHex(r, g, b);
    },
    [],
  );

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!picking || loadState !== "ready") return;
    const hex = sampleAt(e.clientX, e.clientY);
    setHoverHex(hex);
  };

  const handleClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!picking || loadState !== "ready") return;
    const hex = sampleAt(e.clientX, e.clientY);
    if (hex) {
      setPickedHex(hex);
      onAnnounce?.(`Picked ${hex.toUpperCase()} — choose a slot to assign.`);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!picking) return;
    if (e.key === "Escape") {
      setPicking(false);
      setHoverHex(null);
    }
  };

  const tryNativeEyedropper = async () => {
    if (typeof window === "undefined" || !window.EyeDropper) {
      onAnnounce?.("Your browser doesn't support the native eyedropper.");
      return;
    }
    try {
      const result = await new window.EyeDropper().open();
      const hex = result.sRGBHex.toLowerCase();
      setPickedHex(hex);
      onAnnounce?.(`Picked ${hex.toUpperCase()} from screen.`);
    } catch {
      // User dismissed — no-op.
    }
  };

  const assign = (slot: number) => {
    if (!pickedHex) return;
    onAssign(slot, pickedHex);
    onAnnounce?.(`Assigned ${pickedHex.toUpperCase()} to slot ${slot + 1}.`);
  };

  return (
    <section
      className="rounded-lg border bg-card"
      aria-label="Source artwork and color picker"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Source artwork</h3>
          {variant === "shiny" ? (
            <Sparkles
              className="size-3.5 text-amber-500"
              aria-label="Shiny variant"
            />
          ) : null}
        </div>
        <div
          role="radiogroup"
          aria-label="Artwork source"
          className="inline-flex rounded-md border bg-background p-0.5"
        >
          <SourceToggle
            active={source === "sprite"}
            onClick={() => setSource("sprite")}
            disabled={!spriteUrl}
          >
            Sprite
          </SourceToggle>
          <SourceToggle
            active={source === "official"}
            onClick={() => setSource("official")}
            disabled={!hasOfficialArt}
          >
            Official art
          </SourceToggle>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div
          role={picking ? "button" : undefined}
          tabIndex={picking ? 0 : -1}
          aria-label={
            picking
              ? "Move the cursor over the artwork to sample a color. Press Escape to cancel."
              : undefined
          }
          aria-live="polite"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverHex(null)}
          onClick={handleClick}
          onKeyDown={handleKey}
          className={cn(
            // Give the admin a sizeable canvas to pick from — pixel sprites
            // scale crisply via `image-rendering: pixelated`, and the square
            // aspect ratio keeps official artwork uncropped.
            "relative mx-auto flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded-md border bg-muted/30 sm:max-w-lg lg:max-w-xl",
            picking && "cursor-crosshair ring-2 ring-primary/70",
            !picking && "cursor-default",
          )}
          style={{
            backgroundImage:
              "repeating-conic-gradient(var(--muted) 0 25%, transparent 0 50%)",
            backgroundSize: "16px 16px",
            touchAction: "none",
          }}
        >
          {resolvedUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={resolvedUrl}
                alt={`${source === "sprite" ? "Sprite" : "Official artwork"} source image`}
                // `object-contain` lets tiny pixel sprites scale up to fill
                // the larger canvas without distorting their aspect ratio.
                className="h-full w-full select-none object-contain"
                style={{
                  imageRendering: source === "sprite" ? "pixelated" : "auto",
                }}
                draggable={false}
                crossOrigin="anonymous"
              />
              {loadState === "loading" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground"
                    aria-label="Loading artwork"
                  />
                </div>
              ) : null}
              {picking && hoverHex ? (
                <div
                  className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md border bg-background/90 px-2 py-1 text-[11px] shadow-sm backdrop-blur-sm"
                  translate="no"
                >
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded border"
                    style={{ backgroundColor: hoverHex }}
                  />
                  <span className="font-mono tabular-nums">
                    {hoverHex.toUpperCase()}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
              <ImageOff className="size-6" aria-hidden="true" />
              <span>No artwork available for this variant.</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={picking ? "default" : "outline"}
              disabled={loadState !== "ready"}
              onClick={() => {
                if (loadState !== "ready") return;
                setPicking((p) => !p);
                setHoverHex(null);
              }}
              className="h-7 gap-1 text-xs"
              aria-pressed={picking}
              aria-label={picking ? "Stop picking color" : "Pick color from artwork"}
            >
              <Pipette className="size-3" aria-hidden="true" />
              {picking ? "Picking…" : "Pick color"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={tryNativeEyedropper}
              className="h-7 gap-1 text-xs"
              aria-label="Pick any color on screen"
              title="Pick any color on screen (Chrome / Edge)"
            >
              <Crosshair className="size-3" aria-hidden="true" />
              Screen
            </Button>
          </div>
          {loadState === "error" ? (
            <span
              className="text-[11px] text-destructive"
              role="alert"
              aria-live="polite"
            >
              Could not decode image (CORS). Try the other source.
            </span>
          ) : loadState === "loading" ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              Decoding…
            </span>
          ) : null}
        </div>

        {pickedHex ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
            <span
              aria-hidden="true"
              className="size-6 shrink-0 rounded border"
              style={{ backgroundColor: pickedHex }}
            />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span
                className="font-mono text-xs tabular-nums"
                translate="no"
              >
                {pickedHex.toUpperCase()}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Assign to slot
              </span>
            </div>
            <div
              className="flex items-center gap-0.5"
              role="group"
              aria-label="Slot assignment"
            >
              {Array.from({ length: MAX_PALETTE_SIZE }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => assign(i)}
                  className="flex size-6 items-center justify-center rounded font-mono text-xs tabular-nums hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Assign ${pickedHex.toUpperCase()} to slot ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => setPickedHex(null)}
              aria-label="Clear picked color"
            >
              Clear
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Toggle <span className="font-medium">Pick color</span>, then click
            anywhere on the artwork. Press <kbd className="font-mono">Esc</kbd>{" "}
            to cancel.
          </p>
        )}
      </div>
    </section>
  );
}

interface SourceToggleProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function SourceToggle({
  active,
  disabled,
  onClick,
  children,
}: SourceToggleProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
