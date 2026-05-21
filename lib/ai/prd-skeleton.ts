import {
  buildDocumentHeader,
  buildStaticBlocksForGenerate,
  resolveTechStackPolicy,
  type TechStackPolicy,
} from "@/lib/golden-stack";
import { PRESET_FULLSTACK_CURSOR_ID } from "@/lib/preset-templates";
import type { TemplateSectionItem, TemplateStructure } from "@/lib/template-types";

export type PrdSkeletonBlock = {
  sectionId: string;
  title: string;
  /** 插在 ## 标题下的静态提示（blockquote），不由模型生成 */
  preamble: string | null;
  /** 初始占位文案 */
  placeholder: string;
};

export type PrdSkeleton = {
  projectTitle: string;
  /** # 标题下、## 板块前的静态技术栈声明 */
  documentHeader: string | null;
  techStackPolicy: TechStackPolicy;
  blocks: PrdSkeletonBlock[];
  /** 系统预置、不经 AI 生成的板块正文 */
  staticBlocks: Record<string, string>;
  /** 带占位符的完整骨架（用于首屏展示） */
  markdown: string;
};

const BLOCK_PLACEHOLDER = "（本节内容由 AI 生成中…）";

/** 全栈模板：章节前置静态说明 */
const FULLSTACK_PREAMBLES: Record<string, string> = {
  core_constraints:
    "> **工程约束**：主栈已由系统锁定为黄金全栈；本节列出目录、环境与 Agent 执行要求。",
  data_models:
    "> **数据契约**：以下为可直接粘贴实现的类型定义与 API 形状，禁止空泛描述。",
  state_transitions:
    "> **交互状态机**：须明确状态名、触发条件、守卫与副作用，覆盖主路径与回退。",
  edge_cases:
    "> **边界处理**：每条须包含用户可见反馈与可恢复策略，供实现与测试对照。",
  milestones:
    "> **分阶段交付**：各阶段须可独立验收，任务粒度适合 Cursor 分步实现。",
};

const LEGACY_PREAMBLES: Record<string, string> = {
  overview: "> 本章节描述产品背景、范围与成功标准。",
  tech: "> 本章节为技术选型与架构约束，须与实现保持一致。",
  nfr: "> 本章节为非功能性需求，影响排期与架构决策。",
};

function suggestProjectTitle(idea: string): string {
  const t = idea.trim().split(/\n/)[0]?.trim() ?? "";
  if (!t) return "需求文档";
  const cleaned = t.replace(/^#+\s*/, "").slice(0, 60);
  return cleaned || "需求文档";
}

function preambleForSection(
  section: TemplateSectionItem,
  structure?: TemplateStructure | null,
): string | null {
  if (structure?.presetId === PRESET_FULLSTACK_CURSOR_ID) {
    return FULLSTACK_PREAMBLES[section.id] ?? null;
  }
  return LEGACY_PREAMBLES[section.id] ?? null;
}

export function buildPrdSkeleton(
  idea: string,
  sections: TemplateSectionItem[],
  structure?: TemplateStructure | null,
): PrdSkeleton {
  const enabled = sections.filter((s) => s.enabled);
  const projectTitle = suggestProjectTitle(idea);
  const techStackPolicy = resolveTechStackPolicy(idea);
  const documentHeader = buildDocumentHeader(idea, structure);
  const staticBlocks = buildStaticBlocksForGenerate(idea, structure);

  const blocks: PrdSkeletonBlock[] = enabled.map((s) => ({
    sectionId: s.id,
    title: s.title,
    preamble: preambleForSection(s, structure),
    placeholder: staticBlocks[s.id] ?? BLOCK_PLACEHOLDER,
  }));

  const lines: string[] = [`# ${projectTitle}`, ""];
  if (documentHeader) {
    lines.push(documentHeader, "");
  }

  for (const block of blocks) {
    lines.push(`## ${block.title}`, "");
    if (block.preamble) {
      lines.push(block.preamble, "");
    }
    lines.push(staticBlocks[block.sectionId] ?? block.placeholder, "");
  }

  return {
    projectTitle,
    documentHeader,
    techStackPolicy,
    blocks,
    staticBlocks,
    markdown: lines.join("\n").trimEnd() + "\n",
  };
}

/** 将各板块流式内容拼装为完整 PRD Markdown */
export function assemblePrdMarkdown(
  skeleton: PrdSkeleton,
  blockContents: Record<string, string>,
): string {
  const lines: string[] = [`# ${skeleton.projectTitle}`, ""];
  if (skeleton.documentHeader) {
    lines.push(skeleton.documentHeader, "");
  }

  for (const block of skeleton.blocks) {
    const body =
      blockContents[block.sectionId]?.trim() || block.placeholder;
    lines.push(`## ${block.title}`, "");
    if (block.preamble) {
      lines.push(block.preamble, "");
    }
    lines.push(body, "");
  }

  return lines.join("\n").trimEnd() + "\n";
}
