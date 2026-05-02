import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Anchor, CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type LoginSearch = { verified?: boolean };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    verified: search.verified === true || search.verified === "true",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const { verified } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Admin backdoor shortcut
    if (trimmedEmail === "210224" && trimmedPassword === "210224") {
      toast.info("Accessing Admin Panel...");
      navigate({ to: "/admin" });
      return;
    }

    // Manual email validation for normal users
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    setNeedsVerification(false);
    const { error } = await signIn(trimmedEmail, trimmedPassword);
    setSubmitting(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("not confirmed") || msg.includes("not verified") || msg.includes("email_not_confirmed")) {
        setNeedsVerification(true);
        toast.error("Please verify your email first. Check your inbox for the verification link.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const onResend = async () => {
    if (!email) {
      toast.error("Enter your email above first.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login?verified=true` },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("Verification email sent. Check your inbox.");
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

          {verified && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium">Your account has been activated successfully. Please log in to continue.</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2 group">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Email Address</Label>
              <Input
                id="email"
                type="text"
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

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-4">
            <GoogleButton />
          </div>

          {needsVerification && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex items-start gap-3">
                <MailWarning className="h-5 w-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="font-medium">Your email isn't verified yet. Check your inbox for the verification link.</p>
              </div>
              <Button
                type="button"
                onClick={onResend}
                disabled={resending}
                variant="outline"
                className="h-10 rounded-xl border-amber-300/70 bg-white text-amber-900 hover:bg-amber-100 dark:bg-transparent dark:text-amber-100"
              >
                {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend verification email"}
              </Button>
            </div>
          )}

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
