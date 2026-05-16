import { buildDemoMarkdown } from "@/lib/ai/demo-markdown";
import type { TemplateSectionItem } from "@/lib/template-types";

function textToStreamResponse(
  text: string,
  extraHeaders: Record<string, string>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const chunk = 64;
      for (let i = 0; i < text.length; i += chunk) {
        controller.enqueue(encoder.encode(text.slice(i, i + chunk)));
        await new Promise((r) => setTimeout(r, 18));
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

export function demoPrdStreamResponse(
  idea: string,
  sections: TemplateSectionItem[],
): Response {
  const enabled = sections.filter((s) => s.enabled);
  const md = buildDemoMarkdown(idea, enabled);
  return textToStreamResponse(md, { "X-Xuqiu-Mode": "demo" });
}
