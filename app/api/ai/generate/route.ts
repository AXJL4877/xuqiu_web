import { streamText } from "ai";

import { resolveAiConfigForRequest } from "@/lib/ai/config";
import { buildPrdSystemPrompt, buildPrdUserPrompt } from "@/lib/ai/prd-prompt";
import { demoPrdStreamResponse } from "@/lib/ai/demo-stream";
import {
  createCompatibleOpenAI,
  isDeepSeekThinkingModel,
} from "@/lib/ai/openai-compatible";
import { createAiStreamTextResponse } from "@/lib/ai/stream-text-response";
import { generateBodySchema } from "@/lib/schemas/api";

export const maxDuration = 120;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = generateBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { idea, sections, ai: aiInput } = parsed.data;
  const enabled = sections.filter((s) => s.enabled);
  if (enabled.length === 0) {
    return Response.json({ error: "至少启用一个文档板块" }, { status: 400 });
  }

  const ai = await resolveAiConfigForRequest(aiInput);
  if (!ai) {
    return demoPrdStreamResponse(idea, sections);
  }

  const provider = createCompatibleOpenAI(ai);

  try {
    const result = streamText({
      // 兼容网关仅支持 Chat Completions；DeepSeek 思考模型自动注入 thinking 参数
      model: provider.chat(ai.model),
      system: buildPrdSystemPrompt(enabled),
      prompt: buildPrdUserPrompt(idea),
      ...(isDeepSeekThinkingModel(ai.model)
        ? {
            providerOptions: {
              openai: { reasoningEffort: "high" as const },
            },
          }
        : {}),
    });

    return createAiStreamTextResponse(result, {
      failurePrefix:
        "【生成失败】",
      headers: { "X-Xuqiu-Mode": "live" },
      logTag: "ai/generate",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "模型调用失败";
    console.error("[ai/generate]", e);
    return Response.json({ error: message }, { status: 502 });
  }
}
