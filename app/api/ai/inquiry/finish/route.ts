import { resolveAiConfigForRequest } from "@/lib/ai/config";
import { processInquiryFinish } from "@/lib/inquiry/finish-engine";
import { inquiryFinishBodySchema } from "@/lib/schemas/api";

export const maxDuration = 90;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = inquiryFinishBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { idea, sections, notebook, session, ai: aiInput, providerId } =
    parsed.data;

  const ai = await resolveAiConfigForRequest(aiInput, providerId);

  try {
    const result = await processInquiryFinish(
      idea,
      sections,
      notebook,
      session ?? null,
      ai,
    );
    return Response.json(result, {
      headers: { "X-Xuqiu-Mode": result.mode },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成确认数据失败";
    console.error("[ai/inquiry/finish]", e);
    return Response.json({ error: message }, { status: 502 });
  }
}
