-- Admin table indexes.
--
-- The admin console moved to server-side pagination, sorting, filtering, and
-- search. These indexes back the hot queries against users, daily_game_attempts,
-- and saved_palettes so large datasets stay fast as they grow.
--
-- Why each index:
--   * `created_at DESC` supports the default "newest first" ordering used by
--     every list view.
--   * Per-user compound indexes (user_id, created_at DESC) serve the detail
--     views which filter by user then sort.
--   * The pg_trgm GIN index on a concatenated user string accelerates the
--     admin search-box ILIKE across email/username/name/id.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users
CREATE INDEX IF NOT EXISTS idx_users_created_at_desc
    ON public.users (created_at DESC)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_users_last_active_at_desc
    ON public.users (last_active_at DESC NULLS LAST)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_users_last_sign_in_at_desc
    ON public.users (last_sign_in_at DESC NULLS LAST)
    WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_users_search_trgm
    ON public.users
    USING gin (
        (
            coalesce(email, '')
            || ' ' || coalesce(username, '')
            || ' ' || coalesce(first_name, '')
            || ' ' || coalesce(last_name, '')
            || ' ' || coalesce(id, '')
        ) gin_trgm_ops
    )
    WHERE is_deleted = false;

-- Daily game attempts
CREATE INDEX IF NOT EXISTS idx_dga_created_at_desc
    ON public.daily_game_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dga_date_target
    ON public.daily_game_attempts (date DESC, target_pokemon_id);

CREATE INDEX IF NOT EXISTS idx_dga_user_created_at_desc
    ON public.daily_game_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dga_target_pokemon_id
    ON public.daily_game_attempts (target_pokemon_id);

-- Saved palettes
CREATE INDEX IF NOT EXISTS idx_saved_palettes_created_at_desc
    ON public.saved_palettes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_palettes_user_created_at_desc
    ON public.saved_palettes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_palettes_pokemon_id
    ON public.saved_palettes (pokemon_id);

CREATE INDEX IF NOT EXISTS idx_saved_palettes_search_trgm
    ON public.saved_palettes
    USING gin (
        (
            coalesce(pokemon_name, '')
            || ' ' || coalesce(palette_name, '')
        ) gin_trgm_ops
    );
