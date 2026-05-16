import type { TemplateSectionItem } from "@/lib/template-types";

const sectionBody: Record<string, string> = {
  项目概述:
    "### 背景\n- 基于用户一句话创意快速形成初稿。\n\n### 范围\n- 本稿为演示模式占位，配置 AI 后由大模型按创意扩写。",
  目标用户:
    "### 主要用户\n- 产品经理\n- 独立开发者\n- 需求分析师",
  核心价值:
    "### 价值主张\n- 提效：一句话生成结构化 PRD 初稿\n- 降本：划词 AI 辅助编辑\n- 规范：模板引擎统一输出结构",
  核心功能:
    "### 功能范围\n- AI 极速生成\n- 模板管理\n- 划词助手\n- 智能编辑器\n- 工作台与检索",
  技术设计:
    "### 实现要点\n- 文档生成采用流式输出\n- 数据本地持久化\n- 预览区支持编辑与 Markdown 导出",
  非功能性需求:
    "### 质量属性\n- 性能：AI 流式响应\n- 安全：用户创意不用于模型训练\n- 适配：工作台多端，编辑器优先 PC",
};

export function buildDemoMarkdown(
  idea: string,
  enabled: TemplateSectionItem[],
): string {
  const lines: string[] = [`# ${idea.trim() || "需求文档"}`, ""];
  let ideaPlaced = false;

  for (const s of enabled) {
    if (!s.enabled) continue;
    lines.push(`## ${s.title}`, "");
    if (s.id === "overview" && !ideaPlaced) {
      lines.push(sectionBody[s.title] ?? "- （占位）", "");
      ideaPlaced = true;
    } else {
      lines.push(
        sectionBody[s.title] ?? "- （此板块占位，接入模型后将自动扩写。）",
        "",
      );
    }
  }

  return lines.join("\n").trimStart();
}
