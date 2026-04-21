import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, ExternalLink, Trash2 } from "lucide-react";
import { formatBytes, formatRelative, getDomain } from "@/lib/item-helpers";
import { toast } from "sonner";
import type { Item } from "./types";

interface Props {
  item: Item | null;
  onOpenChange: (o: boolean) => void;
  onDelete: (i: Item) => void;
}

export function ItemDetailModal({ item, onOpenChange, onDelete }: Props) {
  if (!item) return null;

  const copy = async () => {
    let text = "";
    if (item.type === "link") text = item.link_url ?? "";
    else if (item.type === "note" || item.type === "code") text = item.content ?? "";
    else text = item.file_url ?? "";
    if (text) {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-2 pr-8">
            {item.title || item.file_name || (item.type === "link" ? getDomain(item.link_url ?? "") : "Untitled")}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto">
          {item.type === "image" && item.file_url && (
            <img src={item.file_url} alt={item.file_name ?? ""} className="mx-auto max-h-[55vh] rounded-lg object-contain" />
          )}
          {item.type === "video" && item.file_url && (
            <video src={item.file_url} controls className="mx-auto max-h-[55vh] w-full rounded-lg bg-black" />
          )}
          {item.type === "note" && (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">{item.content}</pre>
          )}
          {item.type === "code" && (
            <pre className="overflow-auto rounded-lg bg-foreground p-4 font-mono text-xs text-white">{item.content}</pre>
          )}
          {item.type === "link" && (
            <div className="flex flex-col items-center gap-3 p-6">
              {item.link_favicon && <img src={item.link_favicon} alt="" className="h-12 w-12 rounded" />}
              <a href={item.link_url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-lg font-medium text-primary hover:underline">
                {getDomain(item.link_url ?? "")}
              </a>
              <p className="break-all text-xs text-muted-foreground">{item.link_url}</p>
            </div>
          )}
          {item.type === "file" && (
            <div className="flex flex-col items-center gap-3 p-6">
              <p className="text-sm text-muted-foreground">{item.file_name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(item.file_size)} · {item.file_type}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>{formatRelative(item.created_at)}</span>
          {item.file_size > 0 && <span>{formatBytes(item.file_size)}</span>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" />Copy</Button>
          {item.file_url && (
            <Button variant="outline" onClick={() => window.open(item.file_url!, "_blank")}>
              <Download className="h-4 w-4" />Download
            </Button>
          )}
          {item.type === "link" && item.link_url && (
            <Button variant="outline" onClick={() => window.open(item.link_url!, "_blank")}>
              <ExternalLink className="h-4 w-4" />Open
            </Button>
          )}
          <Button variant="destructive" onClick={() => onDelete(item)}>
            <Trash2 className="h-4 w-4" />Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
