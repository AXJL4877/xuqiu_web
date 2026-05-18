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
import { sanitizePrdMarkdown } from "@/lib/ai/sanitize-prd";
import { suggestTitleFromMarkdown } from "@/lib/markdown";
import type { ApiTemplate } from "@/lib/generate-types";
import {
  addSection,
  defaultStructure,
  EXPORT_FILE_TYPE,
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
};

function resetGenerateFormState(
  setIdea: (v: string) => void,
  setSections: (v: TemplateSectionItem[]) => void,
  setPreview: (v: string) => void,
  setPreviewDirty: (v: boolean) => void,
  setStreamMode: (v: "idle" | "demo" | "live") => void,
  setError: (v: string | null) => void,
  previewLockedRef: MutableRefObject<boolean>,
) {
  setIdea("");
  setSections(defaultStructure().sections);
  setPreview("");
  setPreviewDirty(false);
  setStreamMode("idle");
  setError(null);
  previewLockedRef.current = false;
}

export function GenerateView({ initialTemplates }: GenerateViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idea, setIdea] = useState("");
  const [sections, setSections] = useState<TemplateSectionItem[]>(() =>
    defaultStructure().sections,
  );
  const [preview, setPreview] = useState("");
  const [previewDirty, setPreviewDirty] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamMode, setStreamMode] = useState<"idle" | "demo" | "live">(
    "idle",
  );
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
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
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
    setStreaming(true);
    setConfigOpen(false);
    setInquiryOpen(false);

    try {
      const body: {
        idea: string;
        sections: TemplateSectionItem[];
        inquirySessionId?: string;
        notebook?: InquiryGeneratePayload["notebook"];
        acceptedAssumptions?: InquiryGeneratePayload["acceptedAssumptions"];
        gaps?: InquiryGeneratePayload["gaps"];
        completionStrategy?: InquiryGeneratePayload["completionStrategy"];
        ai?: typeof aiSettings;
      } = { idea: ideaForGen, sections };
      if (inquiryPayload) {
        body.notebook = inquiryPayload.notebook;
        body.acceptedAssumptions = inquiryPayload.acceptedAssumptions;
        body.gaps = inquiryPayload.gaps;
        body.completionStrategy = inquiryPayload.completionStrategy;
        if (inquiryPayload.inquirySessionId) {
          body.inquirySessionId = inquiryPayload.inquirySessionId;
        }
      }
      if (aiHydrated && isAiSettingsConfigured(aiSettings)) {
        body.ai = aiSettings;
      }

      const res = await fetch("/api/ai/generate", {
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
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        if (!previewLockedRef.current) {
          setPreview(sanitizePrdMarkdown(buf));
        }
      }

      const finalText = sanitizePrdMarkdown(buf);
      if (!previewLockedRef.current) setPreview(finalText);

      if (mode === "live" && !finalText.trim() && !previewLockedRef.current) {
        setError(
          "模型未返回内容，请检查 API 配置与模型名称（如 deepseek-v4-flash）",
        );
      } else if (finalText.startsWith("【生成失败】")) {
        setError(
          finalText.replace(/^【生成失败】/, "").split("\n")[0] ?? "生成失败",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setStreaming(false);
    }
  };

  const applyTemplate = (t: ApiTemplate) => {
    setSections(t.structure.sections.map((s) => ({ ...s })));
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
    if (!confirm("确定删除该模板？")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
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
              {streamMode !== "idle" ? (
                <span className="ml-2">
                  ·{" "}
                  {streamMode === "live"
                    ? `大模型${activeProvider ? ` · ${activeProvider.name}` : ""}`
                    : "演示模式"}
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
                ? "正在生成 PRD 正文，内容将实时显示…"
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
