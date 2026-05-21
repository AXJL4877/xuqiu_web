import { z } from "zod";

import { PRESET_FULLSTACK_CURSOR_ID } from "@/lib/preset-templates";
import type { TemplateSectionItem, TemplateStructure } from "@/lib/template-types";

/** 笔记板 JSON 版本：2 = 结构化数组条目 */
export const NOTEBOOK_SCHEMA_VERSION = 2;

export const STRUCTURED_SECTION_IDS = [
  "core_constraints",
  "data_models",
  "state_transitions",
  "edge_cases",
  "milestones",
] as const;

export type StructuredSectionId = (typeof STRUCTURED_SECTION_IDS)[number];

export const coreConstraintItemSchema = z.object({
  constraint: z.string().min(1).max(500),
  scope: z.string().min(1).max(300),
});

export const dataModelItemSchema = z.object({
  entity: z.string().min(1).max(200),
  fields: z.string().min(1).max(2000),
  notes: z.string().max(1000).optional(),
});

export const stateTransitionItemSchema = z.object({
  from: z.string().min(1).max(200),
  event: z.string().min(1).max(300),
  to: z.string().min(1).max(200),
  sideEffect: z.string().max(500).optional(),
});

export const edgeCaseItemSchema = z.object({
  scenario: z.string().min(1).max(300),
  action: z.string().min(1).max(800),
});

export const milestoneItemSchema = z.object({
  phase: z.string().min(1).max(200),
  scope: z.string().min(1).max(1500),
  acceptance: z.string().min(1).max(800),
});

const sectionItemSchemas: Record<
  StructuredSectionId,
  z.ZodType<Record<string, unknown>>
> = {
  core_constraints: coreConstraintItemSchema,
  data_models: dataModelItemSchema,
  state_transitions: stateTransitionItemSchema,
  edge_cases: edgeCaseItemSchema,
  milestones: milestoneItemSchema,
};

export type CoreConstraintItem = z.infer<typeof coreConstraintItemSchema>;
export type DataModelItem = z.infer<typeof dataModelItemSchema>;
export type StateTransitionItem = z.infer<typeof stateTransitionItemSchema>;
export type EdgeCaseItem = z.infer<typeof edgeCaseItemSchema>;
export type MilestoneItem = z.infer<typeof milestoneItemSchema>;

export type NotebookSectionItem =
  | CoreConstraintItem
  | DataModelItem
  | StateTransitionItem
  | EdgeCaseItem
  | MilestoneItem;

export type NotebookEntryFormat = "plain" | "structured";

export function isStructuredSectionId(
  sectionId: string,
): sectionId is StructuredSectionId {
  return (STRUCTURED_SECTION_IDS as readonly string[]).includes(sectionId);
}

export function usesStructuredNotebook(
  sections: TemplateSectionItem[],
): boolean {
  const enabled = sections.filter((s) => s.enabled);
  if (enabled.length === 0) return false;
  return enabled.every((s) => isStructuredSectionId(s.id));
}

export function usesStructuredNotebookFromPreset(
  structure?: TemplateStructure | null,
): boolean {
  return structure?.presetId === PRESET_FULLSTACK_CURSOR_ID;
}

export function inferNotebookFormat(
  sections: TemplateSectionItem[],
  structure?: TemplateStructure | null,
): NotebookEntryFormat {
  if (usesStructuredNotebookFromPreset(structure)) return "structured";
  return usesStructuredNotebook(sections) ? "structured" : "plain";
}

export function parseSectionItems(
  sectionId: string,
  raw: unknown[],
): NotebookSectionItem[] {
  if (!isStructuredSectionId(sectionId)) return [];
  const schema = sectionItemSchemas[sectionId];
  const out: NotebookSectionItem[] = [];
  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data as NotebookSectionItem);
  }
  return out;
}

