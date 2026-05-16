"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import {
  isSelectionAskAction,
  SELECTION_ACTIONS,
  type SelectionActionId,
} from "@/lib/ai/selection-prompt";
import {
  type AiSettings,
  isAiSettingsConfigured,
} from "@/lib/ai/settings";
import {
  clampToolbarPosition,
  getTextareaCaretClientRect,
  replaceTextareaRange,
} from "@/lib/textarea-selection";
type SelectionRange = {
  start: number;
  end: number;
  text: string;
};

type SelectionAiAssistantProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onApply: (next: string) => void;
  disabled?: boolean;
  aiSettings: AiSettings;
  configured: boolean;
  providerId?: string | null;
  providerName?: string | null;
};

const TOOLBAR_W = 420;
const TOOLBAR_H = 120;

export function SelectionAiAssistant({
  textareaRef,
  value,
  onApply,
  disabled = false,
  aiSettings,
  configured,
  providerId,
  providerName,
}: SelectionAiAssistantProps) {
  const customInputId = useId();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<SelectionRange | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const [diffOpen, setDiffOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamMode, setStreamMode] = useState<"demo" | "live" | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<SelectionActionId | null>(
    null,
  );

  const readSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el || disabled) return null;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return null;
    const text = value.slice(start, end);
    if (!text.trim()) return null;
    return { start, end, text };
  }, [textareaRef, value, disabled]);

  const updateToolbarFromSelection = useCallback(
    (clientX?: number, clientY?: number) => {
      const sel = readSelection();
      if (!sel) {
        if (!diffOpen) {
          setRange(null);
          setToolbarPos(null);
        }
        return;
      }
      setRange(sel);

      const el = textareaRef.current;
      if (!el) return;

      let x = clientX ?? 0;
      let y = clientY ?? 0;
      if (clientX == null || clientY == null) {
        const caret = getTextareaCaretClientRect(el, sel.end);
        x = caret.left;
        y = caret.top;
      }

      const clamped = clampToolbarPosition(
        x - TOOLBAR_W / 2,
        y - TOOLBAR_H - 12,
        TOOLBAR_W,
        TOOLBAR_H,
      );
      setToolbarPos(clamped);
    },
    [readSelection, textareaRef, diffOpen],
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || disabled) return;

    const onSelect = (e: MouseEvent | KeyboardEvent) => {
      if (diffOpen) return;
      const sel = readSelection();
      if (!sel) {
        setRange(null);
        setToolbarPos(null);
        return;
      }
      if (e instanceof MouseEvent) {
        updateToolbarFromSelection(e.clientX, e.clientY);
      } else {
        updateToolbarFromSelection();
      }
    };

    el.addEventListener("mouseup", onSelect);
    el.addEventListener("keyup", onSelect);
    return () => {
      el.removeEventListener("mouseup", onSelect);
      el.removeEventListener("keyup", onSelect);
    };
  }, [textareaRef, disabled, readSelection, updateToolbarFromSelection, diffOpen]);

  useEffect(() => {
    if (disabled) {
      setRange(null);
      setToolbarPos(null);
      setDiffOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (diffOpen) return;
      const target = e.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (textareaRef.current?.contains(target)) return;
      setRange(null);
      setToolbarPos(null);
      setCustomOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [diffOpen, textareaRef]);

  const runAction = async (
    action: SelectionActionId,
    options?: { prompt?: string; question?: string },
  ) => {
    if (!range) return;
    setActiveAction(action);
    setError(null);
    setResult("");
    setDiffOpen(true);
    setStreaming(true);
    setToolbarPos(null);
    setCustomOpen(false);

    try {
      const body: {
        text: string;
        action: SelectionActionId;
        customPrompt?: string;
        question?: string;
        context?: string;
        providerId?: string;
        ai?: AiSettings;
      } = {
        text: range.text,
        action,
        context: value,
      };
      if (action === "custom" && options?.prompt) {
        body.customPrompt = options.prompt;
      }
      if (providerId) {
        body.providerId = providerId;
      }
      if (configured && isAiSettingsConfigured(aiSettings)) {
        body.ai = aiSettings;
      }

      const res = await fetch("/api/ai/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? `请求失败 (${res.status})`);
        return;
      }

      const mode = res.headers.get("X-Xuqiu-Mode");
      setStreamMode(mode === "live" ? "live" : "demo");

      const reader = res.body?.getReader();
      if (!reader) {
        setError("无法读取响应流");
        return;
      }

      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf += dec.decode(chunk, { stream: true });
        setResult(buf);
      }

      if (buf.startsWith("【改写失败】") || buf.startsWith("【回答失败】")) {
        setError(
          buf
            .replace(/^【改写失败】|^【回答失败】/, "")
            .split("\n")[0] ?? "请求失败",
        );
        setResult("");
      } else if (!buf.trim()) {
        setError(
          "模型未返回内容，请检查模型名称（deepseek-v4-flash / deepseek-v4-pro）与 API Key。",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setStreaming(false);
    }
  };

  const handleAccept = () => {
    if (!range || !result.trim()) return;
    const next = replaceTextareaRange(
      value,
      range.start,
      range.end,
      result.trimEnd(),
    );
    onApply(next);
    closeDiff();
  };

  const closeDiff = () => {
    setDiffOpen(false);
    setResult("");
    setError(null);
    setActiveAction(null);
    setStreamMode(null);
    setRange(null);
    setToolbarPos(null);
  };

  const showToolbar =
    Boolean(range && toolbarPos && !diffOpen && !disabled);

  const isAskMode = activeAction != null && isSelectionAskAction(activeAction);

  const actionLabel =
    activeAction === "custom"
      ? "自定义"
      : activeAction === "ask"
        ? "名词解释"
        : (SELECTION_ACTIONS.find((a) => a.id === activeAction)?.label ??
          "AI 改写");

  return (
    <>
      <AnimatePresence>
        {showToolbar ? (
          <motion.div
            ref={toolbarRef}
            role="toolbar"
            aria-label="划词 AI 助手"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="bg-popover fixed z-50 max-w-[calc(100vw-16px)] rounded-xl border border-border p-2 shadow-lg"
            style={{
              left: toolbarPos!.x,
              top: toolbarPos!.y,
              width: TOOLBAR_W,
            }}
          >
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 px-1 text-[11px]">
              <Sparkles className="text-primary size-3.5 shrink-0" />
              <span className="truncate">
                已选 {range!.text.length} 字 · 划词 AI
                {configured && providerName
                  ? ` · ${providerName}`
                  : configured
                    ? ""
                    : " · 将使用已保存模型"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {SELECTION_ACTIONS.map((a) => (
                <Button
                  key={a.id}
                  type="button"
                  size="xs"
                  variant="secondary"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void runAction(a.id)}
                >
                  {a.label}
                </Button>
              ))}
              <Button
                type="button"
                size="xs"
                variant="outline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCustomOpen(false);
                  void runAction("ask");
                }}
              >
                名词解释
              </Button>
              <Button
                type="button"
                size="xs"
                variant={customOpen ? "default" : "outline"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCustomOpen((v) => !v)}
              >
                自定义
              </Button>
            </div>
            {customOpen ? (
              <div className="mt-2 flex gap-1.5">
                <input
                  id={customInputId}
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="例如：改成用户故事格式、补充验收标准…"
                  className="border-input bg-background h-8 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customPrompt.trim()) {
                      void runAction("custom", { prompt: customPrompt.trim() });
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!customPrompt.trim()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    void runAction("custom", { prompt: customPrompt.trim() })
                  }
                >
                  执行
                </Button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {diffOpen && range ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="selection-diff-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-background/80 absolute inset-0 z-40 flex flex-col backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="bg-card mt-auto flex max-h-[min(70%,520px)] min-h-0 flex-col border-t border-border shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
            >
              <motion.div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="min-w-0">
                  <h3
                    id="selection-diff-title"
                    className="text-sm font-semibold"
                  >
                    {isAskMode ? "名词解释" : `${actionLabel} · 对比采纳`}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {streaming
                      ? isAskMode
                        ? "正在解释术语…"
                        : "AI 正在改写…"
                      : streamMode === "live"
                        ? "大模型输出"
                        : streamMode === "demo"
                          ? configured
                            ? "未连接到大模型，请检查 DeepSeek 配置是否已保存为默认"
                            : "演示模式（请先在右侧配置并保存 DeepSeek）"
                          : providerName
                            ? `使用 ${providerName}`
                            : isAskMode
                              ? "仅解释专业名词，不修改正文"
                              : "请确认后替换选区"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="关闭"
                  onClick={closeDiff}
                >
                  <X className="size-4" />
                </Button>
              </motion.div>

              {error ? (
                <p className="text-destructive shrink-0 px-4 py-2 text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 sm:grid-cols-2">
                <div className="flex min-h-0 flex-col border-b border-border sm:border-r sm:border-b-0">
                  <p className="text-muted-foreground shrink-0 px-4 py-1.5 text-xs font-medium">
                    {isAskMode ? "选中名词" : "原文"}
                  </p>
                  <pre className="min-h-0 flex-1 overflow-auto px-4 pb-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {range.text}
                  </pre>
                </div>
                <div className="flex min-h-0 flex-col">
                  <p className="text-primary shrink-0 px-4 py-1.5 text-xs font-medium">
                    {isAskMode ? "名词释义" : "AI 建议"}
                    {streaming ? (
                      <Loader2 className="ml-1.5 inline size-3.5 animate-spin" />
                    ) : null}
                  </p>
                  <pre className="min-h-0 flex-1 overflow-auto px-4 pb-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {result || (streaming ? "…" : "（无输出）")}
                  </pre>
                </div>
              </div>

              <motion.div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
                {isAskMode ? (
                  <Button type="button" onClick={closeDiff}>
                    关闭
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={closeDiff}>
                      拒绝
                    </Button>
                    <Button
                      type="button"
                      disabled={streaming || !result.trim() || Boolean(error)}
                      onClick={handleAccept}
                    >
                      采纳并替换
                    </Button>
                  </>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
