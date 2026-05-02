import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createNote, createLink } from "@/lib/upload";
import { isUrl } from "@/lib/item-helpers";
import { useStatus } from "@/components/ui/QuickStatus";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  onCreated: () => void;
  spaceId?: string | null;
}

export function NoteModal({ open, onOpenChange, userId, onCreated, spaceId }: Props) {
  const { showStatus } = useStatus();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setTitle(""); setContent(""); setTagsRaw(""); }
  }, [open]);

  const submit = async () => {
    if (!content.trim()) { showStatus("Add some content", "error"); return; }
    setBusy(true);
    try {
      const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      await createNote(userId, title, content, tags, spaceId);
      showStatus("Note saved", "success");
      onCreated();
      onOpenChange(false);
    } catch (e) {
      showStatus("Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Create note</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title (optional)</Label>
            <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-content">Content</Label>
            <Textarea id="note-content" value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Type your note…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-tags">Tags (comma separated)</Label>
            <Input id="note-tags" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="idea, todo" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-primary-gradient">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LinkModal({ open, onOpenChange, userId, onCreated, spaceId }: Props) {
  const { showStatus } = useStatus();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) setUrl(""); }, [open]);

  const submit = async () => {
    if (!isUrl(url)) { showStatus("Enter a valid URL", "error"); return; }
    setBusy(true);
    try {
      await createLink(userId, url.trim(), spaceId);
      showStatus("Link saved", "success");
      onCreated();
      onOpenChange(false);
    } catch (e) {
      showStatus("Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Save link</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="link-url">URL</Label>
          <Input id="link-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-primary-gradient">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
