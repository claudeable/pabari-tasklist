"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api-client";

interface MessageResponse {
  id: string;
  channel_id: string;
  author_id: string;
  parent_message_id: string | null;
  body: string;
  mentions: string[];
  edited_at: string | null;
  created_at: string;
}

interface MeResponse {
  id: string;
  alias: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function wsBaseUrl(): string {
  return API_BASE_URL.replace(/^http/, "ws");
}

export default function ChannelMessagesPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string; projectId: string; channelId: string }>();
  const { orgId, projectId, channelId } = params;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  function addMessage(msg: MessageResponse) {
    if (seenIds.current.has(msg.id)) return;
    seenIds.current.add(msg.id);
    setMessages((prev) => [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }

  useEffect(() => {
    Promise.all([
      apiFetch<MeResponse>("/api/v1/users/me"),
      apiFetch<MessageResponse[]>(`/api/v1/channels/${channelId}/messages?limit=50`),
    ])
      .then(([meResp, msgs]) => {
        setMe(meResp);
        msgs.forEach(addMessage);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load messages");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, router]);

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

  return (
    <main className="flex min-h-screen flex-col px-6 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">Channel</h1>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs ${wsStatus === "open" ? "text-green-400" : wsStatus === "connecting" ? "text-slate-500" : "text-red-400"}`}
            >
              {wsStatus === "open" ? "live" : wsStatus === "connecting" ? "connecting..." : "disconnected"}
            </span>
            <Link href={`/orgs/${orgId}/projects/${projectId}`} className="text-sm text-slate-400 hover:text-vault-accent">
              Back
            </Link>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="mb-4 flex-1 space-y-2 overflow-y-auto rounded-lg border border-vault-border bg-vault-surface p-4">
          {messages.length === 0 && <p className="text-sm text-slate-500">No messages yet.</p>}
          {messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <span className={me && msg.author_id === me.id ? "font-medium text-vault-accent" : "font-medium text-slate-300"}>
                {me && msg.author_id === me.id ? "You" : msg.author_id.slice(0, 8)}
              </span>
              <span className="ml-2 text-slate-100">{msg.body}</span>
              <span className="ml-2 text-xs text-slate-600">{new Date(msg.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
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
    </main>
  );
}
