"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, Search, Trash2 } from "lucide-react";

import { BackToHome } from "@/components/shared/back-to-home";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import type { DocumentListItem } from "@/lib/document-db";
import { cn } from "@/lib/utils";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardView() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = q?.trim()
        ? `/api/documents?q=${encodeURIComponent(q.trim())}`
        : "/api/documents";
      const res = await fetch(url);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "加载失败");
        return;
      }
      const data = (await res.json()) as { documents: DocumentListItem[] };
      setDocuments(data.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定删除「${title}」？`)) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "删除失败");
      return;
    }
    await load(query);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <BackToHome />
      <PageHeader
        title="工作台"
        description="文档自动归档、标题与全文检索、最近修改优先展示。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/generate"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              智能生成
            </Link>
            <Link href="/editor/new" className={cn(buttonVariants())}>
              新建文档
            </Link>
          </div>
        }
      />

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索标题或正文关键词…"
          className="border-input bg-background h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">加载中…</p>
      ) : documents.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed border-border p-10 text-center text-sm">
          {query.trim() ? (
            <>未找到匹配文档</>
          ) : (
            <>
              暂无文档。
              <Link href="/editor/new" className="text-primary ml-1 underline">
                新建文档
              </Link>
              或从
              <Link href="/generate" className="text-primary mx-1 underline">
                智能生成
              </Link>
              保存到工作台。
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="bg-card hover:border-primary/30 flex items-start gap-3 rounded-xl border border-border px-4 py-3 transition-colors"
            >
              <FileText className="text-muted-foreground mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/editor/${doc.id}`}
                  className="font-medium hover:underline"
                >
                  {doc.title}
                </Link>
                {doc.excerpt ? (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {doc.excerpt}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-1.5 text-[11px]">
                  创建 {formatTime(doc.createdAt)} · 修改{" "}
                  {formatTime(doc.updatedAt)}
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="text-destructive shrink-0"
                aria-label={`删除 ${doc.title}`}
                onClick={() => void handleDelete(doc.id, doc.title)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
