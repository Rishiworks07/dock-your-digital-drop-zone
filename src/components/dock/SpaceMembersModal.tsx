import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Search, UserMinus, UserPlus, X, Crown, AtSign, Trash2, LogOut, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedSpaces, type SharedSpace } from "@/lib/shared-spaces-context";
import { useAuth } from "@/lib/auth-context";
import { logActivity } from "@/lib/logger";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  onSpaceDeleted?: () => void;
}

export function SpaceMembersModal({ open, onOpenChange, space, onUpdate, onSpaceDeleted }: Props) {
  const { user } = useAuth();
  const { refresh: refreshSpaces } = useSharedSpaces();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

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
    if (!val.trim()) { setSearchResults([]); return; }
    
    setSearching(true);
    console.log("Searching for:", val);
    
    // Search by username OR email
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, email")
      .or(`username.ilike.%${val}%,email.ilike.%${val}%`)
      .not("user_id", "eq", user?.id) // Don't find yourself
      .limit(10);
    
    if (error) {
      console.error("Search error:", error);
      toast.error("Search failed. Check console for details.");
      setSearching(false);
      return;
    }

    console.log("Search results from DB:", data);

    if (!data || data.length === 0) {
      console.warn("No users found. This might be due to Row Level Security (RLS) blocking access to other profiles.");
    }

    // Filter out existing members
    const filtered = (data || []).filter(u => 
      !members.find(m => m.user_id === u.user_id)
    );
    
    setSearchResults(filtered);
    setSearching(false);
  };

  const addMember = async (targetUser: any) => {
    if (!space) return;
    if (members.length >= 3) {
      toast.error("Space is limited to 3 members total.");
      return;
    }
    setBusy(targetUser.user_id);
    try {
      // 1. Add to members table
      const { error: memErr } = await supabase
        .from("shared_space_members")
        .insert({ space_id: space.id, user_id: targetUser.user_id, role: "member" });
      
      if (memErr) throw memErr;

      // 2. Send notification
      await supabase.from("notifications").insert({
        user_id: targetUser.user_id,
        type: "space_invite",
        title: "New Space Invite",
        body: `You've been added to "${space.name}"`,
        metadata: { space_id: space.id, space_name: space.name },
      });
      
      await logActivity(user?.id || null, "invite_send", { space_id: space.id, target_user: targetUser.username });

      toast.success(`${targetUser.username} added`);
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

  const handleDeleteSpace = async () => {
    if (!space || !isOwner) return;
    setBusy("deleting");
    try {
      // 1. Get all items in the space to clean up storage
      const { data: items } = await supabase
        .from("items")
        .select("id, file_path")
        .eq("space_id", space.id);
      
      if (items && items.length > 0) {
        const paths = items.map(i => i.file_path).filter(Boolean) as string[];
        if (paths.length > 0) {
          await supabase.storage.from("user-files").remove(paths);
        }
        await supabase.from("items").delete().eq("space_id", space.id);
      }

      // 2. Delete the space (members should cascade if DB is set up)
      const { error } = await supabase.from("shared_spaces").delete().eq("id", space.id);
      
      if (error) throw error;

      toast.success("Space deleted");
      await logActivity(user?.id || null, "delete", { type: "shared_space", name: space.name });
      onOpenChange(false);
      await refreshSpaces();
      onSpaceDeleted?.();
      onUpdate?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleLeaveSpace = async () => {
    if (!space || isOwner || !user) return;
    setBusy("leaving");
    try {
      const { error } = await supabase
        .from("shared_space_members")
        .delete()
        .eq("space_id", space.id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Left the space");
      await logActivity(user.id, "shared_space_join", { space_id: space.id, action: "leave" });
      onOpenChange(false);
      await refreshSpaces();
      onSpaceDeleted?.();
      onUpdate?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
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
                    placeholder="Search by username or email..."
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
                        key={u.user_id}
                        onClick={() => addMember(u)}
                        disabled={!!busy}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border-b last:border-0 border-border/50 text-left"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <AtSign className="h-3.5 w-3.5 text-primary" />
                            <span className="text-sm font-bold">{u.username || "No username"}</span>
                          </div>
                          {u.email && <span className="text-[10px] text-muted-foreground ml-5">{u.email}</span>}
                        </div>
                        <UserPlus className="h-4 w-4 text-primary" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Danger Zone */}
            <div className="pt-4 border-t border-destructive/20">
              <h4 className="text-xs font-bold text-destructive uppercase tracking-widest mb-3">Danger Zone</h4>
              {isOwner ? (
                <Button 
                  variant="destructive" 
                  className="w-full rounded-xl font-bold gap-2"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={!!busy}
                >
                  {busy === "deleting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete Space Permanently
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full rounded-xl font-bold gap-2 border-destructive/20 text-destructive hover:bg-destructive/10"
                  onClick={() => setShowLeaveConfirm(true)}
                  disabled={!!busy}
                >
                  {busy === "leaving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Leave This Space
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-[2rem] p-8 border-none shadow-lift">
          <AlertDialogHeader className="mb-6">
            <div className="mx-auto bg-destructive/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-center text-foreground">Delete "{space?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground text-base">
              This will permanently delete all items, files, and notes in this space for <strong>everyone</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="rounded-xl font-bold flex-1 border-primary/20 text-primary hover:bg-sky-soft/30">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSpace} 
              className="rounded-xl font-bold flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Confirmation */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent className="rounded-[2rem] p-8 border-none shadow-lift">
          <AlertDialogHeader className="mb-6">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
              <LogOut className="h-8 w-8 text-primary" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-center text-foreground">Leave Space?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground text-base">
              You will lose access to all items in "{space?.name}". You'll need an invite to join back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="rounded-xl font-bold flex-1 border-primary/20 text-primary hover:bg-sky-soft/30">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLeaveSpace} 
              className="rounded-xl font-bold flex-1 bg-primary hover:bg-primary/90 text-white"
            >
              Leave Space
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
