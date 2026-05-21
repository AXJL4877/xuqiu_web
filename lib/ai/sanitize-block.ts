import { normalizeListMarkers } from "@/lib/ai/sanitize-prd";
import {
  filterMetaLines,
  findContentStartIndex,
  shouldHideStreamingBuffer,
  stripThinkingTags,
} from "@/lib/ai/strip-model-meta";

/** 剥离思考过程、元话术与擅自输出的章节标题，只保留板块正文 */
export function sanitizeBlockMarkdown(
  raw: string,
  sectionTitle: string,
  streaming = false,
): string {
  let body = stripThinkingTags(raw).trim();
  if (!body || body.startsWith("【生成失败】")) return raw;

  if (streaming && shouldHideStreamingBuffer(body)) {
    return "";
  }

  body = filterMetaLines(body);

  const lines = body.split("\n");
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (t === `## ${sectionTitle}` || t === `## ${sectionTitle.trim()}`) {
      return false;
    }
    return true;
  });

  body = filtered
    .map((line) => normalizeListMarkers(line))
    .join("\n")
    .trim();

  const start = findContentStartIndex(body);
  if (start > 0) body = body.slice(start).trimStart();

  if (streaming && shouldHideStreamingBuffer(body)) {
    return "";
  }

  return body;
}
