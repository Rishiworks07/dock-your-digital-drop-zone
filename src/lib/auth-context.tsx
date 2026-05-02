import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  user_id: string;
  username: string | null;
  username_set: boolean;
  display_name: string | null;
  email: string | null;
  has_seen_guide: boolean;
  is_admin: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null }; error: any }>;
  signUp: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null }; error: any }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasSetUsername: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, username_set, display_name, email, has_seen_guide")
      .eq("user_id", userId)
      .maybeSingle();
      
    // Try to fetch is_admin separately so it doesn't break if column is missing
    const { data: adminData } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    if (data) {
      setProfile({
        user_id: data.user_id,
        username: data.username ?? null,
        username_set: data.username_set ?? false,
        display_name: data.display_name ?? null,
        email: data.email ?? null,
        has_seen_guide: data.has_seen_guide ?? false,
        is_admin: adminData?.is_admin ?? false,
      });
    } else {
      // No profile row yet — upsert a blank one
      // We use a safe insert with onConflict to avoid resetting existing data if select failed silently
      const { error: upsertError } = await supabase.from("profiles").upsert(
        { user_id: userId, username_set: false, has_seen_guide: false }, 
        { onConflict: "user_id" }
      );
      
      if (upsertError) {
        console.error("Error creating profile:", upsertError);
      } else {
        setProfile({ user_id: userId, username: null, username_set: false, display_name: null, email: null, has_seen_guide: false, is_admin: false });
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    // Set up listener BEFORE getSession (per knowledge guideline)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      if (sess?.user) {
        fetchProfile(sess.user.id);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) fetchProfile(data.session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login?verified=true` },
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      return { error };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasSetUsername = useMemo(() => !!profile?.username_set, [profile]);

  const value = useMemo(
    () => ({ user, session, profile, loading, signIn, signUp, signInWithGoogle, signOut, refreshProfile, hasSetUsername }),
    [user, session, profile, loading, refreshProfile, hasSetUsername]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
