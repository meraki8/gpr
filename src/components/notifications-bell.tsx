"use client";

import { Bell, Check, FileText, Trophy, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
};

type Bundle = {
  unreadCount: number;
  items: Notification[];
};

const POLL_FALLBACK_MS = 60_000;

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch (err) {
      console.error("[notifications] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + low-effort fallback poll. No websockets — the
  // user said simple is fine.
  useEffect(() => {
    fetchData();
    const id = window.setInterval(fetchData, POLL_FALLBACK_MS);
    return () => window.clearInterval(id);
  }, [fetchData]);

  // Outside click + Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        popoverRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const onToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) fetchData();
      return next;
    });
  };

  const markRead = useCallback(
    async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setData((prev) =>
        prev
          ? {
              ...prev,
              unreadCount: Math.max(0, prev.unreadCount - 1),
              items: prev.items.map((n) =>
                n.id === id && !n.readAt
                  ? { ...n, readAt: new Date().toISOString() }
                  : n,
              ),
            }
          : prev,
      );
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setData((prev) =>
      prev
        ? {
            unreadCount: 0,
            items: prev.items.map((n) =>
              n.readAt ? n : { ...n, readAt: new Date().toISOString() },
            ),
          }
        : prev,
    );
  }, []);

  const acceptInvite = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await fetch(`/api/notifications/${id}/accept-invite`, {
          method: "POST",
        });
        const j = await r.json();
        if (j.ok && j.redirectTo) {
          setOpen(false);
          router.push(j.redirectTo);
          router.refresh();
        }
      } catch (err) {
        console.error("[notifications] accept failed:", err);
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const declineInvite = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/notifications/${id}/decline-invite`, {
        method: "POST",
      });
      setData((prev) =>
        prev
          ? {
              unreadCount: Math.max(0, prev.unreadCount - 1),
              items: prev.items.map((n) =>
                n.id === id
                  ? { ...n, readAt: new Date().toISOString() }
                  : n,
              ),
            }
          : prev,
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <div
      style={{
        position: "fixed",
        top: 14,
        right: 24,
        zIndex: 30,
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
        style={{
          position: "relative",
          width: 38,
          height: 38,
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: "var(--paper)",
          color: "var(--ink)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        <Bell size={16} strokeWidth={2.2} />
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "var(--red)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--bg)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: 46,
            right: 0,
            width: 360,
            maxHeight: "70vh",
            overflowY: "auto",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "0 18px 48px -16px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: "1px solid var(--line)",
              position: "sticky",
              top: 0,
              background: "var(--paper)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                Notifications
              </span>
              {unread > 0 && (
                <span
                  className="num"
                  style={{
                    fontSize: 11,
                    color: "var(--red)",
                    fontWeight: 600,
                  }}
                >
                  {unread} unread
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="lk-mute"
                  style={{
                    fontSize: 12,
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--mute)",
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div
              className="mute-ink"
              style={{ padding: 24, fontSize: 13, textAlign: "center" }}
            >
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
              }}
            >
              <div className="body" style={{ marginBottom: 6 }}>
                You&apos;re caught up.
              </div>
              <div className="mute-ink" style={{ fontSize: 12 }}>
                The ref is quiet for now.
              </div>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  busy={busyId === n.id}
                  onMarkRead={() => markRead(n.id)}
                  onAccept={() => acceptInvite(n.id)}
                  onDecline={() => declineInvite(n.id)}
                  onNavigate={() => {
                    if (!n.readAt) markRead(n.id);
                    setOpen(false);
                    if (n.linkUrl) router.push(n.linkUrl);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  busy,
  onMarkRead,
  onAccept,
  onDecline,
  onNavigate,
}: {
  notification: Notification;
  busy: boolean;
  onMarkRead: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onNavigate: () => void;
}) {
  const unread = !notification.readAt;
  const meta = iconForType(notification.type);
  const isInvite = notification.type === "invite";
  return (
    <li
      style={{
        position: "relative",
        padding: "14px 16px",
        borderBottom: "1px solid var(--line-2)",
        background: unread
          ? "color-mix(in srgb, var(--red) 6%, var(--paper))"
          : "transparent",
      }}
    >
      {unread && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 6,
            top: 18,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--red)",
          }}
        />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px minmax(0, 1fr)",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--red) 12%, var(--paper))",
            color: meta.color,
            border: "1px solid var(--line)",
          }}
        >
          {meta.icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <button
            type="button"
            onClick={onNavigate}
            disabled={!notification.linkUrl && !isInvite}
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              textAlign: "left",
              cursor:
                notification.linkUrl || isInvite ? "pointer" : "default",
              width: "100%",
              color: "var(--ink)",
              font: "inherit",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.35,
                color: "var(--ink)",
              }}
            >
              {notification.title}
            </div>
            {notification.body && (
              <div
                className="mute-ink"
                style={{
                  fontSize: 13,
                  marginTop: 3,
                  lineHeight: 1.45,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {notification.body}
              </div>
            )}
            <div
              className="mute-ink num"
              style={{ fontSize: 11, marginTop: 6 }}
            >
              {timeAgo(notification.createdAt)}
            </div>
          </button>
          {isInvite && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 10,
              }}
            >
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="pill pill-red pill-sm"
                style={{
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Accept
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={busy}
                className="pill pill-ghost pill-sm"
                style={{
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Decline
              </button>
            </div>
          )}
          {!isInvite && unread && (
            <button
              type="button"
              onClick={onMarkRead}
              className="lk-mute"
              style={{
                marginTop: 8,
                fontSize: 11,
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Check size={12} />
              Mark read
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function iconForType(type: string) {
  switch (type) {
    case "invite":
      return { icon: <UserPlus size={14} />, color: "var(--red)" };
    case "card":
      return { icon: <Trophy size={14} />, color: "var(--red)" };
    case "report":
      return { icon: <FileText size={14} />, color: "var(--ink)" };
    default:
      return { icon: <Bell size={14} />, color: "var(--ink)" };
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
