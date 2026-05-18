import { streamText } from "ai";

import { resolveAiConfigForRequest } from "@/lib/ai/config";
import { buildPrdSystemPrompt, buildPrdUserPrompt } from "@/lib/ai/prd-prompt";
import { buildGenerationUserPrompt } from "@/lib/inquiry/build-generation-prompt";
import { findInquirySessionById } from "@/lib/inquiry/inquiry-session-db";
import type { InquiryNotebook } from "@/lib/inquiry/types";
import { demoPrdStreamResponse } from "@/lib/ai/demo-stream";
import { getLocalUserId } from "@/lib/local-user";
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

  const {
    idea,
    sections,
    inquirySessionId,
    notebook: notebookInput,
    acceptedAssumptions,
    gaps,
    completionStrategy,
    ai: aiInput,
  } = parsed.data;
  const enabled = sections.filter((s) => s.enabled);
  if (enabled.length === 0) {
    return Response.json({ error: "至少启用一个文档板块" }, { status: 400 });
  }

  let notebook: InquiryNotebook | undefined = notebookInput;
  if (inquirySessionId && (!notebook || notebook.entries.length === 0)) {
    try {
      const userId = await getLocalUserId();
      const row = await findInquirySessionById(userId, inquirySessionId);
      if (row?.notebook) {
        notebook = row.notebook as InquiryNotebook;
      }
    } catch (e) {
      console.warn("[ai/generate] load session notebook failed", e);
    }
  }

  const ai = await resolveAiConfigForRequest(aiInput);

  const hasInquiryNotebook =
    notebook != null && notebook.entries.length > 0;

  const userPrompt =
    hasInquiryNotebook && notebook
      ? buildGenerationUserPrompt({
          idea,
          notebook,
          acceptedAssumptions: acceptedAssumptions ?? [],
          gaps: gaps ?? [],
          completionStrategy: completionStrategy ?? "standard",
        })
      : buildPrdUserPrompt(idea);

  if (!ai) {
    return demoPrdStreamResponse(userPrompt, sections);
  }

  const provider = createCompatibleOpenAI(ai);

  try {
    const result = streamText({
      // 兼容网关仅支持 Chat Completions；DeepSeek 思考模型自动注入 thinking 参数
      model: provider.chat(ai.model),
      system: buildPrdSystemPrompt(enabled),
      prompt: buildPrdUserPrompt(userPrompt),
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
