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
    return `你是专业名词解释助手。用户会在 PRD 中划选一个词或短语，请你解释其含义。
规则：
1. 只解释选中内容中的专业名词/术语：定义、常见含义、在软件/产品需求场景中的指代。
2. 用简洁中文，可分条；不要整段复述选中文字，不要改写或续写文档正文。
3. 若选中多个术语，逐个简要解释；若是短语，先说明整体再拆解关键术语。
4. 不要给修改建议、扩写或评审意见，只做名词解释。`;
  }

  return `你是需求文档（PRD）写作助手，用户会选中一段 Markdown 正文请你改写。
规则：
1. 只输出改写后的选中文本本身，不要输出解释、引号包裹或「修改如下」等前缀。
2. 保留原有的 Markdown 标记（标题、列表、加粗等），不要擅自改成 HTML。
3. 未要求扩写时不要堆砌空话；未要求缩写时不要删掉关键约束。`;
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
    return `请解释下面选中内容中的专业名词（若本身就是术语，直接解释该词）：

【选中内容】
${text}${contextBlock}`;
  }

  const actionMeta =
    action === "custom"
      ? null
      : SELECTION_ACTIONS.find((a) => a.id === action);

  const instruction =
    action === "custom"
      ? (options?.customPrompt?.trim() ?? "按用户要求修改选中文本。")
      : (actionMeta?.instruction ?? "按用户要求修改选中文本。");

  return `${instruction}

【待改写的选中文本】
${text}${contextBlock}`;
}
