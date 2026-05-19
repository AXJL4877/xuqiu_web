"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAiProviders } from "@/hooks/use-ai-providers";
import {
  DEFAULT_AI_SETTINGS,
  type AiSettings,
  isAiSettingsConfigured,
} from "@/lib/ai/settings";
import { cn } from "@/lib/utils";

const inputClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2";

type AiSettingsPanelProps = {
  className?: string;
  /** full：完整编辑；compact：首页折叠；picker：生成配置内仅选用已保存模型 */
  variant?: "full" | "compact" | "picker";
};

export function AiSettingsPanel({
  className,
  variant = "full",
}: AiSettingsPanelProps) {
  const {
    providers,
    activeId,
    activeProvider,
    configured,
    hydrated,
    loading,
    selectProvider,
    saveProvider,
    deleteProvider,
  } = useAiProviders();

  const [draft, setDraft] = useState<AiSettings & { name: string }>({
    name: "",
    ...DEFAULT_AI_SETTINGS,
  });
  const [expanded, setExpanded] = useState(variant === "full");
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== "compact") return;
    const root = document.documentElement;
    if (expanded) {
      root.classList.add("home-ai-config-expanded");
    } else {
      root.classList.remove("home-ai-config-expanded");
    }
    return () => root.classList.remove("home-ai-config-expanded");
  }, [expanded, variant]);

  useEffect(() => {
    if (!hydrated) return;
    if (activeProvider) {
      setDraft({
        name: activeProvider.name,
        baseUrl: activeProvider.baseUrl,
        apiKey: activeProvider.apiKey,
        model: activeProvider.model,
      });
      setEditingId(activeProvider.id);
    } else {
      setDraft({ name: "", ...DEFAULT_AI_SETTINGS });
      setEditingId(null);
    }
  }, [hydrated, activeProvider]);

  const handleSave = async () => {
    const next = {
      name: draft.name.trim() || draft.model || "未命名模型",
      baseUrl: draft.baseUrl.trim() || DEFAULT_AI_SETTINGS.baseUrl,
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim() || DEFAULT_AI_SETTINGS.model,
    };
    const ok = await saveProvider(next, editingId ? { id: editingId } : undefined);
    setMessage(
      ok
        ? isAiSettingsConfigured(next)
          ? "已保存到云端，各浏览器可复用"
          : "已保存；请填写完整 base_url、api_key、model"
        : "保存失败",
    );
    setTimeout(() => setMessage(null), 4000);
  };

  const handleNew = () => {
    setEditingId(null);
    setDraft({ name: "", ...DEFAULT_AI_SETTINGS });
  };

  const handleSelect = async (id: string) => {
    await selectProvider(id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("确定删除该模型配置？")) return;
    try {
      await deleteProvider(id);
      if (editingId === id) {
        setEditingId(null);
        setDraft({ name: "", ...DEFAULT_AI_SETTINGS });
      }
      setMessage("已删除");
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "删除失败");
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (variant === "picker" && !hydrated) {
    return (
      <section className={cn("w-full text-left", className)}>
        <h3 className="text-sm font-semibold">AI 模型</h3>
        <p className="text-muted-foreground mt-2 text-xs">加载中…</p>
      </section>
    );
  }

  if ((!hydrated || loading) && variant !== "picker") {
    return (
      <div
        className={cn(
          variant === "compact"
            ? "bg-card/80 min-h-14 animate-pulse rounded-xl border border-border/80 p-4"
            : "bg-card/80 min-h-[300px] animate-pulse rounded-xl border border-border/80 p-4",
          className,
        )}
        aria-hidden
      >
        <div className="bg-muted h-4 w-32 rounded" />
      </div>
    );
  }

  if (variant === "picker") {
    return (
      <section className={cn("w-full text-left", className)}>
        <h3 className="text-sm font-semibold">AI 模型</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          选用已保存的模型；新增或修改请回到首页配置。
        </p>
        {providers.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-xs">
            暂无已保存模型，请先在首页完成 AI 配置。
          </p>
        ) : (
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
            {providers.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left text-xs transition-colors",
                    p.id === activeId
                      ? "border-primary bg-primary/5"
                      : "border-border/80 hover:bg-muted/50",
                  )}
                  onClick={() => void handleSelect(p.id)}
                >
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-muted-foreground mt-0.5 block truncate">
                    {p.model}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <span
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            configured
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {configured && activeProvider
            ? `当前：${activeProvider.name}`
            : "演示模式"}
        </span>
      </section>
    );
  }

  if (variant === "compact" && !expanded) {
    return (
      <div
        className={cn(
          "bg-card/80 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 px-4 py-3",
          className,
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
              configured
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                configured ? "bg-primary" : "bg-muted-foreground",
              )}
            />
            {configured && activeProvider
              ? activeProvider.name
              : "演示模式"}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setExpanded(true)}
        >
          修改配置
        </Button>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "bg-card/80 w-full rounded-xl border border-border/80 p-5 text-left backdrop-blur-sm",
        variant === "compact" &&
          expanded &&
          "home-ai-config-scroll max-h-[min(78dvh,720px)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">AI 模型配置</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            已保存的配置同步至服务器，换浏览器登录也可选用。
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            configured
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {configured ? "已就绪" : "演示模式"}
        </span>
      </div>

      {providers.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium">已保存的模型</p>
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-0.5">
            {providers.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-xs",
                  p.id === activeId
                    ? "border-primary bg-primary/5"
                    : "border-border/80",
                )}
              >
                <button
                  type="button"
                  className="w-full min-w-0 text-left"
                  onClick={() => void handleSelect(p.id)}
                >
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-muted-foreground mt-0.5 block truncate">
                    {p.model} · {p.baseUrl}
                  </span>
                </button>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(p.id);
                      setDraft({
                        name: p.name,
                        baseUrl: p.baseUrl,
                        apiKey: p.apiKey,
                        model: p.model,
                      });
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 flex-1 gap-1 px-2 text-xs"
                    onClick={(e) => void handleDelete(p.id, e)}
                  >
                    <Trash2 className="size-3.5 shrink-0" aria-hidden />
                    删除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
                </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {editingId ? "编辑配置" : "新增配置"}
        </p>
        {editingId ? (
          <Button type="button" size="xs" variant="ghost" onClick={handleNew}>
            新建
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="ai-config-name">
            配置名称
          </label>
          <input
            id="ai-config-name"
            className={inputClass}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="例如：DeepSeek 主力"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="ai-base-url">
            Base URL
          </label>
          <input
            id="ai-base-url"
            className={inputClass}
            value={draft.baseUrl}
            onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
            placeholder="https://api.deepseek.com"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="ai-api-key">
              API Key
            </label>
            <input
              id="ai-api-key"
              type="password"
              className={inputClass}
              value={draft.apiKey}
              onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
              placeholder="sk-..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="ai-model">
              Model
            </label>
            <input
              id="ai-model"
              className={inputClass}
              value={draft.model}
              onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
              placeholder="deepseek-v4-flash"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void handleSave()}>
          {editingId ? "更新并选用" : "保存并选用"}
        </Button>
        {variant === "compact" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(false)}
          >
            收起
          </Button>
        ) : null}
        {message ? (
          <span className="text-primary text-xs font-medium">{message}</span>
        ) : null}
      </div>
    </section>
  );
}
