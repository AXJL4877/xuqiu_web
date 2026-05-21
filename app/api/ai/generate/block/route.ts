import { streamText } from "ai";

import { resolveAiConfigForRequest } from "@/lib/ai/config";
import {
  buildBlockSystemPrompt,
  buildBlockUserPrompt,
  type BlockGenerateContext,
} from "@/lib/ai/block-prompt";
import { buildDemoBlockMarkdown } from "@/lib/ai/demo-block";
import { resolveNotebookForGenerate } from "@/lib/ai/generate-shared";
import {
  buildGoldenCoreConstraintsMarkdown,
  inferFullstackStructure,
  shouldLockCoreConstraintsBlock,
} from "@/lib/golden-stack";
import { createCompatibleOpenAI } from "@/lib/ai/openai-compatible";
import { createAiStreamTextResponse } from "@/lib/ai/stream-text-response";
import { generateBlockBodySchema } from "@/lib/schemas/api";

export const maxDuration = 90;

function demoBlockStream(sectionId: string, text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const chunk = 48;
      for (let i = 0; i < text.length; i += chunk) {
        controller.enqueue(encoder.encode(text.slice(i, i + chunk)));
        await new Promise((r) => setTimeout(r, 14));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Xuqiu-Mode": "demo",
      "X-Xuqiu-Block-Id": sectionId,
    },
  });
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = generateBlockBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    idea,
    sectionId,
    sections,
    acceptedAssumptions,
    gaps,
    completionStrategy,
    providerId,
    ai: aiInput,
  } = parsed.data;

  const section = sections.find((s) => s.id === sectionId && s.enabled);
  if (!section) {
    return Response.json({ error: "未找到启用的板块" }, { status: 400 });
  }

  const notebook = await resolveNotebookForGenerate(parsed.data);

  const structure = inferFullstackStructure(sections);

  if (
    sectionId === "core_constraints" &&
    shouldLockCoreConstraintsBlock(idea, structure)
  ) {
    const body = buildGoldenCoreConstraintsMarkdown();
    return demoBlockStream(sectionId, body);
  }

  const ctx: BlockGenerateContext = {
    idea,
    section,
    sections,
    notebook,
    acceptedAssumptions,
    gaps,
    completionStrategy,
  };

  const ai = await resolveAiConfigForRequest(aiInput, providerId);

  if (!ai) {
    const demo = buildDemoBlockMarkdown(idea, section);
    return demoBlockStream(sectionId, demo);
  }

  // 板块正文须直接可渲染：禁止注入 thinking，且不转发 reasoning_content
  const provider = createCompatibleOpenAI(ai, { disableThinking: true });

  try {
    const result = streamText({
      model: provider.chat(ai.model),
      system: buildBlockSystemPrompt(section),
      prompt: buildBlockUserPrompt(ctx),
    });

    return createAiStreamTextResponse(result, {
      failurePrefix: "【生成失败】",
      headers: {
        "X-Xuqiu-Mode": "live",
        "X-Xuqiu-Block-Id": sectionId,
      },
      logTag: "ai/generate/block",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "模型调用失败";
    console.error("[ai/generate/block]", e);
    return Response.json({ error: message }, { status: 502 });
  }
}
