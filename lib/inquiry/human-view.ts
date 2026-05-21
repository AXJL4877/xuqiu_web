import { generateText } from "ai";

import type { ResolvedAiConfig } from "@/lib/ai/config";
import { createCompatibleOpenAI } from "@/lib/ai/openai-compatible";
import type {
  DataModelItem,
  EdgeCaseItem,
  MilestoneItem,
  NotebookSectionItem,
  StateTransitionItem,
  StructuredSectionId,
} from "@/lib/inquiry/notebook-schema";
import {
  isStructuredSectionId,
  parseSectionItems,
} from "@/lib/inquiry/notebook-schema";
import type { InquiryHumanFact, InquiryNotebook } from "@/lib/inquiry/types";

/** 确认页板块展示名（给人看） */
export const HUMAN_SECTION_LABELS: Record<string, string> = {
  core_constraints: "工程约定（已由系统锁定，无需改技术栈）",
  data_models: "AI 梳理的数据模型",
  state_transitions: "AI 梳理的使用流程",
  edge_cases: "AI 梳理的异常与边界",
  milestones: "AI 梳理的交付阶段",
  overview: "项目背景",
  users: "目标用户",
  value: "核心价值",
  features: "核心功能",
  tech: "技术方向",
  nfr: "体验与安全",
};

const FIELD_WORD_MAP: Record<string, string> = {
  id: "用户标识",
  userid: "用户编号",
  nickname: "昵称",
  name: "名称",
  email: "邮箱",
  phone: "手机号",
  avatar: "头像",
  points: "积分",
  score: "积分",
  credit: "积分",
  balance: "余额",
  createdat: "注册时间",
  updatedat: "更新时间",
  status: "状态",
  role: "角色",
  token: "登录凭证",
  password: "密码",
};

function humanSectionTitle(sectionId: string, fallback: string): string {
  return HUMAN_SECTION_LABELS[sectionId] ?? fallback;
}

function normalizeToken(raw: string): string {
  return raw.replace(/[_\s-]/g, "").toLowerCase();
}

function fieldTokenToHuman(token: string): string {
  const t = token.trim().replace(/[?:（）()]/g, "");
  if (!t) return "";
  const key = normalizeToken(t.split(/[:：]/)[0] ?? t);
  return FIELD_WORD_MAP[key] ?? t.replace(/([A-Z])/g, " $1").trim();
}

