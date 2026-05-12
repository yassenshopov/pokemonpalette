"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Curated list of microcopy tips. Phrased second-person, concise, with
// curly typography (', …) so they read as polished UI strings rather
// than raw ASCII. Used only on the game page for now.
const TIPS: readonly [string, ...string[]] = [
  "Search works in multiple languages (日本語, Français, Deutsch, Español, and more!)",
  "You can guess by Pokédex number too — try \u201825\u2019 for Pikachu.",
  "Hints get better the more you guess — try a same-type Pok\u00e9mon first.",
  "Stuck? The Pok\u00e9mon\u2019s color palette is your biggest clue. Match the dominant tones.",
  "Use the Filters button to narrow Unlimited mode to specific generations.",
  "Press Esc to close any dialog.",
];

const tipAt = (i: number): string => TIPS[i] ?? TIPS[0];

// Pacing knobs. The hold time is how long the fully-typed tip stays
// on screen before we start erasing. The per-char base + jitter is what
// gives the typing its slightly-organic feel. We cap the *total* typing
// time so very long tips don't stall the rotation: if a tip would take
// longer than `MAX_TYPE_TOTAL_MS` at the base pace, we scale the
// per-char delay down so any tip finishes in roughly that budget.
const HOLD_MS = 5000;
const TYPE_PER_CHAR_MS = 30;
const TYPE_JITTER_MS = 10;
const MIN_CHAR_DELAY_MS = 8;
const MAX_TYPE_TOTAL_MS = 2500;
const ERASE_PER_CHAR_MS = 17;

type Phase = "typing" | "holding" | "erasing";

interface RotatingTipProps {
  className?: string;
}

/**
 * A small marquee that cycles through `TIPS` with a typewriter effect.
 *
 * - Renders deterministically on the server (always `TIPS[0]`, no caret
 *   blink) so the SSR markup is stable; the random starting index, the
 *   reduced-motion preference, and the typing loop are all set up
 *   client-side in a `useEffect`.
 * - Honors `prefers-reduced-motion: reduce`: skips the typewriter
 *   animation entirely (full text in place, swap on rotation) and
 *   freezes the caret as a static visible character so the
 *   `step-end` blink doesn't flash for users who opted out.
 * - Pauses the typing/erasing/holding timers when the document is
 *   hidden so background tabs don't tick.
 * - Screen-reader experience: the visible text region is
 *   `aria-hidden` (so SRs don't read each character as it types) and
 *   a separate `sr-only` `aria-live="polite"` region carries the
 *   *full* tip text. We update that region only when a new tip
 *   starts, so each rotation is announced once as a complete line.
 */
