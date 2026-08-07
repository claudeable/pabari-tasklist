"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessagesSquare, Plus, Send, Hash, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { formatTimestamp } from "@/components/ui-custom/activity-row";
import { OnlineDot } from "@/components/ui-custom/online-dot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useChannelMessages,
  useChannels,
  useCreateChannel,
  useCreateDirectChannel,
  useCreateGroupChannel,
  useDirectChannels,
  useGroupChannels,
  useSendChannelMessage,
} from "@/lib/hooks/use-communication";
import { useCurrentUser } from "@/lib/hooks/use-auth";
import { useUsers } from "@/lib/hooks/use-users";
import type { Channel, ChannelMessage } from "@/lib/types";

function isAdmin(user: { role?: string | { name?: string } } | undefined): boolean {
  if (!user?.role) return false;
  if (typeof user.role === "string") return user.role.toLowerCase().includes("admin");
  return (user.role.name ?? "").toLowerCase().includes("admin");
}

export default function CommunicationPage() {
  return (
    <div>
      <PageHeader
        title="Communication"
        description="Channel-based messaging shared across both organizations."
      />

      <Tabs defaultValue="channels">
        <TabsList className="mb-4">
          <TabsTrigger value="channels" className="gap-1.5">
            <Hash className="h-3.5 w-3.5" />
            Project Channels
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <UsersRound className="h-3.5 w-3.5" />
            Groups
          </TabsTrigger>
          <TabsTrigger value="direct" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Direct Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <ProjectChannels />
        </TabsContent>
        <TabsContent value="groups">
          <GroupMessages />
        </TabsContent>
        <TabsContent value="direct">
          <DirectMessages />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectChannels() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const { data: user } = useCurrentUser();

  const projectId =
    selectedProjectId && (projects ?? []).some((p) => p.id === selectedProjectId)
      ? selectedProjectId
      : (projects?.[0]?.id ?? "");

  const {
    data: channels,
    isLoading: channelsLoading,
    isError: channelsError,
    refetch: refetchChannels,
  } = useChannels(projectId || undefined);

  const channelId =
    selectedChannelId && (channels ?? []).some((c) => c.id === selectedChannelId)
      ? selectedChannelId
      : (channels?.[0]?.id ?? "");

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Select value={projectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {projectsLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : !projectId ? (
        <EmptyState icon={MessagesSquare} title="Select a project to view channels" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Channels</p>
              <CreateChannelDialog
                open={createChannelOpen}
                onOpenChange={setCreateChannelOpen}
                projectId={projectId}
                onCreated={(id) => setSelectedChannelId(id)}
              />
            </div>
            {channelsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-md" />
                ))}
              </div>
            ) : channelsError ? (
              <ErrorState onRetry={() => refetchChannels()} />
            ) : (channels ?? []).length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No channels yet</p>
            ) : (
              <div className="space-y-1">
                {(channels ?? []).map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannelId(channel.id)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                      channel.id === channelId
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground",
                    )}
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <MessageThread
            channelId={channelId}
            currentUserId={user?.id}
            emptyTitle="No channel selected"
          />
        </div>
      )}
    </div>
  );
}

