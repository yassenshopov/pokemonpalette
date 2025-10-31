# 🗄️ Supabase Database Setup

## Step 1: Run the SQL Migration

1. **Go to your Supabase Dashboard**
2. **Navigate to**: SQL Editor
3. **Copy and paste** the following SQL:

```sql
-- Create users table for Clerk sync
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    notion_databases JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON public.users(is_deleted);

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
```

4. **Click "Run"** to execute the SQL

## Step 2: Verify Table Creation

1. Go to **Table Editor** in Supabase Dashboard
2. You should see a `users` table with the following columns:
   - `id` (text, primary key)
   - `email` (text, nullable)
   - `first_name` (text, nullable)
   - `last_name` (text, nullable)
   - `username` (text, nullable)
   - `image_url` (text, nullable)
   - `profile_image_url` (text, nullable)
   - `has_image` (boolean, default false)
   - `primary_email_address_id` (text, nullable)
   - `primary_phone_number_id` (text, nullable)
   - `banned` (boolean, default false)
   - `locked` (boolean, default false)
   - `backup_code_enabled` (boolean, default false)
   - `two_factor_enabled` (boolean, default false)
   - `totp_enabled` (boolean, default false)
   - `password_enabled` (boolean, default false)
   - `create_organization_enabled` (boolean, default true)
   - `delete_self_enabled` (boolean, default true)
   - `last_active_at` (timestamptz, nullable)
   - `last_sign_in_at` (timestamptz, nullable)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)
   - `is_deleted` (boolean, default false)
   - `email_addresses` (jsonb, default [])
   - `phone_numbers` (jsonb, default [])
   - `external_accounts` (jsonb, default [])
   - `public_metadata` (jsonb, default {})
   - `private_metadata` (jsonb, default {})
   - `unsafe_metadata` (jsonb, default {})
   - `notion_databases` (jsonb, default [])

## Step 3: Configure Environment Variables

Make sure your `.env.local` has:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Database URL (from Supabase Settings > Database)
DATABASE_URL=postgresql://postgres:[password]@[host]:[port]/postgres
DIRECT_URL=postgresql://postgres:[password]@[host]:[port]/postgres

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret
```

## Step 4: Test Database Connection

Run this command to test your database connection:

```bash
npx prisma db pull
```

This should confirm your database schema matches your Prisma schema.

## Step 5: Test the Webhook

1. **Start your development server with ngrok**:
   ```bash
   npm run dev:ngrok
   ```

2. **Copy the webhook URL** from the terminal output

3. **Configure Clerk webhook**:
   - Go to Clerk Dashboard → Webhooks
   - Add endpoint with your webhook URL
   - Select events: `user.created`, `user.updated`, `user.deleted`
   - Copy the webhook secret to your `.env.local`

4. **Test by creating a user** in your app

5. **Check the logs** in your terminal - you should see detailed webhook processing logs

6. **Verify in Supabase** - check the `users` table in your Supabase dashboard

## Troubleshooting

### Common Issues:

1. **500 errors**: Check your environment variables are set correctly
2. **Database connection errors**: Verify your `DATABASE_URL` is correct
3. **Webhook signature errors**: Make sure `CLERK_WEBHOOK_SECRET` matches Clerk Dashboard
4. **RLS errors**: The service role should bypass RLS for webhooks

### Debug Steps:

1. Check terminal logs for detailed error messages
2. Verify table exists in Supabase Dashboard
3. Test database connection with `npx prisma db pull`
4. Check webhook logs in ngrok web interface (http://localhost:4040)

## Next Steps

Once the table is created and webhooks are working:

1. Users will automatically sync from Clerk to Supabase
2. You can query users using Prisma: `await prisma.user.findMany()`
3. All user operations (create/update/delete) will be logged in your terminal
4. Data will be available in both Clerk and your Supabase database
