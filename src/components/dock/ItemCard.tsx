import { useState } from "react";
import {
  Code2, Download, ExternalLink, FileText, Image as ImageIcon,
  Link as LinkIcon, MoreVertical, PinIcon, PinOff, Play, Trash2, Copy,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fileExtBadge, fileTypeColor, formatBytes, formatRelative, getDomain } from "@/lib/item-helpers";
import type { Item } from "./types";
import { toast } from "sonner";

interface Props {
  item: Item;
  onTogglePin: (item: Item) => void;
  onDelete: (item: Item) => void;
  onOpen: (item: Item) => void;
}

export function ItemCard({ item, onTogglePin, onDelete, onOpen }: Props) {
  const [imgError, setImgError] = useState(false);

  const copyContent = async () => {
    let text = "";
    if (item.type === "link") text = item.link_url ?? "";
    else if (item.type === "note" || item.type === "code") text = item.content ?? "";
    else if (item.file_url) text = item.file_url;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-base hover:-translate-y-0.5 hover:shadow-lift cursor-pointer animate-fade-in-up"
      onClick={() => onOpen(item)}
    >
      {/* Pin button */}
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePin(item); }}
        className={cn(
          "absolute right-2 top-2 z-10 rounded-full p-1.5 transition-base",
          item.is_pinned
            ? "bg-primary text-primary-foreground"
            : "bg-card/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent",
        )}
        aria-label={item.is_pinned ? "Unpin" : "Pin"}
      >
        {item.is_pinned ? <PinIcon className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
      </button>

      {/* Menu */}
      <div className="absolute left-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-base">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-card/80 hover:bg-accent">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={copyContent}><Copy className="h-4 w-4" />Copy</DropdownMenuItem>
            {item.file_url && (
              <DropdownMenuItem onClick={() => window.open(item.file_url!, "_blank")}>
                <Download className="h-4 w-4" />Download
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive">
              <Trash2 className="h-4 w-4" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body by type */}
      {item.type === "image" && item.thumbnail_url && !imgError ? (
        <div className="aspect-square w-full overflow-hidden bg-muted">
          <img
            src={item.thumbnail_url}
            alt={item.file_name ?? "image"}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        </div>
      ) : item.type === "video" ? (
        <div className="relative aspect-square w-full overflow-hidden bg-foreground/90 flex items-center justify-center">
          <Play className="h-12 w-12 text-white" />
        </div>
      ) : item.type === "link" ? (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-sky-soft to-accent">
          {item.link_favicon ? (
            <img src={item.link_favicon} alt="" className="h-10 w-10 rounded" loading="lazy" />
          ) : (
            <LinkIcon className="h-10 w-10 text-primary" />
          )}
        </div>
      ) : item.type === "code" ? (
        <div className="aspect-[16/10] w-full overflow-hidden bg-foreground p-3 font-mono text-[11px] text-white/90">
          <pre className="line-clamp-5 whitespace-pre-wrap break-all">{item.content?.slice(0, 200) ?? ""}</pre>
        </div>
      ) : item.type === "note" ? (
        <div className="aspect-[16/10] w-full bg-gradient-to-br from-sky-soft to-card p-4">
          <FileText className="mb-2 h-5 w-5 text-primary" />
          <p className="line-clamp-4 text-sm text-foreground/80">{item.content}</p>
        </div>
      ) : (
        // file
        <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-sky-soft to-card">
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl text-white", fileTypeColor(fileExtBadge(item.file_name)))}>
            <span className="text-xs font-bold">{fileExtBadge(item.file_name)}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5 text-xs text-primary">
          {iconForType(item.type)}
          <span className="capitalize">{item.type}</span>
        </div>
        <p className="line-clamp-1 text-sm font-medium text-foreground">
          {item.title || item.file_name || (item.type === "link" ? getDomain(item.link_url ?? "") : "Untitled")}
        </p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{item.file_size ? formatBytes(item.file_size) : item.type === "link" ? getDomain(item.link_url ?? "") : ""}</span>
          <span>{formatRelative(item.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function iconForType(type: Item["type"]) {
  const cls = "h-3 w-3";
  switch (type) {
    case "image": return <ImageIcon className={cls} />;
    case "video": return <Play className={cls} />;
    case "link": return <ExternalLink className={cls} />;
    case "code": return <Code2 className={cls} />;
    case "note": return <FileText className={cls} />;
    default: return <FileText className={cls} />;
  }
}
