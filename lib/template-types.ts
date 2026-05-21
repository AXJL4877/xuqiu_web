import { z } from "zod";

export const templateSectionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  enabled: z.boolean(),
  /** 预置模板中的强制板块，不可关闭或删除 */
  locked: z.boolean().optional(),
});

export const templateStructureSchema = z.object({
  /** 系统预置模板标识，用户自建模板勿填 */
  presetId: z.string().optional(),
  sections: z.array(templateSectionItemSchema),
});

export type TemplateSectionItem = z.infer<typeof templateSectionItemSchema>;
export type TemplateStructure = z.infer<typeof templateStructureSchema>;

/** 当前仅支持 Markdown 导出 */
export const fileTypeSchema = z.literal("md");
export type ExportFileType = z.infer<typeof fileTypeSchema>;

export const EXPORT_FILE_TYPE: ExportFileType = "md";

export const DEFAULT_SECTIONS: TemplateSectionItem[] = [
  { id: "overview", title: "项目概述", enabled: true },
  { id: "users", title: "目标用户", enabled: true },
  { id: "value", title: "核心价值", enabled: true },
  { id: "features", title: "核心功能", enabled: true },
  { id: "tech", title: "技术设计", enabled: true },
  { id: "nfr", title: "非功能性需求", enabled: true },
];

export function defaultStructure(): TemplateStructure {
  return { sections: DEFAULT_SECTIONS.map((s) => ({ ...s })) };
}

export function parseTemplateStructure(raw: unknown): TemplateStructure {
  const r = templateStructureSchema.safeParse(raw);
  return r.success ? normalizeTemplateStructure(r.data) : defaultStructure();
}

export function isLockedSection(section: TemplateSectionItem): boolean {
  return section.locked === true;
}

/** 强制板块始终启用；丢弃无效 locked 标记 */
export function normalizeTemplateSections(
  sections: TemplateSectionItem[],
): TemplateSectionItem[] {
  return sections.map((s) =>
    isLockedSection(s) ? { ...s, enabled: true } : s,
  );
}

export function normalizeTemplateStructure(
  structure: TemplateStructure,
): TemplateStructure {
  return {
    ...structure,
    sections: normalizeTemplateSections(structure.sections),
  };
}

export function isCustomSectionId(id: string): boolean {
  return id.startsWith("custom-");
}

export function createCustomSection(title: string): TemplateSectionItem {
  const slug =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now());
  return {
    id: `custom-${slug}`,
    title: title.trim(),
    enabled: true,
  };
}

export function addSection(
  sections: TemplateSectionItem[],
  title: string,
): TemplateSectionItem[] {
  const t = title.trim();
  if (!t) return sections;
  return [...sections, createCustomSection(t)];
}

export function removeSection(
  sections: TemplateSectionItem[],
  id: string,
): TemplateSectionItem[] {
  if (sections.length <= 1) return sections;
  const target = sections.find((s) => s.id === id);
  if (target && isLockedSection(target)) return sections;
  return sections.filter((s) => s.id !== id);
}

export function updateSectionTitle(
  sections: TemplateSectionItem[],
  id: string,
  title: string,
): TemplateSectionItem[] {
  const t = title.trim();
  if (!t) return sections;
  return sections.map((s) => (s.id === id ? { ...s, title: t } : s));
}
