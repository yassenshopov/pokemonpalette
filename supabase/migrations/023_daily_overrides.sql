-- Daily Pokemon overrides — admin-controlled schedule entries that take
-- precedence over the deterministic hash in `getDailyPokemonIdForDate()`.
--
-- One row per UTC date. The presence of a row means "use this Pokemon
-- and shiny status instead of the algorithmic pick". Removing the row
-- reverts the day to the deterministic schedule.
--
-- The resolver lives in `src/lib/game/daily-target.ts` and is consumed
-- by the game page, the daily-game-attempts POST endpoint, the admin
-- daily detail API, the admin calendar, and the daily palette email.

CREATE TABLE IF NOT EXISTS public.daily_overrides (
    date          DATE PRIMARY KEY,
    pokemon_id    INTEGER NOT NULL CHECK (pokemon_id > 0),
    is_shiny      BOOLEAN NOT NULL DEFAULT false,
    created_by    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    note          TEXT,
    created_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_overrides_date
    ON public.daily_overrides (date);

CREATE INDEX IF NOT EXISTS idx_daily_overrides_created_by
    ON public.daily_overrides (created_by);

-- RLS — admins can manage overrides via the API (which uses the service
-- role). Regular clients should not touch this table directly.

ALTER TABLE public.daily_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all overrides" ON public.daily_overrides
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read their own scheduled overrides so the
-- game page can resolve today's target without needing the service role.
-- We keep this read-only and scoped to today/yesterday at the API layer.
CREATE POLICY "Authenticated users can read overrides" ON public.daily_overrides
    FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
