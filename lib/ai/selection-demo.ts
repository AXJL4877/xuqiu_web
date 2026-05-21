import type { SelectionActionId } from "@/lib/ai/selection-prompt";

function textToStreamResponse(
  text: string,
  extraHeaders: Record<string, string>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const chunk = 32;
      for (let i = 0; i < text.length; i += chunk) {
        controller.enqueue(encoder.encode(text.slice(i, i + chunk)));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/** 演示模式下的本地改写（无大模型时） */
export function demoSelectionTransform(
  text: string,
  action: SelectionActionId,
  options?: { customPrompt?: string; question?: string },
): string {
  const trimmed = text.trim();
  if (!trimmed) return text;

  switch (action) {
    case "ask":
      return `（演示）**${trimmed.slice(0, 40)}${trimmed.length > 40 ? "…" : ""}**\n\n指需求/技术文档中的相关专有表述。配置 DeepSeek 后可获取准确名词解释。`;
    case "professional":
      return trimmed
        .replace(/很好/g, "符合预期")
        .replace(/大概/g, "预计")
        .replace(/做/g, "实现");
    case "expand":
      return `${trimmed}\n\n（演示扩写）可进一步细化验收标准、边界条件与异常流程。`;
    case "shorten": {
      const lines = trimmed.split("\n").filter(Boolean);
      if (lines.length <= 1) {
        return trimmed.length > 80
          ? `${trimmed.slice(0, 77)}…`
          : trimmed;
      }
      return lines.slice(0, Math.max(1, Math.ceil(lines.length / 2))).join("\n");
    }
    case "custom":
      return options?.customPrompt?.trim()
        ? `【按指令调整】${trimmed}`
        : trimmed;
    case "to_ts_interface":
      return `\`\`\`typescript
/** 演示：配置 DeepSeek 后生成真实契约 */
export interface DemoEntity {
  id: string;
  /** 由「${trimmed.slice(0, 24)}${trimmed.length > 24 ? "…" : ""}」提炼 */
  name: string;
  createdAt: string;
}
\`\`\``;
    case "add_edge_branches":
      return [
        `- **网络超时**：展示 Toast「请求超时」，保留表单输入，支持重试`,
        `- **校验失败**：字段下 inline 错误，禁用提交直至修正`,
        `- **权限不足**：跳转登录或 403 页，不泄露敏感信息`,
      ].join("\n");
    case "to_gherkin": {
      const snippet =
        trimmed.slice(0, 40) + (trimmed.length > 40 ? "…" : "");
      return [
        "### Scenario: 演示用例",
        "",
        "**Given** 用户已打开相关页面且输入合法",
        `**When** 用户执行：${snippet}`,
        "**Then** 系统按 PRD 完成主路径反馈",
        "**And** 失败时展示明确错误并可恢复",
      ].join("\n");
    }
    default:
      return trimmed;
  }
}

export function demoSelectionStreamResponse(
  text: string,
  action: SelectionActionId,
  options?: { customPrompt?: string; question?: string },
): Response {
  const result = demoSelectionTransform(text, action, options);
  return textToStreamResponse(result, { "X-Xuqiu-Mode": "demo" });
}
