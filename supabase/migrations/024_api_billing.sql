-- API billing: api_customers (one row per paying user) + api_keys.

CREATE TABLE IF NOT EXISTS public.api_customers (
    user_id    TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_session_id  TEXT,
    purchased_at       TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    status             TEXT        DEFAULT 'active' NOT NULL,
    amount_cents       INTEGER     NOT NULL,
    currency           TEXT        DEFAULT 'usd' NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_customers_stripe_customer_id
    ON public.api_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_api_customers_status
    ON public.api_customers(status);

ALTER TABLE public.api_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api_customers row" ON public.api_customers
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can manage all api_customers" ON public.api_customers
    FOR ALL USING (auth.role() = 'service_role');

-- api_keys ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    key_hash    TEXT NOT NULL UNIQUE,
    key_prefix  TEXT NOT NULL,
    name        TEXT,
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id   ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash  ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api_keys" ON public.api_keys
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can manage all api_keys" ON public.api_keys
    FOR ALL USING (auth.role() = 'service_role');
