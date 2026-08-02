"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch, apiFetchRaw } from "@/lib/api-client";

interface MessageAttachmentInfo {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

interface MessageResponse {
  id: string;
  channel_id: string;
  author_id: string;
  parent_message_id: string | null;
  body: string;
  mentions: string[];
  edited_at: string | null;
  created_at: string;
  attachment?: MessageAttachmentInfo | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentView({ attachment }: { attachment: MessageAttachmentInfo }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    apiFetch<{ token: string }>(`/api/v1/attachments/${attachment.id}/view-url`)
      .then(({ token }) => apiFetchRaw(`/api/v1/attachment-downloads/${token}`))
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load attachment");
        const blob = await res.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id]);

  if (error) {
    return <p className="mt-1 text-xs text-vault-danger">Failed to load attachment.</p>;
  }

  const isImage = attachment.mime_type.startsWith("image/");

  if (!objectUrl) {
    return <p className="mt-1 text-xs text-slate-500">Loading {attachment.filename}...</p>;
  }

  if (isImage) {
    return (
      <a href={objectUrl} target="_blank" rel="noreferrer" className="mt-1 block">
        <img src={objectUrl} alt={attachment.filename} className="max-h-56 rounded border border-vault-border" />
      </a>
    );
  }

  return (
    <a
      href={objectUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex w-fit items-center gap-2 rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs text-vault-accent hover:underline"
    >
      📄 {attachment.filename} <span className="text-slate-500">({formatSize(attachment.size_bytes)})</span>
    </a>
  );
}

interface MeResponse {
  id: string;
  alias: string;
  system_role: string;
}

// REST calls go through apiFetch (relative, proxied via Next.js rewrites — see
// next.config.ts) so the refresh-token cookie stays first-party. WebSocket
// upgrades can't go through that rewrite, so this needs the backend's real,
// absolute origin — a separate env var from the REST base URL.
const WS_ORIGIN = process.env.NEXT_PUBLIC_WS_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function wsBaseUrl(): string {
  return WS_ORIGIN.replace(/^http/, "ws");
}

export default function ChannelChat({ channelId, onBack }: { channelId: string; onBack?: () => void }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  function addMessage(msg: MessageResponse) {
    if (seenIds.current.has(msg.id)) return;
    seenIds.current.add(msg.id);
    setMessages((prev) => [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }

  useEffect(() => {
    seenIds.current = new Set();
    setMessages([]);
    Promise.all([
      apiFetch<MeResponse>("/api/v1/users/me"),
      apiFetch<MessageResponse[]>(`/api/v1/channels/${channelId}/messages?limit=50`),
    ])
      .then(([meResp, msgs]) => {
        setMe(meResp);
        msgs.forEach(addMessage);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const { ticket } = await apiFetch<{ ticket: string }>(`/api/v1/channels/${channelId}/ws-ticket`, {
          method: "POST",
        });
        if (cancelled) return;
        socket = new WebSocket(`${wsBaseUrl()}/api/v1/ws?ticket=${encodeURIComponent(ticket)}`);
        socket.onopen = () => setWsStatus("open");
        socket.onclose = () => setWsStatus("closed");
        socket.onerror = () => setWsStatus("closed");
        socket.onmessage = (event) => {
          try {
            const frame = JSON.parse(event.data) as MessageResponse & { type: string };
            if (frame.id) addMessage(frame);
          } catch {
            // ignore malformed frames
          }
        };
      } catch {
        setWsStatus("closed");
      }
    }

    connect();
    return () => {
      cancelled = true;
      socket?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleDeleteMessage(messageId: string) {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/v1/messages/${messageId}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message");
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setError(null);
    try {
      const msg = await apiFetch<MessageResponse>(`/api/v1/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      addMessage(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("caption", draft.trim());
      const msg = await apiFetch<MessageResponse>(`/api/v1/channels/${channelId}/attachments`, {
        method: "POST",
        body: form,
      });
      addMessage(msg);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload attachment");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="mb-2 flex items-center justify-between">
        {onBack && (
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-200 md:hidden">
            ← Back
          </button>
        )}
        <span
          className={`ml-auto text-xs ${wsStatus === "open" ? "text-green-400" : wsStatus === "connecting" ? "text-slate-500" : "text-red-400"}`}
        >
          {wsStatus === "open" ? "live" : wsStatus === "connecting" ? "connecting..." : "disconnected"}
        </span>
      </div>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      <div className="mb-4 flex-1 space-y-2 overflow-y-auto rounded-lg border border-vault-border bg-vault-surface p-4">
        {messages.length === 0 && <p className="text-sm text-slate-500">No messages yet.</p>}
        {messages.map((msg) => {
          const canDelete = !!me && (msg.author_id === me.id || me.system_role === "system_admin");
          return (
            <div key={msg.id} className="group flex items-start justify-between text-sm">
              <div>
                <span className={me && msg.author_id === me.id ? "font-medium text-vault-accent" : "font-medium text-slate-300"}>
                  {me && msg.author_id === me.id ? "You" : msg.author_id.slice(0, 8)}
                </span>
                <span className="ml-2 text-slate-100">{msg.body}</span>
                <span className="ml-2 text-xs text-slate-600">{new Date(msg.created_at).toLocaleTimeString()}</span>
                {msg.attachment && <AttachmentView attachment={msg.attachment} />}
              </div>
              {canDelete && (
                <button
                  onClick={() => handleDeleteMessage(msg.id)}
                  className="ml-2 shrink-0 text-xs text-slate-600 opacity-0 hover:text-vault-danger group-hover:opacity-100"
                  title="Delete message"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach a file or photo"
          className="rounded border border-vault-border px-3 py-2 text-sm text-slate-300 hover:border-vault-accent disabled:opacity-50"
        >
          {uploading ? "..." : "📎"}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message..."
          className="flex-1 rounded border border-vault-border bg-transparent px-3 py-2 text-sm text-slate-100"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded bg-vault-accent px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
