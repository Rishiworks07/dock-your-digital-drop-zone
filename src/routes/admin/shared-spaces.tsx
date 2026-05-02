import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardDrive, Users, Trash2, Search, ExternalLink, Activity, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useStatus } from "@/components/ui/QuickStatus";

export const Route = createFileRoute("/admin/shared-spaces")({
  component: SharedSpacesMonitoring,
});

function SharedSpacesMonitoring() {
  const { showStatus } = useStatus();
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      // Fetch shared spaces
      const { data: spacesData, error } = await supabase
        .from("shared_spaces")
        .select(`
          id,
          name,
          owner_id,
          created_at,
          profiles:owner_id (
            display_name,
            email
          )
        `);

      if (error) throw error;

      // Get stats for each space
      const spacesWithStats = await Promise.all((spacesData || []).map(async (space: any) => {
        const { count: memberCount } = await supabase
          .from("shared_space_members")
          .select("*", { count: "exact", head: true })
          .eq("space_id", space.id);
          
        const { count: itemCount } = await supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("space_id", space.id);

        const { data: itemData } = await supabase
          .from("items")
          .select("file_size")
          .eq("space_id", space.id);

        const totalStorage = itemData?.reduce((acc, curr) => acc + (curr.file_size || 0), 0) || 0;

        return {
          ...space,
          memberCount: memberCount || 0,
          itemCount: itemCount || 0,
          totalStorage
        };
      }));

      setSpaces(spacesWithStats);
    } catch (error) {
      console.error("Error fetching spaces:", error);
      showStatus("Failed to load spaces", "error");
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

  const filteredSpaces = spaces.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.profiles?.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const deleteSpace = async (spaceId: string) => {
    const confirm = window.confirm("Are you sure you want to delete this shared space? All members will be removed and space-specific items will lose their context.");
    if (!confirm) return;
    
    showStatus("Deletion restricted", "error");
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
          <h1 className="text-3xl font-black tracking-tight text-foreground">Shared Spaces</h1>
          <p className="text-muted-foreground mt-1 font-medium">Monitor collaborative drop zones.</p>
        </div>
        
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search space name or owner..." 
            className="pl-11 h-12 rounded-2xl bg-card border-primary/10 shadow-sm focus-visible:ring-primary/20 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatSmall title="Total Spaces" value={spaces.length} icon={Activity} color="text-primary" />
        <StatSmall title="Total Space Members" value={spaces.reduce((acc, s) => acc + s.memberCount, 0)} icon={Users} color="text-emerald-500" />
        <StatSmall title="Space Storage" value={formatBytes(spaces.reduce((acc, s) => acc + s.totalStorage, 0))} icon={HardDrive} color="text-amber-500" />
      </div>

      <Card className="border-primary/10 shadow-lift rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-primary/5">
                <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest">Space Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Owner</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Members</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Items</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Storage</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSpaces.map((space) => (
                <TableRow key={space.id} className="hover:bg-muted/30 border-primary/5 transition-colors">
                  <TableCell className="py-5 px-8 font-bold text-sm text-foreground">
                    {space.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">{space.profiles?.display_name || "Unknown"}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{space.profiles?.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 px-3 py-0.5 rounded-full text-[10px] font-black">
                      {space.memberCount} MBRS
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs font-bold text-muted-foreground">
                    {space.itemCount}
                  </TableCell>
                  <TableCell className="text-right text-xs font-black text-foreground">
                    {formatBytes(space.totalStorage)}
                  </TableCell>
                  <TableCell className="px-8 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/5 text-primary">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full hover:bg-destructive/10 text-destructive"
                        onClick={() => deleteSpace(space.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/30 p-4 rounded-2xl border border-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <span>Admins have read-only visibility into shared space content for moderation purposes.</span>
      </div>
    </div>
  );
}

function StatSmall({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="border-primary/5 shadow-sm rounded-2xl overflow-hidden bg-card">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-xl font-black mt-1 text-foreground">{value}</h3>
        </div>
        <Icon className={`h-8 w-8 ${color} opacity-20`} />
      </CardContent>
    </Card>
  );
}
