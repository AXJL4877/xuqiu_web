import { marked } from "marked";
import TurndownService from "turndown";

marked.setOptions({ gfm: true, breaks: true });

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.addRule("strikethrough", {
  filter: ["del", "s"],
  replacement: (content) => `~~${content}~~`,
});

export function markdownToHtml(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "<p></p>";
  const html = marked.parse(trimmed, { async: false });
  return typeof html === "string" ? html : "<p></p>";
}

export function htmlToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p></p>" || trimmed === "<p><br></p>") {
    return "";
  }
  return turndown.turndown(trimmed).trim();
}

/** 从 Markdown 正文推断标题（用于自动归档） */
export function suggestTitleFromMarkdown(markdown: string): string {
  const text = markdown.trim();
  if (!text) return "未命名需求文档";

  const h2 = text.match(/^##\s+(.+)$/m);
  if (h2?.[1]) return h2[1].trim().slice(0, 100);

  const h1 = text.match(/^#\s+(.+)$/m);
  if (h1?.[1]) return h1[1].trim().slice(0, 100);

  const line = text.split("\n").find((l) => l.trim());
  if (line) {
    const plain = line.replace(/^#+\s*/, "").trim();
    if (plain) return plain.slice(0, 80);
  }

  return "未命名需求文档";
}
