"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import { GenerateConfigDrawer } from "@/components/generate/generate-config-drawer";
import { InquiryFlowView } from "@/components/inquiry/inquiry-flow-view";
import { SelectionAiAssistant } from "@/components/generate/selection-ai-assistant";
import { BackToHome } from "@/components/shared/back-to-home";
import { Button } from "@/components/ui/button";
import { useAiProviders } from "@/hooks/use-ai-providers";
import { isAiSettingsConfigured } from "@/lib/ai/settings";
import { runBlockedGenerate } from "@/lib/ai/run-blocked-generate";
import { sanitizePrdMarkdown } from "@/lib/ai/sanitize-prd";
import { suggestTitleFromMarkdown } from "@/lib/markdown";
import type { ApiTemplate } from "@/lib/generate-types";
import { isPresetTemplateStructure } from "@/lib/preset-templates";
import {
  addSection,
  defaultStructure,
  EXPORT_FILE_TYPE,
  isLockedSection,
  normalizeTemplateSections,
  removeSection,
  updateSectionTitle,
  type TemplateSectionItem,
} from "@/lib/template-types";
import {
  fetchActiveInquirySession,
  linkInquirySessionDocument,
} from "@/lib/inquiry/session-sync-client";
import {
  clearInquiryClearedFlag,
  clearInquirySession,
  loadInquirySession,
  saveInquirySession,
  wasInquiryExplicitlyCleared,
} from "@/lib/inquiry/session-storage";
import type { InquiryGeneratePayload } from "@/lib/inquiry/types";
import { cn } from "@/lib/utils";

type GenerateViewProps = {
  initialTemplates: ApiTemplate[];
  /** 进入页面时默认套用的板块（优先全栈预置模板） */
  defaultTemplateSections?: TemplateSectionItem[];
};

function resolveInitialSections(
  defaultTemplateSections?: TemplateSectionItem[],
): TemplateSectionItem[] {
  if (defaultTemplateSections?.length) {
    return normalizeTemplateSections(
      defaultTemplateSections.map((s) => ({ ...s })),
    );
  }
  return defaultStructure().sections;
}

function resetGenerateFormState(
  setIdea: (v: string) => void,
  setSections: (v: TemplateSectionItem[]) => void,
  setPreview: (v: string) => void,
  setPreviewDirty: (v: boolean) => void,
  setStreamMode: (v: "idle" | "demo" | "live") => void,
  setError: (v: string | null) => void,
  previewLockedRef: MutableRefObject<boolean>,
  defaultTemplateSections?: TemplateSectionItem[],
) {
  setIdea("");
  setSections(resolveInitialSections(defaultTemplateSections));
  setPreview("");
  setPreviewDirty(false);
  setStreamMode("idle");
  setError(null);
  previewLockedRef.current = false;
}

