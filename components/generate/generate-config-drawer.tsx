"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { DrawerSection } from "@/components/generate/drawer-section";
import { SectionEditor } from "@/components/generate/section-editor";
import { AiSettingsPanel } from "@/components/shared/ai-settings-panel";
import { Button } from "@/components/ui/button";
import type { ApiTemplate } from "@/lib/generate-types";
import { drawerContentDelay } from "@/lib/motion-presets";
import type { TemplateSectionItem } from "@/lib/template-types";
import { cn } from "@/lib/utils";

type GenerateConfigDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: string;
  onIdeaChange: (v: string) => void;
  sections: TemplateSectionItem[];
  onToggleSection: (id: string) => void;
  onAddSection: (title: string) => void;
  onRemoveSection: (id: string) => void;
  onRenameSection: (id: string, title: string) => void;
  enabledCount: number;
  templates: ApiTemplate[];
  showSave: boolean;
  onShowSaveChange: (v: boolean) => void;
  saveName: string;
  onSaveNameChange: (v: string) => void;
  onSaveTemplate: () => void;
  onApplyTemplate: (t: ApiTemplate) => void;
  onRenameTemplate: (id: string, name: string) => void;
  onRemoveTemplate: (id: string) => void;
  streaming: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
};

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [locked]);
}

export function GenerateConfigDrawer({
  open,
  onOpenChange,
  idea,
  onIdeaChange,
  sections,
  onToggleSection,
  onAddSection,
  onRemoveSection,
  onRenameSection,
  enabledCount,
  templates,
  showSave,
  onShowSaveChange,
  saveName,
  onSaveNameChange,
  onSaveTemplate,
  onApplyTemplate,
  onRenameTemplate,
  onRemoveTemplate,
  streaming,
  onGenerate,
  canGenerate,
}: GenerateConfigDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useBodyScrollLock(open);

  const drawerLayer = mounted ? (
    <div
      className="generate-drawer-root fixed inset-0 z-50 flex justify-end"
      data-open={open ? "true" : "false"}
      aria-hidden={!open}
      {...(!open ? { inert: true } : {})}
    >
      <button
        type="button"
        aria-label="关闭配置面板"
        tabIndex={open ? 0 : -1}
        className="generate-drawer-backdrop absolute inset-0 bg-black/30"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "generate-drawer-panel bg-card relative z-10 flex h-dvh max-h-dvh w-[min(100vw,400px)] flex-col border-l border-border shadow-xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="generate-drawer-content flex shrink-0 items-center justify-between border-b border-border px-4 py-3"
          style={{ animationDelay: drawerContentDelay(0) }}
        >
          <h2 className="text-sm font-semibold">生成配置</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={open ? 0 : -1}
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <DrawerSection index={1}>
            <AiSettingsPanel variant="picker" className="border-0 p-0 shadow-none" />
          </DrawerSection>

          <DrawerSection index={2} className="mt-5">
            <label className="text-sm font-medium" htmlFor="drawer-idea">
              项目创意
            </label>
            <textarea
              id="drawer-idea"
              rows={4}
              tabIndex={open ? 0 : -1}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring mt-2 flex min-h-[100px] w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2"
              placeholder="例如：做一个帮独立开发者从想法生成 PRD 的 Web 应用…"
              value={idea}
              onChange={(e) => onIdeaChange(e.target.value)}
            />
          </DrawerSection>

          <DrawerSection index={3} className="mt-5">
            <SectionEditor
              sections={sections}
              onToggle={onToggleSection}
              onAdd={onAddSection}
              onRemove={onRemoveSection}
              onRename={onRenameSection}
              enabledCount={enabledCount}
            />
          </DrawerSection>

          <DrawerSection index={4} className="mt-5">
            <Button
              type="button"
              className="w-full"
              disabled={!canGenerate || streaming}
              tabIndex={open ? 0 : -1}
              onClick={onGenerate}
            >
              {streaming ? "生成中…" : "开始生成"}
            </Button>
          </DrawerSection>

          <DrawerSection index={5} className="mt-5 border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold">我的模板</h3>
            {templates.length === 0 ? (
              <p className="text-muted-foreground text-xs">暂无模板</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto overscroll-contain">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="bg-muted/40 rounded-lg border border-border/80 p-2.5"
                  >
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        tabIndex={open ? 0 : -1}
                        onClick={() => onRenameTemplate(t.id, t.name)}
                      >
                        改名
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        tabIndex={open ? 0 : -1}
                        onClick={() => onApplyTemplate(t)}
                      >
                        应用
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="text-destructive"
                        tabIndex={open ? 0 : -1}
                        onClick={() => onRemoveTemplate(t.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {showSave ? (
              <div className="mt-3 space-y-2">
                <input
                  tabIndex={open ? 0 : -1}
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
                  value={saveName}
                  onChange={(e) => onSaveNameChange(e.target.value)}
                  placeholder="模板名称"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    tabIndex={open ? 0 : -1}
                    onClick={onSaveTemplate}
                  >
                    保存
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    tabIndex={open ? 0 : -1}
                    onClick={() => onShowSaveChange(false)}
                  >
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                tabIndex={open ? 0 : -1}
                onClick={() => onShowSaveChange(true)}
              >
                保存当前板块为模板
              </Button>
            )}
          </DrawerSection>
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        {open ? (
          <PanelRightClose className="size-4" aria-hidden />
        ) : (
          <PanelRightOpen className="size-4" aria-hidden />
        )}
        {open ? "收起配置" : "生成配置"}
      </Button>

      {drawerLayer ? createPortal(drawerLayer, document.body) : null}
    </>
  );
}
