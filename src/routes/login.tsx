import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Anchor, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);


  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-primary shadow-lift ring-4 ring-primary/10">
            <Anchor className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Dock</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground/80 uppercase tracking-widest text-[10px]">Your universal drop zone</p>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-primary/10 bg-card p-10 shadow-lift">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Welcome back. Your space is ready.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2 group">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Email Address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-2xl border-primary/5 bg-muted/30 focus-visible:ring-primary/20 transition-all"
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2 group">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl border-primary/5 bg-muted/30 focus-visible:ring-primary/20 transition-all"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 mt-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-lift transition-all hover:translate-y-[-2px] active:translate-y-[0px] hover:shadow-lg hover:bg-primary/95"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in to Dock"}
            </Button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="font-bold text-primary hover:text-primary/80 transition-colors">
                Sign up for free
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-[11px] text-muted-foreground/60 font-medium">
          Secure, encrypted storage with Supabase.
        </p>
      </div>
    </div>
  );
}
