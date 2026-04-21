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
  const isFull = pct >= 100;
  const isWarn = pct >= 80;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HardDrive className="h-4 w-4 text-primary" />
          Storage
        </div>
        <span className={cn(
          "text-sm tabular-nums",
          isFull ? "text-destructive" : isWarn ? "text-warning" : "text-muted-foreground",
        )}>
          {formatBytes(used)} / {formatBytes(limit)} used
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-base",
            isFull ? "bg-destructive" : isWarn ? "bg-warning" : "bg-primary-gradient",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isFull && (
        <p className="mt-2 text-xs text-destructive">Storage full. Delete items to upload more.</p>
      )}
    </div>
  );
}
