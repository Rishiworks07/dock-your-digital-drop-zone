import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/item-helpers";
import { cn } from "@/lib/utils";
import { HardDrive } from "lucide-react";

interface Props {
  used: number;
  limit: number;
}

export function StorageBar({ used, limit }: Props) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="rounded-2xl bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Storage Space</h3>
        <span className="text-sm font-bold text-primary">
          {formatBytes(used)} <span className="font-normal text-muted-foreground">/ {formatBytes(limit)}</span>
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/80 border border-border/20">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary),0.4)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
