-- Add is_admin column to profiles
ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Create activity_logs table
CREATE TABLE public.activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create system_alerts table
CREATE TABLE public.system_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- 'limit_reached', 'unusual_activity', 'failed_login'
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_logs
CREATE POLICY "Admins can view all logs"
    ON public.activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
        )
    );

CREATE POLICY "Users can insert their own logs"
    ON public.activity_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policies for system_alerts
CREATE POLICY "Admins can manage alerts"
    ON public.system_alerts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Set dockapp07@gmail.com as admin
-- Note: This assumes the user already exists. If not, the trigger will handle future users if we update it.
-- But for now, we'll try to update if it exists.
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'dockapp07@gmail.com';

-- Update handle_new_user function to respect is_admin if we ever want to automate it,
-- but usually admins are set manually.
