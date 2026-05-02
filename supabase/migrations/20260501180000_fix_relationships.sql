-- Fix relationships for PostgREST joins

-- 1. Link user_storage to profiles
-- This allows joining user_storage when querying profiles
ALTER TABLE public.user_storage 
DROP CONSTRAINT IF EXISTS user_storage_user_id_fkey_profiles,
ADD CONSTRAINT user_storage_user_id_fkey_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 2. Link shared_spaces to profiles
-- This allows joining profiles (as owner) when querying shared_spaces
-- First check if shared_spaces exists (since it might have been created via Lovable UI)
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_spaces') THEN
        ALTER TABLE public.shared_spaces 
        DROP CONSTRAINT IF EXISTS shared_spaces_owner_id_fkey_profiles,
        ADD CONSTRAINT shared_spaces_owner_id_fkey_profiles 
        FOREIGN KEY (owner_id) REFERENCES public.profiles(user_id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Link items to profiles
ALTER TABLE public.items 
DROP CONSTRAINT IF EXISTS items_user_id_fkey_profiles,
ADD CONSTRAINT items_user_id_fkey_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
