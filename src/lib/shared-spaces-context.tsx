import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export interface SharedSpace {
  id: string;
  name: string;
  owner_id: string;
  role: "owner" | "member";
  member_count: number;
  created_at: string;
  updated_at: string;
}

interface SharedSpacesContextValue {
  spaces: SharedSpace[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const SharedSpacesContext = createContext<SharedSpacesContextValue | undefined>(undefined);

export function SharedSpacesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSpaces = useCallback(async () => {
    if (!user) { setSpaces([]); return; }
    setLoading(true);

    // Get memberships + space details
    const { data: memberships } = await supabase
      .from("shared_space_members")
      .select("space_id, role")
      .eq("user_id", user.id);

    if (!memberships?.length) { setSpaces([]); setLoading(false); return; }

    const spaceIds = memberships.map(m => m.space_id);
    const roleMap = Object.fromEntries(memberships.map(m => [m.space_id, m.role]));

    const { data: spaceRows } = await supabase
      .from("shared_spaces")
      .select("*")
      .in("id", spaceIds);

    // Get member counts
    const { data: allMembers } = await supabase
      .from("shared_space_members")
      .select("space_id")
      .in("space_id", spaceIds);

    const countMap: Record<string, number> = {};
    for (const m of allMembers ?? []) {
      countMap[m.space_id] = (countMap[m.space_id] ?? 0) + 1;
    }

    const result: SharedSpace[] = (spaceRows ?? []).map(s => ({
      id: s.id,
      name: s.name,
      owner_id: s.owner_id,
      role: (roleMap[s.id] ?? "member") as "owner" | "member",
      member_count: countMap[s.id] ?? 1,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    setSpaces(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchSpaces();

    const channel = supabase
      .channel("spaces-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_spaces" }, fetchSpaces)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_space_members" }, fetchSpaces)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSpaces]);

  const value = useMemo(() => ({ spaces, loading, refresh: fetchSpaces }), [spaces, loading, fetchSpaces]);

  return <SharedSpacesContext.Provider value={value}>{children}</SharedSpacesContext.Provider>;
}

export function useSharedSpaces() {
  const ctx = useContext(SharedSpacesContext);
  if (!ctx) throw new Error("useSharedSpaces must be used within SharedSpacesProvider");
  return ctx;
}
