import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, LayoutDashboard, Users, HardDrive, History, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  
  const isAdminLogin = pathname === "/admin" || pathname === "/admin/";

  useEffect(() => {
    if (loading) return;

    // If on admin login page, and already an admin, go to dashboard
    if (isAdminLogin) {
      if (user && profile?.is_admin) {
        navigate({ to: "/admin/dashboard" });
      }
      return;
    }

    // If on guarded admin page, and not logged in as admin, go to admin login
    if (!user || !profile?.is_admin) {
      navigate({ to: "/admin" });
    }
  }, [user, profile, loading, navigate, pathname, isAdminLogin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If we're on the login page, just render the outlet (the login form)
  if (isAdminLogin) {
    return <Outlet />;
  }

  // If not logged in as admin and not on login page, wait for redirect
  if (!user || !profile?.is_admin) {
    return null;
  }

  const menuItems = [
    { label: "Overview", icon: LayoutDashboard, to: "/admin/dashboard" },
    { label: "Users", icon: Users, to: "/admin/users" },
    { label: "Shared Spaces", icon: HardDrive, to: "/admin/shared-spaces" },
    { label: "Storage", icon: HardDrive, to: "/admin/storage" },
    { label: "Activity Logs", icon: History, to: "/admin/activity-logs" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <ShieldAlert className="h-6 w-6" />
            <span>Dock Admin</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-bold">Control Center</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => (
            <Button
              key={item.label}
              variant={pathname === item.to ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 rounded-xl h-11"
              onClick={() => navigate({ to: item.to as any })}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <Separator className="mb-4" />
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/30">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
