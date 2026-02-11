"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import type { PaletteSize } from "@/constants/pokemon";
import {
  PALETTE_SIZE_OPTIONS,
  getStoredPaletteSize,
  setStoredPaletteSize,
} from "@/constants/pokemon";

/**
 * Returns the user's palette size (3, 4, 5, or 6). When signed in, uses the
 * account API; when signed out, uses localStorage. Persists the same way other
 * account settings do.
 */
export function usePaletteSize(): [PaletteSize, (size: PaletteSize) => void] {
  const { user, isLoaded } = useUser();
  const [paletteSize, setPaletteSizeState] = useState<PaletteSize>(3);

  const fetchFromApi = useCallback(() => {
    if (!user?.id) return;
    fetch("/api/account/palette-preference")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const n = data?.paletteSize;
        if (typeof n === "number" && PALETTE_SIZE_OPTIONS.includes(n as PaletteSize)) {
          setPaletteSizeState(n as PaletteSize);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Load from API (signed in) or localStorage (signed out); refetch on focus so changes in Account Settings apply
  useEffect(() => {
    if (!isLoaded) return;

    if (user?.id) {
      fetchFromApi();
      const onFocus = () => fetchFromApi();
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    } else {
      setPaletteSizeState(getStoredPaletteSize());
    }
  }, [isLoaded, user?.id, fetchFromApi]);

  // Listen for updates from Account Settings (same tab)
  useEffect(() => {
    const onPreferenceChange = (e: Event) => {
      const n = (e as CustomEvent<number>).detail;
      if (typeof n === "number" && PALETTE_SIZE_OPTIONS.includes(n as PaletteSize)) {
        setPaletteSizeState(n as PaletteSize);
      }
    };
    window.addEventListener("palette-preference-changed", onPreferenceChange);
    return () => window.removeEventListener("palette-preference-changed", onPreferenceChange);
  }, []);

  const setPaletteSize = useCallback(
    async (size: PaletteSize) => {
      setPaletteSizeState(size);
      setStoredPaletteSize(size);

      if (user?.id) {
        try {
          await fetch("/api/account/palette-preference", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paletteSize: size }),
          });
        } catch {
          // Non-blocking; local state and localStorage already updated
        }
      }
    },
    [user?.id]
  );

  return [paletteSize, setPaletteSize];
}
