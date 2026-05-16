"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type TiptapEditorProps = {
  className?: string;
  initialMarkdown?: string;
  editable?: boolean;
  onMarkdownChange?: (markdown: string) => void;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
};

export function TiptapEditor({
  className,
  initialMarkdown = "",
  editable = true,
  onMarkdownChange,
  onEditorReady,
}: TiptapEditorProps) {
  const onChangeRef = useRef(onMarkdownChange);
  onChangeRef.current = onMarkdownChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "在此编写需求文档…支持 **加粗**、## 标题、列表等 Markdown 快捷键",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline underline-offset-2" },
      }),
      Underline,
    ],
    content: markdownToHtml(initialMarkdown),
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-[min(60vh,640px)] px-4 py-4 text-sm leading-relaxed outline-none",
          "[&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold",
          "[&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-medium",
          "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2",
          className,
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current?.(htmlToMarkdown(ed.getHTML()));
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-auto" />
    </div>
  );
}
