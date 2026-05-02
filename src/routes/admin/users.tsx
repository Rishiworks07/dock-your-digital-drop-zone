import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, MoreVertical, Shield, UserX, Trash2, ExternalLink, HardDrive, ShieldAlert, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: UserManagement,
});

function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Fetch profiles with storage and item counts
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id,
          user_id,
          email,
          display_name,
          username,
          created_at,
          user_storage (
            used_bytes,
            limit_bytes
          )
        `);

      if (error) throw error;

      // Get item counts for each user (separate queries because aggregate join is tricky in simple select)
      const usersWithStats = await Promise.all((profiles || []).map(async (profile) => {
        const { count: itemCount } = await supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.user_id);
          
        const { count: vaultCount } = await supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.user_id)
          .eq("is_vaulted", true);

        return {
          ...profile,
          itemCount: itemCount || 0,
          vaultCount: vaultCount || 0,
          storage: profile.user_storage?.[0] || { used_bytes: 0, limit_bytes: 5368709120 }
        };
      }));

      setUsers(usersWithStats);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const suspendUser = (userId: string) => {
    toast.warning("Deactivation feature requires auth.users update (admin API)", {
      description: "You can implement this via a Supabase Edge Function with service_role."
    });
  };

  const deleteUser = async (userId: string) => {
    const confirm = window.confirm("Are you sure you want to delete this user? This cannot be undone.");
    if (!confirm) return;
    
    toast.error("User deletion restricted. Use Supabase dashboard for security.");
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1 font-medium">View and manage platform residents.</p>
        </div>
        
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search email, name, or username..." 
            className="pl-11 h-12 rounded-2xl bg-card border-primary/10 shadow-sm focus-visible:ring-primary/20 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-primary/10 shadow-lift rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-primary/5">
                <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest">User</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Joined</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Storage</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Items</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30 border-primary/5 transition-colors">
                  <TableCell className="py-5 px-8">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm uppercase">
                        {user.display_name?.charAt(0) || user.email?.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          {user.display_name || "Unknown"}
                          {user.is_admin && <Shield className="h-3 w-3 text-destructive fill-destructive/10" />}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-none px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Active
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-bold text-muted-foreground/80">
                      {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-black text-foreground">{formatBytes(user.storage.used_bytes)}</span>
                      <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${Math.min(100, (user.storage.used_bytes / user.storage.limit_bytes) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-foreground">{user.itemCount} total</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{user.vaultCount} in vault</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-8 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-muted">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-2xl border-primary/10 shadow-xl p-2">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest px-3 py-2 text-muted-foreground">Actions</DropdownMenuLabel>
                        <DropdownMenuItem className="rounded-xl gap-2 focus:bg-primary/5 focus:text-primary cursor-pointer px-3">
                          <ExternalLink className="h-4 w-4" />
                          <span>View Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl gap-2 focus:bg-primary/5 focus:text-primary cursor-pointer px-3">
                          <HardDrive className="h-4 w-4" />
                          <span>Storage Stats</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-primary/5 my-1" />
                        <DropdownMenuItem 
                          className="rounded-xl gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer px-3"
                          onClick={() => suspendUser(user.user_id)}
                        >
                          <UserX className="h-4 w-4" />
                          <span>Suspend User</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="rounded-xl gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer px-3"
                          onClick={() => deleteUser(user.user_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete Account</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Flagged Users section */}
      <div className="mt-12 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Flagged Users
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-amber-100 bg-amber-50/50 dark:border-amber-900/20 dark:bg-amber-950/10 rounded-[2rem] p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                <HardDrive className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 dark:text-amber-100">Near Storage Limit</h3>
                <p className="text-xs text-amber-800/70 dark:text-amber-200/50 mt-1">Users utilizing more than 90% of their 5GB quota.</p>
                <p className="mt-4 text-sm font-bold text-amber-900 dark:text-amber-100">0 users found.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
