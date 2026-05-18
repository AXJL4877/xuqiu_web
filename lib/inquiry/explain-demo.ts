import type { InquiryExplainContext } from "@/lib/inquiry/explain-prompt";

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

export function demoInquiryExplainText(
  term: string,
  ctx: InquiryExplainContext,
): string {
  const t = term.trim();
  const stemRaw = ctx.questionStem?.trim() ?? "";
  const stemHint = stemRaw.slice(0, 48);
  const section = ctx.sectionTitle?.trim();

  const lines = [
    `**${t}**`,
    "",
    `（演示模式）在本题${stemHint ? `「${stemHint}${stemRaw.length > 48 ? "…" : ""}」` : ""}语境下，通常指与当前项目需求相关的常用表述。`,
  ];

  if (section) {
    lines.push(`- 关联板块：${section}`);
  }
  lines.push(
    "- 配置大模型 API 后，将结合你的项目创意与题目上下文给出更准确的释义。",
  );

  return lines.join("\n");
}

export function demoInquiryExplainStreamResponse(
  term: string,
  ctx: InquiryExplainContext,
): Response {
  return textToStreamResponse(demoInquiryExplainText(term, ctx), {
    "X-Xuqiu-Mode": "demo",
  });
}
