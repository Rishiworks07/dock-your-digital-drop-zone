import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBytes, STORAGE_LIMIT } from "@/lib/item-helpers";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(STORAGE_LIMIT);
  const [breakdown, setBreakdown] = useState<{ type: string; bytes: number; count: number }[]>([]);

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
    if (error) toast.error(error.message);
    else toast.success("All items cleared");
    navigate({ to: "/dashboard" });
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur-md shadow-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section className="rounded-2xl border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Account</h2>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="mb-4 font-medium">{user?.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={sendPasswordReset}>Send password reset email</Button>
            <Button variant="outline" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>Sign out</Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Storage</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Using <span className="font-medium text-foreground">{formatBytes(used)}</span> of {formatBytes(limit)}
          </p>
          <div className="space-y-2">
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet.</p>
            ) : breakdown.map((b) => (
              <div key={b.type} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="capitalize">{b.type} <span className="text-muted-foreground">({b.count})</span></span>
                <span className="tabular-nums">{formatBytes(b.bytes)}</span>
              </div>
            ))}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-4"><Trash2 className="h-4 w-4" />Clear all items</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Clear everything?</AlertDialogTitle>
                <AlertDialogDescription>This permanently deletes all your items and files.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAll} className="bg-destructive text-destructive-foreground">Delete all</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>
    </div>
  );
}
