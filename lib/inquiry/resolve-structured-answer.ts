import type { InquiryAnswerPayload, InquiryQuestion } from "@/lib/inquiry/types";
import {
  type NotebookSectionItem,
  type StructuredSectionId,
  edgeCaseItemSchema,
  coreConstraintItemSchema,
  dataModelItemSchema,
  milestoneItemSchema,
  stateTransitionItemSchema,
  isStructuredSectionId,
  parseSectionItems,
} from "@/lib/inquiry/notebook-schema";
import { resolveAnswerText } from "@/lib/inquiry/resolve-answer";

function tryParseJsonItems(raw: string): unknown[] | null {
  const t = raw.trim();
  if (!t.startsWith("[") && !t.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {
    return null;
  }
  return null;
}

function splitScenarioAction(line: string): { scenario: string; action: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const colon = trimmed.match(/^([^:：]+)[:：]\s*(.+)$/);
  if (colon) {
    return { scenario: colon[1].trim(), action: colon[2].trim() };
  }
  const dash = trimmed.match(/^([^—\-]+)[—\-]\s*(.+)$/);
  if (dash) {
    return { scenario: dash[1].trim(), action: dash[2].trim() };
  }
  return { scenario: trimmed.slice(0, 80), action: "待补充具体处理方式" };
}

function textToEdgeCaseItems(text: string): NotebookSectionItem[] {
  const json = tryParseJsonItems(text);
  if (json) {
    return parseSectionItems("edge_cases", json);
  }
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
  const items: NotebookSectionItem[] = [];
  for (const line of lines) {
    const pair = splitScenarioAction(line);
    if (!pair) continue;
    const r = edgeCaseItemSchema.safeParse(pair);
    if (r.success) items.push(r.data);
  }
  if (items.length === 0 && text.trim()) {
    const pair = splitScenarioAction(text);
    if (pair) {
      const r = edgeCaseItemSchema.safeParse(pair);
      if (r.success) items.push(r.data);
    }
  }
  return items;
}

function optionLabelToItems(
  sectionId: StructuredSectionId,
  labels: string[],
): NotebookSectionItem[] {
  const items: NotebookSectionItem[] = [];
  for (const label of labels) {
    let parsed: NotebookSectionItem | null = null;
    switch (sectionId) {
      case "core_constraints": {
        const r = coreConstraintItemSchema.safeParse({
          constraint: label,
          scope: "全局工程约束",
        });
        if (r.success) parsed = r.data;
        break;
      }
      case "data_models": {
        const r = dataModelItemSchema.safeParse({
          entity: label,
          fields: "待补充字段与 TypeScript 契约",
        });
        if (r.success) parsed = r.data;
        break;
      }
      case "state_transitions": {
        const r = stateTransitionItemSchema.safeParse({
          from: "初始",
          event: label,
          to: "下一状态（待细化）",
        });
        if (r.success) parsed = r.data;
        break;
      }
      case "edge_cases": {
        const r = edgeCaseItemSchema.safeParse({
          scenario: label,
          action: "待补充 UI/接口处理方式",
        });
        if (r.success) parsed = r.data;
        break;
      }
      case "milestones": {
        const r = milestoneItemSchema.safeParse({
          phase: label,
          scope: "待补充交付范围",
          acceptance: "待补充验收标准",
        });
        if (r.success) parsed = r.data;
        break;
      }
      default:
        break;
    }
    if (parsed) items.push(parsed);
  }
  return items;
}

function textToSectionItems(
  sectionId: StructuredSectionId,
  text: string,
): NotebookSectionItem[] {
  if (sectionId === "edge_cases") return textToEdgeCaseItems(text);

  const json = tryParseJsonItems(text);
  if (json) return parseSectionItems(sectionId, json);

  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length === 0 && text.trim()) {
    return optionLabelToItems(sectionId, [text.trim()]);
  }

  return optionLabelToItems(sectionId, lines);
}

function collectOptionLabels(
  question: InquiryQuestion,
  selectedOptionIds: string[] | undefined,
): string[] {
  const ids = selectedOptionIds ?? [];
  if (!question.options?.length) return [];
  return question.options
    .filter((o) => ids.includes(o.id) && !o.isCustom)
    .map((o) => o.label);
}

/**
 * 将单轮回答沉淀为结构化数组条目（Vibe Coding 模板专用）
 */
export function resolveAnswerToItems(
  sectionId: string,
  question: InquiryQuestion | null,
  answer: InquiryAnswerPayload,
): NotebookSectionItem[] {
  if (!isStructuredSectionId(sectionId)) return [];

  const custom = answer.customText?.trim();
  const text =
    answer.resolvedText?.trim() ||
    answer.text?.trim() ||
    custom ||
    null;

  if (answer.skipped) {
    return optionLabelToItems(sectionId, ["（用户跳过，待补充）"]);
  }

  if (question && question.options?.length) {
    const labels = collectOptionLabels(question, answer.selectedOptionIds);
    if (labels.length > 0) return optionLabelToItems(sectionId, labels);
  }

  if (text) return textToSectionItems(sectionId, text);

  if (question) {
    const fallback = resolveAnswerText(
      question,
      answer.selectedOptionIds,
      answer.customText,
    );
    if (fallback) return textToSectionItems(sectionId, fallback);
  }

  return [];
}
