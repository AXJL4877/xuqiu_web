"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { InquiryDialogMotion } from "@/components/inquiry/inquiry-dialog-motion";
import { InquiryTextSelection } from "@/components/inquiry/inquiry-text-selection";
import { Button } from "@/components/ui/button";
import type { AiSettings } from "@/lib/ai/settings";
import { resolveAnswerText } from "@/lib/inquiry/resolve-answer";
import type { InquiryQuestion } from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";
import { cn } from "@/lib/utils";

const cardClass =
  "bg-card w-full rounded-xl border border-border shadow-lg";

type InquiryQuestionDialogProps = {
  question: InquiryQuestion | null;
  loading?: boolean;
  loadingHint?: string;
  submitting?: boolean;
  idea?: string;
  sections?: TemplateSectionItem[];
  aiSettings: AiSettings;
  aiConfigured: boolean;
  providerId?: string | null;
  onSubmit: (payload: {
    selectedOptionIds: string[];
    customText?: string;
    resolvedText: string;
  }) => void;
  onSkip: () => void;
};

export function InquiryQuestionDialog({
  question,
  loading = false,
  loadingHint,
  submitting = false,
  idea = "",
  sections = [],
  aiSettings,
  aiConfigured,
  providerId,
  onSubmit,
  onSkip,
}: InquiryQuestionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);

  const isMulti = question?.kind === "multi";
  const isText = question?.kind === "text";

  useEffect(() => {
    setSelectedIds([]);
    setCustomText("");
    setTextAnswer("");
    setWhyOpen(false);
  }, [question?.id]);

  const busy = loading || submitting;
  const showCustom = selectedIds.includes("custom");

  const explainContext = useMemo(() => {
    if (!question) {
      return idea.trim() ? { idea: idea.trim() } : undefined;
    }
    const sectionTitle = question.sectionId
      ? sections.find((s) => s.id === question.sectionId)?.title
      : undefined;
    return {
      idea: idea.trim() || undefined,
      questionStem: question.stem,
      questionWhy: question.whyAsk,
      sectionTitle,
      options: question.options?.map((o) => o.label),
    };
  }, [idea, question, sections]);

  const pendingNext = loading || submitting;

  const motionKey = pendingNext
    ? "loading"
    : !question
      ? "empty"
      : `question-${question.id}`;

  const loadingMessage = submitting && !loading
    ? "正在提交并准备下一题…"
    : (loadingHint ?? "正在准备下一题…");

  const toggleOption = (id: string) => {
    if (id === "custom") {
      setSelectedIds((prev) =>
        prev.includes("custom") ? [] : ["custom"],
      );
      return;
    }
    if (isMulti) {
      setSelectedIds((prev) => {
        const withoutCustom = prev.filter((x) => x !== "custom");
        return withoutCustom.includes(id)
          ? withoutCustom.filter((x) => x !== id)
          : [...withoutCustom, id];
      });
    } else {
      setSelectedIds([id]);
    }
  };

  const canSubmit = isText
    ? Boolean(textAnswer.trim()) && !busy
    : selectedIds.length > 0 &&
      (!showCustom || Boolean(customText.trim())) &&
      !busy;

  const handleSubmit = () => {
    if (!question) return;
    if (isText) {
      const t = textAnswer.trim();
      if (!t) return;
      onSubmit({
        selectedOptionIds: [],
        resolvedText: t,
        customText: t,
      });
      return;
    }
    if (selectedIds.length === 0) return;
    const resolved =
      resolveAnswerText(
        question,
        selectedIds,
        showCustom ? customText : undefined,
      ) ?? "";
    onSubmit({
      selectedOptionIds: selectedIds,
      customText: showCustom ? customText.trim() : undefined,
      resolvedText: resolved,
    });
  };

  return (
    <InquiryDialogMotion motionKey={motionKey}>
      {pendingNext ? (
        <div
          className={cn(
            cardClass,
            "flex flex-col items-center justify-center gap-3 p-10",
          )}
        >
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">{loadingMessage}</p>
          {loading ? (
            <p className="text-muted-foreground mt-1 text-xs">
              智能出题约需 3–8 秒，请稍候
            </p>
          ) : null}
        </div>
      ) : !question ? (
        <div className={cn(cardClass, "p-8 text-center")}>
          <p className="text-muted-foreground text-sm">暂无待回答问题</p>
        </div>
      ) : (
        <InquiryTextSelection
          explainContext={explainContext}
          cacheScope={question.id}
          aiSettings={aiSettings}
          configured={aiConfigured}
          providerId={providerId}
          disabled={busy}
          className={cn(cardClass, "p-6")}
        >
          <div role="dialog" aria-labelledby="inquiry-question-title">
            <div className="text-muted-foreground mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                第 {question.questionIndex} 题
                {question.estimatedRemaining > 0
                  ? ` · 约还需 ${question.estimatedRemaining} 题`
                  : null}
              </span>
              <span className="bg-muted rounded px-2 py-0.5">
                {isText ? "填空" : isMulti ? "多选" : "单选"}
              </span>
            </div>

            <h2
              id="inquiry-question-title"
              className="text-base font-semibold leading-snug sm:text-lg"
            >
              {question.stem}
            </h2>
            <p className="text-muted-foreground mt-1 text-[11px]">
              划词题干或选项中的词语可「名词解释」
            </p>

            {question.whyAsk ? (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                  onClick={() => setWhyOpen((v) => !v)}
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      whyOpen && "rotate-180",
                    )}
                  />
                  为何问这题
                </button>
                {whyOpen ? (
                  <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                    {question.whyAsk}
                  </p>
                ) : null}
              </div>
            ) : null}

            {isText ? (
              <textarea
                className="border-input bg-background mt-5 w-full rounded-md border px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2"
                rows={5}
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="请用自己的话补充细节，可多写几句…"
                disabled={busy}
              />
            ) : (
              <fieldset className="mt-5 space-y-2" disabled={busy}>
                <legend className="sr-only">
                  {isMulti ? "可多选" : "请选择一项"}
                </legend>
                {question.options?.map((opt) => (
                  <label
                    key={opt.id}
                    className={cn(
                      "hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      selectedIds.includes(opt.id)
                        ? "border-primary bg-primary/5"
                        : "border-border",
                    )}
                  >
                    <input
                      type={isMulti && !opt.isCustom ? "checkbox" : "radio"}
                      name="inquiry-option"
                      className="mt-1"
                      checked={selectedIds.includes(opt.id)}
                      onChange={() => toggleOption(opt.id)}
                    />
                    <span className="text-sm leading-relaxed">{opt.label}</span>
                  </label>
                ))}
              </fieldset>
            )}

            {showCustom && !isText ? (
              <textarea
                className="border-input bg-background mt-3 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                rows={3}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="请用你自己的话描述…"
                disabled={busy}
              />
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                    提交中…
                  </>
                ) : (
                  "下一题"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={onSkip}
              >
                跳过本题
              </Button>
            </div>
          </div>
        </InquiryTextSelection>
      )}
    </InquiryDialogMotion>
  );
}
