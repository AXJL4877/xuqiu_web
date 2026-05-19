import type {
  CompletionStrategy,
  InquiryAssumption,
  InquiryGap,
  InquiryGeneratePayload,
  InquiryNotebook,
} from "@/lib/inquiry/types";

const STRATEGY_LABELS: Record<CompletionStrategy, string> = {
  conservative: "保守：缺失板块仅列「待补充」，不做推断",
  standard: "标准：仅将用户勾选的假设写入正文，并标注（推断）",
  aggressive:
    "积极：尽量补全，勾选假设写入正文；未勾选写入「假设清单」附录",
};

export function buildGenerationUserPrompt(
  payload: InquiryGeneratePayload,
): string {
  const {
    idea,
    notebook,
    acceptedAssumptions,
    gaps,
    completionStrategy,
  } = payload;

  const notebookBlock = notebook.entries
    .filter((e) => e.content.trim())
    .map((e) => `### ${e.sectionTitle}\n${e.content.trim()}`)
    .join("\n\n");

  const factsBlock = notebook.entries
    .filter((e) => e.content.trim() && !e.content.includes("（用户跳过，待补充）"))
    .map((e) => `- ${e.sectionTitle}：${e.content.trim().slice(0, 500)}`)
    .join("\n");

  const acceptedBlock =
    acceptedAssumptions.length > 0
      ? acceptedAssumptions
          .map((a) => `- [${a.sectionTitle}] ${a.text}`)
          .join("\n")
      : "（无）";

  const gapBlock =
    gaps.length > 0
      ? gaps.map((g) => `- ${g.sectionTitle}：${g.reason}`).join("\n")
      : "（无）";

  const unaccepted = gaps
    .filter(
      (g) => !acceptedAssumptions.some((a) => a.sectionId === g.sectionId),
    )
    .map((g) => g.sectionTitle);

  return [
    "【项目创意】",
    idea.trim(),
    "",
    "【需求笔记板全文 — 已确认事实来源，优先采信】",
    notebookBlock || "（空）",
    "",
    "【已确认事实摘要】",
    factsBlock || "（空）",
    "",
    "【用户勾选的假设 — 可写入正文】",
    acceptedBlock,
    "",
    "【仍缺失且未勾选假设的板块 — 不得用确定语气写成已定需求】",
    unaccepted.length > 0 ? unaccepted.join("、") : "（无）",
    "",
    "【仍待补充说明】",
    gapBlock,
    "",
    `【补全策略】${STRATEGY_LABELS[completionStrategy]}`,
    "",
    "【生成要求】",
    "- 你必须产出「加工后的 PRD 正文」，禁止整段照搬【需求笔记板全文】或【已确认事实摘要】的原文。",
    "- 须按各 ## 板块重新组织、扩写、提炼为可落地需求表述，可合并要点、补充合理细节，但不得原样复制问答记录。",
    "- 已确认事实：用确定语气写入对应 ## 板块。",
    "- 勾选假设：可写入对应板块，关键句须带「（推断）」标注。",
    "- 未勾选假设：不得写成已确定需求；保守策略下缺失处用「待补充：…」；标准/积极可将未确认项集中写入「待确认」小节或开放问题。",
    "- 禁止输出文档以外内容；分条仅用 `-`。",
    "",
    "请直接输出 PRD 正文。",
  ].join("\n");
}