export function GenerateView({
  initialTemplates,
  defaultTemplateSections,
}: GenerateViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idea, setIdea] = useState("");
  const [sections, setSections] = useState<TemplateSectionItem[]>(() =>
    resolveInitialSections(defaultTemplateSections),
  );
  const [preview, setPreview] = useState("");
  const [previewDirty, setPreviewDirty] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamMode, setStreamMode] = useState<"idle" | "demo" | "live">(
    "idle",
  );
  const [generatingBlockTitle, setGeneratingBlockTitle] = useState<
    string | null
  >(null);
  const [configOpen, setConfigOpen] = useState(false);
  const {
    settings: aiSettings,
    configured: aiConfigured,
    hydrated: aiHydrated,
    activeProvider,
  } = useAiProviders();
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ApiTemplate[]>(initialTemplates);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquirySessionId, setInquirySessionId] = useState<string | null>(null);
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const previewLockedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("fresh") === "1") {
      clearInquirySession();
      clearInquiryClearedFlag();
      try {
        localStorage.removeItem("xuqiu-generate-preview");
      } catch {
        /* ignore */
      }
      resetGenerateFormState(
        setIdea,
        setSections,
        setPreview,
        setPreviewDirty,
        setStreamMode,
        setError,
        previewLockedRef,
        defaultTemplateSections,
      );
      router.replace("/generate");
      return;
    }

    if (wasInquiryExplicitlyCleared()) return;

    void (async () => {
      const local = loadInquirySession();
      const remote = await fetchActiveInquirySession();
      let saved = local;
      if (remote && local) {
        const remoteTs = new Date(
          remote.serverUpdatedAt ?? remote.session.updatedAt,
        ).getTime();
        const localTs = new Date(local.session.updatedAt).getTime();
        saved = remoteTs >= localTs ? remote : local;
        if (remoteTs > localTs) saveInquirySession(remote);
      } else if (remote) {
        saved = remote;
        saveInquirySession(remote);
      }
      if (!saved) return;

      setIdea(saved.session.idea);
      setSections(saved.session.sections.map((s) => ({ ...s })));
      setInquirySessionId(saved.session.sessionId);
      if (saved.inquiryOpen !== false) {
        setInquiryOpen(true);
      }
    })();
  }, [searchParams, router]);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/templates");
    if (!res.ok) return;
    const data = (await res.json()) as { templates: ApiTemplate[] };
    setTemplates(data.templates ?? []);
  }, []);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id || isLockedSection(s)) return s;
        return { ...s, enabled: !s.enabled };
      }),
    );
  };

  const handleAddSection = (title: string) => {
    setSections((prev) => addSection(prev, title));
  };

  const handleRemoveSection = (id: string) => {
    setSections((prev) => removeSection(prev, id));
  };

  const handleRenameSection = (id: string, title: string) => {
    setSections((prev) => updateSectionTitle(prev, id, title));
  };

  const enabledCount = useMemo(
    () => sections.filter((s) => s.enabled).length,
    [sections],
  );

  const canGenerate = Boolean(idea.trim() && enabledCount > 0);

  const startInquiry = () => {
    if (!canGenerate) return;
    clearInquiryClearedFlag();
    setError(null);
    setConfigOpen(false);
    setInquiryOpen(true);
  };

  const handleInquiryCleared = () => {
    setInquiryOpen(false);
  };

  const handleInquiryComplete = (payload: InquiryGeneratePayload) => {
    setInquirySessionId(payload.inquirySessionId ?? null);
    clearInquirySession();
    void runGenerate(payload);
  };

  const runGenerate = async (inquiryPayload?: InquiryGeneratePayload) => {
    const ideaForGen = (inquiryPayload?.idea ?? idea).trim();
    if (!ideaForGen || enabledCount === 0) return;

    setError(null);
    setPreview("");
    setPreviewDirty(false);
    previewLockedRef.current = false;
    setStreamMode("idle");
    setGeneratingBlockTitle(null);
    setStreaming(true);
    setConfigOpen(false);
    setInquiryOpen(false);

    const aiPayload =
      aiHydrated && isAiSettingsConfigured(aiSettings)
        ? aiSettings
        : undefined;

    try {
      const { markdown: finalText, mode } = await runBlockedGenerate({
        idea: ideaForGen,
        sections,
        inquiryPayload,
        providerId: activeProvider?.id,
        ai: aiPayload,
        onSkeleton: (markdown) => {
          if (!previewLockedRef.current) {
            setPreview(sanitizePrdMarkdown(markdown));
          }
        },
        onBlockStart: (_sectionId, title) => {
          setGeneratingBlockTitle(title);
        },
        onBlockChunk: (_sectionId, assembled) => {
          if (!previewLockedRef.current) {
            setPreview(sanitizePrdMarkdown(assembled));
          }
        },
        onBlockDone: () => {},
        onMode: (m) => setStreamMode(m),
      });

      setStreamMode(mode);

      if (!previewLockedRef.current) {
        setPreview(sanitizePrdMarkdown(finalText));
      }

      if (mode === "live" && !finalText.trim() && !previewLockedRef.current) {
        setError(
          "模型未返回内容，请检查 API 配置与模型名称（如 deepseek-v4-flash）",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setStreaming(false);
      setGeneratingBlockTitle(null);
    }
  };

  const applyTemplate = (t: ApiTemplate) => {
    setSections(
      normalizeTemplateSections(t.structure.sections.map((s) => ({ ...s }))),
    );
  };

  const saveTemplate = async () => {
    const name = saveName.trim();
    if (!name) {
      setError("请填写模板名称");
      return;
    }
    setError(null);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        structure: { sections },
        fileType: EXPORT_FILE_TYPE,
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "保存失败");
      return;
    }
    setSaveName("");
    setShowSave(false);
    await loadTemplates();
  };

  const removeTemplate = async (id: string) => {
    const target = templates.find((t) => t.id === id);
    if (target && isPresetTemplateStructure(target.structure)) {
      setError("系统预置模板不可删除");
      return;
    }
    if (!confirm("确定删除该模板？")) return;
    setError(null);
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "删除失败");
      return;
    }
    await loadTemplates();
  };

  const renameTemplate = async (id: string, currentName: string) => {
    const name = window.prompt("新的模板名称", currentName)?.trim();
    if (!name || name === currentName) return;
    setError(null);
    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "重命名失败");
      return;
    }
    await loadTemplates();
  };

  const saveToWorkspace = async () => {
    if (!preview.trim()) return;
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestTitleFromMarkdown(preview),
          content: preview,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "归档失败");
        return;
      }
      const data = (await res.json()) as { document: { id: string } };
      if (inquirySessionId) {
        void linkInquirySessionDocument(inquirySessionId, data.document.id);
      }
      router.push(`/editor/${data.document.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "归档失败");
    } finally {
      setArchiving(false);
    }
  };

  const downloadMd = () => {
    if (!preview.trim()) return;
    const blob = new Blob([preview], {
      type: "text/markdown;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "需求文档.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handlePreviewChange = (value: string) => {
    setPreview(value);
    setPreviewDirty(true);
    previewLockedRef.current = true;
  };

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <header className="bg-background flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <BackToHome className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              智能生成
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              预览区全屏编辑 · 配置从右侧拉出
              {streamMode !== "idle" || generatingBlockTitle ? (
                <span className="ml-2">
                  ·{" "}
                  {generatingBlockTitle
                    ? `正在生成：${generatingBlockTitle}`
                    : streamMode === "live"
                      ? `大模型${activeProvider ? ` · ${activeProvider.name}` : ""}`
                      : streamMode === "demo"
                        ? "演示模式"
                        : null}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GenerateConfigDrawer
            open={configOpen}
            onOpenChange={setConfigOpen}
            idea={idea}
            onIdeaChange={setIdea}
            sections={sections}
            onToggleSection={toggleSection}
            onAddSection={handleAddSection}
            onRemoveSection={handleRemoveSection}
            onRenameSection={handleRenameSection}
            enabledCount={enabledCount}
            templates={templates}
            showSave={showSave}
            onShowSaveChange={setShowSave}
            saveName={saveName}
            onSaveNameChange={setSaveName}
            onSaveTemplate={() => void saveTemplate()}
            onApplyTemplate={applyTemplate}
            onRenameTemplate={(id, name) => void renameTemplate(id, name)}
            onRemoveTemplate={(id) => void removeTemplate(id)}
            streaming={streaming}
            onGenerate={startInquiry}
            canGenerate={canGenerate}
          />
          <Button
            type="button"
            disabled={!canGenerate || streaming || inquiryOpen}
            onClick={startInquiry}
            className="hidden sm:inline-flex"
          >
            {streaming ? "生成中…" : "开始询问"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!preview.trim() || archiving}
            onClick={() => void saveToWorkspace()}
          >
            {archiving ? "归档中…" : "保存到工作台"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!preview.trim()}
            onClick={downloadMd}
          >
            下载 .md
          </Button>
        </div>
      </header>

      {error ? (
        <p
          className="text-destructive shrink-0 border-b border-border bg-destructive/5 px-4 py-2 text-sm sm:px-6"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
        <div className="bg-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border shadow-sm">
          <div className="text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs">
            <span className="font-medium text-foreground">文档预览</span>
            <span className="flex items-center gap-2">
              {previewDirty ? (
                <span>未保存的修改 · 请归档到工作台</span>
              ) : preview.trim() ? (
                <span>划词可选用 AI 助手</span>
              ) : (
                <span>填写创意后开始询问</span>
              )}
            </span>
          </div>
          <textarea
            ref={previewRef}
            value={preview}
            onChange={(e) => handlePreviewChange(e.target.value)}
            readOnly={streaming && !previewDirty}
            placeholder={
              streaming
                ? generatingBlockTitle
                  ? `正在写入「${generatingBlockTitle}」…`
                  : "正在加载文档骨架（标题由模板固定）…"
                : "点击「生成配置」填写创意与板块，开始询问收集需求。确认后生成 PRD，生成后可划词辅助编辑。"
            }
            className={cn(
              "min-h-0 flex-1 w-full resize-none border-0 bg-transparent px-4 py-4 font-mono text-sm leading-relaxed outline-none sm:px-6 sm:text-[15px] sm:leading-7",
              "focus-visible:ring-0",
              streaming && !previewDirty && "cursor-wait opacity-90",
            )}
            spellCheck={false}
          />
          <SelectionAiAssistant
            textareaRef={previewRef}
            value={preview}
            onApply={handlePreviewChange}
            disabled={streaming && !previewDirty}
            aiSettings={aiSettings}
            configured={aiConfigured}
            providerId={activeProvider?.id ?? null}
            providerName={activeProvider?.name ?? null}
          />
        </div>
      </main>

      <InquiryFlowView
        open={inquiryOpen}
        idea={idea}
        sections={sections}
        onClose={() => setInquiryOpen(false)}
        onCleared={handleInquiryCleared}
        onCompleteGenerate={handleInquiryComplete}
        generating={streaming}
        aiSettings={aiSettings}
        aiConfigured={aiConfigured}
        providerId={activeProvider?.id ?? null}
      />
    </div>
  );
}
