
-- =========================================================
-- PROFILES TABLE
-- =========================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  default_view TEXT NOT NULL DEFAULT 'grid',
  auto_delete_days INT NOT NULL DEFAULT 0,
  paste_detection_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- =========================================================
-- ITEMS TABLE
-- =========================================================
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note','image','file','link','video','code')),
  title TEXT,
  content TEXT,
  file_url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT,
  thumbnail_url TEXT,
  link_url TEXT,
  link_title TEXT,
  link_favicon TEXT,
  link_image TEXT,
  language TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own items"
  ON public.items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own items"
  ON public.items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own items"
  ON public.items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own items"
  ON public.items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_items_user_created ON public.items(user_id, created_at DESC);
CREATE INDEX idx_items_user_pinned ON public.items(user_id, is_pinned);
CREATE INDEX idx_items_type ON public.items(user_id, type);

-- Enable realtime
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;

-- =========================================================
-- USER_STORAGE TABLE
-- =========================================================
CREATE TABLE public.user_storage (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  limit_bytes BIGINT NOT NULL DEFAULT 5368709120,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own storage"
  ON public.user_storage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own storage"
  ON public.user_storage FOR UPDATE USING (auth.uid() = user_id);

-- =========================================================
-- TIMESTAMP TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_items_updated
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- AUTO-CREATE PROFILE + STORAGE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_storage (user_id, used_bytes, limit_bytes)
  VALUES (NEW.id, 0, 5368709120);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- STORAGE QUOTA TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_storage_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_storage (user_id, used_bytes)
    VALUES (NEW.user_id, COALESCE(NEW.file_size, 0))
    ON CONFLICT (user_id) DO UPDATE
      SET used_bytes = public.user_storage.used_bytes + COALESCE(NEW.file_size, 0),
          updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_storage
      SET used_bytes = GREATEST(0, used_bytes - COALESCE(OLD.file_size, 0)),
          updated_at = now()
      WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_items_storage_insert
  AFTER INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_storage_usage();

CREATE TRIGGER trg_items_storage_delete
  AFTER DELETE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_storage_usage();

-- =========================================================
-- STORAGE BUCKET + POLICIES
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files', 'user-files', false);

CREATE POLICY "Users can view their own files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);
