import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Anchor, ArrowDownAZ, ArrowDownWideNarrow, Clipboard, FileText,
  Link as LinkIcon, Loader2, LogOut, Search, Settings, User, X, PinIcon,
  Moon, Sun, FolderPlus, Users, AtSign, Crown, HelpCircle
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
import { NotificationsPanel } from "@/components/dock/NotificationsPanel";
import { CreateSpaceModal } from "@/components/dock/CreateSpaceModal";
import { SpaceMembersModal } from "@/components/dock/SpaceMembersModal";
import { ProductTour } from "@/components/dock/ProductTour";
import { useSharedSpaces, type SharedSpace } from "@/lib/shared-spaces-context";
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
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const userId = user!.id;
  const { spaces } = useSharedSpaces();

  const [items, setItems] = useState<Item[]>([]);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(STORAGE_LIMIT);
  const [loading, setLoading] = useState(true);
  const [activeSpace, setActiveSpace] = useState<SharedSpace | null>(null);
  const [activeTab, setActiveTab] = useState<"dock" | "vault">("dock");

  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [noteOpen, setNoteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const { theme, toggleTheme } = useTheme();

  // Sync states
  const [syncState, setSyncState] = useState<"synced" | "pending" | "syncing">("synced");
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAll = useCallback(async (isAutoSync = false) => {
    if (!isAutoSync) setSyncState("syncing");

    try {
      if (activeSpace) {
        // --- Shared Space Mode ---
        const [itemsRes, usageRes] = await Promise.all([
          supabase.from("items").select("*").eq("space_id", activeSpace.id).order("created_at", { ascending: false }),
          supabase.from("items").select("file_size").eq("space_id", activeSpace.id),
        ]);

        if (itemsRes.error) toast.error(itemsRes.error.message);
        else setItems((itemsRes.data ?? []) as Item[]);

        const totalUsed = (usageRes.data ?? []).reduce((acc, curr) => acc + (curr.file_size || 0), 0);
        setUsedBytes(totalUsed);
        setLimitBytes(1024 * 1024 * 1024); // 1GB
        setLoading(false);
      } else {
        // --- Personal Mode (Dock or Vault) ---
        const isVault = activeTab === "vault";
        const itemsRes = await supabase
          .from("items")
          .select("*")
          .eq("user_id", userId)
          .is("space_id", null)
          .eq("is_vaulted", isVault)
          .order("created_at", { ascending: false });

        if (itemsRes.error) {
          toast.error(itemsRes.error.message);
        } else {
          const fetchedItems = (itemsRes.data ?? []) as Item[];
          setItems(fetchedItems);
          
          // Calculate used bytes from fetched items directly
          const totalUsed = fetchedItems.reduce((acc, curr) => acc + (curr.file_size || 0), 0);
          setUsedBytes(totalUsed);
          setLimitBytes(isVault ? 200 * 1024 * 1024 : STORAGE_LIMIT); // 200MB Vault, 5GB Dock
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setSyncState("synced");
    }
  }, [userId, activeSpace, activeTab]);

  const handleManualSync = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchAll(true); // Initial load is "auto" to avoid animation
    if (profile && !profile.has_seen_guide) {
      setTourOpen(true);
    }
  }, [fetchAll, profile]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel("items-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, (payload) => {
        // If in space mode, only sync if payload matches current space
        if (activeSpace) {
          if (payload.new && (payload.new as any).space_id === activeSpace.id) fetchAll();
          if (payload.old && (payload.old as any).space_id === activeSpace.id) fetchAll();
          return;
        }
        // If in personal mode, only sync if payload has no space_id and matches user
        if ((payload.new as any)?.user_id === userId && !(payload.new as any)?.space_id) {
          fetchAll();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_storage", filter: `user_id=eq.${userId}` }, () => {
        if (!activeSpace) fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [userId, activeSpace, activeTab, fetchAll]);

  const handleFiles = useCallback(async (files: File[]) => {
    setUploading(true);
    setUploadProgress(0);
    let usedSoFar = usedBytes;
    let success = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const item = await uploadFileItem(files[i], { 
          userId, 
          usedBytes: usedSoFar, 
          limitBytes,
          spaceId: activeSpace?.id,
          isVaulted: !activeSpace && activeTab === "vault"
        });
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
  }, [userId, usedBytes, limitBytes, fetchAll, activeSpace, activeTab]);

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
        const isVaulted = !activeSpace && activeTab === "vault";
        if (isUrl(text)) {
          await createLink(userId, text.trim(), activeSpace?.id, isVaulted);
          toast.success("Link saved");
        } else {
          await createNote(userId, "", text, [], activeSpace?.id, isVaulted);
          toast.success("Note saved");
        }
        fetchAll();
      } catch (err) {
        toast.error((err as Error).message);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [userId, handleFiles, fetchAll, activeSpace, activeTab]);

  const togglePin = async (item: Item) => {
    const { error } = await supabase.from("items").update({ is_pinned: !item.is_pinned }).eq("id", item.id);
    if (error) toast.error(error.message);
    else fetchAll();
  };

  const moveToVault = async (item: Item) => {
    const { error } = await supabase.from("items").update({ is_vaulted: true }).eq("id", item.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Moved to Vault");
      fetchAll();
    }
  };

  const performDelete = async (item: Item) => {
    try {
      await deleteItem(userId, { id: item.id, file_path: item.file_path, type: item.type, title: item.title ?? item.file_name });
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
      const isVaulted = !activeSpace && activeTab === "vault";
      if (isUrl(text)) {
        await createLink(userId, text.trim(), activeSpace?.id, isVaulted);
        toast.success("Link saved");
      } else {
        await createNote(userId, "", text, [], activeSpace?.id, isVaulted);
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
          <button onClick={() => setActiveSpace(null)} className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-primary">Dock</h1>
          </button>

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
            {/* Notifications bell */}
            <div id="notifications-bell">
              <NotificationsPanel />
            </div>

            <button
              onClick={handleManualSync}
              disabled={syncState === "syncing"}
              className={cn(
                "relative overflow-hidden hidden lg:flex items-center gap-3 mr-4 px-3 py-1.5 rounded-full border shadow-sm transition-all duration-500 group min-w-[155px] justify-center",
                syncState === "synced" && "bg-sky-soft/40 border-border/50 hover:bg-sky-soft/70 hover:shadow-lift hover:-translate-y-0.5",
                syncState === "pending" && "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:-translate-y-0.5",
                syncState === "syncing" && "bg-transparent border-transparent shadow-none cursor-wait"
              )}
            >
              {/* Infinity light animation overlay */}
              <svg
                className={cn(
                  "pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300",
                  syncState === "synced" ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                )}
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <filter id="infinity-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation={syncState === "syncing" ? "1.5" : "0.8"} result="blur" />
                    <feComponentTransfer in="blur">
                      <feFuncA type="linear" slope={syncState === "syncing" ? "3" : "1.5"} />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="comet-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#ffffff" />
                  </linearGradient>
                </defs>
                <path
                  id="infinity-path"
                  d="M 20,20 C 20,5 45,5 50,20 C 55,35 80,35 80,20 C 80,5 55,5 50,20 C 45,35 20,35 20,20 Z"
                  fill="none"
                  stroke={
                    syncState === "synced" ? "var(--primary)" :
                      syncState === "pending" ? "#f59e0b" : "#6366f1"
                  }
                  strokeOpacity="0.1"
                  strokeWidth="0.6"
                />
                {/* The "Comet" Path */}
                <path
                  d="M 20,20 C 20,5 45,5 50,20 C 55,35 80,35 80,20 C 80,5 55,5 50,20 C 45,35 20,35 20,20 Z"
                  fill="none"
                  stroke="url(#comet-gradient)"
                  strokeWidth={syncState === "syncing" ? "2.5" : "1.2"}
                  strokeDasharray={syncState === "syncing" ? "30 70" : "10 90"}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  filter="url(#infinity-glow-strong)"
                  pathLength="100"
                  className={cn(
                    "transition-all duration-500",
                    syncState === "synced" ? "opacity-0" : "opacity-100"
                  )}
                  style={{
                    animation: `dash-scroll ${syncState === "syncing" ? '0.8s' : '2.4s'} linear infinite`
                  }}
                />
                {/* Synced State Circles (Original Style) */}
                {syncState === "synced" && (
                  <>
                    <circle r="1.6" fill="var(--primary-glow)" filter="url(#infinity-blur)" className="infinity-glow">
                      <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto">
                        <mpath href="#infinity-path" />
                      </animateMotion>
                    </circle>
                    <circle r="0.9" fill="var(--primary)">
                      <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto">
                        <mpath href="#infinity-path" />
                      </animateMotion>
                    </circle>
                  </>
                )}
              </svg>
              <div className={cn(
                "relative flex items-center justify-center z-10 transition-all duration-300",
                syncState === "syncing" ? "opacity-0 scale-50" : "opacity-100 scale-100"
              )}>
                <div className={cn(
                  "h-2 w-2 rounded-full transition-colors duration-300",
                  syncState === "synced" && "bg-primary",
                  syncState === "pending" && "bg-amber-500 animate-bounce",
                  syncState === "syncing" && "bg-indigo-500 animate-spin"
                )} />
                <div className={cn(
                  "absolute h-4 w-4 rounded-full transition-all duration-300 animate-pulse-soft",
                  syncState === "synced" && "bg-primary/40",
                  syncState === "pending" && "bg-amber-500/40",
                  syncState === "syncing" && "bg-indigo-500/40"
                )} />
              </div>
              <span className={cn(
                "relative z-10 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap",
                syncState === "synced" && "text-primary",
                syncState === "pending" && "text-amber-600",
                syncState === "syncing" && "text-indigo-600 opacity-0 scale-95"
              )}>
                Sync your Workspace
              </span>
            </button>

            <div className="flex items-center gap-1.5">
              {/* Username display */}
              {profile?.username && (
                <span className="hidden md:flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted/40 rounded-full px-3 py-1.5">
                  <AtSign className="h-3 w-3" />{profile.username}
                </span>
              )}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setTourOpen(true)}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all"
                aria-label="Start product tour"
              >
                <HelpCircle className="h-5 w-5" />
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
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {activeSpace ? (
              <>
                <button 
                  onClick={() => setActiveSpace(null)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  My Dock
                </button>
                <span className="text-muted-foreground">/</span>
                <h2 className="text-xl font-bold text-foreground">{activeSpace.name}</h2>
                {activeSpace.role === "owner" && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setMembersOpen(true)}
                    className="ml-2 h-7 gap-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-black uppercase tracking-wider px-3"
                  >
                    <Users className="h-3 w-3" /> Manage Members
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setActiveTab("dock")}
                  className={cn(
                    "text-xl font-bold transition-all",
                    activeTab === "dock" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                  )}
                >
                  Temporary Dock
                </button>
                <div className="h-5 w-px bg-border"></div>
                <button
                  id="vault-tab"
                  onClick={() => setActiveTab("vault")}
                  className={cn(
                    "text-xl font-bold transition-all",
                    activeTab === "vault" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                  )}
                >
                  Private Vault
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {activeSpace 
              ? "Shared with your partners" 
              : activeTab === "dock" 
                ? "Auto-deletes items after 24 hours" 
                : "Permanent, secure storage (200MB limit)"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Left Column: Upload Zone */}
          <div className="lg:col-span-2">
            <UploadZone id="upload-zone" onFiles={handleFiles} uploading={uploading} progress={uploadProgress} disabled={isFull} className="h-full" />
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

        {/* ── Shared Spaces Section ── */}
        {!activeSpace && (
          <section id="spaces-section" className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Shared Spaces</h2>
                {spaces.length > 0 && (
                  <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">{spaces.length}</span>
                )}
              </div>
              <button
                onClick={() => {
                  if (spaces.filter(s => s.role === "owner").length >= 5) {
                    toast.error("You can only create up to 5 shared spaces.");
                    return;
                  }
                  setCreateSpaceOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold px-4 py-2 transition-all hover:-translate-y-0.5"
              >
                <FolderPlus className="h-3.5 w-3.5" /> New Space
              </button>
            </div>

            {spaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/20 bg-card/50 py-12 text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Users className="h-7 w-7 text-primary/60" />
                </div>
                <p className="font-bold text-foreground text-sm">No shared spaces yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">Create a space to collaborate with others or wait for an invite.</p>
                <button
                  onClick={() => {
                    if (spaces.filter(s => s.role === "owner").length >= 5) {
                      toast.error("You can only create up to 5 shared spaces.");
                      return;
                    }
                    setCreateSpaceOpen(true);
                  }}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-primary text-white text-xs font-bold px-4 py-2.5 transition-all hover:-translate-y-0.5 shadow-lift"
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Create First Space
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {spaces.map(space => (
                  <SpaceCard key={space.id} space={space} onClick={() => setActiveSpace(space)} />
                ))}
              </div>
            )}
          </section>
        )}

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
                  onMoveToVault={moveToVault}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateSpaceModal open={createSpaceOpen} onOpenChange={setCreateSpaceOpen} />
      <SpaceMembersModal 
        open={membersOpen} 
        onOpenChange={setMembersOpen} 
        space={activeSpace} 
        onUpdate={fetchAll} 
        onSpaceDeleted={() => setActiveSpace(null)}
      />
      <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} userId={userId} />
      <NoteModal open={noteOpen} onOpenChange={setNoteOpen} userId={userId} onCreated={fetchAll} spaceId={activeSpace?.id} />
      <LinkModal open={linkOpen} onOpenChange={setLinkOpen} userId={userId} onCreated={fetchAll} spaceId={activeSpace?.id} />
      <ItemDetailModal
        item={detailItem}
        onOpenChange={(o) => !o && setDetailItem(null)}
        onDelete={(i) => {
          setDetailItem(null);
          setConfirmDelete(i);
        }}
      />
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-lg overflow-hidden">
          <AlertDialogHeader className="min-w-0">
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col gap-1 min-w-0">
              <span className="font-medium text-foreground truncate block w-full">
                {confirmDelete?.title || confirmDelete?.file_name || "This item"}
              </span>
              <span className="text-xs">This cannot be undone.</span>
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

function SpaceCard({ space, onClick }: { space: SharedSpace; onClick: () => void }) {
  const isOwner = space.role === "owner";
  return (
    <div 
      onClick={onClick}
      className="group relative rounded-2xl bg-card border border-border/50 p-5 shadow-card hover:shadow-lift transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary-gradient flex items-center justify-center shadow-sm">
          <Users className="h-5 w-5 text-white" />
        </div>
        {isOwner && (
          <span className="flex items-center gap-1 rounded-full bg-warning/10 text-warning text-[10px] font-black uppercase tracking-wider px-2 py-1">
            <Crown className="h-2.5 w-2.5" /> Owner
          </span>
        )}
      </div>

      <h3 className="font-bold text-foreground truncate text-base mb-1">{space.name}</h3>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="h-3 w-3" />
        {space.member_count} member{space.member_count !== 1 ? "s" : ""}
      </p>

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}
