"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { SelectionAiAssistant } from "@/components/generate/selection-ai-assistant";
import { BackToHome } from "@/components/shared/back-to-home";
import { useAiProviders } from "@/hooks/use-ai-providers";
import type { Editor } from "@tiptap/react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { DocumentRecord } from "@/lib/document-db";
import { suggestTitleFromMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

const AUTOSAVE_MS = 600;

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

type DocumentEditorViewProps = {
  documentId: string;
};

export function DocumentEditorView({ documentId }: DocumentEditorViewProps) {
  const router = useRouter();
  const {
    settings: aiSettings,
    configured: aiConfigured,
    activeProvider,
  } = useAiProviders();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const titleRef = useRef(title);
  const markdownRef = useRef(markdown);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const skipAutosaveRef = useRef(true);

  titleRef.current = title;
  markdownRef.current = markdown;

  const applyDocument = useCallback((doc: DocumentRecord) => {
    setTitle(doc.title);
    setMarkdown(doc.content);
    setUpdatedAt(doc.updatedAt);
    dirtyRef.current = false;
    setSaveState("saved");
  }, []);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "加载失败");
        return;
      }
      const data = (await res.json()) as { document: DocumentRecord };
      applyDocument(data.document);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
      skipAutosaveRef.current = true;
      setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 500);
    }
  }, [documentId, applyDocument]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const persist = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");

    const payload = {
      title: titleRef.current.trim() || suggestTitleFromMarkdown(markdownRef.current),
      content: markdownRef.current,
    };

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "保存失败");
      }
      const data = (await res.json()) as { document: DocumentRecord };
      setUpdatedAt(data.document.updatedAt);
      dirtyRef.current = false;
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      savingRef.current = false;
    }
  }, [documentId]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("pending");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist();
    }, AUTOSAVE_MS);
  }, [persist]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleMarkdownChange = (next: string) => {
    setMarkdown(next);
    if (skipAutosaveRef.current) return;
    scheduleSave();
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleSave();
  };

  const handleSaveNow = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    void persist();
  };

  const handleRename = () => {
    const next = window.prompt("文档标题", title)?.trim();
    if (!next || next === title) return;
    handleTitleChange(next);
  };

  const handleSaveAs = async () => {
    const name =
      window.prompt("另存为标题", `${title || "未命名"}（副本）`)?.trim();
    if (!name) return;
    setError(null);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: name, content: markdownRef.current }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "另存为失败");
      return;
    }
    const data = (await res.json()) as { document: DocumentRecord };
    router.push(`/editor/${data.document.id}`);
  };

  const handleDelete = async () => {
    if (!confirm("确定删除该文档？删除后可在数据库中恢复（软删除）。")) return;
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "删除失败");
      return;
    }
    router.push("/dashboard");
  };

  const handleDownloadMd = () => {
    const blob = new Blob([markdownRef.current], {
      type: "text/markdown;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "需求文档"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveLabel =
    saveState === "pending"
      ? "待保存…"
      : saveState === "saving"
        ? "保存中…"
        : saveState === "saved"
          ? updatedAt
            ? `已保存 ${new Date(updatedAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            : "已保存"
          : saveState === "error"
            ? "保存失败"
            : "无改动";

  if (loading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-12 text-sm">
        加载文档…
      </div>
    );
  }

  if (error && !markdown && !title) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <p className="text-destructive text-sm">{error}</p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
          返回工作台
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-0px)] flex-1 flex-col">
      <header className="bg-background shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <BackToHome className="shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="文档标题"
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
          />
          <span className="text-muted-foreground w-full text-xs sm:w-auto">
            {saveLabel}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleSaveNow}>
              立即保存
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleRename}>
              重命名
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void handleSaveAs()}>
              另存为
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleDownloadMd}>
              下载 .md
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void handleDelete()}
            >
              删除
            </Button>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              工作台
            </Link>
          </div>
        </div>
        {error ? (
          <p className="text-destructive mx-auto mt-2 max-w-5xl text-xs" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col p-4 sm:p-6">
        <div className="bg-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border shadow-sm">
          <TiptapEditor
            key={documentId}
            initialMarkdown={markdown}
            onMarkdownChange={handleMarkdownChange}
            onEditorReady={setEditor}
          />
          <SelectionAiAssistant
            editor={editor}
            value={markdown}
            onApply={handleMarkdownChange}
            aiSettings={aiSettings}
            configured={aiConfigured}
            providerId={activeProvider?.id ?? null}
            providerName={activeProvider?.name ?? null}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-center text-xs">
          富文本编辑 · 划词扩写/缩写/名词解释 · 约 {AUTOSAVE_MS}ms 自动保存
        </p>
      </main>
    </div>
  );
}
