"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { InquiryConfirmPanel } from "@/components/inquiry/inquiry-confirm-panel";
import { InquiryQuestionDialog } from "@/components/inquiry/inquiry-question-dialog";
import { StructuredNotebook } from "@/components/inquiry/structured-notebook";
import { Button } from "@/components/ui/button";
import { setEntryContent, setEntryItems } from "@/lib/inquiry/notebook";
import type { NotebookSectionItem } from "@/lib/inquiry/notebook-schema";
import type { AiSettings } from "@/lib/ai/settings";
import { isAiSettingsConfigured } from "@/lib/ai/settings";
import {
  deleteInquirySessionOnServer,
  syncInquirySessionToServer,
} from "@/lib/inquiry/session-sync-client";
import {
  clearInquirySession,
  loadInquirySession,
  saveInquirySession,
  type PersistedInquirySession,
} from "@/lib/inquiry/session-storage";
import type {
  CompletionStrategy,
  InquiryAssumption,
  InquiryFinishResponse,
  InquiryGeneratePayload,
  InquiryNextResponse,
  InquiryNotebook,
  InquiryQuestion,
  InquirySessionMeta,
} from "@/lib/inquiry/types";
import { EASE_OUT } from "@/lib/motion-presets";
import type { TemplateSectionItem } from "@/lib/template-types";

type InquiryPhase = "collecting" | "confirming";

type InquiryFlowViewProps = {
  open: boolean;
  idea: string;
  sections: TemplateSectionItem[];
  onClose: () => void;
  onCleared?: () => void;
  onCompleteGenerate: (payload: InquiryGeneratePayload) => void;
  generating?: boolean;
  aiSettings: AiSettings;
  aiConfigured: boolean;
  providerId?: string | null;
};

async function postInquiryNext(body: Record<string, unknown>) {
  const res = await fetch("/api/ai/inquiry/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `请求失败 (${res.status})`);
  }
  return (await res.json()) as InquiryNextResponse;
}

async function postInquiryFinish(body: Record<string, unknown>) {
  const res = await fetch("/api/ai/inquiry/finish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `请求失败 (${res.status})`);
  }
  return (await res.json()) as InquiryFinishResponse;
}

