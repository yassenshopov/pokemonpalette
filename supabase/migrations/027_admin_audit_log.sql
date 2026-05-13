-- Admin audit log: append-only trail of every privileged action.
--
-- Background:
--   Pre-hardening, admin actions (ban / lock / demote / delete / bulk
--   wipe / Pokemon color override / daily override) left no record of
--   WHO did WHAT. If an admin account was compromised, or a junior
--   admin mass-deleted rows, there was no way to attribute, audit, or
--   revert the action — the only forensic trail was the Postgres WAL.
--
-- Shape:
--   One row per admin action, keyed by a synthetic UUID for stable
--   pagination. `before_json` / `after_json` capture the row state
--   immediately surrounding the change so we can answer "what did this
--   row look like five minutes ago" without diving into PITR.
--
-- Indexes:
--   The viewer page filters on (actor, action, target, date range)
--   and orders by `created_at DESC`. A single composite index would
--   bloat without serving any one filter well, so we add per-column
--   indexes plus a `created_at` index that handles the default
--   chronological scan + range filters.
--
-- RLS:
--   Service role only. The audit table is read by the admin app via
--   Prisma (which uses the pooled service role connection); end users
--   never access it directly.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   TEXT NOT NULL,
    -- The kind of action performed. Free-form string so new admin
    -- routes can add their own action names without a migration —
    -- examples: 'user.ban', 'user.unban', 'user.delete', 'user.bulk_lock',
    -- 'saved_palette.delete', 'game_data.bulk_delete', 'pokemon_colors.update',
    -- 'daily_override.upsert', 'daily_override.delete'.
    action          TEXT NOT NULL,
    -- The type of entity acted on. Examples: 'user', 'saved_palette',
    -- 'daily_game_attempt', 'pokemon_colors', 'daily_override'.
    target_type     TEXT NOT NULL,
    -- The id of the target entity. For bulk ops this holds a synthetic
    -- value like 'bulk:23' (count) and the actual id list lives in
    -- `before_json` / `after_json` so we can still attribute the action
    -- to a discoverable set.
    target_id       TEXT NOT NULL,
    -- Pre-change snapshot of the affected row(s). Nullable for actions
    -- that don't have a before state (e.g. creating a daily override on
    -- a previously-unset date).
    before_json     JSONB,
    -- Post-change snapshot. Nullable for soft-deletes / hard-deletes
    -- where there is no "after" — those rows store the doomed values
    -- in `before_json`.
    after_json      JSONB,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Filter indexes for the viewer page.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_user_id
    ON public.admin_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
    ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
    ON public.admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at_desc
    ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role only. No SELECT policy for anon / authenticated — the
-- audit log is consumed exclusively by the admin app via Prisma. We
-- explicitly DO NOT add a "users can read their own audit row" path
-- because actions like "ban" should not be self-reflective.
CREATE POLICY "Service role can manage admin_audit_log"
    ON public.admin_audit_log
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.admin_audit_log IS
    'Append-only audit trail of every privileged admin action.';
COMMENT ON COLUMN public.admin_audit_log.actor_user_id IS
    'Clerk user id of the admin who performed the action.';
COMMENT ON COLUMN public.admin_audit_log.action IS
    'Dot-separated action name, e.g. user.ban, daily_override.upsert.';
COMMENT ON COLUMN public.admin_audit_log.target_type IS
    'Entity type the action operated on (user, saved_palette, etc).';
COMMENT ON COLUMN public.admin_audit_log.target_id IS
    'Stringified id of the target. For bulk ops, "bulk:N" where N is row count.';
COMMENT ON COLUMN public.admin_audit_log.before_json IS
    'Pre-change snapshot of the affected row(s), if any.';
COMMENT ON COLUMN public.admin_audit_log.after_json IS
    'Post-change snapshot of the affected row(s), if any.';
