"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  isCustomSectionId,
  isLockedSection,
  type TemplateSectionItem,
} from "@/lib/template-types";
import { cn } from "@/lib/utils";

type SectionEditorProps = {
  sections: TemplateSectionItem[];
  onToggle: (id: string) => void;
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
  enabledCount: number;
};

export function SectionEditor({
  sections,
  onToggle,
  onAdd,
  onRemove,
  onRename,
  enabledCount,
}: SectionEditorProps) {
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    onAdd(t);
    setNewTitle("");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">文档板块</p>
      <ul className="space-y-2">
        {sections.map((s) => {
          const locked = isLockedSection(s);
          return (
          <li
            key={s.id}
            className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-lg border border-border/80 p-2"
          >
            <button
              type="button"
              onClick={() => !locked && onToggle(s.id)}
              disabled={locked}
              title={locked ? "预置模板强制板块，不可关闭" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                s.enabled
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
                locked && "cursor-not-allowed opacity-80",
              )}
            >
              {locked ? "锁定" : s.enabled ? "开" : "关"}
            </button>
            {isCustomSectionId(s.id) ? (
              <input
                className="border-input bg-background min-w-0 flex-1 rounded border px-2 py-1 text-xs outline-none focus-visible:ring-2"
                value={s.title}
                onChange={(e) => onRename(s.id, e.target.value)}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {s.title}
              </span>
            )}
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-destructive shrink-0"
              disabled={sections.length <= 1 || locked}
              onClick={() => onRemove(s.id)}
              title={locked ? "预置模板强制板块，不可删除" : "删除板块"}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        );
        })}
      </ul>
      <div className="flex gap-2">
        <input
          className="border-input bg-background placeholder:text-muted-foreground flex h-8 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none focus-visible:ring-2"
          placeholder="新板块名称，如：里程碑"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="size-3.5" />
          添加
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">已启用 {enabledCount} 个板块</p>
    </div>
  );
}