export function RotatingTip({ className }: RotatingTipProps) {
  const [displayText, setDisplayText] = useState<string>(TIPS[0]);
  const [announcedTip, setAnnouncedTip] = useState<string>(TIPS[0]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  // The state machine drives via refs so the loop doesn't re-create on
  // every `setDisplayText` call. `phaseRef` is the source of truth for
  // which step the loop is in; `charPosRef` is the cursor position
  // inside the current tip; `indexRef` mirrors the active TIPS slot.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef<number>(0);
  const charPosRef = useRef<number>(tipAt(0).length);
  const phaseRef = useRef<Phase>("holding");
  const visibleRef = useRef<boolean>(true);

  // Mount-only side effects: pick a random starting tip and sync to
  // the user's reduced-motion preference. Doing this on mount (rather
  // than at module load) keeps SSR markup deterministic.
  useEffect(() => {
    const startIndex = Math.floor(Math.random() * TIPS.length);
    indexRef.current = startIndex;
    charPosRef.current = tipAt(startIndex).length;
    phaseRef.current = "holding";
    setDisplayText(tipAt(startIndex));
    setAnnouncedTip(tipAt(startIndex));

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", onChange);

    setMounted(true);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const clear = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const schedule = (ms: number, fn: () => void) => {
      clear();
      timeoutRef.current = setTimeout(fn, ms);
    };

    // Move to the next tip and push the *full* string into the
    // announcement region so screen readers read the new tip once,
    // not character-by-character.
    const advanceTip = () => {
      const next = (indexRef.current + 1) % TIPS.length;
      indexRef.current = next;
      setAnnouncedTip(tipAt(next));
    };

    const tick = () => {
      if (!visibleRef.current) return;

      // Reduced-motion path: full-text swap, no typing, no erasing.
      if (reducedMotion) {
        const tip = tipAt(indexRef.current);
        charPosRef.current = tip.length;
        phaseRef.current = "holding";
        setDisplayText(tip);
        schedule(HOLD_MS, () => {
          advanceTip();
          tick();
        });
        return;
      }

      switch (phaseRef.current) {
        case "holding":
          phaseRef.current = "erasing";
          schedule(HOLD_MS, eraseStep);
          return;
        case "erasing":
          eraseStep();
          return;
        case "typing":
          typeStep();
          return;
      }
    };

    const eraseStep = () => {
      if (!visibleRef.current) return;
      phaseRef.current = "erasing";
      const pos = charPosRef.current;
      if (pos <= 0) {
        // Done erasing — advance and start typing the next tip on the
        // next tick. We schedule one short delay so the empty caret
        // gets a frame of visibility before typing kicks in.
        advanceTip();
        charPosRef.current = 0;
        phaseRef.current = "typing";
        setDisplayText("");
        schedule(ERASE_PER_CHAR_MS, typeStep);
        return;
      }
      const newPos = pos - 1;
      charPosRef.current = newPos;
      setDisplayText(tipAt(indexRef.current).slice(0, newPos));
      schedule(ERASE_PER_CHAR_MS, eraseStep);
    };

    const typeStep = () => {
      if (!visibleRef.current) return;
      phaseRef.current = "typing";
      const tip = tipAt(indexRef.current);
      const pos = charPosRef.current;
      if (pos >= tip.length) {
        phaseRef.current = "holding";
        setDisplayText(tip);
        schedule(HOLD_MS, () => {
          phaseRef.current = "erasing";
          eraseStep();
        });
        return;
      }
      const newPos = pos + 1;
      charPosRef.current = newPos;
      setDisplayText(tip.slice(0, newPos));

      // Cap the *total* typing time at MAX_TYPE_TOTAL_MS — for very
      // long tips, dial the per-char delay down so the rotation
      // doesn't stall waiting for the tip to finish.
      const cap = MAX_TYPE_TOTAL_MS / Math.max(tip.length, 1);
      const baseDelay = Math.min(TYPE_PER_CHAR_MS, cap);
      const jitter =
        (Math.random() * 2 - 1) * Math.min(TYPE_JITTER_MS, baseDelay * 0.5);
      schedule(Math.max(baseDelay + jitter, MIN_CHAR_DELAY_MS), typeStep);
    };

    visibleRef.current =
      typeof document === "undefined" || document.visibilityState === "visible";

    if (visibleRef.current) tick();

    const onVisibility = () => {
      const next = document.visibilityState === "visible";
      if (next === visibleRef.current) return;
      visibleRef.current = next;
      if (next) {
        // Resume from wherever the state machine left off.
        tick();
      } else {
        clear();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      clear();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [mounted, reducedMotion]);

  return (
    <p
      className={cn(
        "text-xs text-muted-foreground mt-2 text-center",
        className,
      )}
    >
      <span aria-hidden="true">
        💡 Tip: {displayText}
        <span
          aria-hidden="true"
          className={cn(
            "inline-block ml-0.5 align-baseline",
            // Reduced motion: hold the caret static-visible. The blink is
            // a `step-end` animation that some users find distracting,
            // and the spec treats reduced-motion as "no caret blink".
            reducedMotion ? "opacity-100" : "rotating-tip-caret",
          )}
        >
          |
        </span>
      </span>
      <span className="sr-only" aria-live="polite">
        💡 Tip: {announcedTip}
      </span>
      <style>{`
        @keyframes rotating-tip-caret-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .rotating-tip-caret {
          animation: rotating-tip-caret-blink 1s step-end infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .rotating-tip-caret {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </p>
  );
}
