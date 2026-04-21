import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Anchor, ArrowDownAZ, ArrowDownWideNarrow, Clipboard, FileText,
  Link as LinkIcon, Loader2, LogOut, Search, Settings, User, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { UploadZone } from "@/components/dock/UploadZone";
import { StorageBar } from "@/components/dock/StorageBar";
import { ItemCard } from "@/components/dock/ItemCard";
import { ItemDetailModal } from "@/components/dock/ItemDetailModal";
import { LinkModal, NoteModal } from "@/components/dock/QuickModals";
import type { FilterType, Item, SortType } from "@/components/dock/types";
import { createLink, createNote, deleteItem, uploadFileItem } from "@/lib/upload";
import { isUrl, STORAGE_LIMIT } from "@/lib/item-helpers";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "note", label: "Text" },
  { id: "image", label: "Images" },
  { id: "file", label: "Files" },
  { id: "link", label: "Links" },
  { id: "video", label: "Videos" },
  { id: "pinned", label: "Pinned" },
];

function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const userId = user!.id;

  const [items, setItems] = useState<Item[]>([]);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(STORAGE_LIMIT);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [noteOpen, setNoteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAll = useCallback(async () => {
    const [itemsRes, storageRes] = await Promise.all([
      supabase.from("items").select("*").order("created_at", { ascending: false }),
      supabase.from("user_storage").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (itemsRes.error) toast.error(itemsRes.error.message);
    else setItems((itemsRes.data ?? []) as Item[]);
    if (storageRes.data) {
      setUsedBytes(Number(storageRes.data.used_bytes));
      setLimitBytes(Number(storageRes.data.limit_bytes));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel("items-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `user_id=eq.${userId}` }, () => {
        fetchAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_storage", filter: `user_id=eq.${userId}` }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchAll]);

  const handleFiles = useCallback(async (files: File[]) => {
    setUploading(true);
    setUploadProgress(0);
    let usedSoFar = usedBytes;
    let success = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const item = await uploadFileItem(files[i], { userId, usedBytes: usedSoFar, limitBytes });
        usedSoFar += item.file_size;
        success++;
      } catch (e) {
        toast.error((e as Error).message);
      }
      setUploadProgress(((i + 1) / files.length) * 100);
    }
    setUploading(false);
    if (success) toast.success(`${success} item${success > 1 ? "s" : ""} uploaded`);
    fetchAll();
  }, [userId, usedBytes, limitBytes, fetchAll]);

  // Global paste detection
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!e.clipboardData) return;
      const filesArr = Array.from(e.clipboardData.files);
      if (filesArr.length) {
        e.preventDefault();
        await handleFiles(filesArr);
        return;
      }
      const text = e.clipboardData.getData("text");
      if (!text) return;
      e.preventDefault();
      try {
        if (isUrl(text)) {
          await createLink(userId, text.trim());
          toast.success("Link saved");
        } else {
          await createNote(userId, "", text);
          toast.success("Note saved");
        }
        fetchAll();
      } catch (err) {
        toast.error((err as Error).message);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [userId, handleFiles, fetchAll]);

  const togglePin = async (item: Item) => {
    const { error } = await supabase.from("items").update({ is_pinned: !item.is_pinned }).eq("id", item.id);
    if (error) toast.error(error.message);
    else fetchAll();
  };

  const performDelete = async (item: Item) => {
    try {
      await deleteItem({ id: item.id, file_path: item.file_path });
      toast.success("Deleted");
      setConfirmDelete(null);
      setDetailItem(null);
      fetchAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast.error("Clipboard is empty"); return; }
      if (isUrl(text)) {
        await createLink(userId, text.trim());
        toast.success("Link saved");
      } else {
        await createNote(userId, "", text);
        toast.success("Note saved");
      }
      fetchAll();
    } catch {
      toast.error("Could not read clipboard");
    }
  };

  // Filter + sort
  const visible = useMemo(() => {
    let list = items;
    if (filter === "pinned") list = list.filter((i) => i.is_pinned);
    else if (filter !== "all") list = list.filter((i) => i.type === filter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((i) =>
        (i.title ?? "").toLowerCase().includes(q) ||
        (i.content ?? "").toLowerCase().includes(q) ||
        (i.file_name ?? "").toLowerCase().includes(q) ||
        (i.link_url ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest": return +new Date(a.created_at) - +new Date(b.created_at);
        case "az": return (a.title ?? a.file_name ?? "").localeCompare(b.title ?? b.file_name ?? "");
        case "size_desc": return b.file_size - a.file_size;
        case "size_asc": return a.file_size - b.file_size;
        default: return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return sorted.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
  }, [items, filter, debouncedSearch, sort]);

  const isFull = usedBytes >= limitBytes;
  const initial = (user?.email ?? "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur-md shadow-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-gradient">
              <Anchor className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Dock</span>
          </Link>

          <div className="relative mx-auto flex w-full max-w-md items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search your items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border-input bg-background pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full transition-base hover:opacity-80">
                <Avatar className="h-9 w-9 border-2 border-primary/30">
                  <AvatarFallback className="bg-primary-gradient text-white">{initial}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{user?.email}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <User className="h-4 w-4" />Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <Settings className="h-4 w-4" />Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
                <LogOut className="h-4 w-4" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <UploadZone onFiles={handleFiles} uploading={uploading} progress={uploadProgress} disabled={isFull} />

        {/* Quick actions */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Button variant="outline" onClick={() => setNoteOpen(true)} className="h-12 rounded-xl border-primary/30 bg-card text-foreground hover:bg-accent">
            <FileText className="h-4 w-4 text-primary" />Quick Note
          </Button>
          <Button variant="outline" onClick={() => setLinkOpen(true)} className="h-12 rounded-xl border-primary/30 bg-card text-foreground hover:bg-accent">
            <LinkIcon className="h-4 w-4 text-primary" />Save Link
          </Button>
          <Button variant="outline" onClick={pasteFromClipboard} className="h-12 rounded-xl border-primary/30 bg-card text-foreground hover:bg-accent">
            <Clipboard className="h-4 w-4 text-primary" />Paste Text
          </Button>
        </div>

        <StorageBar used={usedBytes} limit={limitBytes} />

        {/* Filters & sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-base",
                  filter === f.id
                    ? "border-primary bg-primary text-primary-foreground shadow-card"
                    : "border-input bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
            <SelectTrigger className="w-[180px] rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="az"><ArrowDownAZ className="mr-2 inline h-3 w-3" />A–Z</SelectItem>
              <SelectItem value="size_desc"><ArrowDownWideNarrow className="mr-2 inline h-3 w-3" />Size (Largest)</SelectItem>
              <SelectItem value="size_asc">Size (Smallest)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <EmptyState hasItems={items.length > 0} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onTogglePin={togglePin}
                onDelete={(i) => setConfirmDelete(i)}
                onOpen={(i) => setDetailItem(i)}
              />
            ))}
          </div>
        )}
      </main>

      <NoteModal open={noteOpen} onOpenChange={setNoteOpen} userId={userId} onCreated={fetchAll} />
      <LinkModal open={linkOpen} onOpenChange={setLinkOpen} userId={userId} onCreated={fetchAll} />
      <ItemDetailModal
        item={detailItem}
        onOpenChange={(o) => !o && setDetailItem(null)}
        onDelete={(i) => setConfirmDelete(i)}
      />
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.title || confirmDelete?.file_name || "This item"} — this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && performDelete(confirmDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/20 bg-card/50 py-20 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary-gradient shadow-lift">
        <Anchor className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {hasItems ? "No items match" : "Drop your first item to get started!"}
      </h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {hasItems
          ? "Try a different filter or search."
          : "Drop files, paste anything (Ctrl+V), or create a quick note above."}
      </p>
    </div>
  );
}
