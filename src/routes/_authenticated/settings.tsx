import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2, User, HardDrive, ShieldCheck, Moon, Sun, Settings as SettingsIcon, LogOut, AtSign, Pencil, Check, X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBytes, STORAGE_LIMIT } from "@/lib/item-helpers";
import { useStatus } from "@/components/ui/QuickStatus";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { showStatus } = useStatus();
  const { user, signOut, profile, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(STORAGE_LIMIT);
  const [breakdown, setBreakdown] = useState<{ type: string; bytes: number; count: number }[]>([]);

  // Username editing
  const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
  type AvailState = "idle" | "checking" | "available" | "taken" | "invalid";
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameAvail, setUsernameAvail] = useState<AvailState>("idle");
  const [savingUsername, setSavingUsername] = useState(false);

  // Debounced username availability check
  useEffect(() => {
    if (!editingUsername || !newUsername) { setUsernameAvail("idle"); return; }
    if (newUsername === profile?.username) { setUsernameAvail("available"); return; }
    if (!USERNAME_REGEX.test(newUsername)) { setUsernameAvail("invalid"); return; }
    setUsernameAvail("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", newUsername.toLowerCase())
        .maybeSingle();
      setUsernameAvail(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [newUsername, editingUsername, profile?.username]);

  const saveUsername = async () => {
    if (!user || usernameAvail !== "available" || savingUsername) return;
    setSavingUsername(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: newUsername.toLowerCase() })
      .eq("user_id", user.id);
    if (error) { showStatus("Failed to update username", "error"); }
    else {
      await refreshProfile();
      showStatus("Username updated!", "success");
      setEditingUsername(false);
    }
    setSavingUsername(false);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, items] = await Promise.all([
        supabase.from("user_storage").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("items").select("type,file_size"),
      ]);
      if (s.data) { setUsed(Number(s.data.used_bytes)); setLimit(Number(s.data.limit_bytes)); }
      if (items.data) {
        const grouped: Record<string, { bytes: number; count: number }> = {};
        for (const it of items.data) {
          grouped[it.type] = grouped[it.type] || { bytes: 0, count: 0 };
          grouped[it.type].bytes += Number(it.file_size ?? 0);
          grouped[it.type].count += 1;
        }
        setBreakdown(Object.entries(grouped).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.bytes - a.bytes));
      }
    })();
  }, [user]);

  const clearAll = async () => {
    if (!user) return;
    const { data: items } = await supabase.from("items").select("file_path");
    const paths = (items ?? []).map((i) => i.file_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("user-files").remove(paths);
    const { error } = await supabase.from("items").delete().eq("user_id", user.id);
    if (error) showStatus("Failed to clear items", "error");
    else showStatus("All items cleared", "success");
    navigate({ to: "/dashboard" });
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) showStatus("Failed to send email", "error");
    else showStatus("Reset email sent", "success");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-muted/50">
              <Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Settings</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">

        {/* ── Dock Identity ── */}
        <section className="rounded-2xl bg-card p-8 shadow-card border border-transparent">
          <div className="flex items-center gap-4 mb-8 border-b pb-4">
            <div className="bg-sky-soft p-3 rounded-xl text-primary shadow-sm">
              <AtSign className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Dock Identity</h2>
              <p className="text-sm text-muted-foreground">Your unique username for collaboration</p>
            </div>
          </div>

          {!editingUsername ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Username</p>
                <p className="text-2xl font-black text-foreground tracking-tight">
                  <span className="text-primary">@</span>{profile?.username ?? "—"}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => { setEditingUsername(true); setNewUsername(profile?.username ?? ""); }}
                className="rounded-xl border-primary/20 hover:bg-sky-soft/30 hover:text-primary font-bold"
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={cn(
                "flex items-center gap-3 rounded-2xl border-2 bg-muted/30 px-4 py-3 transition-all",
                usernameAvail === "available" && "border-success/60 bg-success/5",
                usernameAvail === "taken" && "border-destructive/50 bg-destructive/5",
                usernameAvail === "invalid" && "border-warning/50 bg-warning/5",
                usernameAvail === "checking" && "border-primary/50",
                usernameAvail === "idle" && "border-border/50 focus-within:border-primary/60",
              )}>
                <AtSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  maxLength={20}
                  autoFocus
                  className="flex-1 bg-transparent text-foreground font-bold outline-none placeholder:text-muted-foreground/40"
                  onKeyDown={e => { if (e.key === "Enter") saveUsername(); if (e.key === "Escape") setEditingUsername(false); }}
                />
                {usernameAvail === "checking" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                {usernameAvail === "available" && <Check className="h-4 w-4 text-success shrink-0" />}
                {(usernameAvail === "taken" || usernameAvail === "invalid") && <X className="h-4 w-4 text-destructive shrink-0" />}
              </div>
              <div className="h-4 px-1">
                {usernameAvail === "available" && <p className="text-xs font-bold text-success">✓ @{newUsername} is available</p>}
                {usernameAvail === "taken" && <p className="text-xs font-bold text-destructive">✗ Already taken</p>}
                {usernameAvail === "invalid" && <p className="text-xs text-muted-foreground">3–20 characters, letters/numbers/underscore only</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={saveUsername}
                  disabled={usernameAvail !== "available" || savingUsername}
                  className="rounded-xl font-bold flex-1"
                >
                  {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Save</>}
                </Button>
                <Button variant="outline" onClick={() => setEditingUsername(false)} className="rounded-xl font-bold">
                  <X className="mr-2 h-4 w-4" />Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
        <section className="rounded-2xl bg-card p-8 shadow-card border border-transparent">
          <div className="flex items-center gap-4 mb-8 border-b pb-4">
            <div className="bg-sky-soft p-3 rounded-xl text-primary shadow-sm">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Account Profile</h2>
              <p className="text-sm text-muted-foreground">Manage your account information</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Email Address</p>
              <div className="bg-muted/50 px-4 py-3 rounded-xl font-bold text-foreground border border-border/50">
                {user?.email}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <Button variant="outline" onClick={sendPasswordReset} className="rounded-xl border-primary/20 hover:bg-sky-soft/30 hover:text-primary font-bold">
                <ShieldCheck className="mr-2 h-4 w-4" /> Reset Password
              </Button>
              <Button variant="outline" onClick={async () => { await signOut(); navigate({ to: "/login" }); }} className="rounded-xl font-bold">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-card p-8 shadow-card border border-transparent">
          <div className="flex items-center gap-4 mb-8 border-b pb-4">
            <div className="bg-sky-soft p-3 rounded-xl text-primary shadow-sm">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Storage Management</h2>
              <p className="text-sm text-muted-foreground">Monitor and manage your used space</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-sm font-bold text-foreground mb-3 flex items-center justify-between">
                <span>Total Usage</span>
                <span className="text-primary">{formatBytes(used)} <span className="font-normal text-muted-foreground">/ {formatBytes(limit)}</span></span>
              </p>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/50 border border-border/20">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                  style={{ width: `${limit > 0 ? Math.min(100, (used / limit) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full py-4 text-center bg-muted/20 rounded-xl border border-dashed">No items stored yet.</p>
              ) : breakdown.map((b) => (
                <div key={b.type} className="flex items-center justify-between p-4 rounded-xl bg-sky-soft/30 border border-border/30 hover:bg-sky-soft/50 transition-all">
                  <div className="flex items-center gap-3">
                    <SettingsIcon className="h-4 w-4 text-primary opacity-60" />
                    <span className="font-bold text-foreground capitalize">{b.type}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground text-sm">{formatBytes(b.bytes)}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{b.count} items</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="rounded-xl font-bold w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" /> Clear All Items
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem] p-8 border-none shadow-lift">
                  <AlertDialogHeader className="mb-6">
                    <AlertDialogTitle className="text-2xl font-bold text-foreground">Clear everything?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-base">
                      This will permanently delete all your items and files from our storage. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold border-primary/20 text-primary hover:bg-sky-soft/30">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAll} className="rounded-xl font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete Everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
