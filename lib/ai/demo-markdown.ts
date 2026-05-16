import type { TemplateSectionItem } from "@/lib/template-types";

const sectionBody: Record<string, string> = {
  项目概述:
    "- 背景：基于用户一句话创意快速形成初稿。\n- 范围：本稿为演示模式占位，配置 AI 后由大模型按创意扩写。",
  目标用户: "- 产品经理、独立开发者、需求分析师。",
  核心价值: "- 提效：一句话生成结构化 PRD 初稿。\n- 降本：划词 AI 辅助（后续迭代）。\n- 规范：模板引擎统一输出结构。",
  核心功能:
    "- AI 极速生成、模板管理、划词助手、智能编辑器、工作台与检索（按 PRD 分阶段落地）。",
  技术设计:
    "- 文档生成采用流式输出，减少等待焦虑。\n- 数据本地持久化，支持模板与文档管理。\n- 预览区支持手动编辑与 Markdown 导出。",
  非功能性需求:
    "- 性能：AI 输出采用流式响应。\n- 安全：用户创意不用于模型训练（产品声明）。\n- 适配：工作台多端，编辑器优先 PC。",
};

export function buildDemoMarkdown(
  idea: string,
  enabled: TemplateSectionItem[],
): string {
  const lines: string[] = [];
  let ideaPlaced = false;

  for (const s of enabled) {
    if (!s.enabled) continue;
    lines.push(`## ${s.title}`, "");
    if (s.id === "overview" && !ideaPlaced) {
      lines.push(
        sectionBody[s.title] ?? "- （占位）",
        "",
        `- 创意输入：${idea.trim()}`,
        "",
      );
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
