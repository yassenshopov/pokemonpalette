-- Email body retention policy.
--
-- Background:
--   The `emails` table preserves every send forever, including
--   `html_content` and `text_content`. That's useful for the first
--   couple of weeks (debugging deliverability, re-rendering bounced
--   templates, etc.) but the bodies accumulate quickly and some of
--   them carry semi-sensitive context — names, sign-in links, future
--   onboarding payloads, and (as a defensive backstop) anything an
--   accidental template change might surface.
--
-- Policy:
--   Bodies are nulled 30 days after `sent_at`. Metadata (recipient,
--   template_type, status, resend_id, sent_at, created_at, …) is
--   preserved for audit purposes. The row itself is never deleted —
--   we still want to be able to answer "did we send X user the
--   onboarding email" indefinitely.
--
-- Function:
--   `prune_email_bodies(retention_days INT)` is parameterised so the
--   admin app can run it ad-hoc with a custom horizon. The Vercel
--   cron job at `/api/cron/prune-email-bodies` calls it with the
--   default (30 days). Returns the number of rows it touched.

CREATE OR REPLACE FUNCTION public.prune_email_bodies(retention_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    affected INT;
BEGIN
    IF retention_days IS NULL OR retention_days < 1 THEN
        RAISE EXCEPTION 'retention_days must be a positive integer (got %)', retention_days;
    END IF;

    UPDATE public.emails
       SET html_content = NULL,
           text_content = NULL
     WHERE sent_at < (timezone('utc'::text, now()) - (retention_days || ' days')::interval)
       AND (html_content IS NOT NULL OR text_content IS NOT NULL);

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.prune_email_bodies(INT) IS
    'Null html_content / text_content for emails older than retention_days. Metadata is preserved.';

-- Lock down EXECUTE — the function is callable by `service_role` only.
-- The admin app (and the cron route) go through the service-role
-- Supabase client; no end-user surface needs to invoke this.
REVOKE ALL ON FUNCTION public.prune_email_bodies(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_email_bodies(INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_email_bodies(INT) TO service_role;
