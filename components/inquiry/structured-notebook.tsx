"use client";

import { memo } from "react";

import { NotebookEntryField } from "@/components/inquiry/notebook-entry-field";
import type { InquiryNotebook, NotebookEntry } from "@/lib/inquiry/types";
import { cn } from "@/lib/utils";

type StructuredNotebookProps = {
  notebook: InquiryNotebook;
  activeSectionId?: string | null;
  onEntryChange: (
    sectionId: string,
    content: string,
    markUserEdit: boolean,
  ) => void;
  disabled?: boolean;
  className?: string;
};

function formatSources(entry: NotebookEntry): string | null {
  const refs = entry.sources
    .map((s) =>
      s.ref ? `[${s.ref}]` : s.type === "user_edit" ? "[用户编辑]" : null,
    )
    .filter(Boolean);
  const unique = [...new Set(refs)];
  return unique.length > 0 ? unique.join(" ") : null;
}

const NotebookEntryRow = memo(function NotebookEntryRow({
  entry,
  isActive,
  disabled,
  onEntryChange,
}: {
  entry: NotebookEntry;
  isActive: boolean;
  disabled: boolean;
  onEntryChange: StructuredNotebookProps["onEntryChange"];
}) {
  const sources = formatSources(entry);

  return (
    <li
      className={cn(
        "rounded-lg border bg-background p-3 transition-colors",
        isActive
          ? "border-primary/50 ring-1 ring-primary/20"
          : "border-border",
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{entry.sectionTitle}</h3>
        {sources ? (
          <p className="text-muted-foreground mt-0.5 text-[11px]">{sources}</p>
        ) : null}
        {!entry.content.trim() ? (
          <span className="text-muted-foreground mt-1 inline-block text-[11px]">
            待补充
          </span>
        ) : null}
      </div>
      <NotebookEntryField
        sectionId={entry.sectionId}
        value={entry.content}
        disabled={disabled}
        onCommit={onEntryChange}
      />
    </li>
  );
});

export function StructuredNotebook({
  notebook,
  activeSectionId,
  onEntryChange,
  disabled = false,
  className,
}: StructuredNotebookProps) {
  return (
    <aside
      className={cn(
        "bg-muted/30 flex h-full flex-col border-l border-border",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">需求笔记板</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          随回答自动更新 · 可直接编辑 · 自动保存
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-3">
          {notebook.entries.map((entry) => (
            <NotebookEntryRow
              key={entry.sectionId}
              entry={entry}
              isActive={entry.sectionId === activeSectionId}
              disabled={disabled}
              onEntryChange={onEntryChange}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}
