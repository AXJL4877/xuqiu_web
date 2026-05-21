import type { TemplateSectionItem, TemplateStructure } from "@/lib/template-types";

/** 系统预置模板标识，写入 Template.structure.presetId */
export const PRESET_FULLSTACK_CURSOR_ID = "fullstack-cursor";

export const PRESET_FULLSTACK_CURSOR_NAME =
  "全栈开发 (适合 Cursor/AI 编程)";

/** 面向 Cursor / AI 编程的 PRD 板块（全部强制启用） */
export function fullstackCursorSections(): TemplateSectionItem[] {
  return [
    {
      id: "core_constraints",
      title: "技术栈与全局规范",
      enabled: true,
      locked: true,
    },
    {
      id: "data_models",
      title: "核心数据结构 / TypeScript 契约",
      enabled: true,
      locked: true,
    },
    {
      id: "state_transitions",
      title: "状态机与核心交互流",
      enabled: true,
      locked: true,
    },
    {
      id: "edge_cases",
      title: "异常与断网处理",
      enabled: true,
      locked: true,
    },
    {
      id: "milestones",
      title: "阶段性开发指令",
      enabled: true,
      locked: true,
    },
  ];
}

export function fullstackCursorStructure(): TemplateStructure {
  return {
    presetId: PRESET_FULLSTACK_CURSOR_ID,
    sections: fullstackCursorSections(),
  };
}

export function isPresetTemplateStructure(
  structure: TemplateStructure,
): boolean {
  return Boolean(structure.presetId);
}

export function findFullstackCursorTemplate<
  T extends { structure: TemplateStructure },
>(templates: T[]): T | undefined {
  return templates.find(
    (t) => t.structure.presetId === PRESET_FULLSTACK_CURSOR_ID,
  );
}
