import type { InquiryNotebook } from "@/lib/inquiry/types";

/** 笔记板内容指纹，用于预生成下一题缓存校验 */
export function hashNotebook(notebook: InquiryNotebook): string {
  const payload = notebook.entries
    .map((e) => {
      if (e.format === "structured" && e.items?.length) {
        return `${e.sectionId}:${JSON.stringify(e.items)}`;
      }
      return `${e.sectionId}:${e.content.trim()}`;
    })
    .join("|");
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0;
  }
  return `nb-${(h >>> 0).toString(36)}`;
}
