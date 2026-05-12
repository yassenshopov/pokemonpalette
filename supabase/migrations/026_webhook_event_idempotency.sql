-- Webhook idempotency: track which provider events we've already processed.
--
-- Background:
--   Both Stripe and Clerk retry failed webhook deliveries. Without a
--   dedupe table our handlers were not idempotent — every retry of
--   `checkout.session.completed` re-ran the fulfillment path and
--   provisioned a NEW api_key + re-emailed the plaintext secret.
--
-- Shape:
--   Single table keyed by (provider, event_id). Both Stripe's
--   `event.id` and Clerk's `svix-id` are globally unique within their
--   provider, so this is a safe natural key. The table is tiny (one
--   row per real event), but we still add a `received_at` index so an
--   eventual retention job (e.g. drop rows > 90 days) is cheap.
--
-- Race conditions:
--   The webhook handler MUST insert into this table inside the SAME
--   transaction as the side-effects it gates. The primary key conflict
--   is how we detect replays — a unique violation on the insert means
--   another handler already processed this event and we should bail.

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
    provider     TEXT        NOT NULL,
    event_id     TEXT        NOT NULL,
    event_type   TEXT,
    received_at  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_received_at
    ON public.processed_webhook_events(received_at);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role only. No anon / authenticated policies — this table is
-- never accessed from the client. Including the policy keeps Supabase
-- happy with RLS-enabled tables.
CREATE POLICY "Service role can manage processed_webhook_events"
    ON public.processed_webhook_events
    FOR ALL
    USING (auth.role() = 'service_role');

-- ApiCustomer idempotency: scope future "did we already fulfill this
-- session?" lookups to a unique session id so we can use it as the
-- natural idempotency key for the Stripe webhook in addition to the
-- processed_webhook_events table above.
--
-- Existing rows with NULL stripe_session_id are allowed — the unique
-- constraint only fires on NOT NULL distinct duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_customers_stripe_session_id_unique
    ON public.api_customers(stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;
