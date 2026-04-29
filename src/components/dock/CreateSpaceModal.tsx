import { useState, useEffect, useRef } from "react";
import { X, Search, Users, Loader2, Plus, FolderPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSharedSpaces } from "@/lib/shared-spaces-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_MEMBERS = 3; // owner + 2 collaborators = 3 total

interface UserResult {
  user_id: string;
  username: string;
  display_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSpaceModal({ open, onOpenChange }: Props) {
  const { user, profile } = useAuth();
  const { refresh } = useSharedSpaces();
  const [spaceName, setSpaceName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setSpaceName(""); setQuery(""); setResults([]); setSelected([]); setCreating(false);
    }
  }, [open]);

  // Username search (debounced)
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .ilike("username", `%${query}%`)
        .neq("user_id", user?.id ?? "")
        .limit(8);

      const filtered = (data ?? []).filter(
        r => r.username && !selected.some(s => s.user_id === r.user_id)
      ) as UserResult[];
      setResults(filtered);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, user, selected]);

  const addUser = (u: UserResult) => {
    if (selected.length >= MAX_MEMBERS - 1) {
      toast.error(`Max ${MAX_MEMBERS - 1} collaborators per space`);
      return;
    }
    setSelected(prev => [...prev, u]);
    setQuery("");
    setResults([]);
    searchRef.current?.focus();
  };

  const removeUser = (userId: string) => {
    setSelected(prev => prev.filter(u => u.user_id !== userId));
  };

  const handleCreate = async () => {
    if (!user || !spaceName.trim() || creating) return;
    setCreating(true);

    try {
      // 1. Create the space
      const { data: space, error: spaceErr } = await supabase
        .from("shared_spaces")
        .insert({ name: spaceName.trim(), owner_id: user.id })
        .select()
        .single();

      if (spaceErr || !space) throw new Error(spaceErr?.message ?? "Failed to create space");

      // 2. Add owner as member
      await supabase.from("shared_space_members").insert({
        space_id: space.id, user_id: user.id, role: "owner",
      });

      // 3. Add selected members + send notifications
      for (const invitee of selected) {
        await supabase.from("shared_space_members").insert({
          space_id: space.id, user_id: invitee.user_id, role: "member",
        });

        await supabase.from("notifications").insert({
          user_id: invitee.user_id,
          type: "space_invite",
          title: `@${profile?.username ?? "Someone"} invited you to join "${space.name}"`,
          body: `You've been added to a shared space. Accept to start collaborating.`,
          metadata: {
            space_id: space.id,
            space_name: space.name,
            inviter_id: user.id,
            inviter_username: profile?.username ?? "",
          },
          status: "pending",
          expires_at: null, // Pending invites don't expire
        });
      }

      toast.success(`"${space.name}" created!`);
      await refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const canCreate = spaceName.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative w-full max-w-md rounded-3xl bg-card border border-border/50 shadow-lift p-8 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FolderPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">New Shared Space</h2>
              <p className="text-xs text-muted-foreground">Collaborate with up to {MAX_MEMBERS - 1} others</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full hover:bg-muted/60 text-muted-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Space name */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Space Name
            </label>
            <input
              type="text"
              value={spaceName}
              onChange={e => setSpaceName(e.target.value)}
              placeholder="e.g. Design Assets, Team Notes..."
              autoFocus
              className="w-full rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-foreground font-semibold placeholder:text-muted-foreground/50 placeholder:font-normal outline-none focus:border-primary/60 focus:bg-primary/5 transition-all"
            />
          </div>

          {/* Invite members */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Add Members
              <span className="ml-auto font-normal normal-case tracking-normal text-[10px]">
                {selected.length}/{MAX_MEMBERS - 1} selected
              </span>
            </label>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selected.map(u => (
                  <span
                    key={u.user_id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold px-3 py-1.5"
                  >
                    <span className="h-4 w-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-black">
                      {u.username[0].toUpperCase()}
                    </span>
                    @{u.username}
                    <button
                      onClick={() => removeUser(u.user_id)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className={cn(
              "relative",
              selected.length >= MAX_MEMBERS - 1 && "opacity-50 pointer-events-none"
            )}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by username..."
                className="w-full rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/60 focus:bg-primary/5 transition-all"
              />
              {searching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Results dropdown */}
            {results.length > 0 && (
              <div className="mt-1.5 rounded-2xl border border-border/60 bg-card shadow-lift overflow-hidden">
                {results.map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => addUser(u)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-all text-left"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary-gradient flex items-center justify-center text-white text-xs font-black shrink-0">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">@{u.username}</p>
                      {u.display_name && (
                        <p className="text-xs text-muted-foreground">{u.display_name}</p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-primary ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && !searching && results.length === 0 && (
              <p className="mt-2 text-xs text-center text-muted-foreground py-3">
                No users found for "@{query}"
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-7">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-2xl border border-border/60 py-3 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            className={cn(
              "flex-1 rounded-2xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2",
              canCreate && !creating
                ? "bg-primary-gradient text-white shadow-lift hover:-translate-y-0.5"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create Space"}
          </button>
        </div>
      </div>
    </div>
  );
}
