"use client";

import { Plus, Trash2 } from "lucide-react";
import { memo, useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  getSectionFieldLabels,
  isStructuredSectionId,
  parseSectionItems,
  type NotebookSectionItem,
  type StructuredSectionId,
} from "@/lib/inquiry/notebook-schema";
import { cn } from "@/lib/utils";

type NotebookStructuredFieldProps = {
  sectionId: string;
  items: Record<string, unknown>[] | undefined;
  disabled?: boolean;
  onChange: (sectionId: string, items: NotebookSectionItem[]) => void;
};

function emptyItem(sectionId: StructuredSectionId): Record<string, string> {
  switch (sectionId) {
    case "core_constraints":
      return { constraint: "", scope: "" };
    case "data_models":
      return { entity: "", fields: "" };
    case "state_transitions":
      return { from: "", event: "", to: "" };
    case "edge_cases":
      return { scenario: "", action: "" };
    case "milestones":
      return { phase: "", scope: "", acceptance: "" };
    default:
      return {};
  }
}

export const NotebookStructuredField = memo(function NotebookStructuredField({
  sectionId,
  items,
  disabled = false,
  onChange,
}: NotebookStructuredFieldProps) {
  const structuredId = isStructuredSectionId(sectionId) ? sectionId : null;
  const parsed = structuredId
    ? parseSectionItems(structuredId, items ?? [])
    : [];
  const fields = structuredId ? getSectionFieldLabels(structuredId) : [];

  const emit = useCallback(
    (next: Record<string, unknown>[]) => {
      if (!structuredId) return;
      const valid = parseSectionItems(structuredId, next);
      onChange(sectionId, valid);
    },
    [onChange, sectionId, structuredId],
  );

  if (!structuredId) return null;

  const updateItem = (index: number, key: string, value: string) => {
    const raw = [...(items ?? [])];
    const row = { ...(raw[index] ?? emptyItem(structuredId)), [key]: value };
    raw[index] = row;
    emit(raw);
  };

  const addItem = () => {
    emit([...(items ?? []), emptyItem(structuredId)]);
  };

  const removeItem = (index: number) => {
    emit((items ?? []).filter((_, i) => i !== index));
  };

  return (
    <div className="mt-2 space-y-2">
      {parsed.length === 0 ? (
        <p className="text-muted-foreground text-[11px]">
          回答后将自动拆成条目；也可手动添加
        </p>
      ) : null}
      {parsed.map((item, index) => (
        <div
          key={`${sectionId}-${index}`}
          className="bg-background space-y-1.5 rounded-md border border-border/80 p-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-[10px] font-medium">
              条目 {index + 1}
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-destructive h-6 px-1"
              disabled={disabled}
              onClick={() => removeItem(index)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-muted-foreground mb-0.5 block text-[10px]">
                {f.label}
              </span>
              <input
                className={cn(
                  "border-input bg-background w-full rounded border px-2 py-1 text-xs outline-none focus-visible:ring-2",
                  disabled && "cursor-not-allowed opacity-60",
                )}
                disabled={disabled}
                value={String((item as Record<string, unknown>)[f.key] ?? "")}
                onChange={(e) => updateItem(index, f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      ))}
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="w-full"
        disabled={disabled}
        onClick={addItem}
      >
        <Plus className="size-3" />
        添加条目
      </Button>
    </div>
  );
});
