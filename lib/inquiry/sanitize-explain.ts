const META_LINE =
  /^(我们|用户|选中|需要|所以|请解释|只解释|【选中|【全文|待改写|项目创意|规则[：:]|输出必须从|禁止输出|在本题语境)/;

/** 去掉模型复述指令、思考过程等元话术 */
export function sanitizeInquiryExplainOutput(
  raw: string,
  term: string,
  streaming = false,
): string {
  let text = raw.trim();
  if (!text || text.startsWith("【解释失败】")) return text;

  if (streaming) {
    const head = text.slice(0, 280);
    const anchor = term ? text.indexOf(`**${term.trim()}**`) : -1;
    if (
      anchor === -1 &&
      /我们被问到|选中内容是|请解释下面|需要符合|所以直接|我们需解释/.test(
        head,
      )
    ) {
      return "";
    }
  }

  const lines = text.split("\n");
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (META_LINE.test(t)) return false;
    if (t.includes("请解释下面选中内容")) return false;
    if (term && t === term.trim()) return false;
    return true;
  });

  text = filtered.join("\n").trim();

  if (term) {
    const idx = text.indexOf(`**${term.trim()}**`);
    if (idx > 80) text = text.slice(idx).trim();
  }

  return text.trim();
}
