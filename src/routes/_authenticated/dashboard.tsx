import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Anchor, ArrowDownAZ, ArrowDownWideNarrow, Clipboard, FileText,
  Link as LinkIcon, Loader2, LogOut, Search, Settings, User, X, PinIcon,
  Moon, Sun,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
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
  const { theme, toggleTheme } = useTheme();

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
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8">
          <Link to="/dashboard" className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-primary">Dock</h1>
          </Link>

          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search your items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border-none bg-muted/50 py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-3 mr-4 px-3 py-1.5 rounded-full bg-sky-soft/40 border border-border/50 shadow-sm transition-all hover:bg-sky-soft/60 cursor-default group">
              <div className="relative flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <div className="absolute h-4 w-4 rounded-full bg-primary/40 animate-pulse-soft" />
              </div>
              <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Workspace Synced</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>
              <button
                onClick={() => navigate({ to: "/settings" })}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hidden sm:block hover:bg-muted/50 transition-all"
              >
                <Settings className="h-5 w-5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 rounded-full transition-all hover:ring-2 hover:ring-primary/20">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-primary text-white font-bold text-xs">{initial}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2">
                  <div className="px-4 py-3 border-b">
                    <p className="text-sm font-bold text-foreground">Logged in as</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })} className="mt-1">
                    <User className="h-4 w-4" />Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    <Settings className="h-4 w-4" />Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }} className="text-destructive">
                    <LogOut className="h-4 w-4" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Left Column: Upload Zone */}
          <div className="lg:col-span-2">
            <UploadZone onFiles={handleFiles} uploading={uploading} progress={uploadProgress} disabled={isFull} className="h-full" />
          </div>

          {/* Right Column: Sidebar */}
          <div className="space-y-8">
            <div className="rounded-2xl bg-card p-6 shadow-card">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-6 border-b pb-2">Quick Actions</h3>
              <div className="space-y-4">
                <button
                  onClick={() => setNoteOpen(true)}
                  className="group w-full flex items-center gap-4 p-4 rounded-xl bg-sky-soft/50 hover:bg-sky-soft/80 transition-all border border-border/50 hover:border-primary/40 shadow-sm"
                >
                  <div className="bg-sky-soft p-2.5 rounded-lg text-primary shadow-sm group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-foreground">Quick Note</span>
                </button>
                <button
                  onClick={() => setLinkOpen(true)}
                  className="group w-full flex items-center gap-4 p-4 rounded-xl bg-sky-soft/50 hover:bg-sky-soft/80 transition-all border border-border/50 hover:border-primary/40 shadow-sm"
                >
                  <div className="bg-sky-soft p-2.5 rounded-lg text-primary shadow-sm group-hover:scale-110 transition-transform">
                    <LinkIcon className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-foreground">Save Link</span>
                </button>
                <button
                  onClick={pasteFromClipboard}
                  className="group w-full flex items-center gap-4 p-4 rounded-xl bg-sky-soft/50 hover:bg-sky-soft/80 transition-all border border-border/50 hover:border-primary/40 shadow-sm"
                >
                  <div className="bg-sky-soft p-2.5 rounded-lg text-primary shadow-sm group-hover:scale-110 transition-transform">
                    <Clipboard className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-foreground">Paste Text</span>
                </button>
              </div>
            </div>

            <StorageBar used={usedBytes} limit={limitBytes} />
          </div>
        </div>

        {/* Filters and Grid Area */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide py-4 px-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full px-6 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300",
                  filter === f.id
                    ? "bg-card text-primary shadow-lg border border-primary/10 -translate-y-0.5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {f.label}
                {f.id === "pinned" && <PinIcon className="inline ml-2 h-3.5 w-3.5 fill-current" />}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : visible.length === 0 ? (
            <EmptyState hasItems={items.length > 0} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
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
        </div>
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
    </div >
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
