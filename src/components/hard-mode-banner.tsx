"use client";

import { useState, useEffect } from "react";
import { Skull, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContrastHex as getTextColor } from "@/lib/game/colors";

/**
 * Storage key for the hard-mode launch banner. Versioned (`-v1`) so future
 * relaunch announcements can re-prompt every player by bumping the suffix
 * without colliding with this one. Cookie wasn't a fit because the rest
 * of the game page already keeps tutorial / catch state in localStorage,
 * so this keeps single-namespace consistency.
 */
const STORAGE_KEY = "pokemon-palette-hard-mode-banner-seen-v1";

/**
 * Fired by the game page when the player engages with the Hard tab — the
 * banner listens for it and auto-retires so the announcement gets out of
 * the way the moment its job is done. Custom event keeps the two
 * components decoupled (banner doesn't need a callback prop drilled in).
 */
export const HARD_MODE_BANNER_DISMISS_EVENT =
  "pokemon-palette:hard-mode-banner-dismiss";

interface HardModeBannerProps {
  /**
   * Optional accent color for the row background. Defaults to a calm,
   * brand-adjacent red that nods at the Hard tab's skull icon. Daily
   * mode passes the current target palette's primary color so the
   * banner harmonizes with whatever's on screen below it.
   */
  primaryColor?: string;
}

export function HardModeBanner({ primaryColor }: HardModeBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // On mount: read localStorage to see if the user has already retired
  // the banner. We start the entry animation only after this check so
  // the SSR/CSR hydration cycle doesn't briefly flash the banner for
  // players who'd already dismissed it on a previous visit.
  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (seen) {
        setIsDismissed(true);
        return;
      }
    } catch {
      // localStorage unavailable (Safari private mode, hardened
      // browsers). Hide the banner rather than risk pestering — the
      // feature is also surfaced via the Hard tab itself.
      setIsDismissed(true);
      return;
    }
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Drive the exit animation when the user dismisses; we wait for the
  // transition to finish before unmounting so the row collapses
  // smoothly instead of yanking off the top of the page.
  useEffect(() => {
    if (!isExiting) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Best-effort persistence — the banner still hides for this
      // session even if storage write fails.
    }
    const timer = setTimeout(() => setIsDismissed(true), 300);
    return () => clearTimeout(timer);
  }, [isExiting]);

  // External dismissal — the game page fires this when the player taps
  // the Hard tab, so engaging with the feature retires the banner too.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      // If we're already gone or animating out, ignore — no need to
      // re-trigger the exit transition.
      if (isExiting || isDismissed) return;
      setIsExiting(true);
    };
    window.addEventListener(HARD_MODE_BANNER_DISMISS_EVENT, handler);
    return () =>
      window.removeEventListener(HARD_MODE_BANNER_DISMISS_EVENT, handler);
  }, [isExiting, isDismissed]);

  if (isDismissed) return null;

  // Calm brand red by default — sampled to match the Hard tab skull
  // without screaming for attention. Daily mode passes the target's
  // primary color, which lets the banner harmonize with the puzzle
  // currently rendering below.
  const bg = primaryColor ?? "#b91c1c";
  const fg = getTextColor(bg);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative w-full overflow-hidden transition-[opacity,transform,max-height,padding] duration-300 ease-in-out ${
        isExiting
          ? "opacity-0 -translate-y-full max-h-0 py-0"
          : isMounted
            ? "opacity-100 translate-y-0 max-h-24 py-2"
            : "opacity-0 -translate-y-full max-h-0 py-0"
      }`}
      style={{ backgroundColor: bg, color: fg }}
    >
      <div className="px-4 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 hover:opacity-70 order-first md:order-last"
          style={{ color: fg }}
          onClick={() => setIsExiting(true)}
          aria-label="Dismiss hard mode announcement"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-sm font-heading order-last md:order-first flex items-center gap-2 min-w-0">
          <Skull className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="truncate sm:whitespace-normal">
            <span className="font-semibold">New!</span>{" "}
            <span className="opacity-90">
              Hard mode is live for the daily game — full Pokédex (Gens
              1–9) with surprise shinies. Tap the Hard tab to play it.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
