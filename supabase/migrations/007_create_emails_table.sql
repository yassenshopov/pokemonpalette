-- Create emails table for logging all sent emails
CREATE TABLE IF NOT EXISTS public.emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resend_id TEXT UNIQUE, -- Resend email ID from response
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL, -- Optional: user who received the email
    recipient_email TEXT NOT NULL, -- Email address of recipient
    sender_email TEXT NOT NULL, -- From email address
    sender_name TEXT, -- From name
    subject TEXT NOT NULL, -- Email subject
    template_type TEXT NOT NULL, -- Template used (e.g., 'daily-nudge')
    html_content TEXT, -- HTML content of email
    text_content TEXT, -- Plain text content of email
    status TEXT NOT NULL, -- 'sent', 'failed', 'pending'
    error_message TEXT, -- Error message if failed
    sent_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL, -- When email was sent
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_recipient_email ON public.emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_emails_resend_id ON public.emails(resend_id);
CREATE INDEX IF NOT EXISTS idx_emails_template_type ON public.emails(template_type);
CREATE INDEX IF NOT EXISTS idx_emails_status ON public.emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON public.emails(sent_at);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON public.emails(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Allow users to view their own emails
CREATE POLICY "Users can view own emails" ON public.emails
    FOR SELECT USING (auth.uid()::text = user_id);

-- Allow service role to do everything (for email sending)
CREATE POLICY "Service role can manage all emails" ON public.emails
    FOR ALL USING (auth.role() = 'service_role');

-- Create updated_at trigger
CREATE TRIGGER handle_emails_updated_at
    BEFORE UPDATE ON public.emails
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.emails IS 'Logs of all emails sent through the system';
COMMENT ON COLUMN public.emails.resend_id IS 'Unique ID from Resend API response';
COMMENT ON COLUMN public.emails.template_type IS 'Type of email template used (e.g., daily-nudge)';
COMMENT ON COLUMN public.emails.status IS 'Status of email: sent, failed, or pending';

