import type { TemplateSectionItem } from "@/lib/template-types";

const DEMO_BY_ID: Record<string, string> = {
  core_constraints: [
    "- **技术栈**：Next.js App Router + TypeScript + Tailwind",
    "- **数据层**：PostgreSQL + Prisma，连接串使用环境变量",
    "- **规范**：组件放 `components/`，业务逻辑放 `lib/`；禁止 `any`",
    "- **鉴权**：本地单机模式使用固定用户，扩展时接入 Session",
  ].join("\n"),
  data_models: [
    "```typescript",
    "export interface Document {",
    "  id: string;",
    "  title: string;",
    "  content: string;",
    "  userId: string;",
    "  updatedAt: string;",
    "}",
    "```",
    "",
    "- 模板 `structure` 字段为 JSON，内含 `sections[]`",
  ].join("\n"),
  state_transitions: [
    "### 生成主流程",
    "- **idle** → 用户填写创意并「开始询问」→ **collecting**",
    "- **collecting** → 笔记板充分或结束询问 → **confirming**",
    "- **confirming** → 确认假设 → 分块流式生成 → **generated**",
  ].join("\n"),
  edge_cases: [
    "- **断网提交**：禁用按钮，Toast「网络异常」，保留表单",
    "- **未配置 AI**：返回演示块内容，提示配置 DeepSeek",
    "- **单块生成失败**：该节显示错误占位，不破坏整体骨架",
  ].join("\n"),
  milestones: [
    "### 阶段一（MVP）",
    "- 骨架静态渲染 + 单块流式 API",
    "- 验收：标题层级与模板配置逐字一致",
    "",
    "### 阶段二",
    "- 并行块生成与编辑器联动",
  ].join("\n"),
};

const DEMO_BY_TITLE: Record<string, string> = {
  项目概述:
    "- 基于用户创意生成结构化 PRD\n- 询问式收集 + 分块流式渲染",
  目标用户: "- 产品经理\n- 独立开发者\n- 需求分析师",
  核心价值:
    "- 提效：分块流式生成，结构稳定\n- 规范：模板固定标题，模型只填正文",
  核心功能:
    "- 询问式生成\n- 模板管理\n- 划词工程化助手\n- 分块 PRD 渲染",
  技术设计:
    "- `POST /api/ai/generate/skeleton` 静态骨架\n- `POST /api/ai/generate/block` 按节流式",
  非功能性需求:
    "- 性能：按块流式，首屏即时见骨架\n- 安全：创意不用于训练",
};

export function buildDemoBlockMarkdown(
  idea: string,
  section: TemplateSectionItem,
): string {
  const byId = DEMO_BY_ID[section.id];
  if (byId) return byId;

  const byTitle = DEMO_BY_TITLE[section.title];
  if (byTitle) return byTitle;

  const snippet = idea.trim().slice(0, 48);
  return `- （演示）围绕「${snippet || "项目"}」扩写 **${section.title}**\n- 配置 AI 后由模型根据笔记板生成`;
}
