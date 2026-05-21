import {
  isStructuredSectionId,
  notebookToStructuredJsonBlock,
  usesStructuredNotebook,
} from "@/lib/inquiry/notebook-schema";
import {
  estimateRemainingQuestions,
  getSectionAskCount,
  getSectionStatus,
  pickNextGapSection,
} from "@/lib/inquiry/section-status";
import type { InquiryNotebook } from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

const IDEA_MAX = 2000;

const FULLSTACK_INQUIRY_HINTS: Record<string, string> = {
  core_constraints: "追问框架、语言、DB、部署、代码规范、禁止项。",
  data_models: "追问实体、字段、关系、API 入参出参形状。",
  state_transitions: "追问主流程步骤、状态名、触发与守卫条件。",
  edge_cases: "追问断网、超时、权限、重复提交、部分失败等。",
  milestones: "追问 MVP 范围、分阶段交付顺序与每阶段验收。",
};

export function buildInquirySystemPrompt(
  sections?: { id: string; title: string; enabled: boolean }[],
): string {
  const enabledIds = sections?.filter((s) => s.enabled).map((s) => s.id) ?? [];
  const fullstackHints = enabledIds
    .map((id) => {
      const hint = FULLSTACK_INQUIRY_HINTS[id];
      return hint ? `- ${id}：${hint}` : null;
    })
    .filter((line): line is string => line != null);

  const lines = [
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
  ];

  if (fullstackHints.length > 0) {
    lines.push(
      "",
      "【全栈 / AI 编程板块 — 追问须偏实现细节，避免产品口号】",
      "【技术独裁】默认已锁定黄金全栈（Next.js + TS + Tailwind + Supabase/Firebase + Vercel），勿追问是否改用 Vue/Python/小程序；仅当用户创意已明确特殊栈时才讨论替代方案。",
      "core_constraints 板块若笔记板已含黄金栈条目，视为已充分，勿重复追问选型。",
      ...fullstackHints,
    );
  }

  if (sections && usesStructuredNotebook(sections)) {
    lines.push(
      "",
      "【笔记板数据形态 — 强制结构化数组】",
      "每个板块在服务端以 JSON 数组存储（如 edge_cases: [{scenario, action}, ...]）。",
      "你的追问必须引导用户给出可拆成独立条目的场景/约束/状态/实体，禁止整段散文式回答。",
      "选项 label 应具体、可一条对应一个数组元素。",
    );
  }

  return lines.join("\n");
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
    if (s.id === focusSectionId && entry) {
      if (
        entry.format === "structured" &&
        isStructuredSectionId(entry.sectionId) &&
        (entry.items?.length ?? 0) > 0
      ) {
        const json = notebookToStructuredJsonBlock([entry]).slice(0, 800);
        return `- ${s.id} | ${s.title} | ${label}\n  已有条目(JSON):\n${json}`;
      }
      if (entry.content.trim()) {
        return `- ${s.id} | ${s.title} | ${label}\n  已有:\n${entry.content.trim().slice(0, 600)}`;
      }
    }
    if (
      entry?.format === "structured" &&
      isStructuredSectionId(entry.sectionId)
    ) {
      const n = entry.items?.length ?? 0;
      return `- ${s.id} | ${s.title} | ${label}（${n} 条）`;
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
