"use client";

import { useMemo, useState } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateKbArticle, useKbArticle, useKbArticles } from "@/lib/hooks/use-knowledge-base";

export default function KnowledgeBasePage() {
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch } = useKbArticles({
    category: category || undefined,
    q: search || undefined,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const articles = useMemo(() => data ?? [], [data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => a.category && set.add(a.category));
    return Array.from(set);
  }, [articles]);

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="A shared library of standards, guidance, and lessons learned."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search articles…"
                className="w-48 pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CreateArticleDialog open={createOpen} onOpenChange={setCreateOpen} />
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No articles found"
          description="Try a different search, or add the first article."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New article
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Card
              key={article.id}
              className="glass-panel cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedId(article.id)}
            >
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">
                    {article.title}
                  </p>
                  {article.category ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {article.category}
                    </Badge>
                  ) : null}
                </div>
                {article.content ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{article.content}</p>
                ) : null}
                {article.tags && article.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {article.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ArticleDetailSheet id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function ArticleDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: article, isLoading, isError, refetch } = useKbArticle(id ?? "");

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {isLoading ? (
          <div className="space-y-3 px-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError ? (
          <div className="px-4">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : article ? (
          <>
            <SheetHeader>
              <SheetTitle>{article.title}</SheetTitle>
              <SheetDescription>{article.category || "Uncategorized"}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              {article.tags && article.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <p className="whitespace-pre-wrap text-sm text-foreground">{article.content}</p>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function CreateArticleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createArticle = useCreateKbArticle();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  function reset() {
    setTitle("");
    setCategory("");
    setContent("");
    setTags("");
  }

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    createArticle.mutate(
      {
        title,
        category,
        content,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          toast.success("Article created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create article"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New article
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New article</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="kb-title">Title</Label>
            <Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kb-category">Category</Label>
            <Input
              id="kb-category"
              placeholder="SOPs, Policies, …"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kb-content">Content</Label>
            <Textarea
              id="kb-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kb-tags">Tags (comma separated)</Label>
            <Input id="kb-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createArticle.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
