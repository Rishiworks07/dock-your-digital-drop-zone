import { useEffect, useRef, useState } from "react";
import { Bell, X, Check, UserPlus, HardDrive, FileUp, Clock, CheckCheck } from "lucide-react";
import { useNotifications, type AppNotification } from "@/lib/notifications-context";
import { formatRelative } from "@/lib/item-helpers";
import { cn } from "@/lib/utils";

export function NotificationsPanel() {
  const { notifications, unreadCount, markAllRead, acceptInvite, declineInvite, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "relative p-2 rounded-full transition-all duration-200",
          open
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-black text-white leading-none shadow">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] z-50 animate-fade-in-up">
          <div className="rounded-2xl border border-border/60 bg-card shadow-lift overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-foreground text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-bold"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-[440px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Bell className="h-6 w-6 text-primary/60" />
                  </div>
                  <p className="font-bold text-foreground text-sm">You're all caught up 🎉</p>
                  <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {notifications.map(n => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      onAccept={(spaceId) => acceptInvite(n.id, spaceId)}
                      onDecline={() => declineInvite(n.id)}
                      onDismiss={() => dismiss(n.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  notification: n,
  onAccept,
  onDecline,
  onDismiss,
}: {
  notification: AppNotification;
  onAccept: (spaceId: string) => void;
  onDecline: () => void;
  onDismiss: () => void;
}) {
  const [acting, setActing] = useState(false);

  const isInvite = n.type === "space_invite";
  const isResolved = n.status === "accepted" || n.status === "declined";

  const Icon = isInvite ? UserPlus
    : n.type === "storage_warning" ? HardDrive
    : n.type === "file_shared" ? FileUp
    : n.type === "expiring_soon" ? Clock
    : Bell;

  const iconColor = isInvite ? "text-primary bg-primary/10"
    : n.type === "storage_warning" ? "text-warning bg-warning/10"
    : "text-primary bg-primary/10";

  return (
    <div className={cn(
      "group relative px-5 py-4 transition-all duration-200",
      !n.is_read && "bg-primary/3",
    )}>
      {/* Unread dot */}
      {!n.is_read && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
      )}

      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn("shrink-0 h-9 w-9 rounded-xl flex items-center justify-center", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-snug">{n.title}</p>
          {n.body && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>}
          <p className="text-[10px] text-muted-foreground mt-1 font-medium">
            {formatRelative(n.created_at)}
          </p>

          {/* Invite actions */}
          {isInvite && !isResolved && (
            <div className="flex gap-2 mt-3">
              <button
                disabled={acting}
                onClick={async () => {
                  setActing(true);
                  await onAccept(n.metadata?.space_id ?? "");
                }}
                className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold py-2 hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-1"
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                disabled={acting}
                onClick={async () => {
                  setActing(true);
                  await onDecline();
                }}
                className="flex-1 rounded-xl bg-muted text-muted-foreground text-xs font-bold py-2 hover:bg-muted/70 transition-all disabled:opacity-60 flex items-center justify-center gap-1"
              >
                <X className="h-3.5 w-3.5" /> Decline
              </button>
            </div>
          )}

          {/* Resolved state */}
          {isInvite && isResolved && (
            <span className={cn(
              "inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
              n.status === "accepted" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            )}>
              {n.status === "accepted" ? "✓ Joined" : "Declined"}
            </span>
          )}
        </div>

        {/* Dismiss */}
        {!isInvite && (
          <button
            onClick={onDismiss}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
