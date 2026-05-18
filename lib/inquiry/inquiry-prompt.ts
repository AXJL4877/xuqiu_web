import {
  estimateRemainingQuestions,
  getSectionAskCount,
  getSectionStatus,
  pickNextGapSection,
} from "@/lib/inquiry/section-status";
import type { InquiryNotebook } from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

const IDEA_MAX = 2000;

export function buildInquirySystemPrompt(): string {
  return [
    "你是需求分析师，通过多轮追问收集 PRD 信息。",
    "只输出一个 JSON 对象，无 Markdown 围栏、无寒暄。",
    '格式：{"done":bool,"estimatedRemaining":number,"question":{"sectionId":str,"kind":"single"|"multi"|"text","stem":str,"whyAsk":str,"options":[{"id":str,"label":str}]}}',
    "",
    "规则：",
    "1. 题干必须紧扣用户创意中的产品/场景，禁止通用问卷。",
    "2. sectionId 必须等于用户指定的「本轮必问板块」。",
    "3. 若该板块为「待深化」：kind 必须为 text，不要 options；题干引用用户已写内容，请用户用自己的话补充，禁止换板块。",
    "4. 若 kind 为 single/multi：选项 3–4 个、贴合创意；勿含自定义项。",
    "5. 仅当所有板块均为「已充分」时可 done=true；否则 done=false。",
    "6. 禁止捏造用户未说过的事实。",
  ].join("\n");
}

export function buildInquiryUserPrompt(
  idea: string,
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  questionIndex: number,
  focusSectionId: string,
  isFollowUp: boolean,
  sectionAskCounts?: Record<string, number>,
): string {
  const enabled = sections.filter((s) => s.enabled);
  const ideaText =
    idea.trim().length > IDEA_MAX
      ? `${idea.trim().slice(0, IDEA_MAX)}…`
      : idea.trim();

  const lines = enabled.map((s) => {
    const entry = notebook.entries.find((e) => e.sectionId === s.id);
    const askCount = getSectionAskCount(s.id, sectionAskCounts);
    const status = getSectionStatus(entry, askCount);
    const label =
      status === "adequate"
        ? "已充分"
        : status === "shallow"
          ? "待深化"
          : "空缺";
    if (s.id === focusSectionId && entry?.content.trim()) {
      return `- ${s.id} | ${s.title} | ${label}\n  已有:\n${entry.content.trim().slice(0, 600)}`;
    }
    return `- ${s.id} | ${s.title} | ${label}`;
  });

  const remaining = estimateRemainingQuestions(
    sections,
    notebook,
    sectionAskCounts,
  );

  return [
    "【项目创意】",
    ideaText,
    "",
    "【板块状态】",
    lines.join("\n"),
    "",
    "【本轮必问板块】",
    focusSectionId,
    isFollowUp
      ? "（待深化 — 必须 kind=text、无 options，开放式追问，勿重复上一题问法）"
      : "（空缺 — 首次提问，可用 single/multi + options）",
    "",
    `已问 ${questionIndex} 题；预估至少还需约 ${remaining} 题。输出 JSON。`,
  ].join("\n");
}

export function resolveFocusSection(
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  sectionAskCounts?: Record<string, number>,
): { section: TemplateSectionItem; isFollowUp: boolean } | null {
  const section = pickNextGapSection(sections, notebook, sectionAskCounts);
  if (!section) return null;
  const entry = notebook.entries.find((e) => e.sectionId === section.id);
  const status = getSectionStatus(
    entry,
    getSectionAskCount(section.id, sectionAskCounts),
  );
  return { section, isFollowUp: status === "shallow" };
}
