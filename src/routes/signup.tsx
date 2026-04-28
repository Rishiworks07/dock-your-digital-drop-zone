import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Anchor, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  useEffect(() => () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubmittedEmail(email);
    startCooldown();
  };

  const onResend = async () => {
    if (!submittedEmail || cooldown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: submittedEmail,
      options: { emailRedirectTo: `${window.location.origin}/login?verified=true` },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Verification email sent again.");
      startCooldown();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient px-4 py-10 transition-colors duration-500">
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
          {submittedEmail ? (
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
                <MailCheck className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mt-6 text-2xl font-bold tracking-tight">Check your inbox</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                We've sent a verification link to{" "}
                <span className="font-bold text-foreground">{submittedEmail}</span>.
                Click the link to activate your account.
              </p>

              <Button
                type="button"
                onClick={onResend}
                disabled={resending || cooldown > 0}
                variant="outline"
                className="mt-8 h-11 w-full rounded-2xl border-primary/15 font-semibold"
              >
                {resending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  "Resend verification email"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setSubmittedEmail(null);
                  setCooldown(0);
                  if (cooldownTimer.current) clearInterval(cooldownTimer.current);
                }}
                className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
              >
                Wrong email? Start over
              </button>

              <p className="mt-8 text-xs text-muted-foreground">
                Already verified?{" "}
                <Link to="/login" className="font-bold text-primary hover:text-primary/80 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Create account</h2>
                <p className="text-sm text-muted-foreground mt-1">Start your smart collection today. Free 5 GB.</p>
              </div>

              <GoogleButton label="Sign up with Google" />

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
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
                    className="h-12 rounded-2xl border-primary/5 bg-muted/30 focus-visible:ring-primary/20 transition-all font-medium"
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-2 group">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-2xl border-primary/5 bg-muted/30 focus-visible:ring-primary/20 transition-all font-medium"
                    placeholder="••••••••"
                  />
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider ml-1 mt-1 opacity-70">At least 6 characters.</p>
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 mt-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-lift transition-all hover:translate-y-[-2px] active:translate-y-[0px] hover:shadow-lg hover:bg-primary/95"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create your Dock"}
                </Button>
              </form>

              <div className="mt-8 flex flex-col items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="font-bold text-primary hover:text-primary/80 transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        <p className="mt-10 text-center text-[11px] text-muted-foreground/60 font-medium">
          By signing up, you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
