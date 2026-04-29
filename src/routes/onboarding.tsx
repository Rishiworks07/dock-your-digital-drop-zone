import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AtSign, Check, X, ArrowRight, Anchor } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
type AvailState = "idle" | "checking" | "available" | "taken" | "invalid";

function OnboardingPage() {
  const { user, loading, hasSetUsername, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [availState, setAvailState] = useState<AvailState>("idle");
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Auth + already-set guard
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    setProfileLoading(false);
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && hasSetUsername) {
      navigate({ to: "/dashboard" });
    }
  }, [hasSetUsername, loading, user, navigate]);

  // Debounced availability check
  useEffect(() => {
    if (!username) { setAvailState("idle"); return; }
    if (!USERNAME_REGEX.test(username)) { setAvailState("invalid"); return; }
    setAvailState("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      setAvailState(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const handleSubmit = async () => {
    if (availState !== "available" || !user || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: username.toLowerCase(), username_set: true })
      .eq("user_id", user.id);
    if (!error) {
      await refreshProfile();
      navigate({ to: "/dashboard" });
    }
    setSaving(false);
  };

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isValid = availState === "available";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/6 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-gradient shadow-lift mb-4">
            <Anchor className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Dock</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your digital drop zone</p>
        </div>

        <div className="rounded-3xl bg-card border border-border/50 p-8 shadow-lift">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground leading-tight">Choose your<br />Dock username</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              This is your unique identity on Dock. Others will use{" "}
              <span className="font-bold text-primary">@{username || "yourname"}</span>{" "}
              to invite you to shared spaces.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-3">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 bg-muted/30 px-4 py-3.5 transition-all duration-200",
                availState === "available" && "border-success/60 bg-success/5",
                availState === "taken" && "border-destructive/50 bg-destructive/5",
                availState === "invalid" && "border-warning/50 bg-warning/5",
                availState === "checking" && "border-primary/50",
                (availState === "idle") && "border-border/50 focus-within:border-primary/60",
              )}
            >
              <AtSign className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                placeholder="your_username"
                maxLength={20}
                autoFocus
                className="flex-1 bg-transparent text-foreground font-bold text-lg outline-none placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:text-base"
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
              <div className="shrink-0 w-5 flex items-center justify-center">
                {availState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {availState === "available" && <Check className="h-4 w-4 text-success" />}
                {(availState === "taken" || availState === "invalid") && <X className="h-4 w-4 text-destructive" />}
              </div>
            </div>

            {/* Feedback */}
            <div className="h-4 px-1">
              {availState === "available" && (
                <p className="text-xs font-bold text-success">✓ @{username} is available!</p>
              )}
              {availState === "taken" && (
                <p className="text-xs font-bold text-destructive">✗ @{username} is already taken</p>
              )}
              {availState === "invalid" && username.length > 0 && username.length < 3 && (
                <p className="text-xs text-muted-foreground">At least 3 characters required</p>
              )}
              {availState === "invalid" && username.length >= 3 && (
                <p className="text-xs text-muted-foreground">Only letters, numbers and underscores allowed</p>
              )}
            </div>
          </div>

          {/* Rules */}
          <div className="mt-4 rounded-xl bg-muted/40 px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Rules</p>
            {[
              "3–20 characters",
              "Letters, numbers, underscores only",
              "Must be unique across all users",
            ].map(rule => (
              <div key={rule} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1 w-1 rounded-full bg-primary/60" />
                {rule}
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className={cn(
              "mt-6 w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-base transition-all duration-300",
              isValid && !saving
                ? "bg-primary-gradient text-white shadow-lift hover:shadow-[0_16px_40px_-12px_rgba(100,140,240,0.5)] hover:-translate-y-0.5"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Setting up your Dock...</>
            ) : (
              <>Continue to Dock <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Logged in as <span className="font-bold text-foreground">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
