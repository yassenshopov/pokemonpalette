-- Pokedex entries — one row per (user, pokemon, variant) caught.
--
-- Whenever a player guesses the correct Pokemon in any game mode (daily or
-- unlimited), we record a Pokedex catch. The same Pokemon can be caught up
-- to twice — once in its normal form and once in its shiny form — so the
-- uniqueness key is `(user_id, pokemon_id, is_shiny)`.
--
-- We intentionally do NOT update on subsequent catches. The first catch is
-- "the moment", and the stats it records (mode / attempts / hints_used)
-- describe how the player earned that entry. Re-catching the same variant
-- is a no-op insert via ON CONFLICT DO NOTHING at the API layer.

CREATE TABLE IF NOT EXISTS public.pokedex_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pokemon_id  INTEGER NOT NULL CHECK (pokemon_id > 0),
    is_shiny    BOOLEAN NOT NULL DEFAULT false,
    -- 'daily' | 'unlimited'. Multiplayer is intentionally excluded — that
    -- mode is competitive PvP and shouldn't fast-track Pokedex completion.
    mode        TEXT NOT NULL CHECK (mode IN ('daily', 'unlimited')),
    -- How many guesses it took to catch this entry (1-4 in normal play).
    -- Capped above the game's MAX_ATTEMPTS for forward-compat / mode tweaks.
    attempts    INTEGER NOT NULL CHECK (attempts BETWEEN 1 AND 8),
    hints_used  INTEGER NOT NULL DEFAULT 0 CHECK (hints_used BETWEEN 0 AND 10),
    caught_at   TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, pokemon_id, is_shiny)
);

CREATE INDEX IF NOT EXISTS idx_pokedex_entries_user_id
    ON public.pokedex_entries (user_id);

CREATE INDEX IF NOT EXISTS idx_pokedex_entries_user_caught_at_desc
    ON public.pokedex_entries (user_id, caught_at DESC);

CREATE INDEX IF NOT EXISTS idx_pokedex_entries_pokemon_id
    ON public.pokedex_entries (pokemon_id);

ALTER TABLE public.pokedex_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pokedex entries" ON public.pokedex_entries
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own pokedex entries" ON public.pokedex_entries
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Service role can manage all pokedex entries" ON public.pokedex_entries
    FOR ALL USING (auth.role() = 'service_role');
