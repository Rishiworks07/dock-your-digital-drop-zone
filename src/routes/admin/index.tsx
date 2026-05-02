import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ShieldAlert, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logActivity } from "@/lib/logger";

export const Route = createFileRoute("/admin/")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Explicit check for admin credentials as per user request
    if (email !== "dockapp07@gmail.com" || password !== "Rishi-Admin@210224") {
      toast.error("Invalid admin credentials");
      return;
    }

    setSubmitting(true);
    const { data, error } = await signIn(email, password);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Admin access granted");
    if (data?.user) {
      await logActivity(data.user.id, "login", { role: "admin" });
    }
    navigate({ to: "/admin/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 selection:bg-primary/30">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-4 ring-destructive/10">
            <ShieldAlert className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight text-white italic uppercase">Admin Panel</h1>
            <p className="mt-1 text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Dock Internal Dashboard</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/5 bg-zinc-900/50 backdrop-blur-xl p-10 shadow-2xl shadow-black/50">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <Lock className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Security Check</h2>
              <p className="text-xs text-zinc-500 font-medium">Enter authorized credentials to continue.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Admin Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-white/5 bg-zinc-800/50 text-white placeholder:text-zinc-600 focus-visible:ring-destructive/30 transition-all"
                placeholder="admin@dock.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Admin Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-white/5 bg-zinc-800/50 text-white placeholder:text-zinc-600 focus-visible:ring-destructive/30 transition-all"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 mt-4 rounded-xl bg-destructive text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:translate-y-[-2px] active:translate-y-[0px] hover:shadow-destructive/20 hover:bg-destructive/90"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Identity"}
            </Button>
          </form>

          <p className="mt-8 text-center text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
            Unauthorized access is strictly prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}
