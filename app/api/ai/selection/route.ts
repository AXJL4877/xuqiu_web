import { streamText } from "ai";

import { resolveAiConfigForRequest } from "@/lib/ai/config";
import { createCompatibleOpenAI } from "@/lib/ai/openai-compatible";
import { demoSelectionStreamResponse } from "@/lib/ai/selection-demo";
import { createAiStreamTextResponse } from "@/lib/ai/stream-text-response";
import {
  buildSelectionSystemPrompt,
  buildSelectionUserPrompt,
  type SelectionActionId,
} from "@/lib/ai/selection-prompt";
import { selectionBodySchema } from "@/lib/schemas/api";

export const maxDuration = 60;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = selectionBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    text,
    action,
    customPrompt,
    question,
    context,
    providerId,
    ai: aiInput,
  } = parsed.data;
  const ai = await resolveAiConfigForRequest(aiInput, providerId);

  if (!ai) {
    return demoSelectionStreamResponse(text, action as SelectionActionId, {
      customPrompt,
      question,
    });
  }

  const provider = createCompatibleOpenAI(ai, { disableThinking: true });

  try {
    const actionId = action as SelectionActionId;
    const result = streamText({
      model: provider.chat(ai.model),
      system: buildSelectionSystemPrompt(actionId),
      prompt: buildSelectionUserPrompt(text, actionId, {
        customPrompt,
        question,
        context,
      }),
    });

    return createAiStreamTextResponse(result, {
      failurePrefix: "【改写失败】",
      headers: { "X-Xuqiu-Mode": "live" },
      logTag: "ai/selection",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "模型调用失败";
    console.error("[ai/selection]", e);
    return Response.json({ error: message }, { status: 502 });
  }
}
