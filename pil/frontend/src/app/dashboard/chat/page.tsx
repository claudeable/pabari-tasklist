"use client";

import { useEffect, useState } from "react";

import ChannelChat from "@/components/ChannelChat";
import ModulePageShell from "@/components/ModulePageShell";
import { apiFetch } from "@/lib/api-client";
import { ensureDefaultWorkspace } from "@/lib/workspace";

interface MeResponse {
  id: string;
  alias: string;
}

interface ChannelResponse {
  id: string;
  project_id: string;
  name: string;
  is_private: boolean;
  created_at: string;
}

interface ProjectMemberResponse {
  user_id: string;
  alias: string;
  role: string;
  added_at: string;
}

export default function ChatModulePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [members, setMembers] = useState<ProjectMemberResponse[]>([]);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelAudience, setNewChannelAudience] = useState<"everyone" | "specific">("everyone");
  const [newChannelMemberIds, setNewChannelMemberIds] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState("");

  async function loadChannels(pid: string) {
    const list = await apiFetch<ChannelResponse[]>(`/api/v1/projects/${pid}/channels`);
    setChannels(list);
    return list;
  }

  useEffect(() => {
    apiFetch<MeResponse>("/api/v1/users/me").then(setMe).catch(() => {});
    ensureDefaultWorkspace()
      .then(async (ws) => {
        setProjectId(ws.projectId);
        const [list] = await Promise.all([
          loadChannels(ws.projectId),
          apiFetch<ProjectMemberResponse[]>(`/api/v1/projects/${ws.projectId}/members`)
            .then(setMembers)
            .catch(() => {}),
        ]);
        setSelectedChannelId((prev) => prev ?? list.find((c) => !c.is_private)?.id ?? list[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load workspace"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    function poll() {
      apiFetch<Record<string, boolean>>(`/api/v1/projects/${projectId}/presence`)
        .then((data) => {
          if (!cancelled) setOnline(data);
        })
        .catch(() => {});
    }

    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId]);

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newChannelName.trim()) return;
    const isPrivate = newChannelAudience === "specific";
    if (isPrivate && newChannelMemberIds.length === 0) {
      setError("Pick at least one person for a private channel");
      return;
    }
    try {
      const channel = await apiFetch<ChannelResponse>(`/api/v1/projects/${projectId}/channels`, {
        method: "POST",
        body: JSON.stringify({
          name: newChannelName.trim(),
          is_private: isPrivate,
          member_ids: isPrivate ? newChannelMemberIds : [],
        }),
      });
      setChannels((prev) => [...prev, channel]);
      setSelectedChannelId(channel.id);
      setNewChannelName("");
      setNewChannelAudience("everyone");
      setNewChannelMemberIds([]);
      setShowNewChannel(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    }
  }

  function toggleNewChannelMember(userId: string) {
    setNewChannelMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleStartDm(otherUserId: string) {
    if (!projectId) return;
    try {
      const channel = await apiFetch<ChannelResponse>(`/api/v1/projects/${projectId}/channels/dm`, {
        method: "POST",
        body: JSON.stringify({ other_user_id: otherUserId }),
      });
      setChannels((prev) => (prev.some((c) => c.id === channel.id) ? prev : [...prev, channel]));
      setSelectedChannelId(channel.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start direct message");
    }
  }

  function dmLabel(channel: ChannelResponse): string {
    // DM channel names are "dm-<uuid>-<uuid>"; find the OTHER participant's alias
    // by matching whichever id in the name isn't me — no dedicated "other user"
    // field is returned by the channel API, so this is derived client-side.
    const ids = channel.name.replace(/^dm-/, "").split("-");
    // uuids contain hyphens too, so re-join in pairs of 5 hyphen-separated groups
    const rejoined: string[] = [];
    for (let i = 0; i < ids.length; i += 5) rejoined.push(ids.slice(i, i + 5).join("-"));
    const otherId = rejoined.find((id) => id !== me?.id);
    const member = members.find((m) => m.user_id === otherId);
    return member ? member.alias : "Direct message";
  }

  const groupChannels = channels.filter((c) => !c.is_private);
  const dmChannels = channels.filter((c) => c.is_private && c.name.startsWith("dm-"));
  const privateChannels = channels.filter((c) => c.is_private && !c.name.startsWith("dm-"));
  const AVATAR_COLORS = [
    "bg-rose-600",
    "bg-amber-600",
    "bg-emerald-600",
    "bg-sky-600",
    "bg-violet-600",
    "bg-fuchsia-600",
    "bg-teal-600",
    "bg-orange-600",
  ];
  function avatarColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? "bg-slate-600";
  }

  const filteredPeople = members
    .filter((m) => m.user_id !== me?.id)
    .filter((m) => m.alias.toLowerCase().includes(peopleSearch.trim().toLowerCase()));

  return (
    <ModulePageShell title="Chat">
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="flex flex-col gap-4 md:flex-row">
        <div className={`w-full space-y-4 md:w-56 md:shrink-0 ${selectedChannelId ? "hidden md:block" : "block"}`}>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Channels</p>
              <button
                onClick={() => setShowNewChannel((v) => !v)}
                className="text-xs text-vault-accent hover:underline"
              >
                + New
              </button>
            </div>
            {showNewChannel && (
              <form onSubmit={handleCreateChannel} className="mb-2 space-y-2 rounded border border-vault-border bg-vault-bg p-2">
                <input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="channel-name"
                  className="w-full rounded border border-vault-border bg-vault-surface px-2 py-1 text-xs text-slate-100"
                />
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewChannelAudience("everyone")}
                    className={`flex-1 rounded px-2 py-1 ${
                      newChannelAudience === "everyone" ? "bg-vault-accent text-white" : "bg-vault-surface text-slate-300"
                    }`}
                  >
                    Everyone
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannelAudience("specific")}
                    className={`flex-1 rounded px-2 py-1 ${
                      newChannelAudience === "specific" ? "bg-vault-accent text-white" : "bg-vault-surface text-slate-300"
                    }`}
                  >
                    Specific people
                  </button>
                </div>
                {newChannelAudience === "specific" && (
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-vault-border p-1">
                    {members
                      .filter((m) => m.user_id !== me?.id)
                      .map((m) => (
                        <label key={m.user_id} className="flex items-center gap-2 px-1 py-0.5 text-xs text-slate-200">
                          <input
                            type="checkbox"
                            checked={newChannelMemberIds.includes(m.user_id)}
                            onChange={() => toggleNewChannelMember(m.user_id)}
                          />
                          {m.alias}
                        </label>
                      ))}
                  </div>
                )}
                <button type="submit" className="w-full rounded bg-vault-accent px-2 py-1 text-xs text-white">
                  Create
                </button>
              </form>
            )}
            <div className="space-y-1">
              {groupChannels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChannelId(c.id)}
                  className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                    selectedChannelId === c.id
                      ? "bg-vault-accent/20 text-vault-accent"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  #{c.name}
                </button>
              ))}
            </div>
          </div>

          {privateChannels.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Private Channels</p>
              <div className="space-y-1">
                {privateChannels.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChannelId(c.id)}
                    className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                      selectedChannelId === c.id
                        ? "bg-vault-accent/20 text-vault-accent"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    🔒 {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dmChannels.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Direct Messages</p>
              <div className="space-y-1">
                {dmChannels.map((c) => {
                  const ids = c.name.replace(/^dm-/, "").split("-");
                  const rejoined: string[] = [];
                  for (let i = 0; i < ids.length; i += 5) rejoined.push(ids.slice(i, i + 5).join("-"));
                  const otherId = rejoined.find((id) => id !== me?.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedChannelId(c.id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                        selectedChannelId === c.id
                          ? "bg-vault-accent2/20 text-vault-accent2"
                          : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <span className="relative shrink-0">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white ${otherId ? avatarColor(otherId) : "bg-slate-600"}`}
                        >
                          {dmLabel(c).slice(0, 1).toUpperCase()}
                        </span>
                        {otherId && (
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-vault-surface ${
                              online[otherId] ? "bg-vault-success" : "bg-slate-600"
                            }`}
                          />
                        )}
                      </span>
                      {dmLabel(c)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">People</p>
            <input
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              placeholder="Search people..."
              className="mb-2 w-full rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs text-slate-200 focus:border-vault-accent focus:outline-none"
            />
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {filteredPeople.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => handleStartDm(m.user_id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-white/5"
                >
                  <span className="relative shrink-0">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(m.user_id)}`}
                    >
                      {m.alias.slice(0, 1).toUpperCase()}
                    </span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-vault-surface ${
                        online[m.user_id] ? "bg-vault-success" : "bg-slate-600"
                      }`}
                    />
                  </span>
                  <span>
                    <span className="block leading-tight">{m.alias}</span>
                    <span className="block text-xs capitalize leading-tight text-slate-500">
                      {m.role.replace("_", " ")}
                    </span>
                  </span>
                </button>
              ))}
              {filteredPeople.length === 0 && <p className="px-2 py-1 text-xs text-slate-500">No matches.</p>}
            </div>
          </div>
        </div>

        <div className={`min-w-0 flex-1 ${selectedChannelId ? "block" : "hidden md:block"}`}>
          {!selectedChannelId && !error && <p className="text-sm text-slate-400">Select a conversation.</p>}
          {selectedChannelId && (
            <ChannelChat channelId={selectedChannelId} onBack={() => setSelectedChannelId(null)} />
          )}
        </div>
      </div>
    </ModulePageShell>
  );
}
