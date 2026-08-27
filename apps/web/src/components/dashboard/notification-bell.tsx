"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationItem = {
  id: string;
  organizationId: string;
  recipientUserId: string;
  actorUserId: string | null;

  type:
    | "FOLLOW_UP_ASSIGNED"
    | "FOLLOW_UP_DUE_TODAY"
    | "FOLLOW_UP_OVERDUE"
    | "FOLLOW_UP_COMPLETED";

  title: string;
  message: string;
  href: string | null;

  customerInternalNoteId: string | null;

  readAt: string | null;
  createdAt: string;

  actor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
};

export function NotificationBell() {
  const router = useRouter();

  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const shouldLoadNotifications = isLoaded && isSignedIn && Boolean(apiUrl);

  useEffect(() => {
    if (!shouldLoadNotifications || !apiUrl) {
      return;
    }

    let cancelled = false;

    async function loadNotifications() {
      try {
        const token = await getToken();

        if (!token || cancelled) {
          return;
        }

        const response = await fetch(`${apiUrl}/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load notifications: ${response.status}`);
        }

        const data = (await response.json()) as NotificationItem[];

        if (!cancelled) {
          setNotifications(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load notifications", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, getToken, shouldLoadNotifications]);

  const unreadCount = notifications.filter(
    (notification) => notification.readAt === null,
  ).length;

  async function markRead(notification: NotificationItem) {
    if (notification.readAt || !apiUrl) {
      navigateToNotification(notification);
      return;
    }

    try {
      const token = await getToken();

      if (!token) {
        return;
      }

      const response = await fetch(`${apiUrl}/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Unable to mark notification read: ${response.status}`);
      }

      const updated = (await response.json()) as NotificationItem;

      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      console.error("Failed to mark notification read", error);
    }

    navigateToNotification(notification);
  }

  async function markAllRead() {
    if (!apiUrl || unreadCount === 0 || markingAllRead) {
      return;
    }

    setMarkingAllRead(true);

    try {
      const token = await getToken();

      if (!token) {
        return;
      }

      const response = await fetch(`${apiUrl}/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Unable to mark all notifications read: ${response.status}`);
      }

      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt,
        })),
      );
    } catch (error) {
      console.error("Failed to mark all notifications read", error);
    } finally {
      setMarkingAllRead(false);
    }
  }

  function navigateToNotification(notification: NotificationItem) {
    if (notification.href) {
      router.push(notification.href);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
            }
            className="relative"
          />
        }
      >
        <Bell className="h-4 w-4" />

        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>

            <p className="text-xs text-muted-foreground">
              {unreadCount === 0 ? "You're all caught up" : `${unreadCount} unread`}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={unreadCount === 0 || markingAllRead}
            onClick={() => void markAllRead()}
            className="gap-1.5"
          >
            <CheckCheck className="h-4 w-4" />

            {markingAllRead ? "Marking..." : "Mark all read"}
          </Button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />

              <p className="text-sm font-medium">No notifications yet</p>

              <p className="mt-1 text-xs text-muted-foreground">
                Follow-up activity will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void markRead(notification)}
                className="flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    notification.readAt ? "bg-muted-foreground/30" : "bg-primary"
                  }`}
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className={
                        notification.readAt ? "text-sm" : "text-sm font-semibold"
                      }
                    >
                      {notification.title}
                    </span>

                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </span>

                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {notification.message}
                  </span>

                  {notification.actor ? (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {actorName(notification.actor)}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function actorName(actor: NotificationItem["actor"]) {
  if (!actor) {
    return "";
  }

  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();

  return name || actor.email;
}

function formatRelativeTime(value: string) {
  const createdAt = new Date(value);
  const now = new Date();

  const differenceMs = now.getTime() - createdAt.getTime();

  const differenceMinutes = Math.max(0, Math.floor(differenceMs / 60_000));

  if (differenceMinutes < 1) {
    return "now";
  }

  if (differenceMinutes < 60) {
    return `${differenceMinutes}m`;
  }

  const differenceHours = Math.floor(differenceMinutes / 60);

  if (differenceHours < 24) {
    return `${differenceHours}h`;
  }

  const differenceDays = Math.floor(differenceHours / 24);

  if (differenceDays < 7) {
    return `${differenceDays}d`;
  }

  return createdAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
