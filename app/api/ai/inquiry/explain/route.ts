import { streamText } from "ai";

import { resolveAiConfigForRequest } from "@/lib/ai/config";
import { createCompatibleOpenAI } from "@/lib/ai/openai-compatible";
import { createAiStreamTextResponse } from "@/lib/ai/stream-text-response";
import { demoInquiryExplainStreamResponse } from "@/lib/inquiry/explain-demo";
import {
  buildInquiryExplainSystemPrompt,
  buildInquiryExplainUserPrompt,
  type InquiryExplainContext,
} from "@/lib/inquiry/explain-prompt";
import { inquiryExplainBodySchema } from "@/lib/schemas/api";

export const maxDuration = 45;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = inquiryExplainBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    term,
    idea,
    questionStem,
    questionWhy,
    sectionTitle,
    options,
    providerId,
    ai: aiInput,
  } = parsed.data;

  const ctx: InquiryExplainContext = {
    idea,
    questionStem,
    questionWhy,
    sectionTitle,
    options,
  };

  const ai = await resolveAiConfigForRequest(aiInput, providerId);
  if (!ai) {
    return demoInquiryExplainStreamResponse(term, ctx);
  }

  const provider = createCompatibleOpenAI(ai, { disableThinking: true });

  try {
    const result = streamText({
      model: provider.chat(ai.model),
      system: buildInquiryExplainSystemPrompt(),
      prompt: buildInquiryExplainUserPrompt(term, ctx),
      maxOutputTokens: 400,
    });

    return createAiStreamTextResponse(result, {
      failurePrefix: "【解释失败】",
      headers: { "X-Xuqiu-Mode": "live" },
      logTag: "ai/inquiry/explain",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "名词解释失败";
    console.error("[ai/inquiry/explain]", e);
    return Response.json({ error: message }, { status: 502 });
  }
}
