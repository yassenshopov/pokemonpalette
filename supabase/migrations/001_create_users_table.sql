-- Create users table for Clerk sync
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    image_url TEXT,
    profile_image_url TEXT,
    has_image BOOLEAN DEFAULT false,
    primary_email_address_id TEXT,
    primary_phone_number_id TEXT,
    banned BOOLEAN DEFAULT false,
    locked BOOLEAN DEFAULT false,
    backup_code_enabled BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    totp_enabled BOOLEAN DEFAULT false,
    password_enabled BOOLEAN DEFAULT false,
    create_organization_enabled BOOLEAN DEFAULT true,
    delete_self_enabled BOOLEAN DEFAULT true,
    last_active_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    email_addresses JSONB DEFAULT '[]'::jsonb,
    phone_numbers JSONB DEFAULT '[]'::jsonb,
    external_accounts JSONB DEFAULT '[]'::jsonb,
    public_metadata JSONB DEFAULT '{}'::jsonb,
    private_metadata JSONB DEFAULT '{}'::jsonb,
    unsafe_metadata JSONB DEFAULT '{}'::jsonb,
    notion_databases JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON public.users(is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_primary_email_address_id ON public.users(primary_email_address_id);
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON public.users(last_active_at);
CREATE INDEX IF NOT EXISTS idx_users_banned ON public.users(banned);
CREATE INDEX IF NOT EXISTS idx_users_locked ON public.users(locked);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS (adjust based on your needs)
-- Allow users to read their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = id);

-- Allow users to update their own data
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid()::text = id);

-- Allow service role to do everything (for webhooks)
CREATE POLICY "Service role can manage all users" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
