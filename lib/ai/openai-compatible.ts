import { createOpenAI } from "@ai-sdk/openai";
import type { FetchFunction } from "@ai-sdk/provider-utils";

import type { AiSettings } from "@/lib/ai/settings";

/** 是否为 DeepSeek 思考类模型（需 thinking 参数） */
export function isDeepSeekThinkingModel(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes("deepseek") &&
    (m.includes("flash") || m.includes("reasoner") || m.includes("v4"))
  );
}

/**
 * 处理 DeepSeek SSE。
 * @param includeReasoning 为 false 时丢弃 reasoning_content，避免思考过程写入 PRD 正文
 */
function transformDeepSeekSseStream(
  body: ReadableStream<Uint8Array>,
  includeReasoning: boolean,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        const out: string[] = [];
        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          const rewritten: string[] = [];
          for (const line of lines) {
            if (!line.startsWith("data: ")) {
              rewritten.push(line);
              continue;
            }
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") {
              rewritten.push(line);
              continue;
            }
            try {
              const json = JSON.parse(payload) as {
                choices?: Array<{
                  delta?: {
                    content?: string | null;
                    reasoning_content?: string | null;
                  };
                }>;
              };
              const delta = json.choices?.[0]?.delta;
              if (delta?.reasoning_content) {
                if (!includeReasoning) {
                  delete delta.reasoning_content;
                } else if (!delta.content) {
                  delta.content = delta.reasoning_content;
                }
              }
              const hasPayload =
                delta?.content != null && String(delta.content).length > 0;
              if (!includeReasoning && !hasPayload) {
                continue;
              }
              rewritten.push(`data: ${JSON.stringify(json)}`);
            } catch {
              rewritten.push(line);
            }
          }
          if (rewritten.length > 0) {
            out.push(rewritten.join("\n"));
          }
        }
        if (out.length > 0) {
          controller.enqueue(encoder.encode(`${out.join("\n\n")}\n\n`));
        }
      },
      flush(controller) {
        if (buffer.trim()) {
          controller.enqueue(encoder.encode(buffer));
        }
      },
    }),
  );
}

/** 注入 DeepSeek 官方 thinking / reasoning_effort 参数 */
function createOpenAiCompatibleFetch(
  disableThinking = false,
): FetchFunction {
  return async (input, init) => {
    let nextInit = init;

    if (
      !disableThinking &&
      init?.method === "POST" &&
      typeof init.body === "string"
    ) {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        const model =
          typeof body.model === "string" ? body.model : "";

        if (isDeepSeekThinkingModel(model)) {
          body.thinking = { type: "enabled" };
          if (body.reasoning_effort == null) {
            body.reasoning_effort = "high";
          }
          nextInit = { ...init, body: JSON.stringify(body) };
        }
      } catch {
        /* 非 JSON 请求体则原样转发 */
      }
    }

    const response = await fetch(input, nextInit);
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (
      response.ok &&
      response.body &&
      url.includes("/chat/completions")
    ) {
      return new Response(
        transformDeepSeekSseStream(response.body, !disableThinking),
        {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        },
      );
    }

    return response;
  };
}

export function createCompatibleOpenAI(
  ai: Pick<AiSettings, "apiKey" | "baseUrl">,
  options?: { disableThinking?: boolean },
) {
  return createOpenAI({
    apiKey: ai.apiKey,
    baseURL: ai.baseUrl,
    fetch: createOpenAiCompatibleFetch(options?.disableThinking),
  });
}
