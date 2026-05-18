"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiSettings } from "@/lib/ai/settings";
import { isAiSettingsConfigured } from "@/lib/ai/settings";
import type { InquiryExplainContext } from "@/lib/inquiry/explain-prompt";
import { sanitizeInquiryExplainOutput } from "@/lib/inquiry/sanitize-explain";
import {
  inquiryPopoverTransition,
  inquiryPopoverVariants,
} from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

type InquiryTextSelectionProps = {
  children: React.ReactNode;
  className?: string;
  /** 题目与项目语境，用于 contextual 名词解释 */
  explainContext?: InquiryExplainContext;
  /** 缓存键后缀（如题目 id），同一术语在不同题可分别缓存 */
  cacheScope?: string;
  aiSettings: AiSettings;
  configured: boolean;
  providerId?: string | null;
  disabled?: boolean;
};

type SelectionState = {
  text: string;
  x: number;
  y: number;
};

function buildCacheKey(scope: string | undefined, term: string): string {
  const base = term.trim().toLowerCase();
  return scope ? `${scope}::${base}` : base;
}

export function InquiryTextSelection({
  children,
  className,
  explainContext,
  cacheScope,
  aiSettings,
  configured,
  providerId,
  disabled = false,
}: InquiryTextSelectionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainTerm, setExplainTerm] = useState("");
  const [explainText, setExplainText] = useState("");
  const [explainError, setExplainError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const readSelection = useCallback(() => {
    if (disabled) return null;
    const root = rootRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return null;

    const text = sel.toString().trim();
    if (!text || text.length > 200) return null;

    const rect = range.getBoundingClientRect();
    return {
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    };
  }, [disabled]);

  useEffect(() => {
    const onMouseUp = () => {
      if (explainOpen) return;
      setSelection(readSelection());
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [readSelection, explainOpen]);

  const runExplain = async () => {
    if (!selection) return;
    const term = selection.text;
    const cacheKey = buildCacheKey(cacheScope, term);
    setSelection(null);
    setExplainTerm(term);
    setExplainOpen(true);
    setExplainError(null);

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setExplainText(cached);
      return;
    }

    setExplaining(true);
    setExplainText("");

    try {
      const body: Record<string, unknown> = {
        term,
        idea: explainContext?.idea,
        questionStem: explainContext?.questionStem,
        questionWhy: explainContext?.questionWhy,
        sectionTitle: explainContext?.sectionTitle,
        options: explainContext?.options,
      };
      if (configured && isAiSettingsConfigured(aiSettings)) {
        body.ai = aiSettings;
        if (providerId) body.providerId = providerId;
      }

      const res = await fetch("/api/ai/inquiry/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `解释失败 (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取解释结果");

      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setExplainText(sanitizeInquiryExplainOutput(buf, term, true));
      }

      const finalText = sanitizeInquiryExplainOutput(buf, term);
      setExplainText(finalText);
      cacheRef.current.set(cacheKey, finalText);
    } catch (e) {
      setExplainError(e instanceof Error ? e.message : "名词解释失败");
    } finally {
      setExplaining(false);
    }
  };

  return (
    <>
      <div ref={rootRef} className={cn("select-text", className)}>
        {children}
      </div>

      <AnimatePresence>
        {selection && !explainOpen ? (
          <motion.div
            key="selection-toolbar"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={inquiryPopoverVariants}
            transition={inquiryPopoverTransition}
            className="bg-popover fixed z-[60] flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-lg border border-border px-1 py-1 shadow-lg"
            style={{ left: selection.x, top: selection.y - 8 }}
            role="toolbar"
          >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1 px-2 text-xs"
            disabled={explaining}
            onClick={() => void runExplain()}
          >
            {explaining ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <BookOpen className="size-3.5" />
            )}
            名词解释
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="关闭"
            onClick={() => setSelection(null)}
          >
            <X className="size-3.5" />
          </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {explainOpen ? (
          <motion.div
            key="explain-panel"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={inquiryPopoverVariants}
            transition={inquiryPopoverTransition}
            className="bg-card fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-lg rounded-xl border border-border p-4 shadow-xl sm:right-6 sm:bottom-6 sm:left-auto"
            role="dialog"
            aria-label="名词解释"
          >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">
              名词解释
              {explainTerm ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {explainTerm}
                </span>
              ) : null}
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              aria-label="关闭释义"
              onClick={() => {
                setExplainOpen(false);
                setExplainText("");
                setExplainError(null);
                setExplainTerm("");
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
          {explainError ? (
            <p className="text-destructive mt-2 text-sm">{explainError}</p>
          ) : explaining && !explainText ? (
            <div className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              正在解释…
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {explainText || "暂无释义"}
            </p>
          )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
