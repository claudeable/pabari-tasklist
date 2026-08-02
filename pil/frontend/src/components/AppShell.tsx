"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { apiFetch, setAccessToken } from "@/lib/api-client";

interface MeResponse {
  id: string;
  alias: string;
  system_role: string;
}

interface NotificationResponse {
  id: string;
  type: string;
  payload: {
    author_alias?: string;
    preview?: string;
    is_dm?: boolean;
    assigned_by?: string;
  };
  read_at: string | null;
  created_at: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", icon: "▦", label: "Dashboard" },
  { href: "/dashboard/chat", icon: "💬", label: "Communication" },
  { href: "/dashboard/documents", icon: "📁", label: "Documents" },
  { href: "/dashboard/tasks", icon: "✓", label: "Tasks" },
];

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    apiFetch<MeResponse>("/api/v1/users/me")
      .then(setMe)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    function poll() {
      apiFetch<NotificationResponse[]>("/api/v1/notifications?unread=false")
        .then((list) => setNotifications(list.slice(0, 15)))
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function handleNotificationClick(n: NotificationResponse) {
    if (!n.read_at) {
      await apiFetch(`/api/v1/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    setShowNotifications(false);
    router.push("/dashboard/chat");
  }

  async function handleMarkAllRead() {
    await apiFetch("/api/v1/notifications/read-all", { method: "POST" }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  async function handleLogout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    setAccessToken(null);
    router.push("/login");
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-vault-bg">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileNavOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 -translate-x-full flex-col border-r border-vault-border bg-vault-surface transition-transform duration-200 md:static md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : ""
        }`}
      >
        <div className="border-b border-vault-border px-5 py-5">
          <p className="bg-gradient-to-r from-vault-accent to-vault-accent2 bg-clip-text text-sm font-bold text-transparent">
            pil-transmission-lines-app
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                isActive(item.href)
                  ? "bg-vault-accent/20 font-medium text-vault-accent"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          {me?.system_role === "system_admin" && (
            <Link
              href="/dashboard/admin"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                isActive("/dashboard/admin")
                  ? "bg-vault-accent/20 font-medium text-vault-accent"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <span className="w-4 text-center">👤</span>
              Admin
            </Link>
          )}
        </nav>
        <div className="border-t border-vault-border p-3">
          <Link
            href="/dashboard/change-password"
            className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            <span className="w-4 text-center">⚙</span>
            Change Password
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
          >
            <span className="w-4 text-center">⏻</span>
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-vault-border bg-vault-surface/60 px-4 py-3 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/5 md:hidden"
            title="Open menu"
          >
            ☰
          </button>
          <input
            placeholder="Search tasks, documents, people..."
            className="hidden w-full max-w-md rounded-lg border border-vault-border bg-vault-bg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-vault-accent focus:outline-none sm:block"
            disabled
            title="Search coming soon"
          />
          <div className="relative ml-auto flex items-center gap-3">
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="relative rounded-lg p-2 text-slate-300 hover:bg-white/5"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-vault-danger text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-vault-border bg-vault-surface shadow-2xl sm:w-80">
                <div className="flex items-center justify-between border-b border-vault-border px-4 py-2">
                  <p className="text-sm font-semibold text-slate-200">Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-vault-accent hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
                  )}
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`block w-full border-b border-vault-border px-4 py-3 text-left last:border-0 hover:bg-white/5 ${
                        !n.read_at ? "bg-vault-accent/5" : ""
                      }`}
                    >
                      <p className="text-sm text-slate-200">
                        <span className="font-semibold">{n.payload.author_alias ?? "Someone"}</span>{" "}
                        {n.type === "mention"
                          ? "mentioned you"
                          : n.payload.is_dm
                            ? "sent you a message"
                            : "posted in a channel"}
                      </p>
                      {n.payload.preview && <p className="truncate text-xs text-slate-400">{n.payload.preview}</p>}
                      <p className="mt-0.5 text-xs text-slate-500">{timeAgo(n.created_at)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {me && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-vault-accent to-vault-accent2 text-xs font-bold text-white">
                {me.alias.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
