import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, hasSetUsername, profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // Profile is fetched — if username not set, redirect to onboarding
    // Only redirect when profile has loaded (profile !== null means fetch completed)
    if (profile !== null && !hasSetUsername) {
      navigate({ to: "/onboarding" });
    }
  }, [user, loading, hasSetUsername, profile, navigate, pathname]);

  if (loading || !user || (profile !== null && !hasSetUsername)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Outlet />;
}
