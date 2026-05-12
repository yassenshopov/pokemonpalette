/**
 * Motion primitives shared by every animated component.
 *
 * Two goals:
 *
 * 1. **Bundle-size**: `gsap` is ~70 KB minified-gzipped. Every page
 *    that statically imports it pays that cost on first paint —
 *    including users on slow networks and users who never see the
 *    animation (off-screen, reduced motion, etc.). The `loadGsap`
 *    helper dynamically imports gsap exactly once per tab and returns
 *    a cached promise, so multiple animated components share the
 *    download.
 *
 * 2. **Accessibility**: `prefersReducedMotion()` is the canonical
 *    runtime check. Components should bail out early when it returns
 *    `true` instead of running animation effects. The hook variant
 *    re-evaluates on `change` so users who flip the OS setting
 *    mid-session see the new behaviour without a reload.
 *
 * Usage:
 *
 *   useEffect(() => {
 *     if (prefersReducedMotion()) return;
 *     let mounted = true;
 *     loadGsap().then(({ gsap }) => {
 *       if (!mounted) return;
 *       gsap.from(ref.current, { opacity: 0, duration: 0.4 });
 *     });
 *     return () => { mounted = false; };
 *   }, []);
 */

import { useEffect, useState } from "react";

let gsapPromise: Promise<typeof import("gsap")> | null = null;

/**
 * Dynamically import gsap. Resolves with the full module so callers
 * can do `({ gsap }) => gsap.to(...)`. Subsequent calls share the
 * same Promise — gsap registers a global plugin state, so we never
 * want to re-import it.
 */
export function loadGsap(): Promise<typeof import("gsap")> {
  if (!gsapPromise) {
    gsapPromise = import("gsap");
  }
  return gsapPromise;
}

/**
 * Synchronous check for the user's reduced-motion preference. Safe
 * to call from any render — returns `false` on the server (where
 * `window` is undefined) so the static path is "animate", matching
 * what users without the OS setting will see.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Reactive hook variant: returns the current preference and updates
 * when the OS setting changes. Use this when you want a component
 * to re-render on toggle (e.g. to hide an animated section
 * entirely). For one-shot animation gating inside `useEffect`,
 * prefer the synchronous `prefersReducedMotion()` to avoid extra
 * re-renders.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    // Different vendor APIs across Safari versions. Modern path first.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Fallback for older Safari (deprecated but still ships).
    type LegacyMQL = MediaQueryList & {
      addListener: (cb: () => void) => void;
      removeListener: (cb: () => void) => void;
    };
    const legacy = mql as LegacyMQL;
    legacy.addListener(onChange);
    return () => legacy.removeListener(onChange);
  }, []);

  return reduced;
}
