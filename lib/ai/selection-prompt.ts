export const SELECTION_ACTIONS = [
  {
    id: "professional",
    label: "专业化",
    instruction: "改为产品/技术文档的专业表述，术语准确、语气客观简洁。",
  },
  {
    id: "expand",
    label: "扩写",
    instruction: "在保持主题的前提下补充必要细节与可执行描述，适度加长。",
  },
  {
    id: "shorten",
    label: "缩写",
    instruction: "删繁就简，保留核心信息，使文字更精炼。",
  },
] as const;

export type SelectionActionId =
  | (typeof SELECTION_ACTIONS)[number]["id"]
  | "ask"
  | "custom";

export function isSelectionAskAction(
  action: SelectionActionId,
): action is "ask" {
  return action === "ask";
}

export function buildSelectionSystemPrompt(action: SelectionActionId): string {
  if (isSelectionAskAction(action)) {
    return `你是术语词典。用户划选一个名词/术语，你只输出该术语的释义。
硬性要求：
1. 第一行起就是释义正文（可用 **术语** 作标题），禁止任何铺垫、思考、复述题目或规则。
2. 禁止出现：我们被问到、选中内容是、需要符合、所以直接解释、请解释下面 等字样。
3. 用简洁中文，分条用「- 」；不写修改建议、不改写文档。`;
  }

  return `你是 PRD 正文改写器。用户选中一段 Markdown，你只输出改写结果。
硬性要求：
1. 第一行起就是改写后的选中文本，禁止思考过程、禁止「修改如下」、禁止复述用户指令。
2. 保留 Markdown 格式，不要输出 HTML。
3. 禁止出现：我们被问到、选中内容是、待改写的选中文本 等元描述。`;
}

export function buildSelectionUserPrompt(
  text: string,
  action: SelectionActionId,
  options?: { customPrompt?: string; context?: string; question?: string },
): string {
  const contextBlock = options?.context?.trim()
    ? `\n\n【全文上下文（仅供参考，勿整段复述）】\n${options.context.slice(0, 8000)}`
    : "";

  if (isSelectionAskAction(action)) {
    const term = text.trim();
    return `术语：${term}

请解释该术语（定义、常见含义、在软件/产品需求文档中的含义）。${contextBlock ? "\n（附：可参考全文上下文，勿复述上下文原文）" : ""}`;
  }

  const actionMeta =
    action === "custom"
      ? null
      : SELECTION_ACTIONS.find((a) => a.id === action);

  const instruction =
    action === "custom"
      ? (options?.customPrompt?.trim() ?? "按用户要求修改。")
      : (actionMeta?.instruction ?? "按用户要求修改。");

  return `${instruction}

---
${text}${contextBlock ? `\n\n---\n（上文为全文参考，勿输出参考说明）` : ""}`;
}
