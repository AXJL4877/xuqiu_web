import { generateText } from "ai";
import { z } from "zod";

import type { ResolvedAiConfig } from "@/lib/ai/config";
import { createCompatibleOpenAI } from "@/lib/ai/openai-compatible";
import { validateNotebookWithArchitect } from "@/lib/inquiry/architect-validator";
import {
  buildHumanFactsFromNotebook,
  enhanceHumanFactsWithAi,
} from "@/lib/inquiry/human-view";
import type {
  InquiryAssumption,
  InquiryFact,
  InquiryFinishResponse,
  InquiryGap,
  InquiryHumanFact,
  InquiryNotebook,
  InquirySessionMeta,
} from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";
import { countValidSectionItems } from "@/lib/inquiry/notebook-schema";
import {
  getSectionAskCount,
  getSectionStatus,
  isEntryAdequate,
} from "@/lib/inquiry/section-status";

const assumptionItemSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  text: z.string().min(4).max(400),
});

const assumptionListSchema = z.object({
  assumptions: z.array(assumptionItemSchema).max(12),
});

function extractJsonObject(raw: string): unknown {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(text);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("未找到 JSON");
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

export function buildFactsFromNotebook(
  notebook: InquiryNotebook,
): InquiryFact[] {
  return notebook.entries
    .filter((e) => {
      if (e.format === "structured") {
        return countValidSectionItems(e.sectionId, e.items) > 0;
      }
      const c = e.content.trim();
      return c && !c.includes("（用户跳过，待补充）");
    })
    .map((e) => ({
      sectionId: e.sectionId,
      sectionTitle: e.sectionTitle,
      content: e.content.trim(),
    }));
}

export function buildGapsFromNotebook(
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  session?: InquirySessionMeta | null,
): InquiryGap[] {
  const counts = session?.sectionAskCounts ?? {};
  const enabled = sections.filter((s) => s.enabled);

  return enabled
    .filter((s) => {
      const entry = notebook.entries.find((e) => e.sectionId === s.id);
      const askCount = getSectionAskCount(s.id, counts);
      if (entry?.format === "structured") {
        return countValidSectionItems(entry.sectionId, entry.items) === 0;
      }
      if (!entry?.content.trim()) return true;
      if (entry.content.includes("（用户跳过，待补充）")) return true;
      return !isEntryAdequate(entry, askCount);
    })
    .map((s) => {
      const entry = notebook.entries.find((e) => e.sectionId === s.id);
      const status = getSectionStatus(
        entry,
        getSectionAskCount(s.id, counts),
      );
      const reason =
        status === "empty"
          ? "尚未收集到有效信息"
          : entry?.content.includes("（用户跳过，待补充）")
            ? "用户跳过，待补充"
            : "信息过简，建议确认或勾选假设后补全";
      return { sectionId: s.id, sectionTitle: s.title, reason };
    });
}

function buildDemoAssumptions(
  idea: string,
  gaps: InquiryGap[],
): InquiryAssumption[] {
  return gaps.map((g) => ({
    id: `assume-${g.sectionId}`,
    sectionId: g.sectionId,
    sectionTitle: g.sectionTitle,
    text: `针对「${g.sectionTitle}」：结合项目创意，合理推断该板块要点（用户未明确确认，勾选后才可写入正文）。`,
  }));
}

async function buildAiAssumptions(
  ai: ResolvedAiConfig,
  idea: string,
  notebook: InquiryNotebook,
  gaps: InquiryGap[],
  facts: InquiryFact[],
): Promise<InquiryAssumption[]> {
  if (gaps.length === 0) return [];

  const provider = createCompatibleOpenAI(ai, { disableThinking: true });
  const gapLines = gaps
    .map((g) => `- ${g.sectionId} | ${g.sectionTitle}：${g.reason}`)
    .join("\n");
  const factSummary = facts
    .map((f) => `- ${f.sectionTitle}：${f.content.slice(0, 120)}…`)
    .join("\n");

  const result = await generateText({
    model: provider.chat(ai.model),
    system: [
      "你是 PRD 需求分析助手。根据项目创意与笔记板，为「仍待补充」的板块生成待验证假设。",
      "只输出 JSON：{\"assumptions\":[{\"id\":\"slug\",\"sectionId\":\"…\",\"text\":\"…\"}]}",
      "规则：",
      "1. 每条假设对应一个待补充板块，sectionId 必须来自待补充列表。",
      "2. text 一句话，说明合理推断内容，语气为「可能」「或许」「待确认」。",
      "3. 禁止捏造与用户创意明显冲突的内容。",
      "4. 最多 8 条。",
    ].join("\n"),
    prompt: [
      "【项目创意】",
      idea.trim(),
      "",
      "【已收集事实摘要】",
      factSummary || "（暂无）",
      "",
      "【待补充板块】",
      gapLines,
    ].join("\n"),
    maxOutputTokens: 600,
  });

  const json = extractJsonObject(result.text);
  const parsed = assumptionListSchema.safeParse(json);
  if (!parsed.success) return buildDemoAssumptions(idea, gaps);

  return parsed.data.assumptions.map((a) => {
    const gap = gaps.find((g) => g.sectionId === a.sectionId);
    return {
      id: a.id || `assume-${a.sectionId}`,
      sectionId: a.sectionId,
      sectionTitle: gap?.sectionTitle ?? a.sectionId,
      text: a.text.trim(),
    };
  });
}

export async function processInquiryFinish(
  idea: string,
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  session: InquirySessionMeta | null | undefined,
  ai: ResolvedAiConfig | null,
): Promise<InquiryFinishResponse> {
  const validatedNotebook = await validateNotebookWithArchitect(
    notebook,
    idea,
    ai,
  );

  const facts = buildFactsFromNotebook(validatedNotebook);
  const gaps = buildGapsFromNotebook(sections, validatedNotebook, session);

  let humanFacts: InquiryHumanFact[] = buildHumanFactsFromNotebook(
    idea,
    validatedNotebook,
  );
  if (ai && humanFacts.length > 0) {
    try {
      humanFacts = await enhanceHumanFactsWithAi(ai, idea, humanFacts);
    } catch (e) {
      console.warn("[inquiry/finish] human facts enhance skipped", e);
    }
  }

  let assumptions: InquiryAssumption[] = [];
  if (gaps.length > 0) {
    if (ai) {
      try {
        assumptions = await buildAiAssumptions(
          ai,
          idea,
          validatedNotebook,
          gaps,
          facts,
        );
      } catch (e) {
        console.error("[inquiry/finish] AI assumptions failed", e);
        assumptions = buildDemoAssumptions(idea, gaps);
      }
    } else {
      assumptions = buildDemoAssumptions(idea, gaps);
    }
  }

  return {
    facts,
    humanFacts,
    gaps,
    assumptions,
    notebook: validatedNotebook,
    mode: ai ? "live" : "demo",
  };
}
