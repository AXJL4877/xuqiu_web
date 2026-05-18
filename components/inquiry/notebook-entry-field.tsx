"use client";

import { memo, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type NotebookEntryFieldProps = {
  sectionId: string;
  value: string;
  disabled?: boolean;
  onCommit: (sectionId: string, content: string, markUserEdit: boolean) => void;
};

export const NotebookEntryField = memo(function NotebookEntryField({
  sectionId,
  value,
  disabled = false,
  onCommit,
}: NotebookEntryFieldProps) {
  const [local, setLocal] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef(sectionId);

  useEffect(() => {
    if (sectionRef.current !== sectionId) {
      sectionRef.current = sectionId;
      setLocal(value);
      return;
    }
    if (value !== local) {
      setLocal(value);
    }
    // 仅在外部 value 变化时同步（如 API 回写），不依赖 local
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const scheduleCommit = (next: string, markUserEdit: boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onCommit(sectionId, next, markUserEdit);
    }, 500);
  };

  const flush = (markUserEdit: boolean) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onCommit(sectionId, local, markUserEdit);
  };

  return (
    <textarea
      value={local}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        setLocal(next);
        scheduleCommit(next, false);
      }}
      onBlur={() => flush(true)}
      placeholder="回答后将自动记录，也可手动补充…"
      rows={4}
      className={cn(
        "border-input bg-background mt-2 w-full resize-y rounded-md border px-2.5 py-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2",
        disabled && "cursor-not-allowed opacity-60",
      )}
      spellCheck={false}
    />
  );
});