function GroupMessages() {
  const { data: user } = useCurrentUser();
  const { data: groups, isLoading, isError, refetch } = useGroupChannels();
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const userIsAdmin = isAdmin(user);

  const activeGroup = (groups ?? []).find((g) => g.id === activeGroupId);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      <div className="rounded-xl border border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Groups</p>
          {userIsAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="New group">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <CreateGroupDialog onOpenChange={setCreateOpen} onCreated={setActiveGroupId} />
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (groups ?? []).length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No groups yet</p>
        ) : (
          <div className="space-y-1">
            {(groups ?? []).map((group) => (
              <button
                key={group.id}
                onClick={() => setActiveGroupId(group.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  group.id === activeGroupId
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground",
                )}
              >
                <UsersRound className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{group.name}</span>
                {group.members && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {group.members.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {activeGroup && activeGroup.members && activeGroup.members.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Members: {activeGroup.members.map((m) => m.user_name || "Unknown").join(", ")}
          </p>
        )}
        <MessageThread
          channelId={activeGroupId}
          currentUserId={user?.id}
          emptyTitle="Select a group to start messaging"
        />
      </div>
    </div>
  );
}

function CreateGroupDialog({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { data: users } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const createGroup = useCreateGroupChannel();
  const [name, setName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const otherUsers = useMemo(
    () => (users ?? []).filter((u) => u.id !== currentUser?.id),
    [users, currentUser?.id],
  );

  function toggleUser(id: string) {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    createGroup.mutate(
      { name: name.trim(), member_user_ids: selectedUserIds },
      {
        onSuccess: (channel) => {
          toast.success("Group created");
          setName("");
          setSelectedUserIds([]);
          onOpenChange(false);
          if (channel?.id) onCreated(channel.id);
        },
        onError: () => toast.error("Failed to create group"),
      },
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New group</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Site Team"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Members</Label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {otherUsers.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm">{u.full_name || u.name || u.email}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={createGroup.isPending}>
          Create group
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function DirectMessages() {
  const { data: user } = useCurrentUser();
  const { data: users, isLoading: usersLoading, isError: usersError, refetch: refetchUsers } =
    useUsers();
  const { data: directChannels } = useDirectChannels();
  const createDirectChannel = useCreateDirectChannel();
  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [activeUserId, setActiveUserId] = useState<string>("");

  const otherUsers = useMemo(
    () => (users ?? []).filter((u) => u.id !== user?.id),
    [users, user?.id],
  );

  function handleSelectUser(otherUserId: string) {
    setActiveUserId(otherUserId);
    const existing = (directChannels ?? []).find(
      (c) => c.user_a_id === otherUserId || c.user_b_id === otherUserId,
    );
    if (existing) {
      setActiveChannelId(existing.id);
      return;
    }
    createDirectChannel.mutate(otherUserId, {
      onSuccess: (channel) => setActiveChannelId(channel.id),
      onError: () => toast.error("Failed to open conversation"),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      <div className="rounded-xl border border-border p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">People</p>
        {usersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : usersError ? (
          <ErrorState onRetry={() => refetchUsers()} />
        ) : otherUsers.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No other users</p>
        ) : (
          <div className="space-y-1">
            {otherUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  u.id === activeUserId
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground",
                )}
              >
                <div className="relative shrink-0">
                  <Avatar size="sm">
                    <AvatarFallback>
                      {(u.full_name || u.name || u.email || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <OnlineDot
                    lastSeenAt={u.last_seen_at}
                    className="absolute -bottom-0.5 -right-0.5"
                  />
                </div>
                <span className="truncate">{u.full_name || u.name || u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <MessageThread
        channelId={activeChannelId}
        currentUserId={user?.id}
        isLoading={createDirectChannel.isPending}
        emptyTitle="Select a person to start messaging"
      />
    </div>
  );
}

function MessageThread({
  channelId,
  currentUserId,
  isLoading: openingChannel,
  emptyTitle,
}: {
  channelId: string;
  currentUserId?: string;
  isLoading?: boolean;
  emptyTitle: string;
}) {
  const {
    data: messages,
    isLoading: messagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
  } = useChannelMessages(channelId || undefined);
  const sendMessage = useSendChannelMessage(channelId || undefined);
  const [messageText, setMessageText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(() => {
    const list: ChannelMessage[] = messages ?? [];
    return [...list].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return da - db;
    });
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [sortedMessages.length]);

  function handleSend() {
    if (!messageText.trim() || !channelId) return;
    sendMessage.mutate(
      { body: messageText },
      {
        onSuccess: () => setMessageText(""),
        onError: () => toast.error("Failed to send message"),
      },
    );
  }

  return (
    <div className="flex h-[32rem] flex-col rounded-xl border border-border">
      {!channelId ? (
        <div className="flex flex-1 items-center justify-center">
          {openingChannel ? (
            <Skeleton className="h-10 w-2/3 rounded-md" />
          ) : (
            <EmptyState icon={MessagesSquare} title={emptyTitle} />
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            {messagesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-2/3 rounded-md" />
                ))}
              </div>
            ) : messagesError ? (
              <ErrorState onRetry={() => refetchMessages()} />
            ) : sortedMessages.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="No messages yet"
                description="Say hello to get the conversation started."
              />
            ) : (
              <div className="space-y-3">
                {sortedMessages.map((message) => {
                  const isMine = message.user_id && currentUserId === message.user_id;
                  return (
                    <div
                      key={message.id}
                      className={cn("flex flex-col", isMine ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "max-w-md rounded-lg px-3 py-2 text-sm",
                          isMine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {message.body}
                      </div>
                      <span className="mt-1 text-[10px] text-muted-foreground">
                        {message.user_name || "Member"} · {formatTimestamp(message.created_at)}
                      </span>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              placeholder="Write a message…"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={sendMessage.isPending || !messageText.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateChannelDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated: (id: string) => void;
}) {
  const createChannel = useCreateChannel();
  const [name, setName] = useState("");

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Channel name is required");
      return;
    }
    createChannel.mutate(
      { name, project_id: projectId },
      {
        onSuccess: (channel) => {
          toast.success("Channel created");
          setName("");
          onOpenChange(false);
          if (channel?.id) onCreated(channel.id);
        },
        onError: () => toast.error("Failed to create channel"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="New channel">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="channel-name">Name</Label>
          <Input id="channel-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createChannel.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