export function validateSectionItems(
  sectionId: string,
  items: unknown[],
): { ok: true; items: NotebookSectionItem[] } | { ok: false; error: string } {
  if (!isStructuredSectionId(sectionId)) {
    return { ok: false, error: `非结构化板块: ${sectionId}` };
  }
  if (!Array.isArray(items)) {
    return { ok: false, error: `${sectionId} 须为数组` };
  }
  const schema = sectionItemSchemas[sectionId];
  const parsed: NotebookSectionItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const r = schema.safeParse(items[i]);
    if (!r.success) {
      return {
        ok: false,
        error: `${sectionId}[${i}] 字段不完整`,
      };
    }
    parsed.push(r.data as NotebookSectionItem);
  }
  return { ok: true, items: parsed };
}

const MIN_STRUCTURED_ITEMS_ADEQUATE = 2;

export function countValidSectionItems(
  sectionId: string,
  items: unknown[] | undefined,
): number {
  if (!items?.length || !isStructuredSectionId(sectionId)) return 0;
  return parseSectionItems(sectionId, items).length;
}

export function isStructuredEntryAdequate(
  sectionId: string,
  items: unknown[] | undefined,
  askCount = 0,
): boolean {
  const n = countValidSectionItems(sectionId, items);
  if (askCount >= 3) return n >= 1;
  return n >= MIN_STRUCTURED_ITEMS_ADEQUATE;
}

export function formatItemAsBullet(
  sectionId: StructuredSectionId,
  item: NotebookSectionItem,
): string {
  switch (sectionId) {
    case "core_constraints": {
      const i = item as CoreConstraintItem;
      return `- **${i.constraint}**（${i.scope}）`;
    }
    case "data_models": {
      const i = item as DataModelItem;
      return `- **${i.entity}**：${i.fields}${i.notes ? ` — ${i.notes}` : ""}`;
    }
    case "state_transitions": {
      const i = item as StateTransitionItem;
      return `- ${i.from} —[${i.event}]→ ${i.to}${i.sideEffect ? `（${i.sideEffect}）` : ""}`;
    }
    case "edge_cases": {
      const i = item as EdgeCaseItem;
      return `- **${i.scenario}**：${i.action}`;
    }
    case "milestones": {
      const i = item as MilestoneItem;
      return `- **${i.phase}**：${i.scope}；验收：${i.acceptance}`;
    }
    default:
      return `- ${JSON.stringify(item)}`;
  }
}

export function formatItemsForDisplay(
  sectionId: string,
  items: unknown[] | undefined,
): string {
  if (!isStructuredSectionId(sectionId) || !items?.length) return "";
  const parsed = parseSectionItems(sectionId, items);
  return parsed
    .map((item) => formatItemAsBullet(sectionId, item))
    .join("\n");
}

/** 生成阶段传给模型的 JSON 片段（按板块 key 聚合） */
export function notebookToStructuredJsonBlock(
  entries: {
    sectionId: string;
    sectionTitle: string;
    items?: unknown[];
  }[],
): string {
  const payload: Record<string, NotebookSectionItem[]> = {};
  for (const e of entries) {
    if (!isStructuredSectionId(e.sectionId)) continue;
    const items = parseSectionItems(e.sectionId, e.items ?? []);
    if (items.length > 0) payload[e.sectionId] = items;
  }
  if (Object.keys(payload).length === 0) return "";
  return JSON.stringify(payload, null, 2);
}

export function getSectionFieldLabels(
  sectionId: StructuredSectionId,
): { key: string; label: string }[] {
  switch (sectionId) {
    case "core_constraints":
      return [
        { key: "constraint", label: "约束项" },
        { key: "scope", label: "适用范围" },
      ];
    case "data_models":
      return [
        { key: "entity", label: "实体" },
        { key: "fields", label: "字段/契约" },
        { key: "notes", label: "备注" },
      ];
    case "state_transitions":
      return [
        { key: "from", label: "当前状态" },
        { key: "event", label: "触发" },
        { key: "to", label: "下一状态" },
        { key: "sideEffect", label: "副作用" },
      ];
    case "edge_cases":
      return [
        { key: "scenario", label: "场景" },
        { key: "action", label: "处理" },
      ];
    case "milestones":
      return [
        { key: "phase", label: "阶段" },
        { key: "scope", label: "交付范围" },
        { key: "acceptance", label: "验收" },
      ];
    default:
      return [];
  }
}
