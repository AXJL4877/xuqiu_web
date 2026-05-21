"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { InquiryDialogMotion } from "@/components/inquiry/inquiry-dialog-motion";
import { Button } from "@/components/ui/button";
import type {
  CompletionStrategy,
  InquiryAssumption,
  InquiryFinishResponse,
} from "@/lib/inquiry/types";
import { cn } from "@/lib/utils";

const cardClass =
  "bg-card flex w-full flex-col rounded-xl border border-border shadow-lg";

type InquiryConfirmPanelProps = {
  finishData: InquiryFinishResponse | null;
  finishLoading?: boolean;
  finishError?: string | null;
  onRetryFinish?: () => void;
  onBack: () => void;
  onGenerate: (payload: {
    acceptedAssumptions: InquiryAssumption[];
    completionStrategy: CompletionStrategy;
  }) => void;
  generating?: boolean;
};

const STRATEGIES: {
  id: CompletionStrategy;
  label: string;
  desc: string;
}[] = [
  {
    id: "conservative",
    label: "保守",
    desc: "缺失处只写「待补充」，不做推断",
  },
  {
    id: "standard",
    label: "标准",
    desc: "仅勾选假设写入正文，并标注（推断）",
  },
  {
    id: "aggressive",
    label: "积极",
    desc: "尽量补全，未确认项收入假设清单附录",
  },
];

export function InquiryConfirmPanel({
  finishData,
  finishLoading = false,
  finishError = null,
  onRetryFinish,
  onBack,
  onGenerate,
  generating = false,
}: InquiryConfirmPanelProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<CompletionStrategy>("standard");

  useEffect(() => {
    setCheckedIds(new Set());
    setStrategy("standard");
  }, [finishData]);

  const toggleAssumption = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = () => {
    if (!finishData) return;
    const accepted = finishData.assumptions.filter((a) =>
      checkedIds.has(a.id),
    );
    onGenerate({ acceptedAssumptions: accepted, completionStrategy: strategy });
  };

  const humanFacts =
    finishData?.humanFacts?.length ? finishData.humanFacts : [];

  const motionKey = finishLoading
    ? "finish-loading"
    : finishError
      ? "finish-error"
      : finishData
        ? "finish-content"
        : "finish-empty";

  return (
    <InquiryDialogMotion motionKey={motionKey} className="max-w-2xl">
      {finishLoading ? (
        <div
          className={cn(
            cardClass,
            "items-center justify-center gap-3 p-12",
          )}
        >
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">正在整理确认信息…</p>
        </div>
      ) : finishError ? (
        <div className={cn(cardClass, "p-8 text-center")}>
          <p className="text-destructive text-sm">{finishError}</p>
          {onRetryFinish ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={onRetryFinish}
            >
              重试
            </Button>
          ) : null}
        </div>
      ) : !finishData ? null : (
        <div
          className={cn(
            cardClass,
            "max-h-[min(85vh,720px)] overflow-y-auto p-6",
          )}
        >
          <h2 className="text-lg font-semibold">确认需求信息</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            请用业务语言核对下方内容；技术细节（如 TypeScript、数据库字段）将在生成
            PRD 时由系统自动编译，无需您审查。
          </p>

          {humanFacts.length > 0 ? (
            <section className="mt-5">
              <h3 className="text-sm font-medium">已确认的业务理解</h3>
              <ul className="mt-2 space-y-4">
                {humanFacts.map((h) => (
                  <li
                    key={h.sectionId}
                    className="rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <p className="text-sm font-medium">{h.sectionTitle}</p>
                    <ul className="text-muted-foreground mt-2 space-y-1.5 text-sm leading-relaxed">
                      {h.bullets.map((line, i) => (
                        <li key={`${h.sectionId}-${i}`} className="flex gap-2">
                          <span className="text-primary shrink-0">·</span>
                          <span>{line.replace(/^\*\*|\*\*/g, "")}</span>
                        </li>
                      ))}
                    </ul>
                    {h.footnote ? (
                      <p className="text-muted-foreground mt-2 text-xs italic">
                        （注：{h.footnote}）
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : finishData.facts.length > 0 ? (
            <section className="mt-5">
              <h3 className="text-sm font-medium">已确认事实</h3>
              <ul className="mt-2 space-y-3">
                {finishData.facts.map((e) => (
                  <li
                    key={e.sectionId}
                    className="rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <p className="text-sm font-medium">{e.sectionTitle}</p>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                      {e.content}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {finishData.gaps.length > 0 ? (
            <section className="mt-5">
              <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400">
                仍待补充
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {finishData.gaps.map((g) => (
                  <li key={g.sectionId}>
                    <span className="font-medium text-foreground">
                      {g.sectionTitle}
                    </span>
                    ：{g.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {finishData.assumptions.length > 0 ? (
            <section className="mt-5">
              <h3 className="text-sm font-medium">待验证假设（勾选后采纳）</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                未勾选的假设不会以确定语气写入正文。
              </p>
              <ul className="mt-3 space-y-2">
                {finishData.assumptions.map((a) => (
                  <li key={a.id}>
                    <label
                      className={cn(
                        "hover:bg-muted/50 flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                        checkedIds.has(a.id)
                          ? "border-primary bg-primary/5"
                          : "border-border",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checkedIds.has(a.id)}
                        onChange={() => toggleAssumption(a.id)}
                      />
                      <span className="min-w-0 text-sm leading-relaxed">
                        <span className="text-muted-foreground text-xs">
                          {a.sectionTitle} ·{" "}
                        </span>
                        {a.text}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-5">
            <h3 className="text-sm font-medium">补全策略</h3>
            <div className="mt-2 space-y-2">
              {STRATEGIES.map((s) => (
                <label
                  key={s.id}
                  className={cn(
                    "hover:bg-muted/50 flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    strategy === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="completion-strategy"
                    className="mt-0.5"
                    checked={strategy === s.id}
                    onChange={() => setStrategy(s.id)}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-muted-foreground"> — {s.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <p className="text-muted-foreground mt-4 text-xs">
            导出给 Cursor 的 PRD 将自动包含 TypeScript 契约等技术细节，与上方业务确认一致。
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" disabled={generating} onClick={handleGenerate}>
              {generating ? "生成中…" : "生成 PRD 初稿"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={generating}
              onClick={onBack}
            >
              返回继续询问
            </Button>
          </div>
        </div>
      )}
    </InquiryDialogMotion>
  );
}
