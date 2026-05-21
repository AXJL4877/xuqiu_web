/** 将常见序号列表转为 `-` 无序列表 */
export function normalizeListMarkers(line: string): string {
  if (!/^\s*(\d+|[一二三四五六七八九十]+)/.test(line)) return line;
  return line
    .replace(/^(\s*)\d+[.)．]\s+/, "$1- ")
    .replace(/^(\s*)\d+、\s*/, "$1- ")
    .replace(/^(\s*)\(\d+\)\s+/, "$1- ")
    .replace(/^(\s*)（\d+）\s*/, "$1- ")
    .replace(/^(\s*)[一二三四五六七八九十]+[、.)．]\s*/, "$1- ");
}

/** 裁剪元话术，并规范化标题起点与列表格式 */
export function sanitizePrdMarkdown(raw: string): string {
  const text = raw.trim();
  if (!text || text.startsWith("【生成失败】")) return raw;

  const startIndex = text.search(/^#{1,2}\s+/m);
  let body = startIndex > 0 ? text.slice(startIndex).trimStart() : text;

  body = body
    .split("\n")
    .map((line) => normalizeListMarkers(line))
    .join("\n");

  return body;
}