function parseFieldList(fields: string): string[] {
  return fields
    .split(/[,，、;；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function humanizeDataModel(item: DataModelItem): string {
  const label = item.entity.replace(/表$/, "").trim() || "业务数据";
  const parts = parseFieldList(item.fields).map(fieldTokenToHuman).filter(Boolean);
  const list =
    parts.length > 0
      ? parts.join("、")
      : item.fields.trim().slice(0, 80) || "相关字段待补充";
  let line = `**${label}**：系统会记录${list}等信息。`;
  if (item.notes?.trim()) {
    line += `（补充：${item.notes.trim()}）`;
  }
  return line;
}

function humanizeStateTransition(item: StateTransitionItem): string {
  return `在「${item.from}」时，若发生「${item.event}」，系统进入「${item.to}」${item.sideEffect ? `，并${item.sideEffect}` : ""}。`;
}

function humanizeEdgeCase(item: EdgeCaseItem): string {
  return `若出现「${item.scenario}」，对用户表现为：${item.action}`;
}

function humanizeMilestone(item: MilestoneItem): string {
  return `**${item.phase}**：${item.scope}（做到这一步算完成：${item.acceptance}）`;
}

function humanizeConstraint(item: { constraint: string; scope: string }): string {
  return `**${item.constraint}**（适用于：${item.scope}）`;
}

function ruleBasedBullets(
  sectionId: StructuredSectionId,
  items: NotebookSectionItem[],
): string[] {
  switch (sectionId) {
    case "data_models":
      return items.map((i) => humanizeDataModel(i as DataModelItem));
    case "state_transitions":
      return items.map((i) => humanizeStateTransition(i as StateTransitionItem));
    case "edge_cases":
      return items.map((i) => humanizeEdgeCase(i as EdgeCaseItem));
    case "milestones":
      return items.map((i) => humanizeMilestone(i as MilestoneItem));
    case "core_constraints":
      return items.map((i) =>
        humanizeConstraint(i as { constraint: string; scope: string }),
      );
    default:
      return [];
  }
}

function ideaFootnote(idea: string, sectionId: string): string | undefined {
  const t = idea.trim();
  if (!t) return undefined;
  const hints: { pattern: RegExp; note: string; sections?: string[] }[] = [
    {
      pattern: /会员|积分|等级|订阅/,
      note: "这能支撑你提到的会员/积分体系",
      sections: ["data_models", "state_transitions"],
    },
    {
      pattern: /登录|注册|鉴权/,
      note: "与登录注册相关需求一致",
      sections: ["state_transitions", "edge_cases"],
    },
    {
      pattern: /文档|PRD|需求/,
      note: "与文档/需求管理场景一致",
      sections: ["data_models", "features"],
    },
  ];
  for (const h of hints) {
    if (!h.pattern.test(t)) continue;
    if (h.sections && !h.sections.includes(sectionId)) continue;
    return h.note;
  }
  return undefined;
}

function buildHumanFactFromEntry(
  sectionId: string,
  sectionTitle: string,
  content: string,
  items: unknown[] | undefined,
  idea: string,
): InquiryHumanFact | null {
  if (isStructuredSectionId(sectionId) && items?.length) {
    const parsed = parseSectionItems(sectionId, items);
    if (parsed.length === 0) return null;
    const bullets = ruleBasedBullets(sectionId, parsed);
    return {
      sectionId,
      sectionTitle: humanSectionTitle(sectionId, sectionTitle),
      summary: bullets[0] ?? "",
      bullets,
      footnote: ideaFootnote(idea, sectionId),
    };
  }

  const text = content.trim();
  if (!text || text.includes("（用户跳过，待补充）")) return null;

  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  return {
    sectionId,
    sectionTitle: humanSectionTitle(sectionId, sectionTitle),
    summary: lines[0] ?? text.slice(0, 120),
    bullets: lines.length > 0 ? lines : [text.slice(0, 200)],
    footnote: ideaFootnote(idea, sectionId),
  };
}

export function buildHumanFactsFromNotebook(
  idea: string,
  notebook: InquiryNotebook,
): InquiryHumanFact[] {
  const out: InquiryHumanFact[] = [];
  for (const entry of notebook.entries) {
    const fact = buildHumanFactFromEntry(
      entry.sectionId,
      entry.sectionTitle,
      entry.content,
      entry.items,
      idea,
    );
    if (fact) out.push(fact);
  }
  return out;
}

function extractJsonObject(raw: string): unknown {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(text);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("未找到 JSON");
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

/** 可选：用大模型润色大白话（无 API 时仅用规则） */
export async function enhanceHumanFactsWithAi(
  ai: ResolvedAiConfig,
  idea: string,
  facts: InquiryHumanFact[],
): Promise<InquiryHumanFact[]> {
  if (facts.length === 0) return facts;

  const provider = createCompatibleOpenAI(ai, { disableThinking: true });
  const payload = facts.map((f) => ({
    sectionId: f.sectionId,
    sectionTitle: f.sectionTitle,
    bullets: f.bullets,
  }));

  try {
    const result = await generateText({
      model: provider.chat(ai.model),
      system: [
        "你是产品经理助手，把结构化需求改写成小白能确认的「大白话」。",
        "只输出 JSON：{\"facts\":[{\"sectionId\",\"sectionTitle\",\"summary\",\"bullets\":[\"…\"],\"footnote\"?}]}",
        "规则：",
        "1. 禁止 interface、外键、SQL、API、TypeScript 等术语。",
        "2. 用「系统会记住…」「用户看到…」「如果…就…」等表述。",
        "3. footnote 可选，一句关联用户原始创意（如：这能支撑你说的会员体系）。",
        "4. 不增删 sectionId，bullets 条数可与输入接近。",
      ].join("\n"),
      prompt: [
        "【用户创意】",
        idea.trim(),
        "",
        "【待润色草案】",
        JSON.stringify(payload, null, 2),
      ].join("\n"),
      maxOutputTokens: 1200,
    });

    const json = extractJsonObject(result.text) as {
      facts?: InquiryHumanFact[];
    };
    if (!json.facts?.length) return facts;

    return json.facts.map((f) => {
      const base = facts.find((x) => x.sectionId === f.sectionId);
      return {
        sectionId: f.sectionId,
        sectionTitle:
          f.sectionTitle ??
          base?.sectionTitle ??
          humanSectionTitle(f.sectionId, f.sectionId),
        summary: f.summary?.trim() || base?.summary || "",
        bullets:
          f.bullets?.length ? f.bullets : (base?.bullets ?? []),
        footnote: f.footnote?.trim() || base?.footnote,
      };
    });
  } catch (e) {
    console.warn("[human-view] AI enhance failed", e);
    return facts;
  }
}
