-- Migration 021: opt-in user geography
--
-- Adds country-level geography to the users table so the admin "Insights"
-- page can show where the audience is. We deliberately keep this minimal:
--
--   * country_code     ISO 3166-1 alpha-2 (e.g. "US", "JP", "DE"). Always
--                      uppercase; capped at 2 chars.
--   * timezone         IANA name (e.g. "America/New_York"). Useful for
--                      future segmentation, not currently rendered.
--   * geo_updated_at   When we last refreshed the row from request
--                      headers. The capture endpoint uses this to throttle
--                      writes to once per ~30 days per user.
--
-- Capture path: a tiny POST /api/me/geo client ping fires once per signed-
-- in session. The route reads Vercel's edge geo headers
-- (`x-vercel-ip-country`, `x-vercel-ip-timezone`) and updates the user row
-- only when the value is missing or older than 30 days. No third-party
-- service, no IP storage, no city/region by default.
--
-- The aggregation RPC `admin_user_geography` returns one row per country
-- with totals + how many of those users were active in the supplied range.
-- Locked to service_role per the convention in migration 014.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS country_code   TEXT,
  ADD COLUMN IF NOT EXISTS timezone       TEXT,
  ADD COLUMN IF NOT EXISTS geo_updated_at TIMESTAMPTZ;

-- Sanity-check the format up front so a stray "US-CA" never sneaks in.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS chk_users_country_code_format;
ALTER TABLE public.users
  ADD  CONSTRAINT chk_users_country_code_format
       CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

CREATE INDEX IF NOT EXISTS idx_users_country_code
  ON public.users (country_code)
  WHERE country_code IS NOT NULL;

COMMENT ON COLUMN public.users.country_code   IS 'ISO 3166-1 alpha-2 country code derived from edge request headers. NULL until first capture.';
COMMENT ON COLUMN public.users.timezone       IS 'IANA timezone name from edge request headers (e.g. America/New_York).';
COMMENT ON COLUMN public.users.geo_updated_at IS 'Last time country_code/timezone were refreshed from request headers.';

-- ---------------------------------------------------------------------------
-- admin_user_geography(p_from, p_to)
-- ---------------------------------------------------------------------------
-- Returns one row per country with all-time counts plus how many of those
-- users were active in the supplied range. "Active" = had at least one
-- attempt or saved palette in [p_from, p_to). The map card on /admin/insights
-- uses the all-time `users` count for choropleth shading and the in-range
-- counts for the live deltas.

CREATE OR REPLACE FUNCTION public.admin_user_geography(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS TABLE (
  country_code      text,
  users             bigint,
  active_in_range   bigint,
  attempts_in_range bigint,
  palettes_in_range bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  active_users AS (
    SELECT DISTINCT user_id FROM public.daily_game_attempts
      WHERE created_at >= p_from AND created_at < p_to
    UNION
    SELECT DISTINCT user_id FROM public.saved_palettes
      WHERE created_at >= p_from AND created_at < p_to
  ),
  attempts_by_user AS (
    SELECT user_id, count(*)::bigint AS c
    FROM public.daily_game_attempts
    WHERE created_at >= p_from AND created_at < p_to
    GROUP BY user_id
  ),
  palettes_by_user AS (
    SELECT user_id, count(*)::bigint AS c
    FROM public.saved_palettes
    WHERE created_at >= p_from AND created_at < p_to
    GROUP BY user_id
  )
  SELECT
    u.country_code,
    count(*)::bigint                                                    AS users,
    count(*) FILTER (WHERE au.user_id IS NOT NULL)::bigint              AS active_in_range,
    COALESCE(sum(ab.c), 0)::bigint                                      AS attempts_in_range,
    COALESCE(sum(pb.c), 0)::bigint                                      AS palettes_in_range
  FROM public.users u
  LEFT JOIN active_users     au ON au.user_id = u.id
  LEFT JOIN attempts_by_user ab ON ab.user_id = u.id
  LEFT JOIN palettes_by_user pb ON pb.user_id = u.id
  WHERE u.is_deleted = false
    AND u.country_code IS NOT NULL
  GROUP BY u.country_code
  ORDER BY users DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_user_geography(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_user_geography(timestamptz, timestamptz)
  TO service_role;
