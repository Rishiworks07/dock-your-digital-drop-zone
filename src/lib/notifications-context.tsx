import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export interface AppNotification {
  id: string;
  user_id: string;
  type: "space_invite" | "invite_accepted" | "storage_warning" | "file_shared" | "expiring_soon" | string;
  title: string;
  body: string | null;
  metadata: Record<string, string>;
  is_read: boolean;
  status: "pending" | "accepted" | "declined" | "resolved";
  expires_at: string | null;
  created_at: string;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  acceptInvite: (notifId: string, spaceId: string) => Promise<void>;
  declineInvite: (notifId: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const THIRTY_MIN_MS = 30 * 60 * 1000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); return; }
    setLoading(true);
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false });
    setNotifications((data ?? []) as AppNotification[]);
    setLoading(false);
  }, [user]);

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel("notifications-rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [user]);

  const acceptInvite = useCallback(async (notifId: string, spaceId: string) => {
    if (!user) return;
    const expiresAt = new Date(Date.now() + THIRTY_MIN_MS).toISOString();

    // Add to space members
    await supabase.from("shared_space_members").upsert(
      { space_id: spaceId, user_id: user.id, role: "member" },
      { onConflict: "space_id,user_id" }
    );

    // Mark notification resolved with 30-min expiry
    await supabase.from("notifications").update({
      status: "accepted",
      is_read: true,
      expires_at: expiresAt,
    }).eq("id", notifId);

    // Notify the inviter
    const notif = notifications.find(n => n.id === notifId);
    if (notif?.metadata?.inviter_id && notif?.metadata?.space_name) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();

      await supabase.from("notifications").insert({
        user_id: notif.metadata.inviter_id,
        type: "invite_accepted",
        title: `@${myProfile?.username ?? "Someone"} joined "${notif.metadata.space_name}"`,
        body: null,
        metadata: { space_id: spaceId, space_name: notif.metadata.space_name },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    await fetchNotifications();
  }, [user, notifications, fetchNotifications]);

  const declineInvite = useCallback(async (notifId: string) => {
    const expiresAt = new Date(Date.now() + THIRTY_MIN_MS).toISOString();
    await supabase.from("notifications").update({
      status: "declined",
      is_read: true,
      expires_at: expiresAt,
    }).eq("id", notifId);
    await fetchNotifications();
  }, [fetchNotifications]);

  const dismiss = useCallback(async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const value = useMemo(() => ({
    notifications, unreadCount, loading,
    markRead, markAllRead, acceptInvite, declineInvite, dismiss, refresh: fetchNotifications,
  }), [notifications, unreadCount, loading, markRead, markAllRead, acceptInvite, declineInvite, dismiss, fetchNotifications]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
