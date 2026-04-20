"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

// Shape of a saved palette row returned by /api/saved-palettes.
// Kept as `any` to avoid churning types when the server row evolves.
export type SavedPalette = Record<string, any> & {
  id: string;
  pokemon_id: number;
  is_shiny: boolean;
  pokemon_form?: string | null;
};

// Module-level cache so every component that asks for the current user's
// saved palettes shares a single in-flight request per page load. Previously
// `PokemonHero`, `SavedPalettesDialog`, `CollapsibleSidebar`, etc. each
// re-issued `GET /api/saved-palettes` on mount, producing one edge request
// per component instance.
type CacheEntry = {
  promise: Promise<SavedPalette[]>;
  data?: SavedPalette[];
  error?: unknown;
};

const cache = new Map<string, CacheEntry>();
const subscribers = new Map<string, Set<() => void>>();

function notify(key: string) {
  subscribers.get(key)?.forEach((cb) => cb());
}

function subscribe(key: string, cb: () => void) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key)!.add(cb);
  return () => {
    subscribers.get(key)?.delete(cb);
  };
}

async function fetchPalettes(): Promise<SavedPalette[]> {
  const response = await fetch("/api/saved-palettes");
  if (!response.ok) {
    // 401/503 are expected (signed-out user, auth service down). Resolve with
    // an empty list so callers don't blow up; the consumer hook still exposes
    // the non-ok status via its error slot if callers want it.
    if (response.status === 401 || response.status === 503) {
      return [];
    }
    throw new Error(`Failed to load saved palettes (${response.status})`);
  }
  const data = await response.json();
  return (data?.palettes ?? []) as SavedPalette[];
}

function getOrCreateEntry(key: string): CacheEntry {
  let entry = cache.get(key);
  if (!entry) {
    const promise = fetchPalettes()
      .then((data) => {
        const current = cache.get(key);
        if (current) {
          current.data = data;
          delete current.error;
        }
        notify(key);
        return data;
      })
      .catch((err) => {
        const current = cache.get(key);
        if (current) {
          current.error = err;
        }
        notify(key);
        throw err;
      });
    entry = { promise };
    cache.set(key, entry);
  }
  return entry;
}

export interface UseSavedPalettesResult {
  palettes: SavedPalette[];
  loading: boolean;
  error: unknown;
  refetch: () => Promise<SavedPalette[]>;
  mutate: (updater: (prev: SavedPalette[]) => SavedPalette[]) => void;
}

/**
 * Returns the current user's saved palettes, deduplicated across all
 * mounted consumers. First component to mount fires the request; everyone
 * else reads from the shared cache.
 */
export function useSavedPalettes(): UseSavedPalettesResult {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? "anon";
  const cacheKey = `palettes:${userId}`;

  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribe(cacheKey, () => setTick((n) => n + 1));
  }, [cacheKey]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) return;
    getOrCreateEntry(cacheKey);
  }, [cacheKey, isLoaded, user]);

  const entry = cache.get(cacheKey);

  const refetch = useCallback(async () => {
    cache.delete(cacheKey);
    const next = getOrCreateEntry(cacheKey);
    return next.promise;
  }, [cacheKey]);

  const mutate = useCallback(
    (updater: (prev: SavedPalette[]) => SavedPalette[]) => {
      const current = cache.get(cacheKey);
      const prev = current?.data ?? [];
      const nextData = updater(prev);
      cache.set(cacheKey, {
        promise: Promise.resolve(nextData),
        data: nextData,
      });
      notify(cacheKey);
    },
    [cacheKey]
  );

  return {
    palettes: entry?.data ?? [],
    loading: !!user && !entry?.data && !entry?.error,
    error: entry?.error,
    refetch,
    mutate,
  };
}
