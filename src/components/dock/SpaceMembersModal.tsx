import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Search, UserMinus, UserPlus, X, Crown, AtSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type SharedSpace } from "@/lib/shared-spaces-context";

interface Member {
  user_id: string;
  role: string;
  profiles: {
    username: string;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  space: SharedSpace | null;
  onUpdate?: () => void;
}

export function SpaceMembersModal({ open, onOpenChange, space, onUpdate }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const isOwner = space?.role === "owner";

  useEffect(() => {
    if (open && space) fetchMembers();
  }, [open, space]);

  const fetchMembers = async () => {
    if (!space) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("shared_space_members")
      .select(`
        user_id,
        role,
        profiles (
          username
        )
      `)
      .eq("space_id", space.id);

    if (error) toast.error(error.message);
    else setMembers((data as any) || []);
    setLoading(false);
  };

  const handleSearch = async (val: string) => {
    setSearch(val);
    if (val.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${val}%`)
      .limit(5);
    
    // Filter out existing members
    const filtered = (data || []).filter(u => !members.find(m => m.user_id === u.id));
    setSearchResults(filtered);
    setSearching(false);
  };

  const addMember = async (user: any) => {
    if (!space) return;
    if (members.length >= 3) {
      toast.error("Space is limited to 3 members total.");
      return;
    }
    setBusy(user.id);
    try {
      // 1. Add to members table
      const { error: memErr } = await supabase
        .from("shared_space_members")
        .insert({ space_id: space.id, user_id: user.id, role: "member" });
      
      if (memErr) throw memErr;

      // 2. Send notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "space_invite",
        title: "New Space Invite",
        body: `You've been added to "${space.name}"`,
        metadata: { space_id: space.id, space_name: space.name },
      });

      toast.success(`${user.username} added`);
      setSearch("");
      setSearchResults([]);
      fetchMembers();
      onUpdate?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const removeMember = async (member: Member) => {
    if (!space || !isOwner) return;
    if (member.role === "owner") return;
    
    setBusy(member.user_id);
    const { error } = await supabase
      .from("shared_space_members")
      .delete()
      .eq("space_id", space.id)
      .eq("user_id", member.user_id);

    if (error) toast.error(error.message);
    else {
      toast.success("Member removed");
      fetchMembers();
      onUpdate?.();
    }
    setBusy(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Manage Members
          </DialogTitle>
          <DialogDescription>
            Add or remove collaborators from this shared space.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Member List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Current Members ({members.length}/3)</h4>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-border">
                        <AvatarFallback className="text-[10px] font-bold bg-primary text-white">
                          {m.profiles.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold flex items-center gap-1.5">
                          {m.profiles.username}
                          {m.role === "owner" && <Crown className="h-3 w-3 text-warning fill-current" />}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                          {m.role}
                        </span>
                      </div>
                    </div>
                    {isOwner && m.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => removeMember(m)}
                        disabled={!!busy}
                      >
                        {busy === m.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Member (Only for owner and if < 3) */}
          {isOwner && members.length < 3 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Add Collaborator</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  className="pl-10 rounded-xl"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
              </div>

              {searchResults.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden mt-2">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => addMember(u)}
                      disabled={!!busy}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border-b last:border-0 border-border/50"
                    >
                      <div className="flex items-center gap-2">
                        <AtSign className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-bold">{u.username}</span>
                      </div>
                      <UserPlus className="h-4 w-4 text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Users } from "lucide-react";
