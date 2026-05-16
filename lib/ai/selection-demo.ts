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
