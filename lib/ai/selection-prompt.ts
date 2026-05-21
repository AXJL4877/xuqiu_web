/** 常规文档润色 */
export const SELECTION_ACTIONS = [
  {
    id: "professional",
    label: "专业化",
    mode: "replace" as const,
    instruction: "改为产品/技术文档的专业表述，术语准确、语气客观简洁。",
  },
  {
    id: "expand",
    label: "扩写",
    mode: "replace" as const,
    instruction: "在保持主题的前提下补充必要细节与可执行描述，适度加长。",
  },
  {
    id: "shorten",
    label: "缩写",
    mode: "replace" as const,
    instruction: "删繁就简，保留核心信息，使文字更精炼。",
  },
] as const;

/** 工程化翻译 — 面向开发 PRD 的程序员思维指令 */
export const ENGINEERING_SELECTION_ACTIONS = [
  {
    id: "to_ts_interface",
    label: "TS 接口",
    mode: "replace" as const,
    instruction:
      "将选中的自然语言（实体、字段、关系描述）转化为可直接使用的 TypeScript 类型定义。",
  },
  {
    id: "add_edge_branches",
    label: "补充异常分支",
    mode: "append" as const,
    instruction:
      "针对选中的交互/流程描述，补充失败、超时、校验错误、权限不足、重复提交等边界场景。",
  },
  {
    id: "to_gherkin",
    label: "Given/When/Then",
    mode: "replace" as const,
    instruction:
      "将选中的口语化业务逻辑改写为严格的 Given/When/Then 测试用例表述。",
  },
] as const;

export type TextSelectionActionId =
  (typeof SELECTION_ACTIONS)[number]["id"];
export type EngineeringSelectionActionId =
  (typeof ENGINEERING_SELECTION_ACTIONS)[number]["id"];

export type SelectionActionId =
  | TextSelectionActionId
  | EngineeringSelectionActionId
  | "ask"
  | "custom";

export type SelectionApplyMode = "replace" | "append";

const ALL_PRESET_ACTIONS = [
  ...SELECTION_ACTIONS,
  ...ENGINEERING_SELECTION_ACTIONS,
] as const;

export function getSelectionActionMeta(action: SelectionActionId): {
  label: string;
  mode: SelectionApplyMode;
  instruction?: string;
} | null {
  if (action === "ask") return { label: "名词解释", mode: "replace" };
  if (action === "custom") return { label: "自定义", mode: "replace" };
  const found = ALL_PRESET_ACTIONS.find((a) => a.id === action);
  if (!found) return null;
  return {
    label: found.label,
    mode: found.mode,
    instruction: found.instruction,
  };
}

export function getSelectionApplyMode(
  action: SelectionActionId,
): SelectionApplyMode {
  return getSelectionActionMeta(action)?.mode ?? "replace";
}

export function isSelectionAskAction(
  action: SelectionActionId,
): action is "ask" {
  return action === "ask";
}

export function isEngineeringSelectionAction(
  action: SelectionActionId,
): action is EngineeringSelectionActionId {
  return ENGINEERING_SELECTION_ACTIONS.some((a) => a.id === action);
}

export function isSelectionAppendAction(action: SelectionActionId): boolean {
  return getSelectionApplyMode(action) === "append";
}

function buildEngineeringSystemPrompt(
  action: EngineeringSelectionActionId,
): string {
  const common = [
    "你是面向开发的 PRD 工程化助手。用户选中一段 Markdown 正文。",
    "硬性要求：",
    "1. 第一行起就是输出正文，禁止思考过程、禁止复述用户指令、禁止「修改如下」类元话术。",
    "2. 保留 Markdown；代码块用 ```typescript 围栏（仅 TS 接口动作）。",
    "3. 分条仅用 `- `，不要用 1.2.3. 序号。",
  ];

  switch (action) {
    case "to_ts_interface":
      return [
        ...common,
        "4. 只输出 TypeScript：`interface` / `type` / 枚举；字段名 camelCase；必要处用 `?` 与注释。",
        "5. 禁止输出实现代码、禁止 JSON Schema、禁止解释性段落。",
      ].join("\n");
    case "add_edge_branches":
      return [
        ...common,
        "4. 只输出「补充的异常/边界场景」条目，不要重复用户选中的原文。",
        "5. 每条格式：`- **场景名**：处理动作（含 UI 反馈或接口行为）`。",
        "6. 覆盖：失败、超时、网络异常、校验错误、权限、重复操作、空数据等合理分支。",
      ].join("\n");
    case "to_gherkin":
      return [
        ...common,
        "4. 输出严格的 BDD 结构，使用 Given / When / Then 标题（Markdown `###`）。",
        "5. 每个 Then 须可验证；允许 And 子句；禁止口语化「用户点一下」而不写清前置条件。",
      ].join("\n");
    default:
      return common.join("\n");
  }
}

export function buildSelectionSystemPrompt(action: SelectionActionId): string {
  if (isSelectionAskAction(action)) {
    return `你是术语词典。用户划选一个名词/术语，你只输出该术语的释义。
硬性要求：
1. 第一行起就是释义正文（可用 **术语** 作标题），禁止任何铺垫、思考、复述题目或规则。
2. 禁止出现：我们被问到、选中内容是、需要符合、所以直接解释、请解释下面 等字样。
3. 用简洁中文，分条用「- 」；不写修改建议、不改写文档。`;
  }

  if (isEngineeringSelectionAction(action)) {
    return buildEngineeringSystemPrompt(action);
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

  const meta = getSelectionActionMeta(action);
  const instruction =
    action === "custom"
      ? (options?.customPrompt?.trim() ?? "按用户要求修改。")
      : (meta?.instruction ?? "按用户要求修改。");

  if (action === "to_ts_interface") {
    return `${instruction}

将下面选中的自然语言转化为 TypeScript 类型定义（仅输出代码块与必要注释）：

---
${text}${contextBlock}`;
  }

  if (action === "add_edge_branches") {
    return `${instruction}

【用户选中的交互/流程描述】
${text}

请只输出应追加在其下方的异常与边界场景列表（不要重复上文）。${contextBlock}`;
  }

  if (action === "to_gherkin") {
    return `${instruction}

将下面口语化逻辑改写为 Given/When/Then 测试用例（Markdown）：

---
${text}${contextBlock}`;
  }

  return `${instruction}

---
${text}${contextBlock ? `\n\n---\n（上文为全文参考，勿输出参考说明）` : ""}`;
}
