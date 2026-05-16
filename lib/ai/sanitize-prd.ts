/** 裁剪模型偶发的元话术，保证预览从第一个 ## 板块标题开始 */
export function sanitizePrdMarkdown(raw: string): string {
  const text = raw.trim();
  if (!text || text.startsWith("【生成失败】")) return raw;

  const h2Index = text.search(/^##\s+/m);
  if (h2Index > 0) {
    return text.slice(h2Index).trimStart();
  }

  return raw;
}
