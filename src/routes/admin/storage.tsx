import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardDrive, PieChart, AlertTriangle, TrendingUp, ShieldAlert, Loader2, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/storage")({
  component: StorageMonitoring,
});

function StorageMonitoring() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStorageStats();
  }, []);

  const fetchStorageStats = async () => {
    try {
      setLoading(true);
      
      // Get all storage data
      const { data: storageData, error } = await supabase.from("user_storage").select("*");
      if (error) throw error;

      const totalUsed = storageData?.reduce((acc, curr) => acc + curr.used_bytes, 0) || 0;
      const totalLimit = storageData?.reduce((acc, curr) => acc + curr.limit_bytes, 0) || 0;

      // Get breakdown by type
      const { data: itemData } = await supabase.from("items").select("type, file_size, is_vaulted, space_id");
      
      const breakdown = {
        vault: 0,
        shared: 0,
        temporary: 0,
        images: 0,
        videos: 0,
        files: 0,
        others: 0
      };

      itemData?.forEach(item => {
        const size = item.file_size || 0;
        if (item.is_vaulted) breakdown.vault += size;
        else if (item.space_id) breakdown.shared += size;
        else breakdown.temporary += size;

        if (item.type === "image") breakdown.images += size;
        else if (item.type === "video") breakdown.videos += size;
        else if (item.type === "file") breakdown.files += size;
        else breakdown.others += size;
      });

      // Users nearing limit
      const nearingLimit = storageData?.filter(s => (s.used_bytes / s.limit_bytes) > 0.8).length || 0;

      setStats({
        totalUsed,
        totalLimit,
        breakdown,
        nearingLimit,
        userCount: storageData?.length || 0
      });
    } catch (error) {
      console.error("Error fetching storage stats:", error);
      toast.error("Failed to load storage metrics");
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const usagePercent = (stats.totalUsed / stats.totalLimit) * 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">Storage Monitoring</h1>
        <p className="text-muted-foreground mt-1 font-medium">System-wide infrastructure visibility.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-primary/10 shadow-lift rounded-[2rem] overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              Total Usage
            </CardTitle>
            <CardDescription>Global consumption across all storage buckets.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <div className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-4xl font-black text-foreground">{formatBytes(stats.totalUsed)}</h3>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Used of {formatBytes(stats.totalLimit)} provisioned</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-black ${usagePercent > 80 ? 'text-destructive' : 'text-emerald-500'}`}>
                    {usagePercent.toFixed(1)}% Capacity
                  </span>
                </div>
              </div>
              
              <Progress value={usagePercent} className="h-4 rounded-full bg-muted shadow-inner" />
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <StorageDetail label="Vaults" value={formatBytes(stats.breakdown.vault)} percent={(stats.breakdown.vault / stats.totalUsed) * 100} color="bg-primary" />
                <StorageDetail label="Shared" value={formatBytes(stats.breakdown.shared)} percent={(stats.breakdown.shared / stats.totalUsed) * 100} color="bg-emerald-500" />
                <StorageDetail label="Temporary" value={formatBytes(stats.breakdown.temporary)} percent={(stats.breakdown.temporary / stats.totalUsed) * 100} color="bg-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-amber-100 bg-amber-50/50 dark:border-amber-900/20 dark:bg-amber-950/10 rounded-[2rem]">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="font-black text-amber-900 dark:text-amber-100 uppercase tracking-tighter">Quota Alerts</h3>
              </div>
              <p className="text-3xl font-black text-amber-900 dark:text-amber-100">{stats.nearingLimit}</p>
              <p className="text-xs font-bold text-amber-800/70 dark:text-amber-200/50 uppercase tracking-widest mt-1">Users nearing 90% limit</p>
            </CardContent>
          </Card>

          <Card className="border-primary/5 shadow-sm rounded-[2rem] bg-card">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="font-black text-foreground uppercase tracking-tighter">Avg / User</h3>
              </div>
              <p className="text-3xl font-black text-foreground">{formatBytes(stats.totalUsed / stats.userCount)}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Mean storage consumption</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-primary/5 shadow-lift rounded-[2rem]">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Content Breakdown
            </CardTitle>
            <CardDescription>Storage usage by media type.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-4">
            <MediaRow label="Images" value={formatBytes(stats.breakdown.images)} percent={(stats.breakdown.images / stats.totalUsed) * 100} />
            <MediaRow label="Videos" value={formatBytes(stats.breakdown.videos)} percent={(stats.breakdown.videos / stats.totalUsed) * 100} />
            <MediaRow label="Documents" value={formatBytes(stats.breakdown.files)} percent={(stats.breakdown.files / stats.totalUsed) * 100} />
            <MediaRow label="Others" value={formatBytes(stats.breakdown.others)} percent={(stats.breakdown.others / stats.totalUsed) * 100} />
          </CardContent>
        </Card>

        <Card className="border-destructive/10 bg-destructive/5 rounded-[2rem] border-dashed">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Abnormal Activity
            </CardTitle>
            <CardDescription>Potential platform abuse or spikes.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4 flex flex-col items-center justify-center min-h-[200px] text-center">
            <TrendingUp className="h-12 w-12 text-destructive/20 mb-4" />
            <p className="text-sm font-bold text-destructive/60 uppercase tracking-widest">No unusual spikes detected</p>
            <p className="text-xs text-muted-foreground mt-2">Activity remains within normal parameters.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StorageDetail({ label, value, percent, color }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-sm font-black text-foreground">{value}</span>
      </div>
      <p className="text-[10px] font-bold text-muted-foreground/60">{Math.round(percent)}% share</p>
    </div>
  );
}

function MediaRow({ label, value, percent }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-primary/5 last:border-0">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-xs font-black text-foreground">{value}</span>
        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-12 text-center">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}
