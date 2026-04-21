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

  const isImage = item.type === "image" && item.thumbnail_url && !imgError;
  const isVideo = item.type === "video";
  const isLink = item.type === "link";
  const isNote = item.type === "note" || item.type === "code";
  const isPDF = item.file_name?.toLowerCase().endsWith(".pdf");

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[1.5rem] border-0 bg-card shadow-card transition-all duration-300 hover:shadow-lift cursor-pointer",
        isImage ? "h-fit" : "aspect-square sm:aspect-auto"
      )}
      onClick={() => onOpen(item)}
    >
      {/* Action Menu (Visible on hover) */}
      <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(item); }}
          className={cn(
            "rounded-full p-2 bg-card/90 shadow-sm border border-border text-muted-foreground hover:text-primary transition-colors",
            item.is_pinned && "text-primary opacity-100"
          )}
        >
          {item.is_pinned ? <PinIcon className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="rounded-full p-2 bg-card/90 shadow-sm border border-border text-muted-foreground hover:text-primary">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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

      {/* Item Body */}
      <div className="flex-1">
        {isImage ? (
          <div className="relative">
            <img
              src={item.thumbnail_url!}
              alt={item.file_name!}
              onError={() => setImgError(true)}
              className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="flex items-center gap-2 p-4 bg-card">
              <div className="bg-sky-soft p-1.5 rounded-lg text-primary">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold truncate max-w-[150px]">{item.file_name}</span>
                <span className="text-[10px] text-muted-foreground">{formatBytes(item.file_size)} • {formatRelative(item.created_at)}</span>
              </div>
            </div>
          </div>
        ) : isLink ? (
          <div className="flex flex-col p-6 h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-sky-soft p-2 rounded-xl text-primary">
                <LinkIcon className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-primary truncate">{getDomain(item.link_url ?? "")}</span>
            </div>
            <h3 className="text-base font-bold text-foreground mb-2 line-clamp-2">{item.link_title || item.title || "Untitled Link"}</h3>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{item.content || "No description available"}</p>
            {item.link_image && !imgError && (
              <img
                src={item.link_image}
                className="mt-auto rounded-xl h-32 w-full object-cover border border-border"
                onError={() => setImgError(true)}
              />
            )}
          </div>
        ) : isNote ? (
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-sky-soft p-2 rounded-xl text-primary">
                <FileText className="h-5 w-5" />
              </div>
              {item.is_pinned && <PinIcon className="h-4 w-4 text-primary fill-current" />}
            </div>
            <h3 className="text-base font-bold text-foreground mb-3 line-clamp-1">{item.title || "Quick Note"}</h3>
            <div className="text-sm text-muted-foreground line-clamp-[6] whitespace-pre-wrap">
              {item.content}
            </div>
            <div className="mt-auto pt-4 text-xs text-muted-foreground font-medium">
              {formatRelative(item.created_at)}
            </div>
          </div>
        ) : (
          <div className="p-6 h-full flex flex-col items-start">
            <div className="flex items-center justify-between w-full mb-4">
              <div className={cn(
                "p-3 rounded-xl text-white shadow-sm",
                isPDF ? "bg-red-500" : fileTypeColor(fileExtBadge(item.file_name))
              )}>
                {isPDF ? <span className="font-bold text-xs uppercase">PDF</span> : <FileText className="h-6 w-6" />}
              </div>
            </div>
            <h3 className="text-base font-bold text-foreground mb-4 line-clamp-2 leading-tight">
              {item.file_name || item.title || "Untitled File"}
            </h3>
            <div className="mt-auto flex items-center justify-between w-full text-xs text-muted-foreground font-semibold">
              <span>{formatBytes(item.file_size)}</span>
              <span>{formatRelative(item.created_at)}</span>
            </div>
          </div>
        )}
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
