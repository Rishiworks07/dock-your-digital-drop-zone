import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History, Search, Filter, Download, User, Info, Loader2, MousePointer2, FileUp, Trash2, Lock, Share2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useStatus } from "@/components/ui/QuickStatus";

export const Route = createFileRoute("/admin/activity-logs")({
  component: ActivityLogs,
});

function ActivityLogs() {
  const { showStatus } = useStatus();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("activity_logs")
        .select(`
          *,
          profiles:user_id (
            display_name,
            email
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      showStatus("Failed to load logs", "error");
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "login": return MousePointer2;
      case "upload": return FileUp;
      case "delete": return Trash2;
      case "vault_move": return Lock;
      case "shared_space_create": return Share2;
      case "invite_send": return Mail;
      default: return History;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "login": return "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20";
      case "upload": return "text-primary bg-primary/5";
      case "delete": return "text-destructive bg-destructive/5";
      case "vault_move": return "text-amber-600 bg-amber-50 dark:bg-amber-950/20";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const filteredLogs = logs.filter(l => 
    l.action?.toLowerCase().includes(search.toLowerCase()) || 
    l.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.profiles?.display_name?.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-3xl font-black tracking-tight text-foreground">Activity Logs</h1>
          <p className="text-muted-foreground mt-1 font-medium">Audit trail of system interactions.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input 
              placeholder="Search user or action..." 
              className="pl-11 h-12 rounded-2xl bg-card border-primary/10 shadow-sm focus-visible:ring-primary/20 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-12 w-12 rounded-2xl border-primary/10 p-0 hover:bg-primary/5">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-12 w-12 rounded-2xl border-primary/10 p-0 hover:bg-primary/5">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border-primary/10 shadow-lift rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-primary/5">
                <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest">Timestamp</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">User</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Action</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Details</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right px-8">Client</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center">
                    <History className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No activity recorded yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Logs will appear as users interact with the platform.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const Icon = getActionIcon(log.action);
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30 border-primary/5 transition-colors">
                      <TableCell className="py-5 px-8">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-foreground">
                            {new Date(log.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/5 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground">{log.profiles?.display_name || "Guest"}</span>
                            <span className="text-[10px] font-medium text-muted-foreground">{log.profiles?.email || "Anonymous"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter gap-1.5 border-none ${getActionColor(log.action)}`}>
                          <Icon className="h-3 w-3" />
                          {log.action?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium text-muted-foreground truncate max-w-xs">
                          {JSON.stringify(log.metadata) !== "{}" ? JSON.stringify(log.metadata) : "Standard system interaction"}
                        </p>
                      </TableCell>
                      <TableCell className="px-8 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">{log.ip_address || "Internal"}</span>
                          <span className="text-[9px] font-medium text-muted-foreground/40 truncate w-32">{log.user_agent || "System API"}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/30 p-4 rounded-2xl border border-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <span>Logs are retained for 90 days by default. Older logs are archived to cold storage.</span>
      </div>
    </div>
  );
}
