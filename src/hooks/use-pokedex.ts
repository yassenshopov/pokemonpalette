"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

// Shape of a Pokedex entry returned by /api/pokedex.
export interface PokedexEntry {
  id: string;
  pokemon_id: number;
  is_shiny: boolean;
  mode: "daily" | "unlimited";
  attempts: number;
  hints_used: number;
  caught_at: string;
}

// Module-level cache so multiple consumers (page + sidebar badge + game
// dialog) share a single in-flight request. Mirrors `use-saved-palettes`.
type CacheEntry = {
  promise: Promise<PokedexEntry[]>;
  data?: PokedexEntry[];
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

async function fetchEntries(): Promise<PokedexEntry[]> {
  const response = await fetch("/api/pokedex");
  if (!response.ok) {
    if (response.status === 401 || response.status === 503) {
      return [];
    }
    throw new Error(`Failed to load Pokedex (${response.status})`);
  }
  const data = await response.json();
  return (data?.entries ?? []) as PokedexEntry[];
}

function getOrCreateEntry(key: string): CacheEntry {
  let entry = cache.get(key);
  if (!entry) {
    const promise = fetchEntries()
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

export interface UsePokedexResult {
  entries: PokedexEntry[];
  loading: boolean;
  error: unknown;
  refetch: () => Promise<PokedexEntry[]>;
}

/**
 * Returns the current user's Pokedex entries, deduplicated across all
 * mounted consumers. First component to mount fires the request; everyone
 * else reads from the shared cache.
 */
export function usePokedex(): UsePokedexResult {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? "anon";
  const cacheKey = `pokedex:${userId}`;

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

  return {
    entries: entry?.data ?? [],
    loading: !!user && !entry?.data && !entry?.error,
    error: entry?.error,
    refetch,
  };
}
