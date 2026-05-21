import { compileSectionForMachine } from "@/lib/inquiry/machine-compile";
import { isStructuredSectionId } from "@/lib/inquiry/notebook-schema";
import type { InquiryNotebook } from "@/lib/inquiry/types";
import type {
  CompletionStrategy,
  InquiryAssumption,
  InquiryGap,
} from "@/lib/inquiry/types";
import {
  resolveTechStackPolicy,
  usesGoldenStackSections,
} from "@/lib/golden-stack";
import type { TemplateSectionItem } from "@/lib/template-types";

const FULLSTACK_BLOCK_HINTS: Record<string, string> = {
  core_constraints:
    "输出技术栈、目录结构、代码规范、环境变量、禁止事项等，可被 AI 直接执行。",
  data_models:
    "优先 TypeScript interface/type 与 API 契约；可用 ```typescript 代码块。",
  state_transitions:
    "用状态机或步骤描述主路径与回退；可用 ### 小标题分流程。",
  edge_cases:
    "每条对应一个异常场景与处理动作，禁止合并成一段话。",
  milestones:
    "分阶段列出交付范围、文件级任务与验收标准。",
};

const STRATEGY_LABELS: Record<CompletionStrategy, string> = {
  conservative: "保守：缺失处仅写「待补充」",
  standard: "标准：推断须标注（推断）",
  aggressive: "积极：可合理补全并标注（推断）",
};

export type BlockGenerateContext = {
  idea: string;
  section: TemplateSectionItem;
  sections: TemplateSectionItem[];
  notebook?: InquiryNotebook;
  acceptedAssumptions?: InquiryAssumption[];
  gaps?: InquiryGap[];
  completionStrategy?: CompletionStrategy;
};

function sectionNotebookPayload(
  ctx: BlockGenerateContext,
): string {
  const { section, notebook } = ctx;
  if (!notebook) return "（无笔记板数据，请基于项目创意合理扩写本节。）";

  const entry = notebook.entries.find((e) => e.sectionId === section.id);
  if (!entry) return "（该板块笔记为空。）";

  const machineBody = compileSectionForMachine(section.id, entry);

  if (
    entry.format === "structured" &&
    isStructuredSectionId(entry.sectionId) &&
    machineBody.trim()
  ) {
    return [
      "【机器编译视图 — 已确认事实的技术向表述，须忠实扩写，禁止改回大白话】",
      machineBody.trim(),
    ].join("\n");
  }

  if (entry.content.trim()) {
    return ["【笔记板摘录 — 须改写为正式表述，禁止整段复制】", entry.content.trim()].join(
      "\n",
    );
  }

  return "（该板块笔记为空。）";
}

export function buildBlockSystemPrompt(section: TemplateSectionItem): string {
  const hint = FULLSTACK_BLOCK_HINTS[section.id];

  return [
    "你是 PRD 章节正文生成器。你只输出「单个章节」的正文内容。",
    "",
    "【硬性规则 — 违反即失败】",
    "1. 禁止输出 `#` 文档标题。",
    `2. 禁止输出 \`## ${section.title}\` 或任何 ## 级章节标题（章节标题已由系统预置）。`,
    "3. 第一行起就是正文：可以是 `- ` 列表、`###` 小标题、blockquote、或 typescript 代码块。",
    "4. 禁止寒暄、禁止复述用户指令、禁止「根据以上内容」类元话术。",
    "5. 禁止输出思考过程、推理步骤、redacted_reasoning 标签或任何链式分析。",
    "6. 分条仅用 `- `，禁止 1.2.3. 序号。",
    "7. 输入 JSON/笔记仅供理解，须改写为可落地 PRD 表述。",
    "8. 正文须达到「AI 编程就绪」：未经人工修改即可被 Cursor/Claude 直接执行——目录/类型/异常须具体、可引用、无空泛口号。",
    hint ? `9. 本节侧重：${hint}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildBlockUserPrompt(ctx: BlockGenerateContext): string {
  const {
    idea,
    section,
    acceptedAssumptions = [],
    gaps = [],
    completionStrategy = "standard",
  } = ctx;

  const sectionAssumptions = acceptedAssumptions.filter(
    (a) => a.sectionId === section.id,
  );
  const sectionGap = gaps.find((g) => g.sectionId === section.id);

  const assumptionBlock =
    sectionAssumptions.length > 0
      ? sectionAssumptions.map((a) => `- ${a.text}`).join("\n")
      : "（无）";

  const policy = resolveTechStackPolicy(idea);
  const isGoldenProject =
    usesGoldenStackSections(ctx.sections) && policy.mode === "golden";

  const stackNote = isGoldenProject
    ? [
        "",
        "【技术栈锁定】本项目已强制采用黄金全栈：Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase（默认）/ Firebase + Vercel。",
        "禁止在本节正文中建议替换为 Vue、Python、微信小程序等其他主栈。",
      ].join("\n")
    : policy.mode === "override"
      ? [
          "",
          `【技术栈例外】用户创意含特殊指向（${policy.matchedSignals.join("、")}），可按需求偏离黄金全栈。`,
        ].join("\n")
      : "";

  return [
    "【项目创意】",
    idea.trim(),
    stackNote,
    "",
    `【当前章节】${section.title}（sectionId: ${section.id}）`,
    "",
    sectionNotebookPayload(ctx),
    "",
    "【本节已勾选假设】",
    assumptionBlock,
    sectionGap ? `【本节仍缺失】${sectionGap.reason}` : "",
    "",
    `【补全策略】${STRATEGY_LABELS[completionStrategy]}`,
    "",
    "请仅输出本节 Markdown 正文（不要章节 ## 标题）。",
  ].join("\n");
}