export function InquiryFlowView({
  open,
  idea,
  sections,
  onClose,
  onCleared,
  onCompleteGenerate,
  generating = false,
  aiSettings,
  aiConfigured,
  providerId,
}: InquiryFlowViewProps) {
  const [mounted, setMounted] = useState(false);
  const bootstrappedRef = useRef(false);
  const persistDisabledRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<InquiryPhase>("collecting");
  const [session, setSession] = useState<InquirySessionMeta | null>(null);
  const [notebook, setNotebook] = useState<InquiryNotebook>({ entries: [] });
  const [question, setQuestion] = useState<InquiryQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inquiryMode, setInquiryMode] = useState<"demo" | "live">("demo");
  const [finishData, setFinishData] = useState<InquiryFinishResponse | null>(
    null,
  );
  const [finishLoading, setFinishLoading] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const buildInquiryBody = useCallback(
    (base: Record<string, unknown>) => {
      const body = { ...base };
      if (session) body.session = session;
      if (providerId) body.providerId = providerId;
      if (aiConfigured && isAiSettingsConfigured(aiSettings)) {
        body.ai = aiSettings;
      }
      return body;
    },
    [aiSettings, aiConfigured, providerId, session],
  );

  const persist = useCallback(
    (
      nextSession: InquirySessionMeta,
      nextNotebook: InquiryNotebook,
      nextPhase: InquiryPhase,
    ) => {
      const data: PersistedInquirySession = {
        version: 1,
        session: { ...nextSession, idea, sections },
        notebook: nextNotebook,
        phase: nextPhase,
        inquiryOpen: true,
        dbId: nextSession.sessionId,
      };
      if (persistDisabledRef.current) return;
      saveInquirySession(data);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        void syncInquirySessionToServer(data);
      }, 400);
    },
    [idea, sections],
  );

  const fetchFinish = useCallback(
    async (
      nextNotebook: InquiryNotebook,
      nextSession: InquirySessionMeta | null,
    ) => {
      setFinishLoading(true);
      setFinishError(null);
      try {
        const body: Record<string, unknown> = {
          idea,
          sections,
          notebook: nextNotebook,
        };
        if (nextSession) body.session = nextSession;
        if (aiConfigured && isAiSettingsConfigured(aiSettings)) {
          body.ai = aiSettings;
        }
        if (providerId) body.providerId = providerId;
        const data = await postInquiryFinish(body);
        setFinishData(data);
        if (data.notebook) {
          setNotebook(data.notebook);
          if (nextSession) {
            persist(nextSession, data.notebook, "confirming");
          }
        }
      } catch (e) {
        setFinishData(null);
        setFinishError(
          e instanceof Error ? e.message : "整理确认信息失败",
        );
      } finally {
        setFinishLoading(false);
      }
    },
    [idea, sections, aiSettings, aiConfigured, providerId, persist],
  );

  const enterConfirming = useCallback(
    (
      nextSession: InquirySessionMeta,
      nextNotebook: InquiryNotebook,
    ) => {
      setQuestion(null);
      setPhase("confirming");
      setFinishData(null);
      persist(nextSession, nextNotebook, "confirming");
      void fetchFinish(nextNotebook, nextSession);
    },
    [persist, fetchFinish],
  );

  const applyResponse = useCallback(
    (data: InquiryNextResponse, nextPhase: InquiryPhase = "collecting") => {
      setInquiryMode(data.mode);
      setSession(data.session);
      setNotebook(data.notebook);
      if (data.done) {
        enterConfirming(data.session, data.notebook);
      } else {
        setQuestion(data.question);
        setPhase(nextPhase);
        persist(data.session, data.notebook, nextPhase);
      }
    },
    [persist, enterConfirming],
  );

  const startInquiry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postInquiryNext(
        buildInquiryBody({
          action: "start",
          idea,
          sections,
          notebook: { entries: [] },
        }),
      );
      applyResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动询问失败");
    } finally {
      setLoading(false);
    }
  }, [idea, sections, applyResponse, buildInquiryBody]);

  useEffect(() => {
    if (!open) {
      bootstrappedRef.current = false;
      return;
    }
    persistDisabledRef.current = false;
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const saved = loadInquirySession();
    const ideaForApi = saved?.session.idea?.trim() || idea.trim();
    const sectionsForApi = saved?.session.sections?.length
      ? saved.session.sections
      : sections;

    if (saved?.notebook?.entries?.length) {
      setSession(saved.session);
      setNotebook(saved.notebook);
      setPhase(saved.phase);
      if (saved.phase === "confirming") {
        setQuestion(null);
        void fetchFinish(saved.notebook, saved.session);
        return;
      }
      void (async () => {
        setLoading(true);
        try {
          const data = await postInquiryNext(
            buildInquiryBody({
              action: "sync_notebook",
              idea: ideaForApi,
              sections: sectionsForApi,
              notebook: saved.notebook,
            }),
          );
          applyResponse(data);
        } catch {
          void startInquiry();
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    void startInquiry();
  }, [
    open,
    idea,
    sections,
    applyResponse,
    startInquiry,
    buildInquiryBody,
    fetchFinish,
  ]);

  useEffect(() => {
    if (!open || !session) return;
    const flush = () => persist(session, notebook, phase);
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [open, session, notebook, phase, persist]);

  const handleNotebookEdit = (
    sectionId: string,
    content: string,
    markUserEdit: boolean,
  ) => {
    setNotebook((prev) => {
      const next = setEntryContent(
        prev,
        sectionId,
        content,
        markUserEdit
          ? { type: "user_edit", at: new Date().toISOString() }
          : undefined,
      );
      if (session) persist(session, next, phase);
      return next;
    });
  };

  const handleNotebookItemsChange = (
    sectionId: string,
    items: NotebookSectionItem[],
    markUserEdit: boolean,
  ) => {
    setNotebook((prev) => {
      const next = setEntryItems(
        prev,
        sectionId,
        items,
        markUserEdit
          ? { type: "user_edit", at: new Date().toISOString() }
          : undefined,
      );
      if (session) persist(session, next, phase);
      return next;
    });
  };

  const submitAnswer = async (
    payload: {
      selectedOptionIds: string[];
      customText?: string;
      resolvedText?: string;
    },
    skip = false,
  ) => {
    if (!question && !skip) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await postInquiryNext(
        buildInquiryBody(
          skip
            ? {
                action: "skip",
                idea,
                sections,
                notebook,
                questionId: question?.id,
                answer: question
                  ? {
                      questionId: question.id,
                      sectionId: question.sectionId,
                    }
                  : undefined,
              }
            : {
                action: "answer",
                idea,
                sections,
                notebook,
                answer: {
                  questionId: question!.id,
                  sectionId: question!.sectionId,
                  selectedOptionIds: payload.selectedOptionIds,
                  customText: payload.customText,
                  resolvedText: payload.resolvedText,
                },
              },
        ),
      );
      applyResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndInquiry = () => {
    if (session) enterConfirming(session, notebook);
  };

  const handleClose = () => {
    if (session) persist(session, notebook, phase);
    onClose();
  };

  const resetInquiryState = () => {
    persistDisabledRef.current = true;
    const sid = session?.sessionId;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    clearInquirySession();
    if (sid) void deleteInquirySessionOnServer(sid);
    bootstrappedRef.current = false;
    setSession(null);
    setNotebook({ entries: [] });
    setQuestion(null);
    setPhase("collecting");
    setError(null);
    setInquiryMode("demo");
    setFinishData(null);
    setFinishError(null);
    setFinishLoading(false);
  };

  const handleExitCompletely = () => {
    if (!confirm("确定清除进度并退出？本地询问记录将被删除。")) return;
    resetInquiryState();
    onCleared?.();
    onClose();
  };

  const handleConfirmGenerate = ({
    acceptedAssumptions,
    completionStrategy,
  }: {
    acceptedAssumptions: InquiryAssumption[];
    completionStrategy: CompletionStrategy;
  }) => {
    if (!finishData) return;
    onCompleteGenerate({
      idea: idea.trim(),
      notebook,
      acceptedAssumptions,
      gaps: finishData.gaps,
      completionStrategy,
      inquirySessionId: session?.sessionId,
    });
  };

  if (!open || !mounted) return null;

  const layer = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-base font-semibold sm:text-lg">需求询问</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {phase === "collecting"
              ? aiConfigured
                ? inquiryMode === "live"
                  ? "AI 根据你的创意与笔记板缺口逐轮提问"
                  : "已配置 AI · 当前为备用题目（网络或服务异常时可重试）"
                : "演示模式 · 在首页配置 API 后可智能追问"
              : "确认后将生成 PRD 初稿"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phase === "collecting" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || submitting}
              onClick={handleEndInquiry}
            >
              结束询问
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭"
            onClick={handleClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {error ? (
        <p className="text-destructive shrink-0 px-4 py-2 text-sm sm:px-6" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-8">
          {phase === "confirming" ? (
            <InquiryConfirmPanel
              finishData={finishData}
              finishLoading={finishLoading}
              finishError={finishError}
              onRetryFinish={() => {
                if (session) void fetchFinish(notebook, session);
              }}
              generating={generating}
              onBack={() => {
                setPhase("collecting");
                setFinishData(null);
                setFinishError(null);
                if (session) persist(session, notebook, "collecting");
                void (async () => {
                  setLoading(true);
                  try {
                    const data = await postInquiryNext(
                      buildInquiryBody({
                        action: "sync_notebook",
                        idea,
                        sections,
                        notebook,
                      }),
                    );
                    if (!data.done) {
                      applyResponse(data, "collecting");
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "恢复询问失败");
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
              onGenerate={handleConfirmGenerate}
            />
          ) : (
            <InquiryQuestionDialog
              question={question}
              loading={loading}
              loadingHint={
                inquiryMode === "live" || aiConfigured
                  ? "正在根据你的创意生成下一题…"
                  : undefined
              }
              submitting={submitting}
              idea={idea}
              sections={sections}
              aiSettings={aiSettings}
              aiConfigured={aiConfigured}
              providerId={providerId}
              onSubmit={(p) => void submitAnswer(p)}
              onSkip={() => void submitAnswer({ selectedOptionIds: [] }, true)}
            />
          )}
        </main>

        <StructuredNotebook
          className="w-full max-w-md shrink-0 border-t md:border-t-0 md:flex md:w-80 md:border-l lg:w-96"
          notebook={notebook}
          activeSectionId={question?.sectionId ?? null}
          onEntryChange={handleNotebookEdit}
          onItemsChange={handleNotebookItemsChange}
          disabled={submitting}
        />
      </div>

      <footer className="text-muted-foreground shrink-0 border-t border-border px-4 py-2 text-center text-[11px] sm:px-6">
        笔记板在宽屏显示于右侧 ·{" "}
        <button
          type="button"
          className="underline hover:text-foreground"
          onClick={handleExitCompletely}
        >
          清除进度并退出
        </button>
      </footer>
    </motion.div>
  );

  return createPortal(layer, document.body);
}
